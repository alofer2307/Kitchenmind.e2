"use client";

import { useEffect, useState } from "react";
import { Check, Clipboard, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { BrandMark } from "@/components/brand/brand-mark";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import type { PlatformIdentitySummary } from "@/types";

interface SetupResponse {
  secret: string;
  authenticatorUri: string;
  enrollmentToken: string;
  expiresAt: string;
}

interface RecoveryResponse {
  recoveryCodes: string[];
}

interface ErrorResponse {
  error?: string;
}

async function readResponse<T>(response: Response): Promise<T> {
  const body = await response.json() as T & ErrorResponse;
  if (!response.ok) throw new Error(body.error ?? "No fue posible completar la verificación.");
  return body;
}

export function PlatformSecurityGate({
  mode,
  identity,
  signOutHref,
}: {
  mode: "enroll" | "challenge";
  identity: PlatformIdentitySummary;
  signOutHref: string;
}) {
  const [setup, setSetup] = useState<SetupResponse | null>(null);
  const [code, setCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(mode === "enroll");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "enroll") return;
    let active = true;
    fetch("/api/platform/mfa/setup", { cache: "no-store", credentials: "same-origin" })
      .then((response) => readResponse<SetupResponse>(response))
      .then((result) => { if (active) setSetup(result); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "No fue posible preparar el autenticador."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [mode]);

  const submit = async () => {
    if (submitting || (mode === "enroll" && !setup)) return;
    setSubmitting(true);
    setError(null);
    try {
      const endpoint = mode === "enroll" ? "/api/platform/mfa/enroll" : "/api/platform/mfa/challenge";
      const payload = mode === "enroll" ? { code, enrollmentToken: setup?.enrollmentToken } : { code };
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (mode === "enroll") {
        const result = await readResponse<RecoveryResponse>(response);
        setRecoveryCodes(result.recoveryCodes);
      } else {
        await readResponse<Record<string, unknown>>(response);
        window.location.replace("/platform");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible verificar el código.");
      setCode("");
    } finally {
      setSubmitting(false);
    }
  };

  const copy = async (value: string, message: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(message);
    } catch {
      toast.error("No fue posible copiarlo. Selecciónalo manualmente.");
    }
  };

  if (recoveryCodes) {
    return <SecurityPage>
      <Card className="w-full max-w-xl rounded-[1.75rem] border-[#cfe2ef] shadow-[0_28px_80px_rgba(24,52,81,.12)]">
        <CardContent className="p-7 sm:p-9">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-[#e4faf4] text-[#087c65]"><Check className="size-6" /></div>
          <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.15em] text-[#168e8b]">MFA activado</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-[#102b48]">Guarda tus códigos de recuperación</h1>
          <p className="mt-3 text-base leading-6 text-[#647a90]">Cada código puede utilizarse una sola vez si pierdes acceso al autenticador. KitchenMind no volverá a mostrarlos.</p>
          <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl border border-[#dbe7f2] bg-[#f6f9fc] p-4 sm:grid-cols-5">
            {recoveryCodes.map((recoveryCode) => <code key={recoveryCode} className="rounded-lg bg-white px-2 py-2 text-center text-xs font-bold text-[#183451]">{recoveryCode}</code>)}
          </div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Button variant="outline" className="h-11 rounded-xl" onClick={() => void copy(recoveryCodes.join("\n"), "Códigos copiados.")}><Clipboard className="size-4" />Copiar códigos</Button>
            <Button className="h-11 flex-1 rounded-xl" onClick={() => window.location.replace("/platform")}>Ya los guardé; abrir Platform</Button>
          </div>
        </CardContent>
      </Card>
    </SecurityPage>;
  }

  return <SecurityPage>
    <Card className="w-full max-w-lg rounded-[1.75rem] border-[#cfe2ef] shadow-[0_28px_80px_rgba(24,52,81,.12)]">
      <CardContent className="p-7 sm:p-9">
        <div className="flex items-start justify-between gap-4">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-[#e8f2ff] text-[#1769e0]"><LockKeyhole className="size-6" /></div>
          <span className="rounded-full bg-[#eef9f8] px-3 py-1 text-xs font-extrabold text-[#168e8b]">Acceso de fundadora</span>
        </div>
        <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.15em] text-[#168e8b]">KitchenMind Platform</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-[#102b48]">{mode === "enroll" ? "Protege tu panel privado" : "Confirma que eres tú"}</h1>
        <p className="mt-3 text-base leading-6 text-[#647a90]">{mode === "enroll" ? "Vincula una aplicación de autenticación antes de administrar cuentas de clientes." : `Escribe el código de tu autenticador para continuar como ${identity.displayName}.`}</p>

        {mode === "enroll" && <div className="mt-6 rounded-2xl border border-[#dbe7f2] bg-[#f6f9fc] p-4">
          {loading && <p className="text-sm font-semibold text-[#6a7e94]">Preparando una clave segura…</p>}
          {setup && <>
            <p className="text-sm font-extrabold text-[#203a57]">1. Agrega una cuenta en tu autenticador</p>
            <p className="mt-2 text-sm leading-5 text-[#687d92]">Usa la clave manual o abre una aplicación compatible en este dispositivo.</p>
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-white p-3">
              <code className="min-w-0 flex-1 break-all text-sm font-bold tracking-[0.12em] text-[#183451]">{setup.secret.match(/.{1,4}/g)?.join(" ")}</code>
              <Button size="icon" variant="ghost" aria-label="Copiar clave" onClick={() => void copy(setup.secret, "Clave copiada.")}><Clipboard className="size-4" /></Button>
            </div>
            <Button asChild variant="outline" className="mt-3 w-full rounded-xl"><a href={setup.authenticatorUri}><KeyRound className="size-4" />Abrir en autenticador</a></Button>
          </>}
        </div>}

        <div className="mt-6">
          <p className="text-sm font-extrabold text-[#203a57]">{mode === "enroll" ? "2. Confirma el código" : useRecovery ? "Código de recuperación" : "Código de seis dígitos"}</p>
          {useRecovery ? <Input className="mt-3 h-12 rounded-xl font-mono uppercase" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="KM-XXXX-XXXX" autoComplete="one-time-code" /> : <InputOTP maxLength={6} value={code} onChange={setCode} inputMode="numeric" autoComplete="one-time-code" containerClassName="mt-3 justify-center" aria-label="Código de autenticación"><InputOTPGroup>{Array.from({ length: 6 }, (_, index) => <InputOTPSlot key={index} index={index} className="h-12 w-11 text-lg font-extrabold" />)}</InputOTPGroup></InputOTP>}
        </div>

        {error && <Alert variant="destructive" className="mt-5"><ShieldCheck className="size-4" /><AlertTitle>No se pudo verificar</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

        <Button className="mt-5 h-12 w-full rounded-xl text-base font-bold" disabled={submitting || loading || (useRecovery ? code.trim().length < 10 : code.length !== 6)} onClick={() => void submit()}>{submitting ? "Verificando…" : "Verificar y continuar"}</Button>
        {mode === "challenge" && <Button variant="ghost" className="mt-2 w-full rounded-xl text-[#1769e0]" onClick={() => { setUseRecovery((current) => !current); setCode(""); setError(null); }}>{useRecovery ? "Usar mi autenticador" : "Usar código de recuperación"}</Button>}
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#e4edf5] pt-5 text-xs text-[#71869a]"><span>{identity.email}</span><a href={signOutHref} target="_top" className="font-bold text-[#1769e0] hover:underline">Cambiar cuenta</a></div>
      </CardContent>
    </Card>
  </SecurityPage>;
}

function SecurityPage({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-[radial-gradient(circle_at_top,#dffaf7_0,#f4f8fc_48%,#eaf2fa_100%)] p-5"><div className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-6xl flex-col"><div className="py-3"><BrandMark /></div><div className="flex flex-1 items-center justify-center py-8">{children}</div></div></main>;
}
