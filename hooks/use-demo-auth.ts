"use client";

import { useEffect, useState, useTransition } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/browser";
import { mapAuthError } from "@/lib/auth/error-mapper";
import {
  performSignup,
  mapSignupError,
  getValidCallbackUrl,
  validateSignupInput,
  validateSignupFullName,
  type SignupResult,
  type SignupParams,
  type SignupInputValidation
} from "@/lib/auth/signup";

type DemoAuthRuntime = typeof import("./demo-auth-runtime");
let demoRuntimePromise: Promise<DemoAuthRuntime> | null = null;

function loadDemoRuntime(): Promise<DemoAuthRuntime> {
  demoRuntimePromise ??= import("./demo-auth-runtime");
  return demoRuntimePromise;
}

export {
  performSignup,
  mapSignupError,
  getValidCallbackUrl,
  validateSignupInput,
  validateSignupFullName,
  type SignupResult,
  type SignupParams,
  type SignupInputValidation
};

export interface AuthStateUser {
  id?: string;
  name: string;
  email: string;
  avatarInitials: string;
  faculty?: string;
  major?: string;
  isDemo?: boolean;
}

function getInitialsFromEmailOrName(nameOrEmail: string): string {
  const clean = nameOrEmail.replace(/^tutor\s+/i, "").trim();
  const parts = clean.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return clean.substring(0, 2).toUpperCase();
}

export function useDemoAuth() {
  const isDemoMode =
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const demoEmail = isDemoMode ? process.env.NEXT_PUBLIC_DEMO_EMAIL?.trim() ?? "" : "";
  const [user, setUser] = useState<AuthStateUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | undefined;

    const initializeAuth = async () => {
      let demoRuntime: DemoAuthRuntime | null = null;
      if (isDemoMode) {
        try {
          demoRuntime = await loadDemoRuntime();
        } catch {
          demoRuntime = null;
        }
      }

      const supabase = createClient();

      // Initial user check
      supabase.auth.getUser().then(({ data: { user: authUser } }) => {
        if (!isMounted) return;

        if (authUser) {
          const email = authUser.email ?? "";
          const fullName =
            (authUser.user_metadata?.full_name as string) ||
            (authUser.user_metadata?.name as string) ||
            email.split("@")[0] ||
            "Học viên";

          setUser({
            id: authUser.id,
            name: fullName,
            email: email,
            avatarInitials: getInitialsFromEmailOrName(fullName)
          });
        } else if (demoRuntime?.hasDemoCredentials()) {
          setUser(demoRuntime.readStoredDemoUser());
        } else {
          setUser(null);
        }
        setLoading(false);
      }).catch(() => {
        if (isMounted) {
          if (demoRuntime?.hasDemoCredentials()) {
            setUser(demoRuntime.readStoredDemoUser());
          } else {
            setUser(null);
          }
          setLoading(false);
        }
      });

      // Listen for auth state changes
      const {
        data: { subscription }
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!isMounted) return;

        if (session?.user) {
          const email = session.user.email ?? "";
          const fullName =
            (session.user.user_metadata?.full_name as string) ||
            (session.user.user_metadata?.name as string) ||
            email.split("@")[0] ||
            "Học viên";

          setUser({
            id: session.user.id,
            name: fullName,
            email: email,
            avatarInitials: getInitialsFromEmailOrName(fullName)
          });
        } else if (demoRuntime?.hasDemoCredentials()) {
          setUser(demoRuntime.readStoredDemoUser());
        } else {
          setUser(null);
        }
        setLoading(false);
      });
      unsubscribe = () => subscription.unsubscribe();
    };

    void initializeAuth().catch(() => {
      if (isMounted) {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, [isDemoMode]);

  const login = async (email: string, password?: string): Promise<{ success: boolean; error?: string }> => {
    // If in demo mode and user submitted demo credentials
    if (isDemoMode) {
      try {
        const demoRuntime = await loadDemoRuntime();
        if (demoRuntime.matchesDemoCredentials(email, password || "")) {
          demoRuntime.persistDemoUser();
          setUser(demoRuntime.demoUser);
          return { success: true };
        }
      } catch {
        // Fall through to real auth if the local fixture is unavailable.
      }
    }

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password || ""
      });

      if (error) {
        return { success: false, error: mapAuthError(error, "login").message };
      }

      if (data.user) {
        const userEmail = data.user.email ?? "";
        const fullName =
          (data.user.user_metadata?.full_name as string) ||
          (data.user.user_metadata?.name as string) ||
          userEmail.split("@")[0] ||
          "Học viên";

        setUser({
          id: data.user.id,
          name: fullName,
          email: userEmail,
          avatarInitials: getInitialsFromEmailOrName(fullName)
        });
        return { success: true };
      }

      return {
        success: false,
        error: "Không tìm thấy thông tin tài khoản."
      };
    } catch (err: unknown) {
      return { success: false, error: mapAuthError(err, "login").message };
    }
  };

  const signup = async (
    email: string,
    password?: string,
    fullNameOrRedirect?: string,
    emailRedirectOrFullName?: string
  ): Promise<SignupResult> => {
    const thirdArgumentIsRedirect = Boolean(
      fullNameOrRedirect && /^https?:\/\//i.test(fullNameOrRedirect)
    );
    const fullName = thirdArgumentIsRedirect
      ? emailRedirectOrFullName
      : fullNameOrRedirect;
    const emailRedirectTo = thirdArgumentIsRedirect
      ? fullNameOrRedirect
      : emailRedirectOrFullName && /^https?:\/\//i.test(emailRedirectOrFullName)
        ? emailRedirectOrFullName
        : undefined;

    try {
      const supabase = createClient();
      return await performSignup(supabase, {
        email,
        password,
        emailRedirectTo,
        fullName: fullName || ""
      });
    } catch (err: unknown) {
      return {
        success: false,
        error: mapSignupError(err)
      };
    }
  };

  const logout = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // Ignore signOut network errors in local dev
    }

    if (isDemoMode) {
      try {
        const demoRuntime = await loadDemoRuntime();
        demoRuntime.clearStoredDemoUser();
      } catch {
        // Ignore unavailable local fixture cleanup.
      }
    }
    setUser(null);
  };

  return {
    isLoggedIn: !!user,
    user,
    loading,
    isDemoMode,
    demoEmail,
    login,
    signup,
    logout
  };
}
