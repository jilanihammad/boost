"use client";

import {
  GoogleAuthProvider,
  User,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
  signOut as fbSignOut,
} from "firebase/auth";
import React, { createContext, useContext, useEffect, useState } from "react";
import { getFirebaseAuth } from "@/lib/firebase";

export type AppRole = "consumer" | "merchant" | "admin";

type AuthState = {
  loading: boolean;
  user: User | null;
  role: AppRole | null;
  idToken: string | null;
  signInWithGoogle: () => Promise<void>;
  sendEmailLink: (email: string) => Promise<void>;
  tryCompleteEmailLinkSignIn: () => Promise<void>;
  signOut: () => Promise<void>;
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
  const [idToken, setIdToken] = useState<string | null>(null);

  useEffect(() => {
    // Avoid initializing Firebase during SSR / build-time prerender.
    if (typeof window === "undefined") return;
    setAuthInstance(getFirebaseAuth());
  }, []);

  useEffect(() => {
    if (!authInstance) return;
    const unsub = onAuthStateChanged(authInstance, async (u) => {
      setUser(u);
      if (!u) {
        setRole(null);
        setIdToken(null);
        setLoading(false);
        return;
      }

      // Placeholder role resolution:
      // In v0, read custom claims `role` (set by backend/admin tooling) if present.
      const tokenResult = await u.getIdTokenResult(true);
      const claimRole = tokenResult.claims.role as AppRole | undefined;
      setRole(claimRole || "consumer");
      setIdToken(tokenResult.token);
      setLoading(false);
    });
    return () => unsub();
  }, [authInstance]);

  async function signInWithGoogle() {
    if (!authInstance) throw new Error("Auth not initialized yet");
    await signInWithPopup(authInstance, new GoogleAuthProvider());
  }

  async function sendEmailLink(email: string) {
    if (!authInstance) throw new Error("Auth not initialized yet");
    await sendSignInLinkToEmail(authInstance, email, getActionCodeSettings());
    window.localStorage.setItem(EMAIL_FOR_SIGNIN_KEY, email);
  }

  async function tryCompleteEmailLinkSignIn() {
    if (typeof window === "undefined") return;
    if (!authInstance) return;
    if (!isSignInWithEmailLink(authInstance, window.location.href)) return;

    const email = window.localStorage.getItem(EMAIL_FOR_SIGNIN_KEY);
    if (!email) {
      // v0: require user to re-enter email if not present.
      return;
    }

    await signInWithEmailLink(authInstance, email, window.location.href);
    window.localStorage.removeItem(EMAIL_FOR_SIGNIN_KEY);
  }

  async function signOut() {
    if (!authInstance) return;
    await fbSignOut(authInstance);
  }

  const value: AuthState = {
    loading,
    user,
    role,
    idToken,
    signInWithGoogle,
    sendEmailLink,
    tryCompleteEmailLinkSignIn,
    signOut,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
