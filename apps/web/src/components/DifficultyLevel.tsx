export const DIFFICULTY_LABELS: Record<number, string> = {
  1: "Foundational",
  2: "Beginner",
  3: "Intermediate",
  4: "Advanced",
  5: "Expert",
};

export function difficultyLabel(level: number): string {
  return DIFFICULTY_LABELS[level] ?? "Foundational";
}

/** Compact 5-pip meter — gold fill up to `level`, hairline outline past it. */
export function DifficultyDots({ level, className = "" }: { level: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-[3px] ${className}`} title={`Level ${level} · ${difficultyLabel(level)}`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className="h-[5px] w-[5px] rounded-full"
          style={{ background: i <= level ? "#c9a84c" : "transparent", border: "1px solid #c9a84c", opacity: i <= level ? 1 : 0.35 }}
        />
      ))}
    </span>
  );
}
