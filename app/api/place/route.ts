import { NextRequest, NextResponse } from "next/server";

const owner = "vusckdgh11-ui";
const repo = "hoya-place-shortform";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")?.replace(/[^0-9A-Za-z_-]/g, "");
  const name = request.nextUrl.searchParams.get("name")?.trim();
  const address = request.nextUrl.searchParams.get("address")?.trim() || "";
  if (!id || !name) return NextResponse.json({ error: "업체 정보가 부족합니다" }, { status: 400 });

  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/place-data/results/${id}.json?t=${Date.now()}`;
  try {
    const saved = await fetch(rawUrl, { cache: "no-store", signal: AbortSignal.timeout(7000) });
    if (saved.ok) return NextResponse.json(await saved.json());
  } catch { /* 아직 수집 결과 없음 */ }

  if (request.nextUrl.searchParams.get("poll") === "1") {
    return NextResponse.json({ pending: true, message: "플레이스 자료를 수집하고 있어요" }, { status: 202 });
  }

  const token = process.env.GITHUB_ACTION_TOKEN;
  if (!token) return NextResponse.json({ error: "GITHUB_ACTION_TOKEN_NOT_CONFIGURED" }, { status: 503 });
  const dispatch = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/scrape-place.yml/dispatches`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    body: JSON.stringify({ ref: "main", inputs: { id, name, address } }),
  });
  if (!dispatch.ok) return NextResponse.json({ error: `ACTION_DISPATCH_${dispatch.status}` }, { status: 502 });
  return NextResponse.json({ pending: true, message: "플레이스 사진·메뉴·리뷰를 수집하고 있어요" }, { status: 202 });
}
