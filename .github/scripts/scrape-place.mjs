import { chromium } from "playwright";
import fs from "node:fs/promises";

const requestId = process.env.PLACE_ID;
const name = process.env.PLACE_NAME || "";
const address = process.env.PLACE_ADDRESS || "";
const clean = (value = "") => String(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const uniq = (items) => [...new Set(items.filter(Boolean))];
const normalize = (value = "") => clean(value).replace(/[^0-9A-Za-z가-힣]/g, "").toLowerCase();
const addressParts = address.split(" ").filter(Boolean);
const city = addressParts.find((part) => /(?:시|군|구)$/.test(part)) || "";
const shortNames = uniq([name, name.length >= 5 ? name.slice(1) : "", name.length >= 6 ? name.slice(2) : ""])
  .filter((candidate) => normalize(candidate).length >= 3);
const searchQueries = uniq([
  `${name} ${addressParts.slice(0, 3).join(" ")}`,
  `${name} ${city}`,
  ...shortNames.slice(1).flatMap((candidate) => [`${candidate} ${city}`, candidate]),
  name,
]).map(clean);
const query = searchQueries[0];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ locale: "ko-KR", userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152 Safari/537.36" });

let naverId = "";
let baseInfo = {};
for (const searchQuery of searchQueries) {
  if (naverId) break;
  try {
    const response = await context.request.get(`https://map.naver.com/p/api/search/allSearch?query=${encodeURIComponent(searchQuery)}&type=all`);
    if (response.ok()) {
      const json = await response.json();
      const list = json?.result?.place?.list || json?.result?.place?.items || [];
      const targetNames = shortNames.map(normalize);
      const locality = addressParts.filter((part) => part.length >= 2 && /(?:시|군|구|동|로|길)$/.test(part));
      const ranked = list.map((place) => {
        const placeName = normalize(place.name);
        const placeAddress = clean(place.roadAddress || place.address || place.jibunAddress || "");
        const nameScore = Math.max(...targetNames.map((target) => placeName === target ? 100 : placeName.includes(target) || target.includes(placeName) ? 70 : 0));
        const addressScore = locality.reduce((score, token) => score + (placeAddress.includes(token) ? 12 : 0), 0);
        return { place, score: nameScore + addressScore };
      }).sort((a, b) => b.score - a.score);
      const match = ranked[0]?.score >= 70 ? ranked[0].place : null;
      naverId = String(match?.id || match?.placeId || match?.sid || "");
      baseInfo = match || {};
    }
  } catch { /* 다음 완화 검색어 계속 */ }
}

if (!naverId) {
  for (const searchQuery of searchQueries) {
    const page = await context.newPage();
    await page.goto(`https://map.naver.com/p/search/${encodeURIComponent(searchQuery)}`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(4500);
    const frameHtml = await Promise.all(page.frames().map((frame) => frame.content().catch(() => "")));
    const html = frameHtml.join("\n");
    naverId = html.match(/(?:place\.naver\.com|pcmap\.place\.naver\.com)\/(?:restaurant|place|hairshop|hospital|beauty)\/([0-9]{5,})/i)?.[1]
      || html.match(/(?:placeId|placeid)["':=\s]+([0-9]{5,})/i)?.[1]
      || "";
    await page.close();
    if (naverId) break;
  }
}

if (!naverId) {
  for (const searchUrl of searchQueries.flatMap((searchQuery) => [
    `https://search.naver.com/search.naver?query=${encodeURIComponent(searchQuery)}`,
    `https://m.search.naver.com/search.naver?query=${encodeURIComponent(searchQuery)}`,
  ])) {
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
const placeImages = uniq(imageMatches).filter((url) => {
  const decoded = decodeURIComponent(url);
  const isPlacePhoto = /(?:ldb-phinf|pup-review-phinf|myplace-phinf)\.pstatic\.net/i.test(decoded);
  const isThumbnail = /[?&]type=f(?:48|84|120|152|167|180|192)_/i.test(url);
  return isPlacePhoto && !isThumbnail && !/(?:avatar|profile|favicon|emoji)/i.test(decoded);
}).slice(0, 30);

// 업체명과 지역을 함께 검색해 관련도가 높은 네이버 블로그의 원본 사진도 수집한다.
const blogImages = [];
try {
  const collectedLinks = [];
  for (const blogQuery of uniq([`${name} ${city}`, ...shortNames.map((candidate) => `${candidate} ${city}`)]).slice(0, 4)) {
    const page = await context.newPage();
    await page.goto(`https://search.naver.com/search.naver?where=blog&query=${encodeURIComponent(blogQuery)}`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(2500);
    const searchHtml = (await page.content()).replace(/\\\//g, "/").replace(/&amp;/g, "&");
    collectedLinks.push(
      ...await page.locator('a[href*="blog.naver.com"], a[href*="m.blog.naver.com"]').evaluateAll((nodes) => nodes.map((node) => node.href)).catch(() => []),
      ...[...searchHtml.matchAll(/https?:\/\/(?:m\.)?blog\.naver\.com\/[A-Za-z0-9_.%-]+\/[0-9]+/gi)].map((match) => match[0]),
    );
    await page.close();
  }
  const links = uniq(collectedLinks).filter((url) => !/PostList|BlogHome|Prologue/i.test(url)).slice(0, 12);

  const addressTokens = address.split(" ").filter((token) => token.length >= 2).slice(1, 4);
  for (const link of links) {
    if (blogImages.length >= 30) break;
    try {
      const post = await context.newPage();
      await post.goto(link, { waitUntil: "domcontentloaded", timeout: 35000 });
      await post.waitForTimeout(1800);
      const htmlParts = await Promise.all(post.frames().map((frame) => frame.content().catch(() => "")));
      const blogHtml = htmlParts.join("\n").replace(/\\\//g, "/").replace(/&amp;/g, "&");
      const blogText = clean(blogHtml);
      const isRelevant = shortNames.some((candidate) => blogText.includes(clean(candidate)))
        && (!addressTokens.length || addressTokens.some((token) => blogText.includes(token)) || (city && blogText.includes(city.replace(/시$/, ""))));
      if (isRelevant) {
        const found = [...blogHtml.matchAll(/https?:\/\/[^"'<>\s]+?\.(?:jpg|jpeg|png|webp)(?:\?[^"'<>\s]*)?/gi)].map((match) => match[0]);
        for (const url of found) {
          const decoded = decodeURIComponent(url);
          if (/(?:blogfiles|postfiles)\.pstatic\.net/i.test(decoded) && !/(?:profile|emoji|sticker|se-map|staticmap|type=f(?:48|84|120|152|167|180|192)_)/i.test(decoded)) blogImages.push(url);
        }
      }
      await post.close();
    } catch { /* 다음 블로그 계속 */ }
  }
} catch { /* 블로그가 막혀도 플레이스 결과는 유지 */ }

const uniqueBlogImages = uniq(blogImages).slice(0, 30);
const images = uniq([...placeImages, ...uniqueBlogImages]).slice(0, 50);
const menuBlocks = [...normalizedHtml.matchAll(/"name"\s*:\s*"([^"\\]{2,50})"[\s\S]{0,300}?"price"\s*:\s*"?([0-9,]+)/g)].slice(0, 20);
const menus = uniq(menuBlocks.map((m) => `${clean(m[1])}|${clean(m[2])}`)).map((row) => { const [menuName, price] = row.split("|"); return { name: menuName, price }; });
const reviews = uniq([...normalizedHtml.matchAll(/"(?:reviewBody|body|text)"\s*:\s*"([^"\\]{8,220})"/g)].map((m) => clean(m[1].replace(/\\n/g, " ")))).slice(0, 30);

await fs.mkdir("results", { recursive: true });
await fs.writeFile(`results/${requestId}.json`, JSON.stringify({ id: requestId, naverId, name, address, category: clean(baseInfo.category || baseInfo.categoryName || ""), images, placeImages, blogImages: uniqueBlogImages, menus, reviews, collectedAt: new Date().toISOString(), source: naverId ? "naver-place-blog" : "manual-fallback" }, null, 2));
await browser.close();
