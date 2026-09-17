import { chatGPTSignInPath, getChatGPTUser } from "@/app/chatgpt-auth";
import { InvitationScreen } from "@/components/customer/invitation-screen";

export const dynamic = "force-dynamic";

export default async function AcceptInvitationPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const identity = await getChatGPTUser();
  const returnTo = `/aceptar-invitacion?token=${encodeURIComponent(token)}`;
  return <InvitationScreen token={token} authenticated={Boolean(identity)} signInHref={chatGPTSignInPath(returnTo)} />;
}
