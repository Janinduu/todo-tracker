import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { NavLinks } from "./_components/NavLinks";

export const metadata: Metadata = {
  title: "Hii.Health Biomarker Co-Team",
  description: "Weekly to-do tracking for the Hii.Health Biomarker Co-Team.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-10 border-b border-line bg-surface/70 backdrop-blur-md">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-5 py-3">
            <Link
              href="/"
              className="text-sm font-semibold tracking-tight whitespace-nowrap"
            >
              Hii.Health <span className="text-accent">Biomarker Co-Team</span>
            </Link>
            <NavLinks />
          </div>
        </header>
        <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
