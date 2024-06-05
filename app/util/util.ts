export const cancelTouchEvents = () => {
  console.log("Cancel touch events");
  const el = document?.querySelector("body");
  el?.addEventListener("touchstart", cancelTouchEvent, { passive: false });
  el?.addEventListener("touchend",  cancelTouchEvent, { passive: false });
  el?.addEventListener("touchcancel",  cancelTouchEvent, { passive: false });
  el?.addEventListener("touchmove",  cancelTouchEvent, { passive: false });
}

const cancelTouchEvent = (event:any) => {
  event.preventDefault();
  console.log("cancelled touch event " + JSON.stringify(event));
}

// export const fetcher = (...args: any[]) => fetch(...args).then(res => res.json());

export const getAsJson = (res: Response) =>{ return res.json() }