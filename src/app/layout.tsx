import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "PackItO",
  description: "Gestión digital de paquetes para edificios",
  applicationName: "PackItO",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icon-192.png",
  },
  // iOS anterior a 16.4 ignora `display: standalone` del manifest y necesita
  // estos meta para abrir sin la barra de Safari cuando se agrega al inicio.
  appleWebApp: {
    capable: true,
    title: "PackItO",
    statusBarStyle: "black",
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0B",
  width: "device-width",
  initialScale: 1,
  // Sin `cover`, los env(safe-area-inset-*) valen 0 y en un iPhone con notch
  // queda una franja del color del body a los costados en horizontal.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen bg-ink-900 font-sans text-ink-100 antialiased">
        {children}
      </body>
    </html>
  );
}
