import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-[calc(100vh-64px)] place-items-center px-5 text-center">
      <div>
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">404</div>
        <h1 className="mt-3.5 text-[clamp(28px,4vw,40px)] leading-[1.05] tracking-[-0.035em]">
          That page doesn&apos;t exist.
        </h1>
        <p className="mt-4 text-[15.5px] leading-[1.6] text-[#9aa6a0]">
          It may have moved, or the link was wrong.
        </p>
        <Link
          href="/"
          className="mt-6.5 inline-block rounded-lg bg-accent px-6.5 py-3.5 text-[15px] font-semibold text-[#04140b] hover:opacity-90"
        >
          Back home
        </Link>
      </div>
    </main>
  );
}
