import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FlipStack CRM",
  description: "Production reseller CRM for inventory, buyers, hauls, bundles, labels, and profit.",
  icons: {
    icon: "/assets/favicon-32.png",
    apple: "/assets/favicon-192.png"
  },
  openGraph: {
    title: "FlipStack CRM",
    description: "Reseller CRM for social-first sellers.",
    images: ["/assets/flipstack-tab-lockup.png"]
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
