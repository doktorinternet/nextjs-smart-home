import type { MetadataRoute } from "next"
import { copy } from "./copy"

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: copy.metadata.applicationName,
    short_name: copy.metadata.homeScreenTitle,
    description: copy.metadata.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#131f42",
    theme_color: "#131f42",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
