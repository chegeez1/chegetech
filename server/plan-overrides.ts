import { dbSettingsGet, dbSettingsSet } from "./storage";

const OVERRIDES_KEY = "plan_overrides";
const CUSTOM_PLANS_KEY = "custom_plans";

export interface PlanOverride {
  priceOverride?: number;
  disabled?: boolean;
  offerLabel?: string;
  originalPrice?: number;
}

export interface CustomPlan {
  id: string;
  name: string;
  price: number;
  duration: string;
  features: string[];
  categoryKey: string;
  categoryName: string;
  maxUsers: number;
  clientId?: string;
  clientSecret?: string;
  serviceUrl?: string;
  createdAt: string;
}

export class PlanOverridesManager {
  private overrides: Record<string, PlanOverride>;
  private customPlans: CustomPlan[];

  constructor() {
    this.overrides = {};
    this.customPlans = [];
  }

  private load(): void {
    try {
      const raw = dbSettingsGet(OVERRIDES_KEY);
      if (raw) this.overrides = JSON.parse(raw);
      else this.overrides = {};
    } catch { this.overrides = {}; }
    try {
      const raw = dbSettingsGet(CUSTOM_PLANS_KEY);
      if (raw) this.customPlans = JSON.parse(raw);
      else this.customPlans = [];
    } catch { this.customPlans = []; }
  }

  private saveOverrides(): void {
    dbSettingsSet(OVERRIDES_KEY, JSON.stringify(this.overrides));
  }

  private saveCustomPlans(): void {
    dbSettingsSet(CUSTOM_PLANS_KEY, JSON.stringify(this.customPlans));
  }

  getOverrides(): Record<string, PlanOverride> {
    this.load();
    return this.overrides;
  }

  getOverride(planId: string): PlanOverride | undefined {
    this.load();
    return this.overrides[planId];
  }

  setOverride(planId: string, data: PlanOverride): void {
    this.load();
    this.overrides[planId] = { ...this.overrides[planId], ...data };
    this.saveOverrides();
  }

  deleteOverride(planId: string): void {
    this.load();
    delete this.overrides[planId];
    this.saveOverrides();
  }

  getCustomPlans(): CustomPlan[] {
    this.load();
    return this.customPlans;
  }

  addCustomPlan(data: Omit<CustomPlan, "id" | "createdAt">): CustomPlan {
    this.load();
    const plan: CustomPlan = {
      ...data,
      id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    this.customPlans.push(plan);
    this.saveCustomPlans();
    return plan;
  }

  updateCustomPlan(id: string, data: Partial<CustomPlan>): CustomPlan | null {
    this.load();
    const idx = this.customPlans.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    this.customPlans[idx] = { ...this.customPlans[idx], ...data };
    this.saveCustomPlans();
    return this.customPlans[idx];
  }

  deleteCustomPlan(id: string): boolean {
    this.load();
    const idx = this.customPlans.findIndex((p) => p.id === id);
    if (idx === -1) return false;
    this.customPlans.splice(idx, 1);
    this.saveCustomPlans();
    return true;
  }
}

export const planOverridesManager = new PlanOverridesManager();
