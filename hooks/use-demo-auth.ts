"use client";

import { useEffect, useState, useTransition } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/browser";
import { demoStudent, DemoStudent } from "@/data/student-demo";

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
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const [user, setUser] = useState<AuthStateUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let isMounted = true;

    try {
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
        } else if (isDemoMode && typeof window !== "undefined") {
          const stored = localStorage.getItem("left-hand-demo-auth");
          if (stored === "true") {
            setUser({
              ...demoStudent,
              isDemo: true
            });
          } else {
            setUser(null);
          }
        } else {
          setUser(null);
        }
        setLoading(false);
      }).catch(() => {
        if (isMounted) {
          if (isDemoMode && typeof window !== "undefined") {
            const stored = localStorage.getItem("left-hand-demo-auth");
            if (stored === "true") {
              setUser({
                ...demoStudent,
                isDemo: true
              });
            } else {
              setUser(null);
            }
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
        } else if (isDemoMode && typeof window !== "undefined") {
          const stored = localStorage.getItem("left-hand-demo-auth");
          if (stored === "true") {
            setUser({
              ...demoStudent,
              isDemo: true
            });
          } else {
            setUser(null);
          }
        } else {
          setUser(null);
        }
        setLoading(false);
      });

      return () => {
        isMounted = false;
        subscription.unsubscribe();
      };
    } catch {
      if (isMounted) {
        if (isDemoMode && typeof window !== "undefined") {
          const stored = localStorage.getItem("left-hand-demo-auth");
          if (stored === "true") {
            setUser({
              ...demoStudent,
              isDemo: true
            });
          } else {
            setUser(null);
          }
        } else {
          setUser(null);
        }
        setLoading(false);
      }
    }
  }, [isDemoMode]);

  const login = async (email: string, password?: string): Promise<{ success: boolean; error?: string }> => {
    // If in demo mode and user submitted demo credentials
    if (
      isDemoMode &&
      email.trim().toLowerCase() === demoStudent.email.toLowerCase() &&
      password === demoStudent.password
    ) {
      if (typeof window !== "undefined") {
        localStorage.setItem("left-hand-demo-auth", "true");
      }
      setUser({
        ...demoStudent,
        isDemo: true
      });
      return { success: true };
    }

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password || ""
      });

      if (error) {
        if (error.message.toLowerCase().includes("email not confirmed") || error.message.toLowerCase().includes("unconfirmed")) {
          return {
            success: false,
            error: "Email của bạn chưa được xác thực. Vui lòng kiểm tra hộp thư (hoặc mục Spam) để nhấn link xác thực tài khoản."
          };
        }
        if (error.message.toLowerCase().includes("invalid login credentials") || error.message.toLowerCase().includes("invalid credentials")) {
          return {
            success: false,
            error: "Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại thông tin đăng nhập."
          };
        }
        return {
          success: false,
          error: error.message || "Đăng nhập không thành công. Vui lòng thử lại sau."
        };
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
      const message = err instanceof Error ? err.message : "Có lỗi xảy ra trong quá trình đăng nhập.";
      return {
        success: false,
        error: message
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

    if (typeof window !== "undefined") {
      localStorage.removeItem("left-hand-demo-auth");
    }
    setUser(null);
  };

  return {
    isLoggedIn: !!user,
    user,
    loading,
    isDemoMode,
    login,
    logout
  };
}
