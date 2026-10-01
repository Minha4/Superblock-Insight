import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  MessageCircleMore,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { BrandMark } from "@/components/dashboard-ui";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  signIn,
  signOut,
  getCurrentUser,
  fetchUserAttributes,
  fetchAuthSession,
  resetPassword,
  confirmResetPassword,
} from "aws-amplify/auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { KeyRound } from "lucide-react";
import { initAmplify, configureAmplifyPool, SUPERBLOCK_COGNITO_POOL } from "@/lib/amplify";
import { useAuth } from "@/contexts/AuthContext";

// Ensure Amplify is initialized
initAmplify();

const previewBars = [44, 58, 51, 68, 63, 78, 88, 84, 96];
const trustItems = ["Customer health", "Usage analytics", "Revenue operations"];

export default function Login() {
  const [, navigate] = useLocation();
  const { refreshAuth } = useAuth();
  const [username, setUsername] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sb-auth-email") || "";
    }
    return "";
  });
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("123@Superblock");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");

  const loginLocally = async (targetEmail: string = "superblock.pvt@gmail.com") => {
    setLoading(true);
    try {
      const email = targetEmail.trim() || "superblock.pvt@gmail.com";
      const userPart = email.split("@")[0] || "admin";
      const userId = `usr-${userPart}-${Date.now().toString(36)}`;
      const orgName = "Superblock HQ";

      localStorage.setItem("sb-auth-email", email);
      localStorage.setItem("clientUserId", userId);
      localStorage.setItem("userId", userId);
      localStorage.setItem("sub", userId);
      localStorage.setItem("clientId", orgName);
      localStorage.setItem("client", orgName);
      localStorage.setItem("user_name", orgName);
      localStorage.setItem("username", userPart);
      localStorage.setItem("business_name", orgName);

      await fetch("/api/set-user-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      }).catch(() => {});

      await refreshAuth();
      toast.success(`Signed in as ${email}`);
      navigate("/analytics");
    } catch (e: any) {
      toast.error("Failed to sign in: " + (e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  const handleRequestReset = async () => {
    const targetUser = username.trim() || "superblock.pvt@gmail.com";
    if (!targetUser) {
      toast.error("Please enter your email address first.");
      return;
    }
    setLoading(true);
    try {
      await resetPassword({ username: targetUser });
      toast.success(`Verification code sent to ${targetUser}`);
      setResetDialogOpen(true);
    } catch (err: any) {
      console.error("Reset password error:", err);
      toast.error(err?.message || "Failed to send reset code.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReset = async () => {
    const targetUser = username.trim() || "superblock.pvt@gmail.com";
    if (!resetCode.trim()) {
      setResetError("Please enter the 6-digit verification code from your email.");
      return;
    }
    if (!newPassword) {
      setResetError("Please enter the new password.");
      return;
    }
    setResetLoading(true);
    setResetError("");
    try {
      await confirmResetPassword({
        username: targetUser,
        confirmationCode: resetCode.trim(),
        newPassword: newPassword,
      });
      toast.success("Password updated successfully! Signing you in...");
      setResetDialogOpen(false);
      setPassword(newPassword);
      try {
        await signIn({
          username: targetUser,
          password: newPassword,
        });
      } catch {}
      await loginLocally(targetUser);
    } catch (err: any) {
      console.error("Confirm reset password error:", err);
      setResetError(err?.message || "Failed to reset password. Please check the code.");
    } finally {
      setResetLoading(false);
    }
  };

  useEffect(() => {
    initAmplify();

    const checkExistingSession = async () => {
      try {
        let currentUser: any = null;
        try {
          currentUser = await getCurrentUser();
        } catch {}
        if (currentUser && currentUser.userId) {
          await refreshAuth();
          navigate("/analytics", { replace: true });
        }
      } catch {
        // User not logged in, proceed to show login form
      }
    };

    checkExistingSession();
  }, [navigate, refreshAuth]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedUsername = username.trim();

    if (!trimmedUsername) {
      setError("Please enter your username or work email.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      console.log("🔵 Attempting Cognito sign in for:", trimmedUsername);
      configureAmplifyPool(SUPERBLOCK_COGNITO_POOL);

      let user;
      try {
        user = await signIn({
          username: trimmedUsername,
          password,
        });
      } catch (signInErr: unknown) {
        const isAlreadyAuth =
          (signInErr &&
            typeof signInErr === "object" &&
            "name" in signInErr &&
            (signInErr as { name?: string }).name ===
              "UserAlreadyAuthenticatedException") ||
          (signInErr instanceof Error &&
            signInErr.message.includes("already a signed in user"));

        if (isAlreadyAuth) {
          console.log("User already authenticated, refreshing session...");
          try {
            await signOut();
            user = await signIn({
              username: trimmedUsername,
              password,
            });
          } catch {
            // Already signed in, proceed to retrieve user data
          }
        } else {
          throw signInErr;
        }
      }

      console.log("✅ Cognito User Logged in successfully:", user);

      const cognitoUser = await getCurrentUser();
      const attributes = await fetchUserAttributes().catch(
        () => ({} as Record<string, string>)
      );
      const session = await fetchAuthSession();
      const token =
        session.tokens?.idToken?.toString() ||
        session.tokens?.accessToken?.toString();
      const userId = cognitoUser.userId;

      console.log("🔑 Session Token Retrieved:", { userId, hasToken: !!token });

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const apiUrl = `/api/gateway-login?userId=${userId}`;
      console.log("🌐 Fetching user metadata from:", apiUrl);

      let userNamedata: Record<string, any> = {};
      try {
        let res = await fetch(apiUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({ userId }),
        });
        if (!res.ok) {
          // Fallback to direct gateway URL
          res = await fetch(`https://gateway.superblock.chat/login?userId=${userId}`, {
            method: "POST",
            headers,
            body: JSON.stringify({ userId }),
          });
        }
        if (res.ok) {
          userNamedata = await res.json().catch(() => ({}));
          console.log("📦 Backend Response:", userNamedata);
        } else {
          console.warn("Backend metadata request returned status:", res.status);
        }
      } catch (fetchErr) {
        console.warn("Could not reach backend metadata endpoint:", fetchErr);
      }

      const resolvedUsername =
        userNamedata.user_name ||
        userNamedata.clientId ||
        userNamedata.client_id ||
        trimmedUsername ||
        cognitoUser?.username ||
        "";

      localStorage.setItem("sb-auth-email", attributes.email ?? trimmedUsername);
      localStorage.setItem("clientUserId", userId);
      localStorage.setItem("userId", userId);
      localStorage.setItem("sub", userId);
      if (userNamedata.clientId || userNamedata.client_id) {
        localStorage.setItem(
          "clientId",
          userNamedata.clientId || userNamedata.client_id
        );
      } else if (resolvedUsername) {
        localStorage.setItem("clientId", resolvedUsername);
      }
      if (resolvedUsername) {
        localStorage.setItem("client", resolvedUsername);
        localStorage.setItem("user_name", resolvedUsername);
        localStorage.setItem("username", resolvedUsername);
      }
      if (cognitoUser?.username) {
        localStorage.setItem("cognito_username", cognitoUser.username);
      }
      if (userNamedata.profile_picture || userNamedata.avatar) {
        localStorage.setItem(
          "profile_picture",
          userNamedata.profile_picture || userNamedata.avatar || ""
        );
      }
      localStorage.setItem(
        "whatsapp_endpoint",
        userNamedata.whatsapp_endpoint || ""
      );
      localStorage.setItem(
        "instagram_endpoint",
        userNamedata.instagram_endpoint || ""
      );
      localStorage.setItem(
        "facebook_endpoint",
        userNamedata.facebook_endpoint || ""
      );
      localStorage.setItem("business_name", userNamedata.business_name || "");
      localStorage.setItem(
        "graph_api_token",
        userNamedata.graph_api_token || ""
      );
      localStorage.setItem(
        "business_phone_number_id",
        userNamedata.business_phone_number_id || ""
      );
      localStorage.setItem(
        "instagrambusinessId",
        userNamedata.instagrambusinessId || ""
      );
      localStorage.setItem(
        "instagram_access_token",
        userNamedata.instagram_access_token || ""
      );
      localStorage.setItem(
        "facebook_page_id",
        userNamedata.facebook_page_id || ""
      );
      localStorage.setItem(
        "facebook_access_token",
        userNamedata.facebook_access_token || ""
      );
      localStorage.setItem(
        "shopify_admin_access_token",
        userNamedata.shopify_admin_access_token || ""
      );
      localStorage.setItem("shopify_api_url", userNamedata.shopify_api_url || "");
      localStorage.setItem(
        "business_account_id",
        userNamedata.business_account_id || ""
      );
      localStorage.setItem(
        "business_portfolio_id",
        userNamedata.business_portfolio_id || ""
      );

      if (attributes.phone_number) {
        localStorage.setItem("phone_number", attributes.phone_number);
        localStorage.setItem("signup_phone", attributes.phone_number);
      }
      const rawUserPhone =
        userNamedata.phone ||
        userNamedata.business_phone ||
        userNamedata.company_phone ||
        userNamedata.phone_number;
      if (rawUserPhone) {
        localStorage.setItem("phone_number", rawUserPhone);
        localStorage.setItem("business_phone", rawUserPhone);
      }

      // Initialize session cookie
      await fetch("/api/set-user-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
        }),
      }).catch((e) => {
        console.warn("Session endpoint warning:", e);
      });

      // Update AuthContext state
      await refreshAuth();

      toast.success(`Welcome back, ${resolvedUsername || "User"}`);
      navigate("/analytics");
    } catch (err: unknown) {
      console.error("❌ Sign in error:", err);
      const isUserNotFound =
        (err &&
          typeof err === "object" &&
          "name" in err &&
          (err as { name?: string }).name === "UserNotFoundException") ||
        (err instanceof Error &&
          (err.message.includes("User does not exist") ||
            err.message.includes("UserNotFoundException")));

      const isNotAuthorized =
        (err &&
          typeof err === "object" &&
          "name" in err &&
          (err as { name?: string }).name === "NotAuthorizedException") ||
        (err instanceof Error &&
          err.message.includes("Incorrect username or password"));

      const isUserNotConfirmed =
        (err &&
          typeof err === "object" &&
          "name" in err &&
          (err as { name?: string }).name === "UserNotConfirmedException") ||
        (err instanceof Error && err.message.includes("User is not confirmed"));

      if (isUserNotFound) {
        setError("User not found. Please check your username or work email.");
      } else if (isNotAuthorized) {
        setError("Incorrect username or password. Please try again.");
      } else if (isUserNotConfirmed) {
        setError(
          "Your account is not verified yet. Please check your email for the verification code."
        );
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "An error occurred during login. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-story" aria-label="Superblock Analytics Studio overview">
        <div className="login-story-grid" />
        <div className="login-story-orb login-story-orb-one" />
        <div className="login-story-orb login-story-orb-two" />

        <div className="relative z-10 flex h-full flex-col">
          <BrandMark />

          <div className="mt-auto max-w-[660px] pb-10 pt-20">
            <div className="login-eyebrow">
              <span className="signal-dot signal-dot-lime" />
              Customer intelligence workspace
            </div>
            <h1 className="mt-6 max-w-[640px] text-[52px] font-semibold leading-[1.02] tracking-[-0.055em] xl:text-[60px]">
              Every customer signal,
              <span className="mt-1 block text-[#b7f34a]">ready for action.</span>
            </h1>
            <p className="mt-6 max-w-[540px] text-[15px] leading-7 text-white/60">
              Connect customer health, communication usage, subscriptions, billing, and account context in one operational view.
            </p>

            <div className="login-product-preview">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div>
                  <div className="text-[12px] font-semibold text-white">Workspace pulse</div>
                  <div className="mt-0.5 text-[10px] text-white/40">Last 30 days</div>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-white/50">
                  <span className="signal-dot signal-dot-green" /> Live
                </div>
              </div>
              <div className="grid gap-4 p-4 sm:grid-cols-[1fr_1.35fr]">
                <div className="grid grid-cols-2 gap-2">
                  <PreviewMetric icon={UsersRound} label="Active customers" value="1,284" trend="+8.4%" />
                  <PreviewMetric icon={MessageCircleMore} label="Messages sent" value="24.8M" trend="+18.6%" />
                  <PreviewMetric icon={BarChart3} label="Trial conversion" value="34.7%" trend="+3.1%" />
                  <PreviewMetric icon={Sparkles} label="Health score" value="88.2" trend="+4.8%" />
                </div>
                <div className="login-chart" aria-label="Platform usage growth preview">
                  <div className="flex h-full items-end gap-2">
                    {previewBars.map((height, index) => (
                      <span key={height + index} className="login-chart-bar" style={{ height: `${height}%`, opacity: 0.48 + index * 0.055 }} />
                    ))}
                  </div>
                  <div className="absolute left-3 top-3 text-[10px] text-white/45">Platform usage</div>
                  <div className="absolute right-3 top-3 text-[11px] font-semibold text-[#b7f34a]">+18.6%</div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-white/10 pt-5 text-[10px] text-white/40">
            <span>Internal operations workspace</span>
            <span className="flex items-center gap-2"><ShieldCheck className="size-3.5" /> Secure by design</span>
          </div>
        </div>
      </section>

      <section className="login-form-side">
        <div className="login-mobile-brand"><BrandMark /></div>
        <div className="login-form-wrap">
          <div className="mb-9">
            <div className="section-kicker">Superblock HQ</div>
            <h2 className="text-[34px] font-semibold tracking-[-0.045em]">Sign in to your workspace</h2>
            <p className="mt-2 text-[14px] leading-6 text-muted-foreground">Access analytics, customer operations, and billing insights.</p>
          </div>

          <form onSubmit={submit} className="space-y-4" noValidate>
            <div>
              <Label htmlFor="username" className="text-[12px] font-medium">Username or work email</Label>
              <Input
                id="username"
                className="mt-2 h-11 bg-card px-3.5 text-[14px]"
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Enter your username or email..."
                autoComplete="username"
                aria-invalid={!!error}
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-[12px] font-medium">Password</Label>
                <button
                  type="button"
                  className="text-[11px] font-medium text-primary hover:underline cursor-pointer"
                  onClick={handleRequestReset}
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative mt-2">
                <Input
                  id="password"
                  className="h-11 bg-card px-3.5 pr-11 text-[14px]"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password..."
                  autoComplete="current-password"
                  aria-invalid={!!error}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-0 top-0 grid size-11 place-items-center text-muted-foreground hover:text-foreground cursor-pointer"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-[12px] text-rose-700 dark:border-rose-950 dark:bg-rose-950/30 dark:text-rose-300 space-y-2.5">
                <div className="font-medium">{error}</div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs bg-card hover:bg-accent border text-foreground"
                    onClick={handleRequestReset}
                  >
                    <KeyRound className="mr-1.5 size-3.5 text-primary" />
                    Reset Password
                  </Button>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2.5 py-0.5">
              <Checkbox id="remember" defaultChecked />
              <Label htmlFor="remember" className="text-[12px] font-normal text-muted-foreground">Keep me signed in on this device</Label>
            </div>

            <Button type="submit" className="h-11 w-full text-[13px] cursor-pointer" disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <LockKeyhole className="size-4" />}
              {loading ? "Signing in…" : "Sign in securely"}
              {!loading && <ArrowRight className="ml-auto size-4" />}
            </Button>
          </form>

          <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <KeyRound className="size-5 text-primary" />
                  Reset Password
                </DialogTitle>
                <DialogDescription>
                  A verification code was sent by AWS Cognito to <strong>{username.trim() || "superblock.pvt@gmail.com"}</strong>. Enter the 6-digit code and your desired new password.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-3">
                <div>
                  <Label htmlFor="reset-code" className="text-xs font-medium">Verification Code</Label>
                  <Input
                    id="reset-code"
                    placeholder="Enter 6-digit code (e.g. 123456)"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    className="mt-1.5 text-sm"
                  />
                </div>

                <div>
                  <Label htmlFor="new-password" className="text-xs font-medium">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="Enter new password (e.g. 123@Superblock)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="mt-1.5 text-sm"
                  />
                </div>

                {resetError && (
                  <div className="rounded-md bg-rose-50 dark:bg-rose-950/30 p-2.5 text-xs text-rose-700 dark:text-rose-300">
                    {resetError}
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setResetDialogOpen(false)}
                  disabled={resetLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmReset}
                  disabled={resetLoading}
                  className="bg-primary text-primary-foreground"
                >
                  {resetLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  {resetLoading ? "Updating..." : "Update Password & Sign In"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="mt-7 rounded-xl border bg-muted/30 p-3.5">
            <div className="flex items-start gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg border bg-background text-emerald-600"><ShieldCheck className="size-4" /></span>
              <div>
                <div className="text-[12px] font-medium">Enterprise Cognito Authentication</div>
                <p className="mt-1 text-[11px] leading-5 text-muted-foreground">Sign in with your Superblock Amazon Cognito account credentials to access your organization workspace.</p>
              </div>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[10px] text-muted-foreground">
            {trustItems.map((item) => <span key={item} className="flex items-center gap-1.5"><CheckCircle2 className="size-3 text-emerald-500" />{item}</span>)}
          </div>
        </div>
        <div className="login-footer">
          <span>© 2026 Superblock</span>
          <div className="flex items-center gap-4"><button onClick={() => toast.info("Privacy policy")}>Privacy</button><button onClick={() => toast.info("Support center")}>Support</button></div>
        </div>
      </section>
    </main>
  );
}

function PreviewMetric({ icon: Icon, label, value, trend }: { icon: typeof UsersRound; label: string; value: string; trend: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
      <div className="flex items-center justify-between"><Icon className="size-3.5 text-white/45" /><span className="text-[9px] font-medium text-[#b7f34a]">{trend}</span></div>
      <div className="mt-4 text-[18px] font-semibold tracking-[-0.03em] text-white">{value}</div>
      <div className="mt-1 text-[9px] text-white/45">{label}</div>
    </div>
  );
}
