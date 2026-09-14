import { NextResponse } from "next/server";

type SourceVoice = { voice_id?: string; voice_name?: string; gender?: string; age?: string; use_cases?: string[] };
const names: Record<string, string> = { Sanghyun: "상현", Seohyeon: "서현", Juwan: "주완", Woony: "우니", Okji: "옥지", Bboddo: "뽀또", Booqoo: "부꾸", Mongsil: "몽실", Eogwool: "어울", Jungsook: "정숙", Byunghun: "병훈", Daeun: "다은", Hyoeun: "효은", Moonjung: "문정", Minuk: "민욱", Leehyun: "이현", Kangil: "강일", Gowoon: "고운", Wonwoo: "원우", Seheon: "세헌", Cheolhoon: "철훈", Seojin: "서진", Jaesun: "재순", Rayeon: "라연", Soye: "소예", Hyeongjin: "형진", Piljae: "필재", Youngmok: "영목", Jain: "재인" };
const gender: Record<string, string> = { male: "남성", female: "여성" };
const age: Record<string, string> = { child: "아동", teenager: "10대", young_adult: "청년", middle_age: "중년", elder: "시니어" };
const purpose = (items: string[] = []) => items.includes("TikTok/Reels/Shorts") ? "쇼츠" : items.includes("Ads/Promotion") ? "광고" : items.includes("Announcer") ? "안내" : items.includes("Radio/Podcast") ? "라디오" : "자연스러운 대화";

export async function GET() {
  const key = process.env.TYPECAST_API_KEY;
  if (!key) return NextResponse.json({ voices: [], error: "TYPECAST_API_KEY_NOT_CONFIGURED" }, { status: 503 });
  const response = await fetch("https://api.typecast.ai/v2/voices?model=ssfm-v30", { headers: { "X-API-KEY": key }, next: { revalidate: 3600 }, signal: AbortSignal.timeout(30000) });
  if (!response.ok) return NextResponse.json({ voices: [], error: "TYPECAST_VOICES_UNAVAILABLE" }, { status: 502 });
  const body = await response.json() as SourceVoice[] | { voices?: SourceVoice[]; data?: SourceVoice[] };
  const source = Array.isArray(body) ? body : body.voices || body.data || [];
  const voices = source.filter((voice) => voice.voice_id && voice.voice_name).map((voice) => ({
    id: voice.voice_id!, name: names[voice.voice_name!] || voice.voice_name!,
    label: `${names[voice.voice_name!] || voice.voice_name!} · ${gender[voice.gender || ""] || "성우"} ${age[voice.age || ""] || ""} · ${purpose(voice.use_cases)}`,
    originalName: voice.voice_name!, priority: names[voice.voice_name!] ? 0 : voice.use_cases?.includes("TikTok/Reels/Shorts") ? 1 : 2,
  })).sort((a, b) => a.priority - b.priority || a.label.localeCompare(b.label, "ko")).slice(0, 100);
  return NextResponse.json({ voices }, { headers: { "cache-control": "private, max-age=3600" } });
}
