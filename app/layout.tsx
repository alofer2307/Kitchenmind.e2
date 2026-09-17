import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProviders } from "@/contexts/app-providers";

export const metadata: Metadata = {
  title: "KitchenMind",
  description: "Sistema operativo digital para operaciones de alimentos.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#1769e0",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
