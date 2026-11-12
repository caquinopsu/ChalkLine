import type { Metadata } from "next";
import { Caveat, Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google"; // fonts from DESIGN.md
import "katex/dist/katex.min.css"; // styles + fonts KaTeX needs to draw math (MathLive reuses these fonts)
import "./globals.css";

// Each font becomes a CSS variable that globals.css maps to Tailwind classes (font-display, font-hand, ...).
const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"], weight: ["600", "700"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const caveat = Caveat({ variable: "--font-caveat", subsets: ["latin"], weight: ["500", "600"] });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"], weight: ["500"] });

export const metadata: Metadata = {
  title: "Chalkline", // browser tab title
  description: "An AI calculus tutor. See the math move.", // shown in search results / link previews
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} ${caveat.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="h-dvh overflow-hidden font-sans">{children}</body>
    </html>
  );
}
