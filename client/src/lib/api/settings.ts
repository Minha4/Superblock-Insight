export interface ProfileSettings {
  fullName: string;
  displayName: string;
  email: string;
  phone: string;
  timezone: string;
}

export interface NotificationSettings {
  renewalAlerts: boolean;
  billingExceptions: boolean;
  usageAnomalies: boolean;
  productUpdates: boolean;
}

export interface SecuritySettings {
  twoFactorEnabled: boolean;
  loginAlerts: boolean;
  sessionTimeoutHours: string;
  activeSessions: {
    id: string;
    device: string;
    location: string;
    lastActive: string;
    isCurrent: boolean;
  }[];
}

export interface ApiKeyRecord {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  expiresAt: string;
}

export interface AppSettings {
  profile: ProfileSettings;
  notifications: NotificationSettings;
  security: SecuritySettings;
  apiKeys: ApiKeyRecord[];
  workspaceName: string;
}

const STORAGE_KEY = "sb_user_settings";

const defaultSettings: AppSettings = {
  profile: {
    fullName: "",
    displayName: "",
    email: "",
    phone: "",
    timezone: "utc",
  },
  notifications: {
    renewalAlerts: true,
    billingExceptions: true,
    usageAnomalies: true,
    productUpdates: false,
  },
  security: {
    twoFactorEnabled: false,
    loginAlerts: false,
    sessionTimeoutHours: "8",
    activeSessions: [],
  },
  apiKeys: [],
  workspaceName: "Superblock Workspace",
};

export function loadLocalSettings(): AppSettings {
  if (typeof window === "undefined") return defaultSettings;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultSettings));
      return defaultSettings;
    }
    const parsed = JSON.parse(raw);
    if (parsed.profile?.fullName === "Anika Shah") {
      parsed.profile.fullName = "";
      parsed.profile.displayName = "";
      parsed.profile.email = "";
      parsed.profile.phone = "";
    }
    if (Array.isArray(parsed.security?.activeSessions)) {
      parsed.security.activeSessions = parsed.security.activeSessions.filter(
        (s: any) => s.id !== "sess-1" && s.id !== "sess-2"
      );
    }
    if (Array.isArray(parsed.apiKeys)) {
      parsed.apiKeys = parsed.apiKeys.filter((k: any) => k.id !== "key-1");
    }
    return {
      ...defaultSettings,
      ...parsed,
      profile: { ...defaultSettings.profile, ...parsed.profile },
      notifications: { ...defaultSettings.notifications, ...parsed.notifications },
      security: { ...defaultSettings.security, ...parsed.security },
      apiKeys: Array.isArray(parsed.apiKeys) ? parsed.apiKeys : defaultSettings.apiKeys,
    };
  } catch (err) {
    console.warn("Could not read settings from localStorage:", err);
    return defaultSettings;
  }
}

export function saveLocalSettings(settings: AppSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn("Could not save settings to localStorage:", err);
  }
}

export async function getSettings(): Promise<AppSettings> {
  const userId =
    typeof window !== "undefined"
      ? localStorage.getItem("userId") || localStorage.getItem("clientUserId") || "default_user"
      : "default_user";
  try {
    const res = await fetch(`/api/settings?userId=${encodeURIComponent(userId)}`);
    if (res.ok) {
      const data = await res.json();
      if (data?.success && data?.settings) {
        const local = loadLocalSettings();
        const merged: AppSettings = {
          ...defaultSettings,
          ...local,
          ...data.settings,
          notifications: {
            ...defaultSettings.notifications,
            ...data.settings.notifications,
          },
          profile: {
            ...defaultSettings.profile,
            ...local.profile,
            ...(data.settings.profile || {}),
          },
        };
        saveLocalSettings(merged);
        return merged;
      }
    }
  } catch (err) {
    console.warn("Backend GET /api/settings failed, using local storage:", err);
  }
  return loadLocalSettings();
}

export async function saveSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
  const current = loadLocalSettings();
  const userId =
    typeof window !== "undefined"
      ? localStorage.getItem("userId") || localStorage.getItem("clientUserId") || "default_user"
      : "default_user";

  const merged: AppSettings = {
    ...current,
    ...updates,
    profile: { ...current.profile, ...(updates.profile || {}) },
    notifications: { ...current.notifications, ...(updates.notifications || {}) },
    security: { ...current.security, ...(updates.security || {}) },
    apiKeys: updates.apiKeys || current.apiKeys,
  };

  try {
    await fetch(`/api/settings?userId=${encodeURIComponent(userId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...merged, userId }),
    });
  } catch (err) {
    console.warn("Backend POST /api/settings failed (DB offline), persisting locally:", err);
  }

  saveLocalSettings(merged);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("settings-updated", { detail: merged }));
  }

  return merged;
}

export async function createApiKey(
  name: string,
  expiryDays = 365
): Promise<{ apiKey: ApiKeyRecord; rawKey: string; settings: AppSettings }> {
  const settings = loadLocalSettings();
  const rand = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  const rawKey = `sb_live_${rand}`;
  const newKey: ApiKeyRecord = {
    id: `key-${Date.now()}`,
    name: name.trim() || "API Key",
    keyPrefix: `sb_live_${rand.slice(0, 6)}...`,
    createdAt: new Date().toLocaleDateString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    expiresAt: new Date(Date.now() + expiryDays * 86400000).toLocaleDateString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
  };

  const updatedKeys = [newKey, ...settings.apiKeys];
  const updated = await saveSettings({ apiKeys: updatedKeys });
  return { apiKey: newKey, rawKey, settings: updated };
}

export async function revokeApiKey(keyId: string): Promise<AppSettings> {
  const settings = loadLocalSettings();
  const updatedKeys = settings.apiKeys.filter((k) => k.id !== keyId);
  return await saveSettings({ apiKeys: updatedKeys });
}

export async function revokeSession(sessionId: string): Promise<AppSettings> {
  const settings = loadLocalSettings();
  const updatedSessions = settings.security.activeSessions.filter(
    (s) => s.id !== sessionId
  );
  return await saveSettings({
    security: {
      ...settings.security,
      activeSessions: updatedSessions,
    },
  });
}

