import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "EpiNote — Notes that become knowledge",
    template: "%s · EpiNote",
  },
  description: "A simple, intelligent workspace for notes and ideas.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
