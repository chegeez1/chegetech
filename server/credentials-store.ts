import { dbSettingsGet, dbSettingsSet } from "./storage";

const SETTINGS_KEY = "credentials";

export interface CredentialsOverride {
  paystackPublicKey?: string;
  paystackSecretKey?: string;
  emailUser?: string;
  emailPass?: string;
  adminEmail?: string;
  adminPassword?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
  whatsappAccessToken?: string;
  whatsappPhoneId?: string;
  whatsappVerifyToken?: string;
  whatsappAdminPhone?: string;
  openaiApiKey?: string;
}

export function getCredentialsOverride(): CredentialsOverride {
  try {
    const raw = dbSettingsGet(SETTINGS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return {};
}

export function saveCredentialsOverride(data: CredentialsOverride): CredentialsOverride {
  let current: CredentialsOverride = {};
  try {
    const raw = dbSettingsGet(SETTINGS_KEY);
    if (raw) current = JSON.parse(raw);
  } catch {}
  const updated = { ...current };
  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined && val !== null) {
      (updated as any)[key] = val === "" ? undefined : val;
    }
  }
  for (const key of Object.keys(updated)) {
    if ((updated as any)[key] === undefined) delete (updated as any)[key];
  }
  dbSettingsSet(SETTINGS_KEY, JSON.stringify(updated));
  return updated;
}
