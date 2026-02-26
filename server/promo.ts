import { dbSettingsGet, dbSettingsSet } from "./storage";

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

  validate(code: string, planId?: string): { valid: boolean; error?: string; promo?: PromoCode } {
    this.load();
    const promo = this.codes.find((c) => c.code.toUpperCase() === code.toUpperCase());
    if (!promo) return { valid: false, error: "Invalid promo code" };
    if (!promo.active) return { valid: false, error: "This promo code is inactive" };
    if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
      return { valid: false, error: "This promo code has expired" };
    }
    if (promo.maxUses !== null && promo.uses >= promo.maxUses) {
      return { valid: false, error: "This promo code has reached its usage limit" };
    }
    if (promo.applicablePlans && promo.applicablePlans.length > 0 && planId) {
      if (!promo.applicablePlans.includes(planId)) {
        return { valid: false, error: "This promo code is not valid for this plan" };
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
      ...data,
      code: data.code.toUpperCase(),
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
