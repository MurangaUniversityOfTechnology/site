"use client";

import { useState } from "react";
import Link from "next/link";
import { ApiError, adminApi, type AdminRegistrationRow, type EventEmailAudience } from "@/lib/api";
import { useConfirm } from "@/components/ConfirmDialog";

const AUDIENCES: { value: EventEmailAudience; label: string; statuses: string[] }[] = [
  { value: "confirmed", label: "Confirmed", statuses: ["approved", "attended"] },
  { value: "attended", label: "Attended", statuses: ["attended"] },
  { value: "pending", label: "Pending", statuses: ["pending"] },
  { value: "waitlisted", label: "Waitlisted", statuses: ["waitlisted"] },
  { value: "everyone", label: "Everyone", statuses: ["approved", "attended", "pending", "waitlisted"] },
];

/** "Email registrants" on an event's admin page — the standard reminder
 * on demand, or a one-off message (venue change, what to bring, slides
 * afterwards). Never reaches rejected or cancelled registrations. */
export function EventEmailPanel({ slug, rows, eventStarted }: { slug: string; rows: AdminRegistrationRow[]; eventStarted: boolean }) {
  const confirm = useConfirm();
  const [audience, setAudience] = useState<EventEmailAudience>("confirmed");
  const [kind, setKind] = useState<"reminder" | "custom">(eventStarted ? "custom" : "reminder");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const count = (a: EventEmailAudience) =>
    rows.filter((r) => AUDIENCES.find((x) => x.value === a)!.statuses.includes(r.status)).length;
  const recipients = count(audience);
  const reminderBlocked = kind === "reminder" && eventStarted;
  const canSend = recipients > 0 && !reminderBlocked && (kind === "reminder" || (subject.trim() && message.trim()));

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const label = AUDIENCES.find((a) => a.value === audience)!.label.toLowerCase();
    const ok = await confirm({
      title: `Email ${recipients} ${recipients === 1 ? "person" : "people"}?`,
      message:
        kind === "reminder"
          ? `The standard reminder goes to ${label} registrants now.`
          : `"${subject.trim()}" goes to ${label} registrants now. This can't be unsent.`,
      confirmLabel: "Send",
      danger: false,
    });
    if (!ok) return;
    setBusy(true);
    setResult(null);
    try {
      const res =
        kind === "reminder"
          ? await adminApi.emailRegistrants(slug, { audience, kind })
          : await adminApi.emailRegistrants(slug, {
              audience,
              kind,
              subject: subject.trim(),
              message: message.trim(),
              ...(linkUrl.trim() && { link_url: linkUrl.trim(), link_label: linkLabel.trim() || undefined }),
            });
      setResult({ ok: true, text: `Sending to ${res.queued} ${res.queued === 1 ? "person" : "people"} ✓` });
      if (kind === "custom") {
        setSubject("");
        setMessage("");
        setLinkUrl("");
        setLinkLabel("");
      }
    } catch (err) {
      setResult({ ok: false, text: err instanceof ApiError ? err.message : "Couldn't send — try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={send} className="mt-6 rounded-[11px] border border-border bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">email registrants</div>
        <Link href="/admin/event-reminders" className="font-mono text-[10px] uppercase tracking-[0.1em] text-accent-dim hover:underline">
          automatic reminder settings →
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Who to email">
        {AUDIENCES.map((a) => {
          const n = count(a.value);
          const on = audience === a.value;
          return (
            <button
              key={a.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setAudience(a.value)}
              className={`rounded-md px-3 py-2 font-mono text-[10.5px] uppercase tracking-[0.1em] ${
                on ? "bg-accent text-navy" : "border border-border-strong text-muted hover:text-foreground"
              }`}
            >
              {a.label} <span className="opacity-70">{n}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <KindOption
          checked={kind === "reminder"}
          onChange={() => setKind("reminder")}
          title="Standard reminder"
          text={eventStarted ? "Only for events that haven't started." : "Event time, venue and their ticket link."}
          disabled={eventStarted}
        />
        <KindOption checked={kind === "custom"} onChange={() => setKind("custom")} title="Custom message" text="Write your own, e.g. a venue change or what to bring." />
      </div>

      {kind === "custom" && (
        <div className="mt-4 flex flex-col gap-2.5">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={150}
            placeholder="Subject"
            aria-label="Subject"
            className="rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={5000}
            rows={5}
            placeholder={"Message. Each person gets \"Hi <name>,\" first, and the event's time and venue plus a link at the end."}
            aria-label="Message"
            className="resize-y rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-sm leading-[1.55] outline-none focus:border-accent"
          />
          <div className="grid gap-2.5 sm:grid-cols-[1fr_200px]">
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="Button link (optional), e.g. a feedback form"
              aria-label="Button link"
              className="min-w-0 rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
            />
            <input
              value={linkLabel}
              onChange={(e) => setLinkLabel(e.target.value)}
              maxLength={40}
              disabled={!linkUrl.trim()}
              placeholder="Button text"
              aria-label="Button text"
              className="min-w-0 rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent disabled:opacity-50"
            />
          </div>
          <p className="text-[12px] leading-[1.45] text-muted">
            {linkUrl.trim() ? "The button opens this link instead of their ticket." : "Without a link, the button opens their ticket or the event page."}
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy || !canSend}
          className="rounded-md bg-accent px-4.5 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-navy hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "sending…" : `send to ${recipients}`}
        </button>
        {recipients === 0 && <span className="text-[13px] text-muted">Nobody in this group yet.</span>}
        {result && <span className={`text-[13px] ${result.ok ? "text-accent-dim" : "text-danger"}`}>{result.text}</span>}
      </div>
    </form>
  );
}

function KindOption({
  checked,
  onChange,
  title,
  text,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  title: string;
  text: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3.5 py-3 ${
        checked ? "border-accent-dim bg-accent/[0.06]" : "border-border"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <input type="radio" checked={checked} onChange={onChange} disabled={disabled} className="mt-1 accent-[#ad8a45]" />
      <span>
        <span className="block text-[14px] font-medium">{title}</span>
        <span className="mt-0.5 block text-[12.5px] leading-[1.45] text-muted">{text}</span>
      </span>
    </label>
  );
}
