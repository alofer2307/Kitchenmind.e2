import { signInPath, getKitchenMindUser } from "@/services/auth-session.service";
import { InvitationScreen } from "@/components/customer/invitation-screen";

export const dynamic = "force-dynamic";

export default async function AcceptInvitationPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token = "", error } = await searchParams;
  const identity = await getKitchenMindUser();
  const returnTo = `/aceptar-invitacion?token=${encodeURIComponent(token)}`;
  return <InvitationScreen token={token} authenticated={Boolean(identity)} signInHref={signInPath(returnTo)} errorMessage={error} />;
}
