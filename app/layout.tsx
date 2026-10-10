import "./globals.css"
import type { Metadata, Viewport } from "next"
import PwaRegister from "./pwa-register"
import { copy, language } from "./copy"

export const metadata: Metadata = {
  title: copy.metadata.title,
  description: copy.metadata.description,
  applicationName: copy.metadata.applicationName,
  appleWebApp: {
    capable: true,
    title: copy.metadata.homeScreenTitle,
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: "/apple-touch-icon.png",
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
    <html lang={language} className="h-full w-full flex">
      <body className="flex grow h-full">
        <PwaRegister />
        {/* <div className="navbar flex flex-col gap-2 bg-gray-900 h-full">
            <Link href="/">Start</Link>
            <Link href="/dashboard">Översikt</Link>
            <Link href="/api/test">Testgränssnitt</Link>
          </div> */}
        <div className="flex grow h-full">
          {children}
        </div>
      </body>
    </html>
  )
}
