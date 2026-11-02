import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/ui/themes";
import { Doto, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Dot-matrix face for the radio LCD.
const doto = Doto({
  variable: "--font-doto",
  subsets: ["latin"],
});

// Compact Clerk modals so sign-up's four fields fit a short laptop window without scrolling.
// The shadcn theme puts Clerk's CSS in the "components" layer, so these Tailwind utilities win.
// A few of Clerk's rules are more specific than a utility, hence the ! (important) markers.
const compactAuth = {
  modalBackdrop: "items-center! py-4",
  modalContent: "my-0!",
  card: "gap-3! py-4!",
  headerSubtitle: "hidden",
  // Labels stay for screen readers; each input's placeholder names the field on screen.
  formFieldLabelRow: "sr-only",
  form: "gap-3! [&>div]:gap-2.5!",
  footerAction: "py-2.5!",
  footerItem: "[&>*]:py-1.5!",
};

export const metadata: Metadata = {
  title: "Nirvana",
  description: "Music and radio player",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${doto.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <ClerkProvider appearance={{ theme: shadcn, elements: compactAuth }}>{children}</ClerkProvider>
      </body>
    </html>
  );
}
