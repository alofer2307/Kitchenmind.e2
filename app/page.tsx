import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signInPath, signOutPath, getKitchenMindUser } from "@/services/auth-session.service";
import { ProductAccessScreen } from "@/components/auth/product-access-screen";
import { getPlatformGate, PLATFORM_SESSION_COOKIE } from "@/services/platform-security.service";
import { CustomerOnboardingService } from "@/services/tenancy.service";

export const dynamic = "force-dynamic";

export default async function ProductEntryPage() {
  const identity = await getKitchenMindUser();
  if (!identity) return <ProductAccessScreen mode="signed_out" signInHref={signInPath("/")} />;

  const sessionToken = (await cookies()).get(PLATFORM_SESSION_COOKIE)?.value ?? null;
  let platformGate: Awaited<ReturnType<typeof getPlatformGate>> | null = null;
  try {
    platformGate = await getPlatformGate(identity, sessionToken);
  } catch (error) {
    console.error("KitchenMind entry platform check unavailable", error);
  }
  if (platformGate && ["enroll", "challenge", "granted"].includes(platformGate.kind)) redirect("/platform");

  let access: Awaited<ReturnType<CustomerOnboardingService["access"]>>;
  try {
    const service = new CustomerOnboardingService({ authUserId: identity.id, email: identity.email, displayName: identity.displayName });
    access = await service.access();
  } catch (error) {
    console.error("KitchenMind customer entry unavailable", error);
    return <ProductAccessScreen mode="unavailable" identityLabel={identity.displayName} signOutHref={signOutPath("/")} />;
  }
  const activeMemberships = access.organizations.filter((organization) => organization.membershipStatus === "active");
  if (activeMemberships.length > 1) redirect("/app/organizaciones");
  if (activeMemberships.length === 1) {
    const organization = activeMemberships[0];
    if (["active", "restricted"].includes(organization.status)) redirect(`/app?organizationId=${encodeURIComponent(organization.id)}`);
    if (!["suspended", "cancelled"].includes(organization.status)) redirect(`/app/onboarding?organizationId=${encodeURIComponent(organization.id)}`);
    return <ProductAccessScreen mode="restricted" identityLabel={identity.displayName} organizationName={organization.name} signOutHref={signOutPath("/")} />;
  }
  const suspendedMembership = access.organizations.find((organization) => organization.membershipStatus === "suspended");
  if (suspendedMembership) return <ProductAccessScreen mode="suspended" identityLabel={identity.displayName} organizationName={suspendedMembership.name} signOutHref={signOutPath("/")} />;
  return <ProductAccessScreen mode="no_membership" identityLabel={identity.displayName} signOutHref={signOutPath("/")} />;
}
