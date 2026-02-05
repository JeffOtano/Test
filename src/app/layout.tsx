import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Goodbye Shortcut - Migrate from Shortcut to Linear",
  description: "The best migration tool for teams moving from Shortcut to Linear. One-shot migration, gradual team transitions, and real-time sync.",
  keywords: ["Shortcut", "Linear", "migration", "project management", "team tools"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
