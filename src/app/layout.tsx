import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "EduMate - Your AI Learning Companion",
  description: "Master any subject with AI-powered tutoring. Learn Languages, Science, History, Mathematics, Coding, and more with EduMate.",
  keywords: ["AI", "Education", "Learning", "Tutoring", "EduMate", "Languages", "Science", "Math", "Coding"],
  authors: [{ name: "EduMate Team" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${dmSans.variable} font-sans antialiased bg-white text-zinc-900`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
