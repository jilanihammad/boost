"use client";

import {
  GoogleAuthProvider,
  User,
  getRedirectResult,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
} from "firebase/auth";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getFirebaseAuth } from "@/lib/firebase";

export type AppRole = "owner" | "merchant_admin" | "staff";

// View modes for impersonation (UI only - doesn't affect API permissions)
export type ViewMode = "merchant_admin" | "staff" | null;

type AuthState = {
  loading: boolean;
  user: User | null;
  role: AppRole | null;
  merchantId: string | null;
  idToken: string | null;

  // Impersonation (UI only)
  viewAs: ViewMode;
  setViewAs: (view: ViewMode) => void;
  effectiveRole: AppRole | null; // role with viewAs applied

  // Auth methods
  signInWithGoogle: () => Promise<void>;
  sendEmailLink: (email: string) => Promise<void>;
  tryCompleteEmailLinkSignIn: () => Promise<void>;
  signOut: () => Promise<void>;

  // Token refresh (after claiming role)
  refreshToken: () => Promise<void>;
};

const Ctx = createContext<AuthState | undefined>(undefined);

const EMAIL_FOR_SIGNIN_KEY = "boost_emailForSignIn";

function getActionCodeSettings() {
  const url =
    process.env.NEXT_PUBLIC_EMAIL_LINK_REDIRECT ||
    (typeof window !== "undefined" ? window.location.origin + "/login" : "");

  return {
    url,
    handleCodeInApp: true,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authInstance, setAuthInstance] = useState<ReturnType<typeof getFirebaseAuth> | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [viewAs, setViewAs] = useState<ViewMode>(null);

  useEffect(() => {
    // Avoid initializing Firebase during SSR / build-time prerender.
    if (typeof window === "undefined") return;
    setAuthInstance(getFirebaseAuth());
  }, []);

  // Read impersonation state from localStorage ONLY after user is authenticated with a role
  useEffect(() => {
    if (typeof window === "undefined") return;
    // Only restore viewAs if user is authenticated and has owner role
    if (user && role === "owner") {
      const savedViewAs = localStorage.getItem("boost_view_as") as ViewMode;
      if (savedViewAs) setViewAs(savedViewAs);
    }
  }, [user, role]);

  // Sync viewAs to localStorage when it changes (only if we have a user)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!user) return; // Don't sync if not logged in
    if (viewAs) {
      localStorage.setItem("boost_view_as", viewAs);
    } else {
      localStorage.removeItem("boost_view_as");
    }
  }, [viewAs, user]);

  useEffect(() => {
    if (!authInstance) return;

    // If mobile Google sign-in used redirect flow, this resolves it.
    // It's safe to call even if there is no pending redirect result.
    getRedirectResult(authInstance).catch(() => {
      // ignore
    });

    const unsub = onAuthStateChanged(authInstance, async (u) => {
      setUser(u);
      if (!u) {
        setRole(null);
        setMerchantId(null);
        setIdToken(null);
        setViewAs(null);
        setLoading(false);
        return;
      }

      // Role resolution: read custom claims
      const tokenResult = await u.getIdTokenResult(true);
      const claimRole = tokenResult.claims.role as AppRole | undefined;
      const claimMerchantId = tokenResult.claims.merchant_id as string | undefined;

      setRole(claimRole || null);
      setMerchantId(claimMerchantId || null);
      setIdToken(tokenResult.token);
      setLoading(false);
    });
    return () => unsub();
  }, [authInstance]);

  // Compute effective role based on viewAs (UI impersonation)
  const effectiveRole = React.useMemo(() => {
    if (!role) return null;
    if (!viewAs) return role;

    // Owner can impersonate as merchant_admin or staff
    if (role === "owner") {
      return viewAs;
    }

    // Merchant admin can impersonate as staff only
    if (role === "merchant_admin" && viewAs === "staff") {
      return "staff";
    }

    // Otherwise return actual role
    return role;
  }, [role, viewAs]);

  const signInWithGoogle = useCallback(async () => {
    if (!authInstance) throw new Error("Auth not initialized yet");

    const provider = new GoogleAuthProvider();

    try {
      await signInWithPopup(authInstance, provider);
    } catch (err: any) {
      const code = err?.code;
      if (code === "auth/popup-closed-by-user") {
        throw new Error("Sign-in cancelled");
      } else if (code === "auth/popup-blocked") {
        throw new Error("Popup was blocked. Please allow popups for this site.");
      } else if (code === "auth/operation-not-allowed") {
        throw new Error("Google sign-in is not enabled. Please contact support.");
      } else {
        throw new Error(err?.message || "Failed to sign in with Google");
      }
    }
  }, [authInstance]);

  const sendEmailLink = useCallback(async (email: string) => {
    if (!authInstance) throw new Error("Auth not initialized yet");
    await sendSignInLinkToEmail(authInstance, email, getActionCodeSettings());
    window.localStorage.setItem(EMAIL_FOR_SIGNIN_KEY, email);
  }, [authInstance]);

  const tryCompleteEmailLinkSignIn = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!authInstance) return;
    if (!isSignInWithEmailLink(authInstance, window.location.href)) return;

    const email = window.localStorage.getItem(EMAIL_FOR_SIGNIN_KEY);
    if (!email) {
      throw new Error("Please enter your email address to complete sign-in");
    }

    try {
      await signInWithEmailLink(authInstance, email, window.location.href);
      window.localStorage.removeItem(EMAIL_FOR_SIGNIN_KEY);
    } catch (err: any) {
      window.localStorage.removeItem(EMAIL_FOR_SIGNIN_KEY);
      const code = err?.code;
      if (code === "auth/invalid-action-code") {
        throw new Error("This sign-in link has expired. Please request a new one.");
      } else if (code === "auth/invalid-email") {
        throw new Error("Invalid email address");
      } else {
        throw new Error(err?.message || "Failed to complete sign-in");
      }
    }
  }, [authInstance]);

  const signOut = useCallback(async () => {
    if (!authInstance) return;
    setViewAs(null);
    // Clear impersonation state from localStorage
    localStorage.removeItem("boost_view_as");
    localStorage.removeItem("boost_impersonate_merchant");
    await fbSignOut(authInstance);
  }, [authInstance]);

  const refreshToken = useCallback(async () => {
    if (!user) return;

    // Force refresh the token to get updated claims
    const tokenResult = await user.getIdTokenResult(true);
    const claimRole = tokenResult.claims.role as AppRole | undefined;
    const claimMerchantId = tokenResult.claims.merchant_id as string | undefined;

    setRole(claimRole || null);
    setMerchantId(claimMerchantId || null);
    setIdToken(tokenResult.token);
  }, [user]);

  const value: AuthState = {
    loading,
    user,
    role,
    merchantId,
    idToken,
    viewAs,
    setViewAs,
    effectiveRole,
    signInWithGoogle,
    sendEmailLink,
    tryCompleteEmailLinkSignIn,
    signOut,
    refreshToken,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
