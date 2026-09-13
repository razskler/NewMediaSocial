import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NewMediaSocial",
  description:
    "A chronological social feed — no algorithm, everyone sees everything.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-100 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
