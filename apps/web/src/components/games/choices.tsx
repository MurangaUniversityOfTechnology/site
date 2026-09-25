// Each answer choice gets a fixed colour + shape, the same on the host's
// projector and every phone — so a player can match "the gold diamond" on
// screen without reading the text twice. All four stay on the club palette.
export const CHOICE_STYLES = [
  { shape: "▲", tile: "bg-navy text-white ring-1 ring-inset ring-white/30", bar: "bg-navy" },
  { shape: "◆", tile: "bg-accent text-navy", bar: "bg-accent" },
  { shape: "●", tile: "bg-[#8a5a12] text-white", bar: "bg-[#8a5a12]" },
  { shape: "■", tile: "border-2 border-navy bg-surface text-navy", bar: "bg-border-strong" },
] as const;

export function ChoiceShape({ index, className = "" }: { index: number; className?: string }) {
  return (
    <span aria-hidden="true" className={`font-mono leading-none ${className}`}>
      {CHOICE_STYLES[index].shape}
    </span>
  );
}
