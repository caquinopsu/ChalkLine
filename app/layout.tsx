import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google"; // DM Sans for all text, JetBrains Mono for small code-like labels
import "katex/dist/katex.min.css"; // styles + fonts KaTeX needs to draw math (MathLive reuses these fonts)
import "./globals.css";

// Each font becomes a CSS variable that globals.css maps to Tailwind classes (font-display, font-hand, ...).
// One clean sans for headings, body text and notes (the board's math uses KaTeX's textbook fonts).
const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"], weight: ["500"] });

export const metadata: Metadata = {
  title: "Chalkline", // browser tab title
  description: "An AI calculus tutor. See the math move.", // shown in search results / link previews
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning // the script below may add data-theme="dark" before React starts
    >
      <head>
        {/* Dark mode, if this browser chose it: set before the first paint so the page never flashes light. */}
        <script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem("chalkline.theme")==="dark")document.documentElement.dataset.theme="dark"}catch(e){}` }} />
      </head>
      <body className="h-dvh overflow-hidden font-sans">{children}</body>
    </html>
  );
}
