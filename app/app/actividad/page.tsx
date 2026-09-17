import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { OperationsScreen } from "@/components/operations/operations-screen";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{organizationId?:string;branchId?:string;operationalDate?:string}> }) { const params=await searchParams; await requireChatGPTUser("/app/actividad"); return <OperationsScreen section="activity" {...params}/>; }
