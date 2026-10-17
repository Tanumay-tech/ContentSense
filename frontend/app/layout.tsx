import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { StatusProvider } from "@/components/layout/StatusProvider";

export const metadata: Metadata = {
  title: "ContentSense · Content & Market Intelligence",
  description: "Understand your content. Detect market trends. Discover your next opportunity.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f6f7f5" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <StatusProvider>
          <AppShell>{children}</AppShell>
        </StatusProvider>
      </body>
    </html>
  );
}
