import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
};

const sections: { heading: string; body: string[] }[] = [
  {
    heading: "What we collect",
    body: [
      "Account info you give us directly: email address, and a password (stored as a salted hash, never in plain text) if you sign up that way.",
      "If you sign in with Google or GitHub instead, we receive your email and basic profile info from them, and — if you connect GitHub from your account settings — your GitHub username and ID.",
      "Membership and payment records: membership status, and M-Pesa payment confirmations (receipt number, amount, phone number) processed via Safaricom's Daraja API for membership payments.",
      "Anything else you choose to add to your profile (display name, bio, links) or submit through the site (projects, event RSVPs, challenge submissions).",
    ],
  },
  {
    heading: "Why we collect it",
    body: [
      "To create and secure your account, and keep you signed in (a session cookie — see Cookies below).",
      "To manage club membership: tracking who's active, processing membership payments, and sending renewal reminders.",
      "To run community features: event sign-ups and check-in, project listings, challenges, and the member directory.",
      "If you connect GitHub, to sync your access to the club's org repos and, for admins, to review project activity.",
    ],
  },
  {
    heading: "Who we share it with",
    body: [
      "Google and GitHub, only as part of the OAuth sign-in flow you initiate — we don't share your data with them beyond what that flow requires.",
      "Safaricom, to process M-Pesa membership payments you initiate.",
      "We don't sell your data, and we don't share it with anyone else outside of running the club's site and programs.",
    ],
  },
  {
    heading: "Cookies",
    body: [
      "We use a single session cookie to keep you signed in. We don't use tracking or advertising cookies.",
    ],
  },
  {
    heading: "Your data, your choices",
    body: [
      "You can update or remove most of your profile info yourself from account settings.",
      "To request a full export or deletion of your account data, email us (below) — we'll handle it directly.",
    ],
  },
  {
    heading: "Contact",
    body: [
      "Questions about this policy or your data: reach the MUT Tech Community team at hello@mutlabs.tech.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="px-5 py-12 sm:px-10 sm:py-14">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">legal</div>
      <h1 className="mt-3.5 text-[clamp(30px,5vw,52px)] leading-none uppercase tracking-[-0.04em]">
        Privacy Policy
      </h1>
      <p className="mt-4.5 max-w-[560px] text-[16.5px] leading-[1.55] text-[#7a7060]">
        This covers what MUT Tech Community collects, why, and who it&apos;s shared with. It applies to
        mutlabs.tech and its API.
      </p>

      <div className="mt-9 flex max-w-[640px] flex-col gap-8">
        {sections.map((s) => (
          <div key={s.heading}>
            <h2 className="text-[19px] font-semibold text-foreground">{s.heading}</h2>
            <div className="mt-2.5 flex flex-col gap-2.5">
              {s.body.map((p, i) => (
                <p key={i} className="text-[15px] leading-[1.6] text-muted">
                  {p}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
