import { requireKitchenMindUser } from "@/services/auth-session.service";
import { MobileAttendanceScreen } from "@/components/attendance/mobile-attendance-screen";

export const dynamic = "force-dynamic";

export default async function CheckAttendancePage() {
  await requireKitchenMindUser("/checar");
  return <MobileAttendanceScreen />;
}
