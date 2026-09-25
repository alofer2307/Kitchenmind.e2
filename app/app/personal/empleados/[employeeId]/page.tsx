import { requireKitchenMindUser } from "@/services/auth-session.service";
import { OperationsScreen } from "@/components/operations/operations-screen";
export const dynamic = "force-dynamic";
export default async function Page({ params, searchParams }: { params: Promise<{ employeeId:string }>; searchParams: Promise<{organizationId?:string;branchId?:string;operationalDate?:string}> }) { const route=await params; const query=await searchParams; await requireKitchenMindUser(`/app/personal/empleados/${route.employeeId}`); return <OperationsScreen section="employee" employeeId={route.employeeId} {...query}/>; }
