export const cancelTouchEvents = () => {
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
