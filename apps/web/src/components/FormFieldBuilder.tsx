"use client";

import { useEffect, useState } from "react";
import { ApiError, adminApi, type AdminFieldRow, type ChoiceItem, type FieldType } from "@/lib/api";
import { useConfirm } from "@/components/ConfirmDialog";

const CHOICE_TYPES: FieldType[] = ["single_choice", "multi_choice", "dropdown"];

const TYPE_LABELS: Record<FieldType, string> = {
  short_text: "Short text",
  long_text: "Paragraph",
  single_choice: "Single choice",
  multi_choice: "Multiple choice",
  dropdown: "Dropdown",
  yes_no: "Yes / no",
  rating: "Rating (1-5)",
  date: "Date",
  number: "Number",
  email: "Email",
};

export function FormFieldBuilder({ formSlug }: { formSlug: string }) {
  const [fields, setFields] = useState<AdminFieldRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirm();

  useEffect(() => {
    adminApi.listFormFields(formSlug).then(setFields);
  }, [formSlug]);

  async function refresh() {
    setFields(await adminApi.listFormFields(formSlug));
  }

  async function addField() {
    setError(null);
    try {
      await adminApi.createFormField(formSlug, {
        type: "short_text",
        prompt: "New question",
        help_text: null,
        required: true,
        choices: [],
      });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add field.");
    }
  }

  async function removeField(id: string) {
    const ok = await confirm({ title: "Delete field?", message: "This can't be undone." });
    if (!ok) return;
    try {
      await adminApi.deleteFormField(id);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete field.");
    }
  }

  async function reorder(id: string, direction: "up" | "down") {
    await adminApi.reorderFormField(id, direction);
    await refresh();
  }

  if (!fields) return null;

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-sm text-danger">{error}</p>}
      {fields.length === 0 && <p className="text-sm text-muted">No fields yet.</p>}
      {fields.map((f, i) => (
        <FieldEditor
          key={f.id}
          field={f}
          isFirst={i === 0}
          isLast={i === fields.length - 1}
          onSaved={refresh}
          onDelete={() => removeField(f.id)}
          onReorder={(direction) => reorder(f.id, direction)}
        />
      ))}
      <button
        type="button"
        onClick={addField}
        className="w-fit rounded-md border border-border-strong px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted"
      >
        + add field
      </button>
    </div>
  );
}

function FieldEditor({
  field,
  isFirst,
  isLast,
  onSaved,
  onDelete,
  onReorder,
}: {
  field: AdminFieldRow;
  isFirst: boolean;
  isLast: boolean;
  onSaved: () => void;
  onDelete: () => void;
  onReorder: (direction: "up" | "down") => void;
}) {
  const [type, setType] = useState<FieldType>(field.type);
  const [prompt, setPrompt] = useState(field.prompt);
  const [helpText, setHelpText] = useState(field.help_text ?? "");
  const [required, setRequired] = useState(field.required);
  const [choices, setChoices] = useState<ChoiceItem[]>(field.choices.length > 0 ? field.choices : [{ id: "a", text: "" }, { id: "b", text: "" }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const isChoiceType = CHOICE_TYPES.includes(type);

  function updateChoice(i: number, text: string) {
    setChoices((cs) => cs.map((c, idx) => (idx === i ? { ...c, text } : c)));
    setSaved(false);
  }

  function addChoice() {
    if (choices.length >= 5) return;
    const nextId = String.fromCharCode(97 + choices.length); // a, b, c, …
    setChoices((cs) => [...cs, { id: nextId, text: "" }]);
    setSaved(false);
  }

  function removeChoice(i: number) {
    if (choices.length <= 2) return;
    setChoices((cs) => cs.filter((_, idx) => idx !== i));
    setSaved(false);
  }

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await adminApi.updateFormField(field.id, {
        type,
        prompt: prompt.trim(),
        help_text: helpText.trim() || null,
        required,
        choices: isChoiceType ? choices : [],
      });
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save field.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-border-strong bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value as FieldType);
              setSaved(false);
            }}
            className="mb-2 rounded-md border border-border-strong bg-surface px-2.5 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.06em] outline-none focus:border-accent"
          >
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <textarea
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              setSaved(false);
            }}
            rows={2}
            placeholder="Question"
            className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => onReorder("up")}
            disabled={isFirst}
            className="rounded-md border border-border-strong px-2 py-1 text-xs text-muted disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onReorder("down")}
            disabled={isLast}
            className="rounded-md border border-border-strong px-2 py-1 text-xs text-muted disabled:opacity-30"
          >
            ↓
          </button>
          <button type="button" onClick={onDelete} className="rounded-md border border-[#f6d9d6] px-2 py-1 text-xs text-danger">
            ×
          </button>
        </div>
      </div>

      <input
        value={helpText}
        onChange={(e) => {
          setHelpText(e.target.value);
          setSaved(false);
        }}
        placeholder="Help text shown under the question (optional)"
        className="mt-2.5 w-full rounded-md border border-border-strong bg-surface px-3 py-1.5 text-[13px] outline-none focus:border-accent"
      />

      {isChoiceType && (
        <div className="mt-3 flex flex-col gap-2">
          <div className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-faint">choices</div>
          {choices.map((c, i) => (
            <div key={c.id} className="flex items-center gap-2">
              <input
                value={c.text}
                onChange={(e) => updateChoice(i, e.target.value)}
                placeholder={`Choice ${c.id}`}
                className="flex-1 rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent"
              />
              {choices.length > 2 && (
                <button type="button" onClick={() => removeChoice(i)} className="rounded-md border border-border-strong px-2 py-1 text-xs text-muted">
                  ×
                </button>
              )}
            </div>
          ))}
          {choices.length < 5 && (
            <button
              type="button"
              onClick={addChoice}
              className="w-fit font-mono text-[10px] uppercase tracking-[0.08em] text-muted"
            >
              + add choice
            </button>
          )}
        </div>
      )}

      <label className="mt-3 flex w-fit items-center gap-2 text-[13px] text-muted">
        <input
          type="checkbox"
          checked={required}
          onChange={(e) => {
            setRequired(e.target.checked);
            setSaved(false);
          }}
          className="accent-accent"
        />
        Required
      </label>

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="mt-3 rounded-md bg-accent px-3.5 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-[#1a2744] disabled:opacity-50"
      >
        {busy ? "Saving…" : saved ? "Saved ✓" : "Save field"}
      </button>
    </div>
  );
}
