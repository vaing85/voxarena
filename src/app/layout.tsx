import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VoxArena",
  description: "Blind A/B battles for voice AI models, ranked by the crowd.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
