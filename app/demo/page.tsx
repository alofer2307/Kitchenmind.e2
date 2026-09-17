import { DashboardScreen } from "@/components/dashboard/dashboard-screen";
import { AdminShell } from "@/components/layout/admin-shell";

export default function DemoPage() {
  return <AdminShell><DashboardScreen /></AdminShell>;
}
