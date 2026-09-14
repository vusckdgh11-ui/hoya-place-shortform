/* global chrome */

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function message(tabId, payload) {
  return new Promise((resolve) => chrome.tabs.sendMessage(tabId, payload, (response) => resolve(chrome.runtime.lastError ? null : response)));
}

async function openAndExtract(url, mode) {
  const tab = await chrome.tabs.create({ url, active: false });
  await wait(2600);
  const result = await message(tab.id, { type: "extract-naver-media", mode });
  await chrome.tabs.remove(tab.id).catch(() => undefined);
  return result || { images: [], links: [] };
}

async function collect(query) {
  const encoded = encodeURIComponent(query);
  const place = await openAndExtract(`https://m.search.naver.com/search.naver?query=${encoded}`, "place");
  const blogSearch = await openAndExtract(`https://search.naver.com/search.naver?where=blog&query=${encoded}`, "blog-search");
  const blogResults = [];
  for (const url of (blogSearch.links || []).slice(0, 4)) {
    blogResults.push(await openAndExtract(url, "blog"));
  }
  return [...(place.images || []), ...(blogSearch.images || []), ...blogResults.flatMap((result) => result.images || [])];
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type !== "collect-media" || !sender.tab?.id || !message.query) return;
  const siteTabId = sender.tab.id;
  chrome.tabs.sendMessage(siteTabId, { type: "collecting" });
  collect(message.query)
    .then((images) => chrome.tabs.sendMessage(siteTabId, { type: "media-result", images: [...new Set(images)].slice(0, 24) }))
    .catch(() => chrome.tabs.sendMessage(siteTabId, { type: "media-result", images: [] }));
});
