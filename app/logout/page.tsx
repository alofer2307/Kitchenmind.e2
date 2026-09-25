"use client";
import { useEffect } from "react";

export default function LogoutPage() {
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const raw = search.get("returnTo") ?? "/";
    const returnTo = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
    void (async () => {
      try { for (const key of await caches.keys()) await caches.delete(key); } catch {}
      try {
        if ("databases" in indexedDB && typeof indexedDB.databases === "function") {
          const databases = await indexedDB.databases();
          for (const database of databases) if (database.name?.startsWith("kitchenmind")) indexedDB.deleteDatabase(database.name);
        }
      } catch {}
      try { localStorage.removeItem("kitchenmind.demo.session.user"); sessionStorage.clear(); } catch {}
      window.location.replace(`/api/auth/logout?returnTo=${encodeURIComponent(returnTo)}`);
    })();
  }, []);
  return <main className="flex min-h-screen items-center justify-center bg-[#f4f8fc] p-5"><p className="text-sm font-semibold text-[#5f758a]">Cerrando sesión de forma segura…</p></main>;
}
