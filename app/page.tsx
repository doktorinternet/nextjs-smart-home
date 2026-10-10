import { Metadata } from 'next'
import { redirect } from "next/navigation"
import { copy } from "./copy"

export const metadata: Metadata = {
  title: copy.metadata.applicationName,
}
export default function Page() {

  redirect("/dashboard");

  return (
    <div>
      <h1>{copy.dashboard.emptyHome}</h1>
    </div>
  )
}