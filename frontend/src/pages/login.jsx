// =============================================================================
// login.jsx — Login Page
// Users choose their role (Security Officer / Administrator) before signing in.
// The selected role is sent to the backend so it can verify the account type.
// =============================================================================

import { useState, useEffect } from "react";
import { useLocation }         from "wouter";
import { Shield }              from "lucide-react";
import { useAuth }             from "@/contexts/AuthContext";
import { Input }               from "@/components/ui/input";
import { Button }              from "@/components/ui/button";
import { useToast }            from "@/hooks/use-toast";

// ─── Role Tab Options ─────────────────────────────────────────────────────────
const ROLE_TABS = [
  { value: "security_staff", label: "Security Officer" },
  { value: "admin",          label: "Administrator"    },
];

// =============================================================================
// Component
// =============================================================================
export default function Login() {
  const [userId,       setUserId]       = useState("");
  const [password,     setPassword]     = useState("");
  const [role,         setRole]         = useState("security_staff");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, isAuthenticated } = useAuth();
  const { toast }                  = useToast();
  const [, setLocation]            = useLocation();

  // Redirect to dashboard if already logged in
  useEffect(() => {
    if (isAuthenticated) setLocation("/dashboard");
  }, [isAuthenticated, setLocation]);

  // ─── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();

    if (!userId.trim()) {
      toast({ variant: "destructive", title: "User ID is required" });
      return;
    }
    if (!password.trim()) {
      toast({ variant: "destructive", title: "Password is required" });
      return;
    }

    setIsSubmitting(true);
    try {
      await login({ userId: userId.trim(), password, role });
      setLocation("/dashboard");
    } catch (err) {
      toast({
        variant:     "destructive",
        title:       "Login failed",
        description: err instanceof Error ? err.message : "Invalid credentials",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Welcome back
          </h1>
          <p className="text-sm text-muted-foreground uppercase tracking-widest mt-2">
            Secure Entry Tracking — NIT Calicut
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl border bg-card text-card-foreground shadow-lg p-6 space-y-6">
          <div>
            <h2 className="font-semibold text-lg leading-none tracking-tight">Sign In</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Select your role and enter your credentials.
            </p>
          </div>

          {/* Role Tabs */}
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
            {ROLE_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setRole(tab.value)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                  role === tab.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="userId" className="text-sm font-medium leading-none">
                User ID
              </label>
              <Input
                id="userId"
                name="userId"
                placeholder={role === "admin" ? "ADMIN001" : "SEC001"}
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                autoComplete="username"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium leading-none">
                Password
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Signing in…" : "Sign In"}
            </Button>
          </form>

          {/* Demo credentials hint */}
          <p className="text-xs text-center text-muted-foreground">
            Demo — Admin:&nbsp;<code>ADMIN001 / admin123</code>&nbsp;&nbsp;
            Staff:&nbsp;<code>SEC001 / sec123</code>
          </p>
        </div>

      </div>
    </div>
  );
}
