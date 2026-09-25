import type { KitchenMindDataProvider } from "@/repositories";

/**
 * Future adapter boundary. The concrete implementation will map every repository
 * operation to PostgreSQL/Supabase and enforce tenant isolation with RLS.
 */
export type SupabaseProviderContract = KitchenMindDataProvider;
