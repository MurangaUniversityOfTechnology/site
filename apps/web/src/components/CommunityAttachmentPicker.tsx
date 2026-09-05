"use client";

import { useRef, useState } from "react";
import { ApiError, communityApi } from "@/lib/api";

function isVideo(url: string): boolean {
  return url.includes("/video/upload/");
}

export function CommunityAttachmentPicker({
  attachments,
  onChange,
  max,
}: {
  attachments: string[];
  onChange: (urls: string[]) => void;
  max: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const remaining = max - attachments.length;
    const selected = Array.from(files).slice(0, remaining);
    setUploading(true);
    setError(null);
    try {
      const urls: string[] = [];
      for (const file of selected) {
        urls.push((await communityApi.uploadAttachment(file)).url);
      }
      onChange([...attachments, ...urls]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't upload that file.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="mt-2.5">
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((url) => (
            <div key={url} className="relative h-16 w-16 flex-none overflow-hidden rounded-md border border-border-strong">
              {isVideo(url) ? (
                <video src={url} className="h-full w-full object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="" className="h-full w-full object-cover" />
              )}
              <button
                type="button"
                onClick={() => onChange(attachments.filter((u) => u !== url))}
                aria-label="Remove attachment"
                className="absolute right-0.5 top-0.5 grid h-4.5 w-4.5 place-items-center rounded-full bg-navy-3/70 text-[10px] leading-none text-white"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {attachments.length < max && (
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-[13px] text-navy hover:underline">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
            multiple={max - attachments.length > 1}
            onChange={(e) => handleFiles(e.target.files)}
            disabled={uploading}
            className="hidden"
          />
          {uploading ? "Uploading…" : "+ Add photo/video"}
        </label>
      )}
      {error && <p className="mt-1 text-[12px] text-danger">{error}</p>}
    </div>
  );
}
