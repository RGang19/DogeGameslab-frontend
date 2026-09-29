/** Ignore image errors fired while the page is navigating away and the node is torn down. */
export function onImageErrorUnlessUnmounting(img: HTMLImageElement, onError: () => void) {
  requestAnimationFrame(() => {
    if (!img.isConnected) return;
    onError();
  });
}
