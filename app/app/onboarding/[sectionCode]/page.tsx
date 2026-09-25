import { signOutPath, requireKitchenMindUser } from "@/services/auth-session.service";
import { CustomerOnboardingScreen } from "@/components/customer/onboarding-screen";

export const dynamic = "force-dynamic";

export default async function OnboardingSectionPage({ params, searchParams }: { params: Promise<{ sectionCode: string }>; searchParams: Promise<{ organizationId?: string }> }) {
  const [{ sectionCode }, { organizationId }] = await Promise.all([params, searchParams]);
  const returnTo = `/app/onboarding/${encodeURIComponent(sectionCode)}${organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ""}`;
  const identity = await requireKitchenMindUser(returnTo);
  return <CustomerOnboardingScreen organizationId={organizationId} identityLabel={identity.displayName} signOutHref={signOutPath("/")} initialSectionCode={sectionCode} />;
}
