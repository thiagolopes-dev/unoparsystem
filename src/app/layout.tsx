import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "UnoparSystem — Gestão Acadêmica de Aulas",
  description:
    "Sistema minimalista de gestão de disciplinas, turmas, professores e grade de aulas com segurança RLS.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body
        suppressHydrationWarning
        className="min-h-screen bg-[#060913] text-slate-100 font-sans selection:bg-cyan-400/30 selection:text-cyan-100"
      >
        {children}
      </body>
    </html>
  );
}
