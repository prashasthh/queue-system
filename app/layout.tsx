import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Tableline | Your table, without the wait",
  description: "Join the queue, explore the menu and order at Demo Restaurant.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
