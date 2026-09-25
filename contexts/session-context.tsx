"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";

const SESSION_KEY = "kitchenmind.demo.session.user";
const SESSION_EVENT = "kitchenmind:session";

interface SessionContextValue {
  userId: string | null;
  signIn: (userId: string) => void;
  signOut: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

function subscribe(listener: () => void): () => void {
  window.addEventListener("storage", listener);
  window.addEventListener(SESSION_EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(SESSION_EVENT, listener);
  };
}

function getSnapshot(): string | null {
  return typeof window === "undefined" ? null : window.localStorage.getItem(SESSION_KEY);
}

export function SessionContextProvider({ children }: { children: React.ReactNode }) {
  const userId = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const signIn = useCallback((nextUserId: string) => {
    window.localStorage.setItem(SESSION_KEY, nextUserId);
    window.dispatchEvent(new Event(SESSION_EVENT));
  }, []);
  const signOut = useCallback(() => {
    window.localStorage.removeItem(SESSION_KEY);
    window.dispatchEvent(new Event(SESSION_EVENT));
  }, []);
  const value = useMemo(() => ({ userId, signIn, signOut }), [userId, signIn, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("SessionContext no está disponible.");
  return value;
}
