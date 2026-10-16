import type { Metadata } from "next";
import { Golos_Text, JetBrains_Mono, Unbounded } from "next/font/google";

import { SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

// The landing page fonts: Golos Text for text, Unbounded for headings, JetBrains Mono for labels.
const fontSans = Golos_Text({ variable: "--font-golos", subsets: ["latin", "cyrillic"] });
const fontDisplay = Unbounded({ variable: "--font-unbounded", subsets: ["latin", "cyrillic"] });
const fontMono = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  title: {
    default: "Личная CRM",
    template: "%s · Личная CRM",
  },
  description: "Люди, которых я знаю лично: кто это, откуда знакомы, как связаться и о чём договорились.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ru"
      className={`${fontSans.variable} ${fontDisplay.variable} ${fontMono.variable} dark h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        <div className="flex flex-1 flex-col">{children}</div>
        <Toaster position="top-center" closeButton />
      </body>
    </html>
  );
}
