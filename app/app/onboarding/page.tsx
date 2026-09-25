import { signOutPath, requireKitchenMindUser } from "@/services/auth-session.service";
import { CustomerOnboardingScreen } from "@/components/customer/onboarding-screen";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ organizationId?: string; section?: string }> }) {
  const { organizationId, section } = await searchParams;
  const identity = await requireKitchenMindUser(`/app/onboarding${organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ""}`);
  return <CustomerOnboardingScreen organizationId={organizationId} identityLabel={identity.displayName} signOutHref={signOutPath("/")} initialSectionCode={section} />;
}
