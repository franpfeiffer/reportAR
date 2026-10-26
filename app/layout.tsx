import type { Metadata } from "next";
import Script from "next/script";
import { IBM_Plex_Mono, Public_Sans } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

const publicSans = Public_Sans({ subsets: ["latin"], variable: "--font-public", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: "400", variable: "--font-plex-mono", display: "swap" });

export const metadata: Metadata = {
  title: "ReportAR | Gestión ciudadana",
  description: "Reportes ciudadanos y gestión municipal.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" suppressHydrationWarning className={`h-full antialiased ${publicSans.variable} ${plexMono.variable}`}>
      <body className="min-h-full flex flex-col">
        <Script id="reportar-theme-init" strategy="beforeInteractive">
          {`(()=>{try{const v=localStorage.getItem("reportar-theme-mode");const m=v==="dark"||v==="light"?v:"system";const d=m==="system"?matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light":m;document.documentElement.dataset.theme=d;document.documentElement.dataset.themeMode=m}catch{document.documentElement.dataset.theme=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.themeMode="system"}})()`}
        </Script>
        {children}
      </body>
    </html>
  );
}
