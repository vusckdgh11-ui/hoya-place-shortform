/* global chrome */

window.addEventListener("message", (event) => {
  if (event.source !== window || event.data?.source !== "hoya-shortform-site" || event.data?.type !== "collect-media") return;
  chrome.runtime.sendMessage({ type: "collect-media", query: event.data.query });
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "collecting" || message.type === "media-result") {
    window.postMessage({ source: "hoya-naver-media-extension", ...message }, window.location.origin);
  }
});
