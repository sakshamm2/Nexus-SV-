import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nexus SV",
  description: "AI knowledge chatbot",
  icons: { icon: "/logo.png", apple: "/icon-192.png" },
  appleWebApp: { capable: true, title: "Nexus SV", statusBarStyle: "black-translucent" },
};

// viewportFit "cover" lets the app use the full screen; page.tsx keeps content clear of the notch
export const viewport: Viewport = { themeColor: "#08060a", viewportFit: "cover" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}