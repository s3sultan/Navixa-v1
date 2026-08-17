"use client";

const STORAGE_KEY = "navixa_admin_session_v2";
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

type AdminSession = {
  email: string;
  expiresAt: number;
};

export function saveAdminSession(email: string) {
  const session: AdminSession = { email, expiresAt: Date.now() + SESSION_DURATION_MS };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function readAdminSession(): AdminSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as AdminSession;
    if (session.email !== "s2shug@gmail.com" || !Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) {
      clearAdminSession();
      return null;
    }
    return session;
  } catch {
    clearAdminSession();
    return null;
  }
}

export function clearAdminSession() {
  localStorage.removeItem(STORAGE_KEY);
}
