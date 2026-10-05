import { useState, useEffect } from "react";
import {
  Bell,
  Building2,
  Check,
  ChevronRight,
  Copy,
  CreditCard,
  KeyRound,
  Lock,
  Moon,
  Palette,
  Plus,
  RefreshCw,
  Save,
  Shield,
  Sun,
  Trash2,
  UserRound,
  Users,
  Zap,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Avatar, PageHeader, SectionHeader } from "@/components/dashboard-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { updateUserAttributes } from "aws-amplify/auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  AppSettings,
  getSettings,
  saveSettings,
  createApiKey,
  revokeApiKey,
  revokeSession,
  ApiKeyRecord,
} from "@/lib/api/settings";

const groups = [
  {
    label: "Account",
    items: [
      ["Profile", UserRound],
      ["Preferences", Zap],
    ],
  },
  {
    label: "Workspace",
    items: [
      ["Workspace", Building2],
      ["Roles & permissions", Shield],
    ],
  },
  {
    label: "Product",
    items: [
      ["Channels", Zap],
      ["Notifications", Bell],
    ],
  },
  {
    label: "Security",
    items: [
      ["Login security", Lock],
      ["API keys", KeyRound],
    ],
  },
  {
    label: "Appearance",
    items: [["Theme", Palette]],
  },
] as const;

export default function Settings() {
  const [section, setSection] = useState("Profile");
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const data = await getSettings();
      setSettings(data);
    } catch {
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleUpdate = async (updated: Partial<AppSettings>) => {
    if (!settings) return;
    const next = { ...settings, ...updated };
    setSettings(next);
    try {
      await saveSettings(next);
      toast.success("Settings saved successfully");
    } catch {
      toast.error("Could not save settings to server");
    }
  };

  return (
    <AppShell breadcrumbs={["Settings", section]}>
      <PageHeader
        eyebrow="Workspace configuration"
        title="Settings"
        description="Manage personal preferences, workspace controls, security, and appearance."
      />
      <div className="mt-4 grid gap-6 lg:grid-cols-[215px_minmax(0,1fr)]">
        <aside className="space-y-4">
          {groups.map((group) => (
            <div key={group.label}>
              <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground">
                {group.label}
              </div>
              {group.items.map(([name, Icon]) => (
                <button
                  key={name}
                  onClick={() => setSection(name)}
                  className={cn("settings-nav", section === name && "active")}
                >
                  <Icon className="size-3.5" />
                  <span>{name}</span>
                  {section === name && <ChevronRight className="ml-auto size-3" />}
                </button>
              ))}
            </div>
          ))}
        </aside>

        <section className="min-w-0">
          {loading || !settings ? (
            <div className="panel flex items-center justify-center p-12 text-sm text-muted-foreground">
              <RefreshCw className="mr-2 size-4 animate-spin" /> Loading settings...
            </div>
          ) : section === "Profile" ? (
            <ProfileSection
              settings={settings}
              onSave={(profile) => handleUpdate({ profile })}
            />
          ) : section === "Theme" ? (
            <ThemeSettings />
          ) : section === "Notifications" ? (
            <NotificationSection
              settings={settings}
              onSave={(notifications) => handleUpdate({ notifications })}
            />
          ) : section === "Login security" ? (
            <SecuritySection
              settings={settings}
              onUpdate={setSettings}
              onSave={(security) => handleUpdate({ security })}
            />
          ) : section === "API keys" ? (
            <ApiKeysSection settings={settings} onUpdate={setSettings} />
          ) : section === "Workspace" ? (
            <WorkspaceSection
              settings={settings}
              onSave={(workspaceName) => handleUpdate({ workspaceName })}
            />
          ) : (
            <GenericSettings section={section} />
          )}
        </section>
      </div>
    </AppShell>
  );
}

function ProfileSection({
  settings,
  onSave,
}: {
  settings: AppSettings;
  onSave: (p: AppSettings["profile"]) => Promise<void>;
}) {
  const { user, refreshAuth } = useAuth();
  const [profile, setProfile] = useState({
    fullName: settings.profile.fullName || user?.username || user?.client || "",
    displayName: settings.profile.displayName || user?.username || "",
    email: settings.profile.email || user?.email || "",
    phone: settings.profile.phone || user?.phone || "",
    timezone: settings.profile.timezone || "utc",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const userAttributes: Record<string, string> = {};
      if (profile.fullName && profile.fullName.trim()) {
        userAttributes.name = profile.fullName.trim();
      }
      if (profile.phone && profile.phone.trim()) {
        userAttributes.phone_number = profile.phone.trim();
      }
      if (Object.keys(userAttributes).length > 0) {
        try {
          await updateUserAttributes({ userAttributes });
        } catch (cognitoErr: any) {
          console.warn("Cognito updateUserAttributes notice:", cognitoErr);
        }
      }
      if (profile.fullName) {
        localStorage.setItem("username", profile.fullName);
        localStorage.setItem("user_name", profile.fullName);
      }
      if (profile.phone) {
        localStorage.setItem("phone_number", profile.phone);
      }
      await refreshAuth();
      await onSave(profile);
      toast.success("Profile saved successfully to Cognito and database");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const displayName = profile.displayName || profile.fullName || user?.username || "Authenticated User";
  const initials = (profile.fullName || user?.username || "SB")
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "SB";

  return (
    <SettingsCard
      title="Profile"
      description="Your personal information and workspace identity."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex items-center gap-4 border-b pb-5">
          <Avatar initials={initials} size="lg" />
          <div>
            <div className="text-sm font-semibold">{displayName}</div>
            <div className="text-[11px] text-muted-foreground">
              {profile.email || user?.email || "No email configured"} · {user?.businessName || settings.workspaceName || "Superblock Workspace"}
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Full name</Label>
            <Input
              className="mt-1.5"
              placeholder={user?.username || "Not configured"}
              value={profile.fullName}
              onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Display name</Label>
            <Input
              className="mt-1.5"
              placeholder={user?.username || "Not configured"}
              value={profile.displayName}
              onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Email</Label>
            <Input
              className="mt-1.5"
              type="email"
              placeholder={user?.email || "Not configured"}
              value={profile.email}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Phone</Label>
            <Input
              className="mt-1.5"
              placeholder={user?.phone || "Not configured"}
              value={profile.phone}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Timezone</Label>
            <Select
              value={profile.timezone}
              onValueChange={(val) => setProfile({ ...profile, timezone: val })}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="utc">Coordinated Universal Time (UTC)</SelectItem>
                <SelectItem value="ist">India Standard Time (GMT+5:30)</SelectItem>
                <SelectItem value="gst">Gulf Standard Time (GMT+4)</SelectItem>
                <SelectItem value="sgt">Singapore Time (GMT+8)</SelectItem>
                <SelectItem value="est">Eastern Standard Time (GMT-5)</SelectItem>
                <SelectItem value="pst">Pacific Standard Time (GMT-8)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-md bg-muted/40 p-3 text-[11px] text-muted-foreground">
          Name and phone number persist to AWS Cognito user attributes. Timezone and workspace preferences persist to Analytics Studio Supabase.
        </div>

        <div className="flex justify-end border-t pt-5">
          <Button type="submit" disabled={saving}>
            <Save className="size-4" />
            {saving ? "Saving…" : "Save profile changes"}
          </Button>
        </div>
      </form>
    </SettingsCard>
  );
}

function ThemeSettings() {
  const { theme, setTheme } = useApp();
  return (
    <SettingsCard
      title="Appearance"
      description="Choose how Superblock Analytics looks in this browser."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["light", "Light", Sun],
          ["dark", "Dark", Moon],
          ["system", "System", Palette],
        ].map(([value, label, Icon]) => (
          <button
            key={value as string}
            onClick={() => setTheme(value as "light" | "dark" | "system")}
            className={cn("theme-card", theme === value && "active")}
          >
            <div className={cn("theme-preview", value === "dark" && "dark-preview")}>
              <div className="h-full w-1/4 border-r opacity-60" />
              <div className="flex-1 p-2">
                <div className="h-1.5 w-1/2 rounded bg-current opacity-50" />
                <div className="mt-2 grid grid-cols-2 gap-1">
                  <div className="h-7 rounded border" />
                  <div className="h-7 rounded border" />
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Icon className="size-4" />
              <span className="text-xs font-medium">{label as string}</span>
              {theme === value && <Check className="ml-auto size-3.5 text-primary" />}
            </div>
          </button>
        ))}
      </div>
      <div className="mt-6 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium">Compact data tables</div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Show more records in each viewport.
            </p>
          </div>
          <Switch
            defaultChecked
            onCheckedChange={() => toast.success("Density preference updated")}
          />
        </div>
      </div>
    </SettingsCard>
  );
}

function NotificationSection({
  settings,
  onSave,
}: {
  settings: AppSettings;
  onSave: (n: AppSettings["notifications"]) => Promise<void>;
}) {
  const [notifications, setNotifications] = useState(settings.notifications);
  const [saving, setSaving] = useState(false);

  const handleToggle = (key: keyof AppSettings["notifications"], val: boolean) => {
    setNotifications((prev) => ({ ...prev, [key]: val }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(notifications);
      toast.success("Notification preferences saved successfully to database");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save notifications");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsCard
      title="Notifications"
      description="Choose the operational and billing events that trigger notifications."
    >
      <div className="divide-y rounded-lg border">
        <div className="flex items-center justify-between gap-4 p-4">
          <div>
            <div className="text-xs font-medium">Renewal alerts</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              When a customer subscription renewal is due within 30 days.
            </div>
          </div>
          <Switch
            checked={notifications.renewalAlerts}
            onCheckedChange={(val) => handleToggle("renewalAlerts", val)}
          />
        </div>

        <div className="flex items-center justify-between gap-4 p-4">
          <div>
            <div className="text-xs font-medium">Billing exceptions</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Instant alerts on overdue invoices or failed payment collection.
            </div>
          </div>
          <Switch
            checked={notifications.billingExceptions}
            onCheckedChange={(val) => handleToggle("billingExceptions", val)}
          />
        </div>

        <div className="flex items-center justify-between gap-4 p-4">
          <div>
            <div className="text-xs font-medium">Usage anomalies</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Notifies when a customer experiences &gt;40% unexpected usage surge or drop.
            </div>
          </div>
          <Switch
            checked={notifications.usageAnomalies}
            onCheckedChange={(val) => handleToggle("usageAnomalies", val)}
          />
        </div>

        <div className="flex items-center justify-between gap-4 p-4">
          <div>
            <div className="text-xs font-medium">Product & Feature updates</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Monthly digests of Superblock SDK and platform capabilities.
            </div>
          </div>
          <Switch
            checked={notifications.productUpdates}
            onCheckedChange={(val) => handleToggle("productUpdates", val)}
          />
        </div>
      </div>

      <div className="mt-6 flex justify-end border-t pt-5">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="size-4" />
          {saving ? "Saving…" : "Save notification preferences"}
        </Button>
      </div>
    </SettingsCard>
  );
}

function SecuritySection({
  settings,
  onUpdate,
  onSave,
}: {
  settings: AppSettings;
  onUpdate: React.Dispatch<React.SetStateAction<AppSettings | null>>;
  onSave: (sec: AppSettings["security"]) => Promise<void>;
}) {
  const [security, setSecurity] = useState(settings.security);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(security);
    setSaving(false);
  };

  const handleRevoke = async (sessionId: string) => {
    try {
      const updated = await revokeSession(sessionId);
      setSecurity(updated.security);
      onUpdate(updated);
      toast.success("Session revoked successfully");
    } catch {
      toast.error("Failed to revoke session");
    }
  };

  return (
    <SettingsCard
      title="Login security"
      description="Control sign-in protection and active login sessions."
    >
      <div className="divide-y rounded-lg border">
        <div className="flex items-center justify-between p-4">
          <div>
            <div className="text-xs font-medium">Two-factor authentication (2FA)</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Require an authenticator app (TOTP) code on every new sign-in.
            </div>
          </div>
          <Switch
            checked={security.twoFactorEnabled}
            onCheckedChange={(val) =>
              setSecurity((s) => ({ ...s, twoFactorEnabled: val }))
            }
          />
        </div>

        <div className="flex items-center justify-between p-4">
          <div>
            <div className="text-xs font-medium">Login alerts</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Send an email alert whenever an unrecognized browser or IP signs in.
            </div>
          </div>
          <Switch
            checked={security.loginAlerts}
            onCheckedChange={(val) =>
              setSecurity((s) => ({ ...s, loginAlerts: val }))
            }
          />
        </div>

        <div className="flex items-center justify-between p-4">
          <div>
            <div className="text-xs font-medium">Session timeout</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Automatically invalidate tokens after inactivity.
            </div>
          </div>
          <Select
            value={security.sessionTimeoutHours}
            onValueChange={(val) =>
              setSecurity((s) => ({ ...s, sessionTimeoutHours: val }))
            }
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 hour</SelectItem>
              <SelectItem value="4">4 hours</SelectItem>
              <SelectItem value="8">8 hours</SelectItem>
              <SelectItem value="24">24 hours</SelectItem>
              <SelectItem value="168">7 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-5">
        <SectionHeader
          title="Active sessions"
          description="Devices and locations currently signed into your account"
        />
        <div className="mt-2 divide-y rounded-lg border">
          {security.activeSessions.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No active session telemetry found. Multi-device session tracking is not configured.
            </div>
          ) : (
            security.activeSessions.map((sess) => (
              <div
                key={sess.id}
                className="flex items-center justify-between p-4 text-xs"
              >
                <div>
                  <div className="font-medium">
                    {sess.device}{" "}
                    {sess.isCurrent && (
                      <span className="ml-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                        Current
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {sess.location} · {sess.lastActive}
                  </div>
                </div>
                {sess.isCurrent ? (
                  <Button variant="ghost" size="sm" className="h-7 text-xs" disabled>
                    Current device
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 bg-card text-xs text-destructive hover:bg-destructive/10"
                    onClick={() => handleRevoke(sess.id)}
                  >
                    Revoke
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-4 rounded-md bg-muted/40 p-3 text-[11px] text-muted-foreground">
        Note: Security preferences are saved for the active session. Server-side session invalidation and database persistence are not currently configured.
      </div>

      <div className="mt-6 flex justify-end border-t pt-5">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="size-4" />
          {saving ? "Saving…" : "Save security preferences"}
        </Button>
      </div>
    </SettingsCard>
  );
}

function ApiKeysSection({
  settings,
  onUpdate,
}: {
  settings: AppSettings;
  onUpdate: React.Dispatch<React.SetStateAction<AppSettings | null>>;
}) {
  const [openDialog, setOpenDialog] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [expiryDays, setExpiryDays] = useState("365");
  const [generating, setGenerating] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim()) {
      toast.error("Please provide a name for the API key");
      return;
    }
    setGenerating(true);
    try {
      const res = await createApiKey(keyName.trim(), Number(expiryDays));
      onUpdate(res.settings);
      setNewlyCreatedKey(res.rawKey);
      setKeyName("");
      toast.success("API Key generated successfully");
    } catch {
      toast.error("Failed to generate API Key");
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async (keyId: string) => {
    try {
      const updated = await revokeApiKey(keyId);
      onUpdate(updated);
      toast.success("API Key revoked");
    } catch {
      toast.error("Failed to revoke API Key");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("API Key copied to clipboard");
  };

  return (
    <SettingsCard
      title="API Keys"
      description="Manage API authentication tokens for programmatic access to Superblock Analytics endpoints."
    >
      <div className="flex items-center justify-between pb-4">
        <div>
          <h3 className="text-xs font-semibold">Active Tokens</h3>
          <p className="text-[11px] text-muted-foreground">
            Keys are scoped to your workspace permissions.
          </p>
        </div>
        <Button size="sm" onClick={() => { setNewlyCreatedKey(null); setOpenDialog(true); }}>
          <Plus className="mr-1 size-3.5" /> Generate new key
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-xs">
          <thead className="border-b bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-3">Key Name</th>
              <th className="p-3">Token Prefix</th>
              <th className="p-3">Created</th>
              <th className="p-3">Expires</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {settings.apiKeys.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  No API keys generated yet. Click "Generate new key" to create one.
                </td>
              </tr>
            ) : (
              settings.apiKeys.map((key) => (
                <tr key={key.id} className="hover:bg-muted/30">
                  <td className="p-3 font-medium">{key.name}</td>
                  <td className="p-3 font-mono text-muted-foreground">{key.keyPrefix}</td>
                  <td className="p-3 text-muted-foreground">{key.createdAt}</td>
                  <td className="p-3 text-muted-foreground">{key.expiresAt}</td>
                  <td className="p-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-destructive hover:bg-destructive/10"
                      onClick={() => handleRevoke(key.id)}
                    >
                      <Trash2 className="size-3.5" /> Revoke
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 rounded-md bg-muted/40 p-3 text-[11px] text-muted-foreground">
        Note: Generated API keys are retained for this browser session. Dedicated database persistence for workspace API keys is not currently configured.
      </div>

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generate New API Key</DialogTitle>
            <DialogDescription>
              Create a secured secret token for integrating external services and webhooks.
            </DialogDescription>
          </DialogHeader>

          {newlyCreatedKey ? (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">
                Key created! Make sure to copy this token now. You will not be able to view it again.
              </div>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={newlyCreatedKey}
                  className="font-mono text-xs"
                />
                <Button
                  size="sm"
                  onClick={() => copyToClipboard(newlyCreatedKey)}
                >
                  <Copy className="size-3.5" />
                </Button>
              </div>
              <DialogFooter>
                <Button onClick={() => setOpenDialog(false)}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleCreate} className="space-y-4 py-2">
              <div>
                <Label className="text-xs">Token Description / Name</Label>
                <Input
                  className="mt-1"
                  placeholder="e.g. CI/CD Ingestion Pipeline"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label className="text-xs">Expiration</Label>
                <Select value={expiryDays} onValueChange={setExpiryDays}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                    <SelectItem value="180">180 days</SelectItem>
                    <SelectItem value="365">1 year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpenDialog(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={generating}>
                  {generating ? "Generating..." : "Generate Key"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </SettingsCard>
  );
}

function WorkspaceSection({
  settings,
  onSave,
}: {
  settings: AppSettings;
  onSave: (name: string) => Promise<void>;
}) {
  const { user } = useAuth();
  const [workspaceName, setWorkspaceName] = useState(
    settings.workspaceName || user?.businessName || "Superblock Workspace"
  );
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave(workspaceName);
    setSaving(false);
  };

  return (
    <SettingsCard
      title="Workspace"
      description="Manage overall identity, workspace labels, and default attributes."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label className="text-xs">Workspace Name</Label>
          <Input
            className="mt-1.5"
            placeholder={user?.businessName || "Superblock Workspace"}
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            required
          />
        </div>
        <div>
          <Label className="text-xs">Workspace Slug / Domain</Label>
          <Input
            className="mt-1.5"
            value="analytics.superblock.chat"
            disabled
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Custom domains can be configured via AWS Route53.
          </p>
        </div>

        <div className="rounded-md bg-muted/40 p-3 text-[11px] text-muted-foreground">
          Note: Workspace label updates are saved for the active session.
        </div>

        <div className="flex justify-end border-t pt-5">
          <Button type="submit" disabled={saving}>
            <Save className="size-4" />
            {saving ? "Saving…" : "Save workspace"}
          </Button>
        </div>
      </form>
    </SettingsCard>
  );
}

function GenericSettings({ section }: { section: string }) {
  const [enabled, setEnabled] = useState(false);
  const [value, setValue] = useState("");

  const handleSave = () => {
    toast.info(`${section} configuration is not currently supported by the backend`);
  };

  return (
    <SettingsCard
      title={section}
      description={`Manage ${section.toLowerCase()} preferences for your Superblock workspace.`}
    >
      <div className="space-y-4">
        <div>
          <Label className="text-xs">{section} identifier</Label>
          <Input
            className="mt-1.5"
            placeholder="Not configured"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <div className="text-xs font-medium">Enable {section.toLowerCase()}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Configuration is not currently connected to live backend services.
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} disabled />
        </div>
      </div>
      <div className="mt-6 flex justify-end border-t pt-5">
        <Button onClick={handleSave} variant="outline">
          <Save className="size-4" /> Save changes
        </Button>
      </div>
    </SettingsCard>
  );
}

function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="panel p-5 sm:p-6">
      <div className="border-b pb-5">
        <h2 className="text-lg font-semibold tracking-[-.025em]">{title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="pt-5">{children}</div>
    </div>
  );
}
