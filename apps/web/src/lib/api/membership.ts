import { apiFetch } from "./core";
import type { PaymentStatus } from "./shared";

export type Payment = {
  id: string;
  status: PaymentStatus;
  amount: number;
  phone: string;
  mpesa_receipt: string | null;
  created_at: string;
};

export type MembershipStatusResponse = {
  membership_status: string;
  latest_payment: Payment | null;
};

export const membershipApi = {
  activate: (phone: string) =>
    apiFetch<Payment>("/membership/activate", { method: "POST", body: JSON.stringify({ phone }) }),
  status: () => apiFetch<MembershipStatusResponse>("/membership/status"),
};
