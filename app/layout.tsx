import "./globals.css"
import type { Metadata, Viewport } from "next"
import PwaRegister from "./pwa-register"

export const metadata: Metadata = {
  title: "Smart Home Kiosk",
  description: "A smart home status and control kiosk.",
  applicationName: "Smart Home Kiosk",
  appleWebApp: {
    capable: true,
    title: "Home Kiosk",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icon-192.svg", type: "image/svg+xml", sizes: "192x192" },
      { url: "/icon-512.svg", type: "image/svg+xml", sizes: "512x512" },
    ],
    apple: "/apple-touch-icon.svg",
  },
}

export const viewport: Viewport = {
  themeColor: "#131f42",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {

  return (
    <html lang="en" className="h-full w-full flex">
      <body className="flex grow h-full">
        <PwaRegister />
        {/* <div className="navbar flex flex-col gap-2 bg-gray-900 h-full">
            <Link href="/">Main</Link>
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/api/test">Hello endpoint</Link>
          </div> */}
        <div className="flex grow h-full">
          {children}
        </div>
      </body>
    </html>
  )
}
