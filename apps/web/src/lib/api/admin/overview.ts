import { apiFetch } from "../core";
import type { ExperienceLevel } from "../shared";

export type AdminOverview = {
  total_members: number;
  new_this_week: number;
  unmatched_payments: number;
};

export type MembershipApplication = {
  user_id: string;
  name: string;
  email: string;
  course: string | null;
  year_of_study: number | null;
  registration_number: string | null;
  payment_amount: number | null;
  payment_receipt: string | null;
  payment_status: string | null;
  membership_status: string;
  is_admin: boolean;
  goals: string[];
  experience_level: ExperienceLevel | null;
};

export type PaymentTotal = { label: string; amount_kes: number; count: number };
export type PaymentSource = "membership" | "donation" | "event";
export type PaymentRow = {
  receipt: string | null;
  source: PaymentSource;
  who: string;
  amount: number;
  status: string;
  created_at: string;
};
export type PaymentsOverview = { totals: PaymentTotal[]; rows: PaymentRow[] };
export type DonationRow = {
  receipt: string | null;
  donor: string;
  reason: string;
  amount: number;
  status: string;
  created_at: string;
};
export type DonationsOverview = { totals: PaymentTotal[]; rows: DonationRow[] };
export type AuditEntry = { at: string; who: string; what: string; kind: string };

export const adminOverviewApi = {
  overview: () => apiFetch<AdminOverview>("/admin/overview"),
  memberships: (statusFilter: string) =>
    apiFetch<MembershipApplication[]>(`/admin/memberships?status_filter=${statusFilter}`),
  payments: () => apiFetch<PaymentsOverview>("/admin/payments"),
  donations: () => apiFetch<DonationsOverview>("/admin/donations"),
  audit: (filters?: { kind?: string; q?: string; since?: string; until?: string }) => {
    const params = new URLSearchParams();
    if (filters?.kind) params.set("kind", filters.kind);
    if (filters?.q) params.set("q", filters.q);
    if (filters?.since) params.set("since", filters.since);
    if (filters?.until) params.set("until", filters.until);
    const qs = params.toString();
    return apiFetch<AuditEntry[]>(`/admin/audit${qs ? `?${qs}` : ""}`);
  },
};
