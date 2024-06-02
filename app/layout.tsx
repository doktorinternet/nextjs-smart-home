import "./globals.css"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {

  return (
    <html lang="en" className="h-full w-full flex">
      <body className="flex grow h-full">
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