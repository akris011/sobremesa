import type { Metadata, Viewport } from "next";
import { Caveat, Cedarville_Cursive, Cormorant_Garamond, Gochi_Hand, Homemade_Apple, Kalam, Newsreader, Reenie_Beanie } from "next/font/google";
import { BottomNav } from "@/components/bottom-nav";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
});

// The other handwriting styles a family member can choose. Not preloaded: a page
// only downloads the hands that appear on it.
// next/font needs literal options, so each is spelled out.
const kalam = Kalam({ variable: "--font-kalam", subsets: ["latin", "latin-ext"], weight: "400", preload: false });
const cedarville = Cedarville_Cursive({ variable: "--font-cedarville", subsets: ["latin"], weight: "400", preload: false });
const homemade = Homemade_Apple({ variable: "--font-homemade", subsets: ["latin"], weight: "400", preload: false });
const reenie = Reenie_Beanie({ variable: "--font-reenie", subsets: ["latin"], weight: "400", preload: false });
const gochi = Gochi_Hand({ variable: "--font-gochi", subsets: ["latin"], weight: "400", preload: false });
const hands = [kalam, cedarville, homemade, reenie, gochi].map((f) => f.variable).join(" ");

export const metadata: Metadata = {
  title: { default: "Sobremesa", template: "%s · Sobremesa" },
  description: "A family cookbook kept around the dinners where the recipes are shared.",
  applicationName: "Sobremesa",
  appleWebApp: { capable: true, title: "Sobremesa", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f5eedf",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${cormorant.variable} ${newsreader.variable} ${caveat.variable} ${hands}`}>
      <body className="min-h-dvh">
        <div
          className="mx-auto min-h-dvh max-w-xl px-5"
          style={{
            paddingTop: "max(env(safe-area-inset-top, 0px), 0.75rem)",
            paddingBottom: "calc(var(--nav-h) + env(safe-area-inset-bottom, 0px) + 2rem)",
          }}
        >
          {children}
        </div>
        <BottomNav />
      </body>
    </html>
  );
}
