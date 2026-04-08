import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "uBlend Stock",
  description: "Stock take, production and delivery tracking for uBlend",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#7c3aed",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex flex-col">
          <Nav />
          <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-6">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
