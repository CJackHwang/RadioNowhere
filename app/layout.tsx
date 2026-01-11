import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import PwaRegistrar from "@/components/PwaRegistrar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://radionowhere.cjack.top"),
  title: {
    template: "%s | Radio Nowhere",
    default: "Radio Nowhere",
  },
  description: "The Frequency of the Lost. A real-time AI generated radio station broadcasting from an alternate reality.",
  keywords: ["AI Radio", "Generative Audio", "Music", "Radio Nowhere", "Sci-Fi", "Roleplay"],
  openGraph: {
    title: "Radio Nowhere",
    description: "The Frequency of the Lost. A real-time AI generated radio station.",
    url: "https://radionowhere.cjack.top",
    siteName: "Radio Nowhere",
    images: [
      {
        url: "/icon.png",
        width: 512,
        height: 512,
        alt: "Radio Nowhere Logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // App-like feel
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <PwaRegistrar />
        {children}
      </body>
    </html>
  );
}
