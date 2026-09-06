import type { Metadata, Viewport } from "next";
import { Geist_Mono, Space_Grotesk, Instrument_Serif } from "next/font/google";
import "./styles/globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { ThemeInit } from "@/components/ui/ThemeInit";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-instrument-serif",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "RittikEvalOpsAI | Premium LLM Evaluation Platform",
  description: "Evaluate, compare, and ship AI models with confidence. Benchmark LLMs including GPT, Claude, Llama, and more with comprehensive evaluation metrics.",
  keywords: ["LLM evaluation", "AI benchmarking", "model comparison", "GPT", "Claude", "Llama", "AI testing"],
  authors: [{ name: "RittikEvalOpsAI" }],
  creator: "RittikEvalOpsAI",
  publisher: "RittikEvalOpsAI",
  formatDetection: { email: false, address: false, telephone: false },
  metadataBase: new URL("https://rittikevalops.ai"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://rittikevalops.ai",
    title: "RittikEvalOpsAI | Premium LLM Evaluation Platform",
    description: "Evaluate, compare, and ship AI models with confidence.",
    siteName: "RittikEvalOpsAI",
  },
  twitter: { card: "summary_large_image", title: "RittikEvalOpsAI | Premium LLM Evaluation Platform", description: "Evaluate, compare, and ship AI models with confidence." },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0F0F0F",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: React.PropsWithChildren) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${instrumentSerif.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground selection:bg-[#C8A96E] selection:text-[#0F0F0F]">
        <ThemeInit />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
