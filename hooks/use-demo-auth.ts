"use client";

import { useEffect, useState } from "react";
import { demoStudent, DemoStudent } from "@/data/student-demo";

const LOCAL_STORAGE_KEY = "left-hand-demo-auth";

export function useDemoAuth() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [user, setUser] = useState<DemoStudent | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const checkAuth = () => {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored === "true") {
      setIsLoggedIn(true);
      setUser(demoStudent);
    } else {
      setIsLoggedIn(false);
      setUser(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    checkAuth();

    // Custom event to sync auth state across components within the same tab
    const handleAuthChange = () => {
      checkAuth();
    };

    window.addEventListener("auth-state-change", handleAuthChange);
    window.addEventListener("storage", handleAuthChange);

    return () => {
      window.removeEventListener("auth-state-change", handleAuthChange);
      window.removeEventListener("storage", handleAuthChange);
    };
  }, []);

  const login = (email: string, password?: string): boolean => {
    if (email.trim().toLowerCase() === demoStudent.email.toLowerCase() && password === demoStudent.password) {
      localStorage.setItem(LOCAL_STORAGE_KEY, "true");
      setIsLoggedIn(true);
      setUser(demoStudent);
      // Dispatch event to notify other components (like Header)
      window.dispatchEvent(new Event("auth-state-change"));
      return true;
    }
    return false;
  };

  const logout = () => {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    setIsLoggedIn(false);
    setUser(null);
    window.dispatchEvent(new Event("auth-state-change"));
  };

  return { isLoggedIn, user, loading, login, logout };
}
