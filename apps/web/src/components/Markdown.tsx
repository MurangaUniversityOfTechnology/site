"use client";

import { isValidElement } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { MermaidDiagram } from "./MermaidDiagram";

const components: Components = {
  h1: ({ children }) => <h2 className="mt-8 text-[26px] font-semibold tracking-[-0.02em] first:mt-0">{children}</h2>,
  h2: ({ children }) => <h3 className="mt-7 text-[21px] font-semibold tracking-[-0.015em] first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="mt-6 text-[17px] font-semibold first:mt-0">{children}</h4>,
  p: ({ children }) => <p className="mt-4 text-[15px] leading-[1.7] text-foreground first:mt-0">{children}</p>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-navy underline hover:opacity-80">
      {children}
    </a>
  ),
  ul: ({ children }) => <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-[15px] leading-[1.6]">{children}</ul>,
  ol: ({ children }) => <ol className="mt-3 flex list-decimal flex-col gap-1.5 pl-5 text-[15px] leading-[1.6]">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="mt-4 border-l-2 border-accent-dim pl-4 text-[15px] italic text-muted">{children}</blockquote>
  ),
  img: ({ src, alt }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt ?? ""} className="mt-4 max-w-full rounded-lg border border-border" />
  ),
  hr: () => <hr className="my-7 border-border" />,
  table: ({ children }) => (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full border-collapse text-[13.5px]">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-border-strong bg-surface-raised px-3 py-1.5 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="border border-border px-3 py-1.5">{children}</td>,
  code(props) {
    const { className, children } = props;
    const isBlock = /language-/.test(className ?? "");
    if (!isBlock) {
      return <code className="rounded bg-surface-raised px-1.5 py-0.5 font-mono text-[13px]">{children}</code>;
    }
    const text = String(children).replace(/\n$/, "");
    if (className === "language-mermaid") return <MermaidDiagram source={text} />;
    return <code className={className}>{children}</code>;
  },
  pre: ({ children }) => {
    // A mermaid block's `code` renderer already returns a <MermaidDiagram>,
    // which shouldn't sit inside the bordered/mono code-box styling meant
    // for actual code.
    if (isValidElement(children) && children.type === MermaidDiagram) return children;
    return (
      <pre className="mt-4 overflow-x-auto rounded-lg border border-border-strong bg-background p-4 font-mono text-[13px] leading-[1.6]">
        {children}
      </pre>
    );
  },
};

export function Markdown({ children }: { children: string }) {
  return (
    <div>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
