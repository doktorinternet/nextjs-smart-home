import { Metadata } from 'next'
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: 'Test app',
}
export default function Page() {

  redirect("/dashboard");

  return (
    <div>
      <h1>This is / which doesn&apos;t have any info yet. You should be automatically redirected to /dashboard</h1>
    </div>
  )
}