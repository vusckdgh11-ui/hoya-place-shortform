/* global chrome */

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function unique(values) {
  return [...new Set(values.filter((value) => /^https?:/i.test(value)))];
}

function imageUrls(limit) {
  const values = [];
  for (const image of document.images) {
    const source = image.currentSrc || image.src || image.dataset.src || image.dataset.lazySrc || image.getAttribute("data-lazy-src") || "";
    if (!source || /profile|emoji|icon|logo|spacer|blank/i.test(source)) continue;
    if (image.naturalWidth && image.naturalWidth < 180) continue;
    values.push(source);
  }
  return unique(values).slice(0, limit);
}

async function asLocalImage(source) {
  try {
    const response = await fetch(source, { credentials: "include" });
    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) return source;
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, 1080 / Math.max(bitmap.width, bitmap.height));
    const canvas = new OffscreenCanvas(Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)));
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const compressed = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.84 });
    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(compressed);
    });
    return typeof dataUrl === "string" ? dataUrl : source;
  } catch {
    return source;
  }
}

async function collectImages(limit) {
  window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" });
  await delay(700);
  const sources = imageUrls(limit);
  const images = [];
  for (const source of sources) images.push(await asLocalImage(source));
  return images;
}

function blogLinks() {
  return unique([...document.querySelectorAll("a[href]")]
    .map((anchor) => anchor.href)
    .filter((href) => /(?:blog|m\.blog)\.naver\.com\//i.test(href)))
    .slice(0, 6);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "extract-naver-media") return;
  (async () => {
    if (message.mode === "blog-search") {
      await delay(600);
      sendResponse({ links: blogLinks(), images: await collectImages(4) });
      return;
    }
    sendResponse({ images: await collectImages(message.mode === "place" ? 12 : 6) });
  })();
  return true;
});
