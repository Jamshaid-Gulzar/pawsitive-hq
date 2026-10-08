import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito_Sans } from "next/font/google";
import "./globals.css";

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const nunito = Nunito_Sans({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "Pawsitive HQ — Pet Care Command Center",
    template: "%s · Pawsitive HQ",
  },
  description:
    "Vaccine checks on autopilot, a live kennel and grooming board, and photo updates for pet parents.",
  appleWebApp: { capable: true, title: "Pawsitive", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#fbf7f2",
  // Draw under the notch and home bar; layouts pad with env(safe-area-inset-*).
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fredoka.variable} ${nunito.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
