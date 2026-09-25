import { redirect } from "next/navigation";

export default async function DashboardAliasPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const input = await searchParams;
  const output = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) if (typeof value === "string") output.set(key, value);
  redirect(`/app${output.size ? `?${output.toString()}` : ""}`);
}
