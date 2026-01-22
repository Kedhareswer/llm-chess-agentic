import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/header";
import { TickCountdown } from "@/components/tick-countdown";

export const metadata: Metadata = {
  title: "LLM Chess Arena",
  description: "Watch AI models compete in chess",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white text-black">
        <div className="flex h-screen flex-col">
          <Header />
          <TickCountdown />
          <main className="flex-1 overflow-hidden">{children}</main>
        </div>
      </body>
    </html>
  );
}
