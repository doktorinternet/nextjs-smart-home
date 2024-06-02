// the simple embeds don't seem to work properly on my ipad kiosk..

// https://developer.spotify.com/documentation/web-playback-sdk/howtos/web-app-player

export default function WebPlayer() {
  return (
    // small
    // <iframe src="https://open.spotify.com/embed/playlist/37i9dQZEVXboapyPnuB0Go?utm_source=generator&theme=0"
    //  width="100%" 
    //  className="grow" 
    //  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
    //  loading="lazy">
    //  </iframe>

    // large
    <iframe
      src="https://open.spotify.com/embed/playlist/37i9dQZEVXboapyPnuB0Go?utm_source=generator&theme=0"
      width="100%"
      height="352"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      loading="lazy">
    </iframe>
  )
}