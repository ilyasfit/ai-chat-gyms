import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider"; // Import ThemeProvider

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MYA AI Assistant",
  description: "Powerful AI solutions",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system" // Default to dark as current UI is dark
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
        {/* ElevenLabs Convai Widget */}
        <div
          dangerouslySetInnerHTML={{
            __html:
              '<elevenlabs-convai agent-id="vNsUiF8EdRUktvmiPxkV"></elevenlabs-convai>',
          }}
        />
      </body>
    </html>
  );
}
