import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Space_Grotesk, VT323 } from "next/font/google";
import Link from "next/link";
import Eq from "@/components/Eq";
import RadioPlayer from "@/components/RadioPlayer";
import "./globals.css";

const sans = Space_Grotesk({ subsets: ["latin"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });
const pixel = VT323({ subsets: ["latin"], weight: "400", variable: "--font-pixel" });

export const metadata: Metadata = {
  title: "fwd.fm · encaminha música pra qualquer streaming",
  description:
    "Cola um link do Spotify, YouTube, Deezer ou Amazon Music e manda pros amigos. Cada um abre no streaming que usa.",
};

export const viewport: Viewport = {
  themeColor: "#07070c",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${sans.variable} ${mono.variable} ${pixel.variable}`}>
      <body>
        <header className="topbar shell">
          <Link href="/" className="logo" aria-label="fwd.fm, início">
            <Eq />
            <span className="logo-text">fwd.fm</span>
          </Link>
          <span className="status">
            <span className="status-dot" /> on air · 128kbps de amor
          </span>
        </header>
        <main className="shell">{children}</main>
        <footer className="footer shell">
          fwd.fm · feito de fone de ouvido · links via song.link &amp; Deezer
        </footer>
        <RadioPlayer />
      </body>
    </html>
  );
}
