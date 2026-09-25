import { getKitchenMindUser } from "@/services/auth-session.service";
import { assertSameOriginRequest, platformJson } from "@/services/platform-security.http";
import { operationsErrorStatus, TenantOperationsService } from "@/services/tenant-operations.service";

export const dynamic = "force-dynamic";

function serviceFor(identity: Awaited<ReturnType<typeof getKitchenMindUser>>) {
  return new TenantOperationsService(identity ? { authUserId: identity.id, email: identity.email, displayName: identity.displayName } : null);
}

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const identity = await getKitchenMindUser();
    const service = serviceFor(identity);
    return platformJson({ data: await service.snapshot({
      organizationId: url.searchParams.get("organizationId"),
      branchId: url.searchParams.get("branchId"),
      operationalDate: url.searchParams.get("operationalDate"),
      employeeSearch: url.searchParams.get("employeeSearch"),
      employeeStatus: url.searchParams.get("employeeStatus"),
      employeePage: url.searchParams.get("employeePage"),
      employeePageSize: url.searchParams.get("employeePageSize"),
      employeeId: url.searchParams.get("employeeId"),
    }) });
  } catch (error) {
    const detail = operationsErrorStatus(error);
    return platformJson({ error: detail.message, code: detail.code }, detail.status);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOriginRequest(request);
    if (Number(request.headers.get("content-length") ?? 0) > 500_000) return platformJson({ error: "La solicitud es demasiado grande.", code: "request_too_large" }, 413);
    const identity = await getKitchenMindUser();
    const service = serviceFor(identity);
    const payload: unknown = await request.json();
    if (!payload || typeof payload !== "object") return platformJson({ error: "Solicitud inválida.", code: "invalid_request" }, 400);
    const { action, data } = payload as { action?: unknown; data?: unknown };
    if (action === "create_employee") return platformJson({ data: await service.createEmployee(data) }, 201);
    if (action === "update_employee") return platformJson({ data: await service.updateEmployee(data) });
    if (action === "set_employee_status") return platformJson({ data: await service.setEmployeeStatus(data) });
    if (action === "synchronize_employees") return platformJson({ data: await service.synchronizeEmployees(data) });
    if (action === "preview_employee_import") return platformJson({ data: await service.previewEmployeeImport(data) });
    if (action === "commit_employee_import") return platformJson({ data: await service.commitEmployeeImport(data) }, 201);
    if (action === "create_shift") return platformJson({ data: await service.createShift(data) }, 201);
    if (action === "configure_shift") return platformJson({ data: await service.configureShift(data) });
    if (action === "assign_shift") return platformJson({ data: await service.assignShift(data) }, 201);
    if (action === "assign_branch") return platformJson({ data: await service.assignBranch(data) }, 201);
    if (action === "create_device") return platformJson({ data: await service.createDevice(data) }, 201);
    if (action === "configure_device") return platformJson({ data: await service.configureDevice(data) });
    if (action === "enroll_biometric") return platformJson({ data: await service.enrollBiometric(data) }, 201);
    if (action === "revoke_biometric") return platformJson({ data: await service.revokeBiometric(data) });
    if (action === "issue_device_credential") return platformJson({ data: await service.issueDeviceCredential(data) }, 201);
    if (action === "revoke_device_credential") return platformJson({ data: await service.revokeDeviceCredential(data) });
    if (action === "manual_attendance_adjustment") return platformJson({ data: await service.manualAttendanceAdjustment(data) }, 201);
    return platformJson({ error: "La acción no existe o pertenece a un módulo diferido.", code: "operations_action_not_found" }, 404);
  } catch (error) {
    const detail = operationsErrorStatus(error);
    return platformJson({ error: detail.message, code: detail.code }, detail.status);
  }
}
