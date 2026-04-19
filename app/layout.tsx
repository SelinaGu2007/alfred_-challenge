import "./globals.css";

export const metadata = {
  title: "Alfred Decision Layer",
  description: "Minimal execution decision layer prototype"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
