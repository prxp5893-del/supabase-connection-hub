import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ShoppingBasket, LogIn, Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { initDb } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { loadSessionUser } from "@/lib/account";
import { markEverythingDirty, syncNow } from "@/lib/sync";
import { useAuth } from "@/store/auth";
import { useHydrated } from "@/hooks/use-hydrated";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — G.K Mart" },
      { name: "description", content: "Sign in to G.K Mart billing software." },
      { property: "og:title", content: "Sign in — G.K Mart" },
      { property: "og:description", content: "Sign in to G.K Mart billing software." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const hydrated = useHydrated();
  const login = useAuth((s) => s.login);
  const user = useAuth((s) => s.user);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void initDb();
  }, []);
  useEffect(() => {
    if (hydrated && user) navigate({ to: "/" });
  }, [hydrated, user, navigate]);

  const finishSignIn = async () => {
    const session = await loadSessionUser();
    if (!session) {
      toast.error("This account is disabled. Ask the shop owner for access.");
      return;
    }
    login(session);
    await initDb();
    await markEverythingDirty();
    void syncNow();
    toast.success(`Welcome, ${session.name}`);
    navigate({ to: "/" });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { name: name.trim() || email.split("@")[0] },
          },
        });
        if (error) {
          toast.error(error.message);
          return;
        }
        if (!data.session) {
          toast.success("Account created. Check your email to confirm, then sign in.");
          setMode("signin");
          return;
        }
        await finishSignIn();
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      await finishSignIn();
    } catch {
      toast.error("Could not sign in. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  const forgot = async () => {
    if (!email.trim()) {
      toast.error("Enter your email first");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success("Password reset link sent to your email");
  };

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
            <ShoppingBasket className="size-6" />
          </div>
          <div>
            <p className="text-lg font-bold">G.K Mart</p>
            <p className="text-xs text-sidebar-foreground/60">Billing • Inventory • GST</p>
          </div>
        </div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="max-w-md text-4xl font-extrabold leading-tight">
            Bill faster. Track every rupee.
          </h2>
          <p className="mt-4 max-w-md text-sm text-sidebar-foreground/70">
            Offline-first grocery billing with GST invoices, barcode scanning, batch-wise
            inventory, loyalty points and business reports — now synced to your online account.
          </p>
        </motion.div>
        <p className="text-xs text-sidebar-foreground/50">
          Works offline · Syncs to your shop account when online
        </p>
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="card-elevated w-full max-w-md p-6">
          <h1 className="text-2xl font-bold">{mode === "signin" ? "Sign in" : "Create account"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Use your shop account email and password."
              : "The first account created becomes the shop Admin."}
          </p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="name">Your name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : mode === "signin" ? (
                <LogIn className="size-4" />
              ) : (
                <UserPlus className="size-4" />
              )}
              {mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <div className="mt-4 flex items-center justify-between text-xs">
            <button
              type="button"
              className="font-medium text-primary hover:underline"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "Create a new account" : "I already have an account"}
            </button>
            {mode === "signin" && (
              <button
                type="button"
                className="text-muted-foreground hover:underline"
                onClick={forgot}
              >
                Forgot password?
              </button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
