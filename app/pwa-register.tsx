"use client"

import { useEffect } from "react"

export default function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/service-worker.js", { scope: "/" })
        .catch((error: unknown) => console.error("Service worker registration failed:", error))
    }
  }, [])

  return null
}
