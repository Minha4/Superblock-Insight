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

export interface ActiveSession {
  id: string;
  device: string;
  location: string;
  lastActive: string;
  isCurrent: boolean;
}

export interface SecuritySettings {
  twoFactorEnabled: boolean;
  loginAlerts: boolean;
  sessionTimeoutHours: string;
  activeSessions: ActiveSession[];
}

export interface ApiKeyRecord {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  expiresAt: string;
}

export interface PreferencesSettings {
  tableDensity: "compact" | "comfortable";
  defaultDateRange: string;
  autoRefresh: boolean;
}

export interface AppSettings {
  profile: ProfileSettings;
  notifications: NotificationSettings;
  security: SecuritySettings;
  apiKeys: ApiKeyRecord[];
  workspaceName: string;
  preferences: PreferencesSettings;
}

const STORAGE_KEY = "sb_user_settings";

export function getCurrentSessionInfo(): ActiveSession {
  if (typeof window === "undefined") {
    return {
      id: "sess-current",
      device: "Web Browser",
      location: "Current Region",
      lastActive: "Active now",
      isCurrent: true,
    };
  }

  const userAgent = navigator.userAgent;
  let browser = "Browser";
  if (userAgent.includes("Chrome") && !userAgent.includes("Edg")) browser = "Chrome";
  else if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) browser = "Safari";
  else if (userAgent.includes("Firefox")) browser = "Firefox";
  else if (userAgent.includes("Edg")) browser = "Edge";

  let os = "Device";
  if (userAgent.includes("Windows")) os = "Windows";
  else if (userAgent.includes("Macintosh") || userAgent.includes("Mac OS")) os = "macOS";
  else if (userAgent.includes("Linux")) os = "Linux";
  else if (userAgent.includes("Android")) os = "Android";
  else if (userAgent.includes("iPhone") || userAgent.includes("iPad")) os = "iOS";

  let tz = "Local Region";
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Local Region";
  } catch {}

  return {
    id: "sess-current",
    device: `${browser} on ${os}`,
    location: tz,
    lastActive: "Active now",
    isCurrent: true,
  };
}

export const defaultSettings: AppSettings = {
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
    activeSessions: [getCurrentSessionInfo()],
  },
  apiKeys: [],
  workspaceName: "Superblock Workspace",
  preferences: {
    tableDensity: "compact",
    defaultDateRange: "Last 30 days",
    autoRefresh: true,
  },
};

export function loadLocalSettings(): AppSettings {
  if (typeof window === "undefined") return defaultSettings;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const currentSession = getCurrentSessionInfo();

    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultSettings));
      return defaultSettings;
    }
    const parsed = JSON.parse(raw);

    // Clean up any legacy dummy placeholders
    if (parsed.profile?.fullName === "Anika Shah") {
      parsed.profile.fullName = "";
      parsed.profile.displayName = "";
      parsed.profile.email = "";
      parsed.profile.phone = "";
    }

    let sessions: ActiveSession[] = Array.isArray(parsed.security?.activeSessions)
      ? parsed.security.activeSessions.filter((s: any) => s && s.id !== "sess-1" && s.id !== "sess-2")
      : [];

    const hasCurrent = sessions.some((s) => s.isCurrent);
    if (!hasCurrent) {
      sessions = [currentSession, ...sessions];
    }

    let keys: ApiKeyRecord[] = Array.isArray(parsed.apiKeys)
      ? parsed.apiKeys.filter((k: any) => k && k.id !== "key-1")
      : [];

    return {
      ...defaultSettings,
      ...parsed,
      profile: { ...defaultSettings.profile, ...(parsed.profile || {}) },
      notifications: { ...defaultSettings.notifications, ...(parsed.notifications || {}) },
      security: {
        ...defaultSettings.security,
        ...(parsed.security || {}),
        activeSessions: sessions,
      },
      apiKeys: keys,
      workspaceName: parsed.workspaceName || defaultSettings.workspaceName,
      preferences: { ...defaultSettings.preferences, ...(parsed.preferences || {}) },
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
    if (settings.workspaceName) {
      localStorage.setItem("business_name", settings.workspaceName);
    }
    if (settings.profile?.fullName) {
      localStorage.setItem("username", settings.profile.fullName);
      localStorage.setItem("user_name", settings.profile.fullName);
    }
    if (settings.profile?.phone) {
      localStorage.setItem("phone_number", settings.profile.phone);
    }
    if (settings.preferences?.tableDensity) {
      localStorage.setItem("sb_table_density", settings.preferences.tableDensity);
    }
  } catch (err) {
    console.warn("Could not save settings to localStorage:", err);
  }
}

export async function getSettings(): Promise<AppSettings> {
  const userId =
    typeof window !== "undefined"
      ? localStorage.getItem("userId") || localStorage.getItem("clientUserId") || "default_user"
      : "default_user";

  const local = loadLocalSettings();

  try {
    const res = await fetch(`/api/settings?userId=${encodeURIComponent(userId)}`);
    if (res.ok) {
      const data = await res.json();
      if (data?.success && data?.settings) {
        const s = data.settings;

        const mergedSessions = Array.isArray(s.security?.activeSessions) && s.security.activeSessions.length > 0
          ? s.security.activeSessions
          : local.security.activeSessions;

        const merged: AppSettings = {
          ...defaultSettings,
          ...local,
          ...s,
          profile: {
            ...defaultSettings.profile,
            ...local.profile,
            fullName: s.profile?.fullName || local.profile?.fullName || "",
            displayName: s.profile?.displayName || local.profile?.displayName || "",
            email: s.profile?.email || local.profile?.email || "",
            phone: s.profile?.phone || local.profile?.phone || "",
            timezone: s.profile?.timezone || local.profile?.timezone || "utc",
          },
          notifications: {
            ...defaultSettings.notifications,
            ...local.notifications,
            ...(s.notifications || {}),
          },
          security: {
            ...defaultSettings.security,
            ...local.security,
            ...(s.security || {}),
            activeSessions: mergedSessions.length > 0 ? mergedSessions : [getCurrentSessionInfo()],
          },
          apiKeys: Array.isArray(s.apiKeys) && s.apiKeys.length > 0 ? s.apiKeys : local.apiKeys,
          workspaceName: s.workspaceName || local.workspaceName || defaultSettings.workspaceName,
          preferences: {
            ...defaultSettings.preferences,
            ...local.preferences,
            ...(s.preferences || {}),
          },
        };

        saveLocalSettings(merged);
        return merged;
      }
    }
  } catch (err) {
    console.warn("Backend GET /api/settings failed, using local storage:", err);
  }

  return local;
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
    apiKeys: updates.apiKeys !== undefined ? updates.apiKeys : current.apiKeys,
    workspaceName: updates.workspaceName !== undefined ? updates.workspaceName : current.workspaceName,
    preferences: { ...current.preferences, ...(updates.preferences || {}) },
  };

  saveLocalSettings(merged);

  try {
    const res = await fetch(`/api/settings?userId=${encodeURIComponent(userId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...merged, userId }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.success && data?.settings) {
        const s = data.settings;
        const verifiedMerged: AppSettings = {
          ...merged,
          ...s,
          profile: { ...merged.profile, ...(s.profile || {}) },
          notifications: { ...merged.notifications, ...(s.notifications || {}) },
          security: { ...merged.security, ...(s.security || {}) },
          apiKeys: Array.isArray(s.apiKeys) ? s.apiKeys : merged.apiKeys,
          preferences: { ...merged.preferences, ...(s.preferences || {}) },
        };
        saveLocalSettings(verifiedMerged);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("settings-updated", { detail: verifiedMerged }));
        }
        return verifiedMerged;
      }
    }
  } catch (err) {
    console.warn("Backend POST /api/settings failed (DB offline), persisted locally:", err);
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("settings-updated", { detail: merged }));
  }

  return merged;
}

export async function createApiKey(
  name: string,
  expiryDays = 365
): Promise<{ apiKey: ApiKeyRecord; rawKey: string; settings: AppSettings }> {
  const current = loadLocalSettings();
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

  const updatedKeys = [newKey, ...current.apiKeys.filter((k) => k.id !== newKey.id)];
  const updated = await saveSettings({ apiKeys: updatedKeys });
  return { apiKey: newKey, rawKey, settings: updated };
}

export async function revokeApiKey(keyId: string): Promise<AppSettings> {
  const current = loadLocalSettings();
  const updatedKeys = current.apiKeys.filter((k) => k.id !== keyId);
  return await saveSettings({ apiKeys: updatedKeys });
}

export async function revokeSession(sessionId: string): Promise<AppSettings> {
  const current = loadLocalSettings();
  const updatedSessions = current.security.activeSessions.filter(
    (s) => s.id !== sessionId
  );
  return await saveSettings({
    security: {
      ...current.security,
      activeSessions: updatedSessions,
    },
  });
}
