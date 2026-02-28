"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { isSignInWithEmailLink, signInWithEmailLink } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { claimRole } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { BoostLogo } from "@/components/boost-logo";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, AlertCircle, Mail } from "lucide-react";

const EMAIL_FOR_SIGNIN_KEY = "boost_emailForSignIn";

type CompleteState = "verifying" | "need-email" | "signing-in" | "claiming" | "success" | "error";

export default function LoginCompletePage() {
  const [state, setState] = useState<CompleteState>("verifying");
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [claimedRoleName, setClaimedRoleName] = useState<string | null>(null);
  const { user, role, loading, refreshToken } = useAuth();
  const router = useRouter();
  const completedRef = useRef(false);

  // If user is already authenticated (e.g. AuthProvider's onAuthStateChanged picked it up),
  // and we've finished our flow, redirect based on role.
  useEffect(() => {
    if (loading) return;
    if (state !== "success") return;

    // Give a moment for the success message to display, then redirect
    const timer = setTimeout(() => {
      if (role === "owner") {
        router.replace("/admin");
      } else if (role === "merchant_admin" || role === "staff") {
        router.replace("/dashboard");
      } else {
        // No role — the claim may not have found a pending role
        router.replace("/dashboard");
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [loading, state, role, router]);

  // Main sign-in completion logic
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (completedRef.current) return;

    const auth = getFirebaseAuth();
    const href = window.location.href;

    // Verify this is actually an email sign-in link
    if (!isSignInWithEmailLink(auth, href)) {
      setState("error");
      setError("This is not a valid sign-in link. Please request a new one from the login page.");
      return;
    }

    // Try to get email from localStorage
    const storedEmail = window.localStorage.getItem(EMAIL_FOR_SIGNIN_KEY);

    if (storedEmail) {
      // We have the email, proceed with sign-in
      completeSignIn(auth, storedEmail, href);
    } else {
      // Email not in localStorage (different device/browser)
      setState("need-email");
    }
  }, []);

  async function completeSignIn(auth: ReturnType<typeof getFirebaseAuth>, emailAddr: string, href: string) {
    if (completedRef.current) return;
    completedRef.current = true;

    setState("signing-in");

    try {
      const result = await signInWithEmailLink(auth, emailAddr, href);
      window.localStorage.removeItem(EMAIL_FOR_SIGNIN_KEY);

      // Sign-in succeeded — now try to claim any pending role
      setState("claiming");

      try {
        const token = await result.user.getIdToken(true);
        const claimResult = await claimRole(token);

        if (claimResult.success && claimResult.role) {
          setClaimedRoleName(claimResult.role.replace("_", " "));
        }
      } catch {
        // claim-role failing is not fatal — user may not have a pending invite
        // They'll just land on the dashboard with no role (or existing role)
      }

      // Refresh the auth context to pick up any new claims
      // Small delay to ensure Firebase has propagated the custom claims
      await new Promise((r) => setTimeout(r, 500));
      await refreshToken();

      setState("success");
    } catch (err: any) {
      completedRef.current = false;
      window.localStorage.removeItem(EMAIL_FOR_SIGNIN_KEY);

      const code = err?.code;
      if (code === "auth/invalid-action-code") {
        setError("This sign-in link has expired or already been used. Please request a new one.");
      } else if (code === "auth/invalid-email") {
        setError("The email address doesn't match. Please try again with the correct email.");
      } else if (code === "auth/expired-action-code") {
        setError("This sign-in link has expired. Please request a new one from the login page.");
      } else {
        setError(err?.message || "Failed to complete sign-in. Please try again.");
      }
      setState("error");
    }
  }

  function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    const auth = getFirebaseAuth();
    completeSignIn(auth, email, window.location.href);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <BoostLogo />
        </div>

        <Card className="border-border bg-card">
          <CardHeader className="space-y-1 pb-4 text-center">
            <h1 className="text-xl font-semibold text-card-foreground">
              {state === "verifying" && "Verifying link..."}
              {state === "need-email" && "Confirm your email"}
              {state === "signing-in" && "Signing you in..."}
              {state === "claiming" && "Setting up your account..."}
              {state === "success" && "You're in!"}
              {state === "error" && "Sign-in failed"}
            </h1>
            <CardDescription className="text-muted-foreground">
              {state === "verifying" && "Please wait while we verify your sign-in link"}
              {state === "need-email" && "Enter the email address you used to request the sign-in link"}
              {state === "signing-in" && "Completing your sign-in..."}
              {state === "claiming" && "Configuring your account permissions..."}
              {state === "success" && (claimedRoleName ? `Role assigned: ${claimedRoleName}` : "Redirecting to your dashboard...")}
              {state === "error" && "Something went wrong"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Loading states */}
            {(state === "verifying" || state === "signing-in" || state === "claiming") && (
              <div className="flex flex-col items-center justify-center py-6">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="mt-4 text-sm text-muted-foreground">
                  {state === "verifying" && "Checking sign-in link..."}
                  {state === "signing-in" && "Authenticating..."}
                  {state === "claiming" && "Checking for pending invites..."}
                </p>
              </div>
            )}

            {/* Need email input (different device/browser) */}
            {state === "need-email" && (
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
                  <p>
                    It looks like you opened this link on a different device or browser.
                    Please enter your email to continue.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@business.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="border-border bg-input pl-10 text-foreground placeholder:text-muted-foreground"
                      required
                      autoFocus
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Continue
                </Button>
              </form>
            )}

            {/* Success */}
            {state === "success" && (
              <div className="space-y-4 rounded-lg border border-success/30 bg-success/10 p-4 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
                <div>
                  <p className="font-medium text-foreground">Sign-in successful!</p>
                  {claimedRoleName && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Role: <span className="font-medium capitalize text-foreground">{claimedRoleName}</span>
                    </p>
                  )}
                  <p className="mt-2 text-sm text-muted-foreground">
                    Redirecting to your dashboard...
                  </p>
                </div>
              </div>
            )}

            {/* Error */}
            {state === "error" && error && (
              <div className="space-y-4">
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-center">
                  <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
                  <p className="mt-3 text-sm text-destructive">{error}</p>
                </div>
                <Button
                  variant="outline"
                  className="w-full border-border"
                  onClick={() => router.push("/login")}
                >
                  Back to login
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
