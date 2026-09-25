export type PlatformAccessMode = "enroll" | "challenge" | "granted";

export interface PlatformIdentitySummary {
  displayName: string;
  email: string;
}

export interface PlatformSecurityEventSummary {
  id: string;
  action: string;
  outcome: "success" | "denied" | "failed";
  reason: string | null;
  createdAt: string;
}

export interface PlatformSecuritySnapshot {
  mfaEnabled: boolean;
  activeSessionCount: number;
  failedAttemptsLast24Hours: number;
  currentSessionExpiresAt: string;
  recentEvents: PlatformSecurityEventSummary[];
}
