import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LOC - Lines of Code Counter",
  description: "Quickly analyze GitHub repositories. Get total lines of code, language breakdowns, and beautiful visualizations instantly.",
  openGraph: {
    title: "LOC - Lines of Code Counter",
    description: "Quickly analyze GitHub repositories. Get total lines of code, language breakdowns, and beautiful visualizations instantly.",
    url: "https://github.com/stripsior/loc", // Assuming base domain based on API
    siteName: "LOC Counter",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "LOC Counter Preview",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "LOC - Lines of Code Counter",
    description: "Quickly analyze GitHub repositories. Get total lines of code, language breakdowns, and beautiful visualizations instantly.",
    images: ["/og.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
