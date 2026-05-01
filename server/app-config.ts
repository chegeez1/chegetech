import { dbSettingsGet, dbSettingsSet } from "./storage";

const SETTINGS_KEY = "app_config";

export interface AppConfig {
  siteName: string;
  whatsappNumber: string;
  whatsappChannel: string;
  supportEmail: string;
  customDomain: string;
  appDomain: string;
  chatAssistantEnabled: boolean;
}

const DEFAULTS: AppConfig = {
  siteName: process.env.SITE_NAME || "Chege Tech",
  whatsappNumber: process.env.WHATSAPP_NUMBER || "+254114291301",
  whatsappChannel: process.env.WHATSAPP_CHANNEL || "https://whatsapp.com/channel/0029VbBx7NeDp2QGF7qoZ02A",
  supportEmail: process.env.SUPPORT_EMAIL || "",
  customDomain: process.env.CUSTOM_DOMAIN || "",
  appDomain: process.env.APP_DOMAIN || process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(",")[0] || "",
  chatAssistantEnabled: true,
};

export function getAppConfig(): AppConfig {
  try {
    const raw = dbSettingsGet(SETTINGS_KEY);
    if (raw) {
      return { ...DEFAULTS, ...JSON.parse(raw) };
    }
  } catch {}
  return { ...DEFAULTS };
}

export function saveAppConfig(config: Partial<AppConfig>): AppConfig {
  const current = getAppConfig();
  const updated = { ...current, ...config };
  dbSettingsSet(SETTINGS_KEY, JSON.stringify(updated));
  return updated;
}
