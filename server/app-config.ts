import { dbSettingsGet, dbSettingsSet } from "./storage";

const SETTINGS_KEY = "app_config";

export interface AppConfig {
  siteName: string;
  whatsappNumber: string;
  whatsappChannel: string;
  supportEmail: string;
  customDomain: string;
  chatAssistantEnabled: boolean;
}

const DEFAULTS: AppConfig = {
  siteName: "Chege Tech",
  whatsappNumber: "+254114291301",
  whatsappChannel: "https://whatsapp.com/channel/0029VbBx7NeDp2QGF7qoZ02A",
  supportEmail: "",
  customDomain: "",
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
