import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const text = request.nextUrl.searchParams.get("text")?.trim().slice(0, 1800);
  const voiceId = request.nextUrl.searchParams.get("voiceId")?.replace(/[^A-Za-z0-9_-]/g, "");
  const tempo = Math.max(0.75, Math.min(1.25, Number(request.nextUrl.searchParams.get("tempo")) || 1));
  if (!text) return new NextResponse("Missing text", { status: 400 });

  const typecastKey = process.env.TYPECAST_API_KEY;
  if (typecastKey && voiceId) {
    const response = await fetch("https://api.typecast.ai/v1/text-to-speech", {
      method: "POST",
      headers: { "X-API-KEY": typecastKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        voice_id: voiceId, text, model: "ssfm-v30", language: "kor",
        prompt: { emotion_type: "smart" },
        output: { volume: 100, audio_pitch: 0, audio_tempo: tempo, audio_format: "wav" },
      }),
      signal: AbortSignal.timeout(90000),
    });
    if (response.ok) return new NextResponse(response.body, { headers: { "content-type": response.headers.get("content-type") || "audio/wav", "cache-control": "private, max-age=3600", "x-tts-provider": "typecast" } });
    return new NextResponse("Typecast TTS unavailable", { status: 502 });
  }

  const url = new URL("https://translate.google.com/translate_tts");
  url.searchParams.set("ie", "UTF-8"); url.searchParams.set("client", "tw-ob"); url.searchParams.set("tl", "ko"); url.searchParams.set("q", text.slice(0, 600));
  const response = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) return new NextResponse("TTS unavailable", { status: 502 });
  return new NextResponse(response.body, { headers: { "content-type": response.headers.get("content-type") || "audio/mpeg", "cache-control": "private, max-age=3600", "x-tts-provider": "google" } });
}
