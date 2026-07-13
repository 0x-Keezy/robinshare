import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RobinShare — route fees to builders",
  description:
    "Launch a coin for any builder on Robinhood Chain. 3% of every trade goes to a vault only they can claim — via GitHub, X, or wallet.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // el script de abajo fija data-robinshare-theme en este mismo tag ANTES
      // de que React hidrate (a propósito) — sin esto React marca ese atributo
      // como mismatch servidor/cliente, igual que ya vimos con extensiones
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {/* RobinShare (Legend): fija data-robinshare-theme ANTES de que React
            hidrate, leyendo localStorage. Sin esto, un usuario que ya eligió
            "light" vería un flash de oscuro (el default) antes de corregirse
            cuando React monta. Script síncrono e inline = bloquea el pintado
            hasta terminar, por eso corre a tiempo. Inocuo para el resto de
            las direcciones del bake-off (nadie más lee este atributo). */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              '(function(){try{var t=localStorage.getItem("robinshare-theme");' +
              'document.documentElement.setAttribute("data-robinshare-theme",' +
              '(t==="light"||t==="dark")?t:"dark");}catch(e){}})();',
          }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
