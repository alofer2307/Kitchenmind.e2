"use client";

import { CloudCheck, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOfflineState } from "@/contexts/offline-context";

export function ConnectionBadge() {
  const { connected, pendingCount, retry } = useOfflineState();
  if (!connected) return <div className="flex items-center gap-2 rounded-xl bg-[#edf6ff] px-3 py-2 text-sm font-bold text-[#245f96]"><WifiOff className="size-4" /><span>Sin conexión — {pendingCount} pendientes</span></div>;
  if (pendingCount > 0) return <Button variant="outline" size="sm" className="rounded-xl" onClick={() => void retry()}><RefreshCw className="size-4" />Sincronizar {pendingCount}</Button>;
  return <div className="flex items-center gap-2 rounded-xl bg-[#e2faf2] px-3 py-2 text-sm font-bold text-[#08745e]"><CloudCheck className="size-4" /><span>Conectado</span></div>;
}
