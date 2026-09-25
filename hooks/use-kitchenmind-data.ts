"use client";

import { useCallback, useEffect, useState } from "react";
import type { KitchenMindDataProvider } from "@/repositories";
import type { AuditEvent, Branch, BusinessProfile, Employee, InternalClient, InventoryLot, Organization, Plan, Product, PurchaseOrder, QualityTemplate, Shift, Subscription, Supplier, User } from "@/types";
import type { EmployeeFilters } from "@/repositories";
import { useDataProvider } from "@/contexts/data-provider-context";
import { getDashboardSnapshot, type DashboardSnapshot } from "@/services/dashboard.service";
import { useOrganizationSelection } from "@/contexts/organization-context";

interface QueryState<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

function useProviderQuery<T>(initial: T, loader: (provider: KitchenMindDataProvider) => Promise<T>): QueryState<T> {
  const { provider, revision } = useDataProvider();
  const [state, setState] = useState<QueryState<T>>({ data: initial, loading: true, error: null });

  useEffect(() => {
    let active = true;
    loader(provider)
      .then((data) => {
        if (active) setState({ data, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (active) setState((current) => ({ ...current, loading: false, error: error instanceof Error ? error.message : "No fue posible cargar los datos." }));
      });
    return () => {
      active = false;
    };
  }, [provider, revision, loader]);

  return state;
}

const loadOrganizations = (provider: KitchenMindDataProvider) => provider.organizations.list();
const loadBranches = (provider: KitchenMindDataProvider) => provider.branches.list();
const loadProducts = (provider: KitchenMindDataProvider) => provider.inventory.products.list();
const loadLots = (provider: KitchenMindDataProvider) => provider.inventory.lots.list();
const loadSuppliers = (provider: KitchenMindDataProvider) => provider.purchasing.suppliers.list();
const loadOrders = (provider: KitchenMindDataProvider) => provider.purchasing.orders.list();
const loadQualityTemplates = (provider: KitchenMindDataProvider) => provider.quality.templates.list();
const loadAuditEvents = async (provider: KitchenMindDataProvider) => (await provider.audit.list()).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
const loadUsers = (provider: KitchenMindDataProvider) => provider.users.list();
const loadShifts = (provider: KitchenMindDataProvider) => provider.shifts.list();
const loadClients = (provider: KitchenMindDataProvider) => provider.services.clients.list();
const loadProfiles = (provider: KitchenMindDataProvider) => provider.businessProfiles.list();
const loadPlans = (provider: KitchenMindDataProvider) => provider.plans.list();
const loadSubscriptions = (provider: KitchenMindDataProvider) => provider.subscriptions.list();

export const useOrganizations = (): QueryState<Organization[]> => useProviderQuery([], loadOrganizations);
export const useAllBranches = (): QueryState<Branch[]> => useProviderQuery([], loadBranches);
export const useUsers = (): QueryState<User[]> => useProviderQuery([], loadUsers);
export const useBusinessProfiles = (): QueryState<BusinessProfile[]> => useProviderQuery([], loadProfiles);
export const usePlans = (): QueryState<Plan[]> => useProviderQuery([], loadPlans);
export const useSubscriptions = (): QueryState<Subscription[]> => useProviderQuery([], loadSubscriptions);

export function useCurrentOrganization(): QueryState<Organization | null> {
  const organizations = useOrganizations();
  const { selectedOrganizationId } = useOrganizationSelection();
  const selected = organizations.data.find((organization) => organization.id === selectedOrganizationId && organization.status === "active");
  const fallback = organizations.data.find((organization) => organization.status === "active") ?? null;
  return { ...organizations, data: selected ?? fallback };
}

function useScopedQuery<T extends { organizationId: string }>(initial: T[], loader: (provider: KitchenMindDataProvider) => Promise<T[]>): QueryState<T[]> {
  const query = useProviderQuery(initial, loader);
  const { data: organization } = useCurrentOrganization();
  return { ...query, data: organization ? query.data.filter((item) => item.organizationId === organization.id) : [] };
}

export const useBranches = (): QueryState<Branch[]> => useScopedQuery([], loadBranches);
export const useProducts = (): QueryState<Product[]> => useScopedQuery([], loadProducts);
export const useInventoryLots = (): QueryState<InventoryLot[]> => useScopedQuery([], loadLots);
export const useSuppliers = (): QueryState<Supplier[]> => useScopedQuery([], loadSuppliers);
export const usePurchaseOrders = (): QueryState<PurchaseOrder[]> => useScopedQuery([], loadOrders);
export const useQualityTemplates = (): QueryState<QualityTemplate[]> => useScopedQuery([], loadQualityTemplates);
export const useAuditEvents = (): QueryState<AuditEvent[]> => useScopedQuery([], loadAuditEvents);
export const useShifts = (): QueryState<Shift[]> => useScopedQuery([], loadShifts);
export const useClients = (): QueryState<InternalClient[]> => useScopedQuery([], loadClients);

export function useDashboard(): QueryState<DashboardSnapshot | null> {
  const { data: organization } = useCurrentOrganization();
  const loadDashboard = useCallback(
    (provider: KitchenMindDataProvider) => organization ? getDashboardSnapshot(provider, organization.id) : Promise.resolve(null),
    [organization],
  );
  return useProviderQuery(null, loadDashboard);
}

export function useEmployees(filters: EmployeeFilters): QueryState<Employee[]> {
  const { provider, revision } = useDataProvider();
  const [state, setState] = useState<QueryState<Employee[]>>({ data: [], loading: true, error: null });
  const { organizationId, branchId, shiftId, status, query } = filters;

  useEffect(() => {
    let active = true;
    provider.employees
      .listFiltered({ organizationId, branchId, shiftId, status, query })
      .then((data) => { if (active) setState({ data, loading: false, error: null }); })
      .catch((error: unknown) => { if (active) setState({ data: [], loading: false, error: error instanceof Error ? error.message : "No fue posible cargar empleados." }); });
    return () => { active = false; };
  }, [provider, revision, organizationId, branchId, shiftId, status, query]);

  return state;
}
