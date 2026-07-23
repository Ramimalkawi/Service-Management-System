// Ensures every <img> inside a container has finished loading before it is
// handed to html2canvas — otherwise images can be captured at their raw
// natural size (ignoring CSS) or missing entirely, and layout below them
// can end up misplaced or cut off.
export const waitForImagesToLoad = (container) => {
  if (!container) return Promise.resolve();
  const images = Array.from(container.querySelectorAll("img"));
  return Promise.all(
    images.map((img) => {
      // `complete` is true once the browser is done with the image, whether
      // it loaded or failed (e.g. a 404) — either way there's no future
      // load/error event left to wait for, so treat it as settled.
      if (img.complete) return Promise.resolve();
      return new Promise((resolve) => {
        img.addEventListener("load", resolve, { once: true });
        img.addEventListener("error", resolve, { once: true });
      });
    }),
  );
};
