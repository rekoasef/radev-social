import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
// Curated brand typefaces (@font-face only; files load when a page uses them).
import "@radev/slides/fonts";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RAdev Social",
  description: "Panel de gestión de carruseles para RAdev y Lumus.",
};

export const viewport: Viewport = {
  themeColor: "#0c0e12",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
