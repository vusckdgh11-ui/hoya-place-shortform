import { chromium } from "playwright";
import fs from "node:fs/promises";

const requestId = process.env.PLACE_ID;
const name = process.env.PLACE_NAME || "";
const address = process.env.PLACE_ADDRESS || "";
const query = `${name} ${address.split(" ").slice(0, 3).join(" ")}`.trim();
const clean = (value = "") => String(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const uniq = (items) => [...new Set(items.filter(Boolean))];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ locale: "ko-KR", userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152 Safari/537.36" });

let naverId = "";
let baseInfo = {};
try {
  const response = await context.request.get(`https://map.naver.com/p/api/search/allSearch?query=${encodeURIComponent(query)}&type=all`);
  if (response.ok()) {
    const json = await response.json();
    const list = json?.result?.place?.list || json?.result?.place?.items || [];
    const exact = list.find((p) => clean(p.name) === clean(name)) || list[0];
    naverId = String(exact?.id || exact?.placeId || exact?.sid || "");
    baseInfo = exact || {};
  }
} catch { /* 브라우저 검색으로 재시도 */ }

if (!naverId) {
  const page = await context.newPage();
  await page.goto(`https://map.naver.com/p/search/${encodeURIComponent(query)}`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(8000);
  const frameHtml = await Promise.all(page.frames().map((frame) => frame.content().catch(() => "")));
  const html = frameHtml.join("\n");
  naverId = html.match(/(?:place\.naver\.com|pcmap\.place\.naver\.com)\/(?:restaurant|place|hairshop|hospital|beauty)\/([0-9]{5,})/i)?.[1]
    || html.match(/(?:placeId|placeid)["':=\s]+([0-9]{5,})/i)?.[1]
    || html.match(/"id"\s*:\s*"([0-9]{5,})"/i)?.[1]
    || "";
  await page.close();
}

if (!naverId) {
  for (const searchUrl of [
    `https://search.naver.com/search.naver?query=${encodeURIComponent(query)}`,
    `https://m.search.naver.com/search.naver?query=${encodeURIComponent(query)}`,
  ]) {
    try {
      const page = await context.newPage();
      await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(3500);
      const html = await page.content();
      naverId = html.match(/(?:place\.naver\.com|pcmap\.place\.naver\.com)\/(?:restaurant|place|hairshop|hospital|beauty)\/([0-9]{5,})/i)?.[1]
        || html.match(/(?:placeId|placeid)["':=\s]+([0-9]{5,})/i)?.[1]
        || "";
      await page.close();
      if (naverId) break;
    } catch { /* 다음 검색 경로 계속 */ }
  }
}

let combined = "";
let resolvedPrefix = "";
for (const prefix of ["place", "restaurant", "hairshop", "hospital", "beauty"]) {
  if (!naverId || resolvedPrefix) break;
  try {
    const page = await context.newPage();
    const response = await page.goto(`https://pcmap.place.naver.com/${prefix}/${naverId}/home`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(1800);
    const html = await page.content();
    if (response?.ok() && html.length > 10000 && !/존재하지 않는|페이지를 찾을 수/.test(html)) {
      resolvedPrefix = prefix;
      combined += `\n${html}`;
    }
    await page.close();
  } catch { /* 다음 업종 경로 계속 */ }
}

for (const tabName of ["menu", "photo", "review/visitor"]) {
  if (!naverId || !resolvedPrefix) break;
  try {
    const page = await context.newPage();
    await page.goto(`https://pcmap.place.naver.com/${resolvedPrefix}/${naverId}/${tabName}`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(1800);
    combined += `\n${await page.content()}`;
    await page.close();
  } catch { /* 다음 탭 계속 */ }
}

const normalizedHtml = combined.replace(/\\\//g, "/").replace(/&amp;/g, "&");
const imageMatches = [...normalizedHtml.matchAll(/https?:\/\/[^"'<>\s]+?\.(?:jpg|jpeg|png|webp)(?:\?[^"'<>\s]*)?/gi)].map((m) => m[0]);
const images = uniq(imageMatches).filter((url) => {
  const decoded = decodeURIComponent(url);
  const isPlacePhoto = /(?:ldb-phinf|pup-review-phinf|myplace-phinf)\.pstatic\.net/i.test(decoded);
  const isThumbnail = /[?&]type=f(?:48|84|120|152|167|180|192)_/i.test(url);
  return isPlacePhoto && !isThumbnail && !/(?:avatar|profile|favicon|emoji)/i.test(decoded);
}).slice(0, 30);
const menuBlocks = [...normalizedHtml.matchAll(/"name"\s*:\s*"([^"\\]{2,50})"[\s\S]{0,300}?"price"\s*:\s*"?([0-9,]+)/g)].slice(0, 20);
const menus = uniq(menuBlocks.map((m) => `${clean(m[1])}|${clean(m[2])}`)).map((row) => { const [menuName, price] = row.split("|"); return { name: menuName, price }; });
const reviews = uniq([...normalizedHtml.matchAll(/"(?:reviewBody|body|text)"\s*:\s*"([^"\\]{8,220})"/g)].map((m) => clean(m[1].replace(/\\n/g, " ")))).slice(0, 30);

await fs.mkdir("results", { recursive: true });
await fs.writeFile(`results/${requestId}.json`, JSON.stringify({ id: requestId, naverId, name, address, category: clean(baseInfo.category || baseInfo.categoryName || ""), images, menus, reviews, collectedAt: new Date().toISOString(), source: naverId ? "naver-place" : "manual-fallback" }, null, 2));
await browser.close();
