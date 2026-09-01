import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
};

const sections: { heading: string; body: string[] }[] = [
  {
    heading: "Who this is for",
    body: [
      "MUT Tech Community is a student tech club at Murang'a University of Technology. This site is for members and prospective members of the club — creating an account means you agree to these terms.",
    ],
  },
  {
    heading: "Membership",
    body: [
      "Membership is granted at the club's discretion and may require a membership payment via M-Pesa. Membership can lapse or be renewed as described on the site at the time.",
      "We may suspend or terminate an account that violates these terms, misuses the platform, or engages in abusive behavior toward other members or organizers.",
    ],
  },
  {
    heading: "Code of conduct",
    body: [
      "Be respectful. Harassment, discrimination, or abusive behavior toward other members isn't tolerated, on the site or at club events, and is grounds for removal from the community.",
      "Don't misuse the platform — no spam, no attempts to access accounts or data that aren't yours, no disrupting events or other members' participation.",
    ],
  },
  {
    heading: "Payments",
    body: [
      "Membership payments are processed via Safaricom's M-Pesa Daraja API. Payment confirmations are handled automatically; if a payment doesn't reflect correctly, contact us (below) with your M-Pesa receipt number.",
      "Refunds are handled case by case — reach out if something needs correcting.",
    ],
  },
  {
    heading: "Your content",
    body: [
      "Anything you post — profile info, project listings, challenge submissions — remains yours. By posting it, you give the club permission to display it on the site as part of normal club activity (e.g. the member directory, project showcase).",
      "Don't post anything you don't have the right to share, or anything illegal, harmful, or infringing.",
    ],
  },
  {
    heading: "Third-party sign-in",
    body: [
      "Signing in with Google or GitHub, or connecting your GitHub account, is subject to that provider's own terms in addition to these.",
    ],
  },
  {
    heading: "No warranty",
    body: [
      "This site is run by a student club on a best-effort basis. It's provided as-is, without warranty of any kind — we'll fix things when we can, but we don't guarantee uninterrupted or error-free service.",
    ],
  },
  {
    heading: "Changes to these terms",
    body: [
      "We may update these terms as the club and site evolve. Continuing to use the site after a change means you accept the update.",
    ],
  },
  {
    heading: "Contact",
    body: [
      "Questions about these terms: reach the MUT Tech Community team at hello@mutlabs.tech.",
    ],
  },
];

export default function TermsPage() {
  return (
    <main className="px-5 py-12 sm:px-10 sm:py-14">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">legal</div>
      <h1 className="mt-3.5 text-[clamp(30px,5vw,52px)] leading-none uppercase tracking-[-0.04em]">
        Terms of Service
      </h1>
      <p className="mt-4.5 max-w-[560px] text-[16.5px] leading-[1.55] text-[#7a7060]">
        The ground rules for using mutlabs.tech and being part of MUT Tech Community.
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
