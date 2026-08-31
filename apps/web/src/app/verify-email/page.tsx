import Link from "next/link";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const success = status === "success";

  return (
    <main className="grid min-h-[calc(100vh-64px)] place-items-center px-5 py-14 text-center">
      <div className="w-full max-w-105">
        <div
          className={`mx-auto grid h-16 w-16 place-items-center rounded-full border font-mono text-2xl ${
            success ? "border-accent-dim bg-accent/10 text-navy" : "border-[#f6d9d6] bg-danger/10 text-danger"
          }`}
        >
          {success ? "✓" : "!"}
        </div>
        <h1 className="mt-6 text-[clamp(26px,3.6vw,34px)] leading-[1.15] tracking-[-0.03em]">
          {success ? "Email verified." : "That link didn't work."}
        </h1>
        <p className="mt-5.5 text-[15.5px] leading-[1.55] text-[#7a7060]">
          {success
            ? "Your email is confirmed. You're all set."
            : "That verification link is invalid or has expired — request a fresh one from your dashboard."}
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block rounded-lg bg-accent px-6.5 py-3.5 text-[15px] font-semibold text-navy hover:opacity-90"
        >
          Go to dashboard
        </Link>
      </div>
    </main>
  );
}
