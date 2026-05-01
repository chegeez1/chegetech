import { dbSettingsGet, dbSettingsSet } from "./storage";
import { subscriptionPlans } from "./plans";

// Build a flat map of planId → plan name for error messages
function getPlanName(planId: string): string {
  for (const cat of Object.values(subscriptionPlans)) {
    if (cat.plans && planId in cat.plans) {
      return (cat.plans as any)[planId].name;
    }
  }
  return planId;
}

const SETTINGS_KEY = "promo_codes";

export interface PromoCode {
  code: string;
  label: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  maxUses: number | null;
  uses: number;
  expiresAt: string | null;
  active: boolean;
  applicablePlans: string[] | null;
  applicableTo: "subscriptions" | "bots" | "all";
  createdAt: string;
}

export class PromoManager {
  private codes: PromoCode[];

  constructor() {
    this.codes = [];
  }

  private load(): void {
    try {
      const raw = dbSettingsGet(SETTINGS_KEY);
      if (raw) {
        this.codes = JSON.parse(raw);
      } else {
        this.codes = [];
      }
    } catch {
      this.codes = [];
    }
  }

  private save(): void {
    dbSettingsSet(SETTINGS_KEY, JSON.stringify(this.codes));
  }

  getAll(): PromoCode[] {
    this.load();
    return this.codes;
  }

  getCode(code: string): PromoCode | undefined {
    this.load();
    return this.codes.find((c) => c.code.toUpperCase() === code.toUpperCase());
  }

  validate(code: string, planId?: string, context?: "subscription" | "bot"): { valid: boolean; error?: string; promo?: PromoCode } {
    this.load();
    const promo = this.codes.find((c) => c.code.toUpperCase() === code.toUpperCase());
    if (!promo) return { valid: false, error: "Invalid promo code" };
    if (promo.active === false) return { valid: false, error: "This promo code is inactive" };
    if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
      return { valid: false, error: "This promo code has expired" };
    }
    if (promo.maxUses !== null && promo.uses >= promo.maxUses) {
      return { valid: false, error: "This promo code has reached its usage limit" };
    }
    // Check applicableTo restriction
    const applicableTo = promo.applicableTo || "all";
    if (applicableTo === "bots" && context !== "bot") {
      return { valid: false, error: "This promo code is only valid for bot deployments" };
    }
    if (applicableTo === "subscriptions" && context === "bot") {
      return { valid: false, error: "This promo code is not valid for bot deployments" };
    }
    if (promo.applicablePlans && promo.applicablePlans.length > 0) {
      if (planId && !promo.applicablePlans.includes(planId)) {
        const names = promo.applicablePlans.map(getPlanName).join(", ");
        return { valid: false, error: `This promo code is only valid for: ${names}` };
      }
    }
    return { valid: true, promo };
  }

  use(code: string): void {
    this.load();
    const promo = this.codes.find((c) => c.code.toUpperCase() === code.toUpperCase());
    if (promo) {
      promo.uses++;
      this.save();
    }
  }

  create(data: Omit<PromoCode, "uses" | "createdAt">): PromoCode {
    this.load();
    const existing = this.codes.find((c) => c.code.toUpperCase() === data.code.toUpperCase());
    if (existing) throw new Error("Promo code already exists");

    const promo: PromoCode = {
      active: true,           // always active by default
      ...data,
      code: data.code.toUpperCase(),
      applicableTo: data.applicableTo || "all",
      uses: 0,
      createdAt: new Date().toISOString(),
    };
    this.codes.push(promo);
    this.save();
    return promo;
  }

  update(code: string, data: Partial<PromoCode>): PromoCode | null {
    this.load();
    const idx = this.codes.findIndex((c) => c.code.toUpperCase() === code.toUpperCase());
    if (idx === -1) return null;
    this.codes[idx] = { ...this.codes[idx], ...data };
    this.save();
    return this.codes[idx];
  }

  delete(code: string): boolean {
    this.load();
    const idx = this.codes.findIndex((c) => c.code.toUpperCase() === code.toUpperCase());
    if (idx === -1) return false;
    this.codes.splice(idx, 1);
    this.save();
    return true;
  }
}

export const promoManager = new PromoManager();
