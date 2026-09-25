import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Games",
  description: "Live quiz and tech bingo games at MUT Tech Community sessions — join with the PIN on the screen.",
};

export default function GamesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
