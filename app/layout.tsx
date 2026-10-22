import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#000000",
};

export const metadata: Metadata = {
  title: "Young Vamp Life — discord.gg/yvl",
  description: "Young Vamp Life — discord.gg/yvl",
  openGraph: {
    title: "Young Vamp Life — discord.gg/yvl",
    description: "Young Vamp Life · discord.gg/yvl",
    type: "website",
    url: "https://narcissistboi.github.io/yvl/",
  },
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='24' fill='%23000000'/%3E%3Ctext x='50' y='73' font-family='Arial' font-size='66' font-weight='900' text-anchor='middle' fill='%23fa0202'%3Ey%3C/text%3E%3C/svg%3E",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
