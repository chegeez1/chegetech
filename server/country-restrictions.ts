import { dbSettingsGet, dbSettingsSet } from "./storage";

const SETTINGS_KEY = "country_restrictions";

export interface CountryRestriction {
  mode: "whitelist" | "blacklist";
  countries: string[];
  updatedAt: string;
}

const DEFAULT: CountryRestriction = {
  mode: "blacklist",
  countries: [],
  updatedAt: new Date().toISOString(),
};

export class CountryRestrictionManager {
  private cache: CountryRestriction | null = null;

  private load(): CountryRestriction {
    try {
      const raw = dbSettingsGet(SETTINGS_KEY);
      return raw ? JSON.parse(raw) : { ...DEFAULT };
    } catch {
      return { ...DEFAULT };
    }
  }

  private save(data: CountryRestriction): void {
    this.cache = data;
    dbSettingsSet(SETTINGS_KEY, JSON.stringify(data));
  }

  get(): CountryRestriction {
    if (this.cache) return this.cache;
    this.cache = this.load();
    return this.cache;
  }

  setMode(mode: "whitelist" | "blacklist"): void {
    const current = this.get();
    this.save({ ...current, mode, updatedAt: new Date().toISOString() });
  }

  addCountry(code: string): void {
    const current = this.get();
    const upper = code.toUpperCase();
    if (!current.countries.includes(upper)) {
      current.countries.push(upper);
      this.save({ ...current, updatedAt: new Date().toISOString() });
    }
  }

  removeCountry(code: string): void {
    const current = this.get();
    const upper = code.toUpperCase();
    current.countries = current.countries.filter((c) => c !== upper);
    this.save({ ...current, updatedAt: new Date().toISOString() });
  }

  setCountries(codes: string[]): void {
    const current = this.get();
    this.save({ ...current, countries: codes.map((c) => c.toUpperCase()), updatedAt: new Date().toISOString() });
  }

  isBlocked(countryCode: string | null | undefined): boolean {
    if (!countryCode) return false;
    const { mode, countries } = this.get();
    const upper = countryCode.toUpperCase();
    if (mode === "blacklist") {
      return countries.includes(upper);
    } else {
      return countries.length > 0 && !countries.includes(upper);
    }
  }
}

export const countryRestrictions = new CountryRestrictionManager();
