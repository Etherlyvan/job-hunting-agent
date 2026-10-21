import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Job Agent | Personal career workspace",
  description:
    "Evidence-led job discovery, applications and interview preparation.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
