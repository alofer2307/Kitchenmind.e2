import { requireKitchenMindUser } from "@/services/auth-session.service";
import { OperationsScreen } from "@/components/operations/operations-screen";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{organizationId?:string;branchId?:string;operationalDate?:string}> }) { const params=await searchParams; await requireKitchenMindUser("/app/actividad"); return <OperationsScreen section="activity" {...params}/>; }
