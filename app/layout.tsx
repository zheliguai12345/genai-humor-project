import type { Metadata } from "next";
import { Geist, Newsreader } from "next/font/google";
import Link from "next/link";
import { SiteHeader } from "./components/site-header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const editorial = Newsreader({ variable: "--font-editorial", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Elsewhere, NYC.", template: "%s | Elsewhere, NYC." },
  description: "One city. A thousand ways to live it. Imaginative journeys through real New York places.",
  applicationName: "Elsewhere, NYC.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${editorial.variable} h-full antialiased`}
    >
      <body><a className="skip-link" href="#main-content">Skip to content</a><SiteHeader />{children}
        <footer className="site-footer"><Link className="footer-brand" href="/">Elsewhere, NYC.</Link><Link href="/privacy">Privacy &amp; your data</Link></footer>
      </body>
    </html>
  );
}
