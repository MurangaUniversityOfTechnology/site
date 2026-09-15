import { apiFetch } from "./core";
import type { PaymentStatus } from "./shared";

export type DonationReason = "alumni" | "general" | "sponsorship" | "scholarship" | "other";

export type Donation = {
  id: string;
  status: PaymentStatus;
  amount: number;
  mpesa_receipt: string | null;
  reason: DonationReason;
  donor_name: string | null;
  message: string | null;
  created_at: string;
};

export type DonationWallEntry = {
  donor_name: string | null;
  reason: DonationReason;
  message: string | null;
  amount: number;
  created_at: string;
};

export const donationApi = {
  create: (payload: {
    amount: number;
    phone: string;
    reason: DonationReason;
    donor_name: string | null;
    is_anonymous: boolean;
    message: string | null;
  }) => apiFetch<Donation>("/donations", { method: "POST", body: JSON.stringify(payload) }),
  status: (id: string) => apiFetch<Donation>(`/donations/${id}`),
  wall: () => apiFetch<DonationWallEntry[]>("/donations/wall"),
};
