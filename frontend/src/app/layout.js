import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Alert from "@/components/ui/Alert";
import TemperatureBadge from "@/components/ui/Nowcast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Istanbul Transport - Crowding Prediction",
  description: "AI-powered crowding predictions for Istanbul's public transportation system",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Alert />
        <TemperatureBadge />
      </body>
    </html>
  );
}
