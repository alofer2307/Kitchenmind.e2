import { getChatGPTUser } from "@/app/chatgpt-auth";
import { attendanceExportFilename, buildAttendanceCsv, buildAttendanceXlsx } from "@/services/attendance-export";
import { operationsErrorStatus, TenantOperationsService } from "@/services/tenant-operations.service";
import { platformJson } from "@/services/platform-security.http";
import { toResponseBody } from "@/utils/response-body";

export const dynamic = "force-dynamic";

export async function GET(request:Request):Promise<Response>{
  try{
    const url=new URL(request.url);const identity=await getChatGPTUser();
    const service=new TenantOperationsService(identity?{authUserId:identity.id,email:identity.email,displayName:identity.displayName}:null);
    const organizationId=url.searchParams.get("organizationId");const operationalDate=url.searchParams.get("operationalDate");const branchId=url.searchParams.get("branchId");const format=url.searchParams.get("format")??"csv";
    if(!organizationId||!operationalDate)return platformJson({error:"Falta organización o fecha operacional.",code:"invalid_export_request"},400);
    const rows=await service.attendanceExport({organizationId,branchId,operationalDate});
    const snapshot=await service.snapshot({organizationId,branchId,operationalDate,employeePageSize:10});
    if(format==="csv"){const body=buildAttendanceCsv(rows);return new Response(toResponseBody(body),{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="${attendanceExportFilename(snapshot.organization.code,operationalDate,"csv")}"`,"Cache-Control":"private, no-store"}});}
    if(format==="xlsx"){const body=buildAttendanceXlsx(rows);return new Response(toResponseBody(body),{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","Content-Disposition":`attachment; filename="${attendanceExportFilename(snapshot.organization.code,operationalDate,"xlsx")}"`,"Cache-Control":"private, no-store"}});}
    return platformJson({error:"Formato no soportado.",code:"invalid_export_format"},400);
  }catch(error){const detail=operationsErrorStatus(error);return platformJson({error:detail.message,code:detail.code},detail.status);}
}
