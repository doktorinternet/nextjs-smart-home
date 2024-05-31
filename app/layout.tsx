import "./globals.css"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {

  return (
    <html lang="en" className="h-full w-full">
      <body className="flex h-full">
        {/* <div className="navbar flex flex-col gap-2 bg-gray-900 h-full">
            <Link href="/">Main</Link>
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/api/test">Hello endpoint</Link>
          </div> */}
        <div className="main w-full h-full">
          {children}
        </div>
      </body>
    </html>
  )
}