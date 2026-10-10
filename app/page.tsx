import { Metadata } from 'next'
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: 'Smart Home',
}
export default function Page() {

  redirect("/dashboard");

  return (
    <div>
      <h1>Startsidan saknar innehåll och du skickas vidare till översikten.</h1>
    </div>
  )
}