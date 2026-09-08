import type { AuthStateUser } from "./use-demo-auth";

export const demoEmail = process.env.NEXT_PUBLIC_DEMO_EMAIL?.trim() ?? "";
export const demoPassword = process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? "";
export const demoUser: AuthStateUser = {
  name: "Demo Student",
  email: demoEmail,
  avatarInitials: "DS",
  isDemo: true
};

export function hasDemoCredentials(): boolean {
  return Boolean(demoEmail && demoPassword);
}

export function matchesDemoCredentials(email: string, password: string): boolean {
  return hasDemoCredentials() &&
    email.trim().toLowerCase() === demoEmail.toLowerCase() &&
    password === demoPassword;
}

export function readStoredDemoUser(): AuthStateUser | null {
  if (typeof window === "undefined" || !hasDemoCredentials()) {
    return null;
  }
  return localStorage.getItem("left-hand-demo-auth") === "true" ? demoUser : null;
}

export function persistDemoUser(): void {
  if (typeof window !== "undefined" && hasDemoCredentials()) {
    localStorage.setItem("left-hand-demo-auth", "true");
  }
}

export function clearStoredDemoUser(): void {
  if (typeof window !== "undefined" && hasDemoCredentials()) {
    localStorage.removeItem("left-hand-demo-auth");
  }
}
