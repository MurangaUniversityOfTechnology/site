import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { Nav } from "@/components/Nav";
import { MobileNav } from "@/components/MobileNav";
import { ConfirmProvider } from "@/components/ConfirmDialog";
import { MeProvider } from "@/lib/useMe";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "MUT Tech Community",
    template: "%s · MUT Tech Community",
  },
  description:
    "A community of students at Murang'a University of Technology building real things with technology — in public, together, every week.",
  openGraph: {
    title: "MUT Tech Community",
    description:
      "A community of students at Murang'a University of Technology building real things with technology — in public, together, every week.",
    siteName: "MUT Tech Community",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MUT Tech Community",
    description: "Build. Learn. Ship. — a community of student builders at MUT.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <MeProvider>
          <ConfirmProvider>
            <Nav />
            {children}
            <MobileNav />
          </ConfirmProvider>
        </MeProvider>
      </body>
    </html>
  );
}
