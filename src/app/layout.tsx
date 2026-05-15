import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Echo Twin",
  description: "Digital twin accountability — API server",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
