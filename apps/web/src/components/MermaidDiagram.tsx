"use client";

import { useEffect, useId, useState } from "react";

export function MermaidDiagram({ source }: { source: string }) {
  const id = useId().replace(/:/g, "-");
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    import("mermaid").then(async (mod) => {
      const mermaid = mod.default;
      mermaid.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "strict" });
      try {
        const { svg: rendered } = await mermaid.render(`mermaid-${id}`, source);
        if (!active) return;
        setSvg(rendered);
        setFailed(false);
      } catch {
        if (!active) return;
        setSvg(null);
        setFailed(true);
      }
    });
    return () => {
      active = false;
    };
  }, [id, source]);

  if (failed) {
    return (
      <div className="my-4 rounded-lg border border-[#f0c9c4] bg-danger/[0.04] p-4">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-danger">Couldn&apos;t render this diagram</div>
        <pre className="mt-2 overflow-x-auto text-[12.5px] text-muted">{source}</pre>
      </div>
    );
  }

  if (!svg) {
    return <div className="my-4 h-20 animate-pulse rounded-lg bg-border" />;
  }

  // Mermaid's own render output — trusted to the same degree as the lesson
  // body itself, which only admins author.
  return <div className="my-4 overflow-x-auto" dangerouslySetInnerHTML={{ __html: svg }} />;
}
