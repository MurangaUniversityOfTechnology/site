import Link from "next/link";
import { events } from "@/lib/data";

export default function AdminEventsPage() {
  return (
    <div>
      <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">events</div>
      <h1 className="mt-3.5 text-[clamp(24px,3.4vw,36px)] tracking-[-0.035em]">Registrations by event</h1>

      <div className="mt-6.5 overflow-hidden rounded-[11px] border border-border bg-surface">
        {events.map((e) => (
          <Link
            key={e.slug}
            href={`/admin/events/${e.slug}`}
            className="flex items-center justify-between gap-4 border-b border-[#14191b] px-4.5 py-4 last:border-0"
          >
            <div>
              <div className="text-[15px] font-medium">{e.title}</div>
              <div className="mt-1 font-mono text-[10.5px] text-faint">{e.meta}</div>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-warn">manage →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
