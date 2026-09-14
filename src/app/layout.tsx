import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NewMediaSocial",
  description:
    "Posts, photos, topics, and the people you follow — your corner of the internet.",
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
