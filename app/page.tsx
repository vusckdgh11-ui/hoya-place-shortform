"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, ChevronRight, Download, ImagePlus, LoaderCircle, MapPin, Pause, Play, Plus, RefreshCw, Search, Sparkles, Store, Trash2, Volume2, WandSparkles } from "lucide-react";

type Place = { id: string; name: string; category: string; address: string; phone: string; image: string; reviewCount: number; photoCount: number; rating: string };
type Menu = { name: string; price: string };
type Scene = { type: string; text: string; seconds: number; image: string };
type Step = "search" | "analyze" | "editor";
type SearchResponse = { places?: Place[]; error?: string };
type PlaceResponse = { images?: string[]; menus?: Menu[]; reviews?: string[]; pending?: boolean; error?: string };

const defaultPlace: Place = { id: "", name: "", category: "음식점", address: "", phone: "", image: "", reviewCount: 0, photoCount: 0, rating: "" };
const hooks = ["여기 아직 모르면 손해예요", "요즘 이 동네에서 가장 궁금한 곳", "한 번 먹으면 또 찾게 되는 이유", "메뉴 고르기 어렵다면 이것부터"];

function proxyImage(url: string) {
  return url.startsWith("blob:") || url.startsWith("data:") ? url : `/api/image?url=${encodeURIComponent(url)}`;
}

function makeScenes(place: Place, menus: Menu[], reviews: string[], images: string[], variant = 0): Scene[] {
  const menuNames = menus.map((m) => m.name).filter(Boolean);
  const first = menuNames[0] || place.category.split(",")[0] || "대표 메뉴";
  const second = menuNames[1] || "푸짐한 구성";
  const review = reviews[0]?.replace(/<[^>]+>/g, "").slice(0, 34) || "맛과 양 모두 만족스럽다는 후기가 가득해요";
  const texts = [hooks[variant % hooks.length], `${place.name}, 첫 장면부터 시선 집중`, `가장 먼저 찾는 ${first}`, `${second}까지 제대로 즐기고`, `“${review}”`, `${place.address.split(" ").slice(0, 3).join(" ")}에서 만나보세요`];
  const types = ["후킹", "매장 소개", "대표 메뉴", "메뉴 소개", "리뷰", "위치·마무리"];
  const seconds = [3, 4, 5, 5, 5, 4];
  return texts.map((text, i) => ({ type: types[i], text, seconds: seconds[i], image: images[i % Math.max(images.length, 1)] || "" }));
}

export default function Home() {
  const [step, setStep] = useState<Step>("search");
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [selected, setSelected] = useState<Place>(defaultPlace);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [reviews, setReviews] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [variant, setVariant] = useState(0);
  const [sourceState, setSourceState] = useState<"idle" | "ok" | "partial">("idle");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalSeconds = useMemo(() => scenes.reduce((sum, scene) => sum + scene.seconds, 0), [scenes]);
  const current = scenes[playing ? previewIndex : active];

  useEffect(() => {
    const saved = localStorage.getItem("hoya-shortform-last");
    if (!saved) return;
    try { const data = JSON.parse(saved); if (data?.place?.name) { setSelected(data.place); setMenus(data.menus || []); setReviews(data.reviews || []); setImages(data.images || []); setScenes(data.scenes || []); } } catch { /* ignore */ }
  }, []);

  useEffect(() => () => { if (previewTimer.current) clearInterval(previewTimer.current); }, []);

  async function searchPlaces() {
    if (!query.trim()) return;
    setLoading(true); setStatus("업체명과 주소를 찾고 있어요"); setPlaces([]);
    try {
      const res = await fetch(`/api/places?query=${encodeURIComponent(query.trim())}`);
      const data = await res.json() as SearchResponse;
      if (!res.ok || !data.places?.length) throw new Error(data.error || "검색 결과가 없습니다");
      setPlaces(data.places); setStatus(`${data.places.length}곳을 찾았어요`);
    } catch (error) { setStatus(error instanceof Error ? `자동 검색 실패: ${error.message}` : "검색에 실패했어요"); }
    finally { setLoading(false); }
  }

  async function analyze(place: Place) {
    setSelected(place); setStep("analyze"); setLoading(true); setProgress(12); setStatus("주소와 업종을 확인하고 있어요");
    const ticker = setInterval(() => setProgress((p) => Math.min(p + Math.ceil(Math.random() * 9), 88)), 650);
    try {
      const params = new URLSearchParams({ id: place.id, name: place.name, category: place.category, image: place.image || "" });
      params.set("address", place.address || "");
      let res = await fetch(`/api/place?${params}`); let data = await res.json() as PlaceResponse;
      let attempts = 0;
      while (res.status === 202 && attempts < 30) {
        setStatus(`플레이스 사진·메뉴·리뷰 수집 중 · 약 ${Math.max(5, 90 - attempts * 3)}초 남음`);
        await new Promise((resolve) => setTimeout(resolve, 5000));
        const pollParams = new URLSearchParams(params); pollParams.set("poll", "1");
        res = await fetch(`/api/place?${pollParams}`); data = await res.json() as PlaceResponse; attempts += 1;
      }
      if (!res.ok || data.pending) throw new Error(data.error || "수집 시간이 초과됐어요");
      const fetchedImages: string[] = (data.images || []).filter(Boolean);
      const fetchedMenus: Menu[] = data.menus || [];
      const fetchedReviews: string[] = data.reviews || [];
      setImages(fetchedImages); setMenus(fetchedMenus); setReviews(fetchedReviews);
      setScenes(makeScenes(place, fetchedMenus, fetchedReviews, fetchedImages));
      setSourceState(fetchedImages.length >= 4 ? "ok" : "partial"); setProgress(100); setStatus("가게 분석이 끝났어요");
    } catch { setImages(place.image ? [place.image] : []); setScenes(makeScenes(place, [], [], place.image ? [place.image] : [])); setSourceState("partial"); setProgress(100); setStatus("기본 정보 분석을 마쳤어요"); }
    finally { clearInterval(ticker); setLoading(false); }
  }

  function enterEditor() { setStep("editor"); setActive(0); setPreviewIndex(0); }
  function addImages(event: ChangeEvent<HTMLInputElement>) {
    const next = Array.from(event.target.files ?? []).map((file) => URL.createObjectURL(file));
    const merged = [...images, ...next].slice(0, 50); setImages(merged);
    setScenes((old) => old.map((scene, i) => ({ ...scene, image: scene.image || merged[i % merged.length] || "" })));
  }
  function updateScene(index: number, patch: Partial<Scene>) { setScenes((old) => old.map((scene, i) => i === index ? { ...scene, ...patch } : scene)); }
  function regenerate() { const next = variant + 1; setVariant(next); setScenes(makeScenes(selected, menus, reviews, images, next)); setActive(0); }
  function saveLocal() { localStorage.setItem("hoya-shortform-last", JSON.stringify({ place: selected, menus, reviews, images: images.filter((x) => !x.startsWith("blob:")), scenes })); setStatus("현재 프로젝트를 이 기기에 저장했어요"); }

  function togglePreview() {
    if (playing) { if (previewTimer.current) clearInterval(previewTimer.current); setPlaying(false); return; }
    setPlaying(true); setPreviewIndex(0); let elapsed = 0;
    previewTimer.current = setInterval(() => { elapsed += 1; let sum = 0; const idx = scenes.findIndex((scene) => { sum += scene.seconds; return elapsed < sum; }); if (idx < 0) { if (previewTimer.current) clearInterval(previewTimer.current); setPlaying(false); setPreviewIndex(0); } else setPreviewIndex(idx); }, 1000);
  }

  async function loadImage(url: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => { const img = new Image(); img.crossOrigin = "anonymous"; img.onload = () => resolve(img); img.onerror = reject; img.src = proxyImage(url); });
  }

  function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, width: number, height: number, scale = 1) {
    const ratio = Math.max(width / img.width, height / img.height) * scale; const w = img.width * ratio; const h = img.height * ratio;
    ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h);
  }

  async function renderVideo() {
    if (!scenes.length || !canvasRef.current) return;
    setStatus("성우 음성과 영상을 준비하고 있어요"); setProgress(1);
    const canvas = canvasRef.current; canvas.width = 1080; canvas.height = 1920; const ctx = canvas.getContext("2d"); if (!ctx) return;
    const loaded = await Promise.all(scenes.map((s) => s.image ? loadImage(s.image).catch(() => null) : Promise.resolve(null)));
    const narration = scenes.map((s) => s.text).join(". ");
    let audioBuffer: AudioBuffer | null = null; let audioContext: AudioContext | null = null; let destination: MediaStreamAudioDestinationNode | null = null;
    try { const audioRes = await fetch(`/api/tts?text=${encodeURIComponent(narration)}`); const bytes = await audioRes.arrayBuffer(); audioContext = new AudioContext(); audioBuffer = await audioContext.decodeAudioData(bytes); destination = audioContext.createMediaStreamDestination(); } catch { setStatus("음성 연결 없이 영상만 렌더링합니다"); }
    const stream = canvas.captureStream(30); if (destination) destination.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
    const candidates = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus"];
    const mime = candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "video/webm"; const chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 }); recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const done = new Promise<void>((resolve) => { recorder.onstop = () => { const ext = mime.startsWith("video/mp4") ? "mp4" : "webm"; const blob = new Blob(chunks, { type: mime }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${selected.name}-홍보숏폼.${ext}`; a.click(); URL.revokeObjectURL(url); resolve(); }; });
    recorder.start(1000); if (audioBuffer && audioContext && destination) { const source = audioContext.createBufferSource(); source.buffer = audioBuffer; source.connect(destination); source.start(); }
    const duration = totalSeconds * 1000; const started = performance.now();
    await new Promise<void>((resolve) => { const frame = () => { const elapsed = performance.now() - started; const seconds = elapsed / 1000; let cursor = 0; let index = 0; for (let i = 0; i < scenes.length; i++) { if (seconds < cursor + scenes[i].seconds) { index = i; break; } cursor += scenes[i].seconds; index = i; } const scene = scenes[index]; ctx.fillStyle = "#17131c"; ctx.fillRect(0, 0, 1080, 1920); const img = loaded[index]; if (img) drawCover(ctx, img, 1080, 1920, 1 + ((seconds - cursor) / Math.max(scene.seconds, 1)) * .05); const gradient = ctx.createLinearGradient(0, 900, 0, 1920); gradient.addColorStop(0, "rgba(0,0,0,0)"); gradient.addColorStop(1, "rgba(0,0,0,.88)"); ctx.fillStyle = gradient; ctx.fillRect(0, 800, 1080, 1120); ctx.fillStyle = "rgba(0,0,0,.48)"; ctx.beginPath(); ctx.roundRect(54, 60, Math.min(720, 42 + selected.name.length * 34), 72, 36); ctx.fill(); ctx.fillStyle = "#fff"; ctx.font = "700 34px Arial, sans-serif"; ctx.fillText(selected.name, 84, 108); ctx.font = "900 76px Arial, sans-serif"; ctx.textAlign = "left"; const words = scene.text.split(" "); let line = ""; const lines: string[] = []; words.forEach((word) => { const test = line ? `${line} ${word}` : word; if (ctx.measureText(test).width > 900) { lines.push(line); line = word; } else line = test; }); if (line) lines.push(line); const y = 1570 - (lines.length - 1) * 48; lines.slice(0, 3).forEach((value, i) => { ctx.fillStyle = "#fff"; ctx.fillText(value, 72, y + i * 92); }); ctx.fillStyle = "#b794f6"; ctx.fillRect(72, y + lines.length * 92 + 8, 170, 12); setProgress(Math.min(99, Math.round(elapsed / duration * 100))); if (elapsed >= duration) resolve(); else requestAnimationFrame(frame); }; requestAnimationFrame(frame); });
    recorder.stop(); await done; if (audioContext) await audioContext.close(); setProgress(100); setStatus("영상 다운로드가 완료됐어요");
  }

  return <main className="min-h-screen bg-[#0b0d13] text-white"><canvas ref={canvasRef} className="hidden" />
    <header className="border-b border-white/8 bg-[#0b0d13]/92 px-5 backdrop-blur-xl sm:px-8"><div className="mx-auto flex h-16 max-w-[1460px] items-center justify-between"><button onClick={() => setStep("search")} className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-400 to-fuchsia-500"><WandSparkles size={19} /></span><span className="text-left"><b className="block text-sm">HOYA Shortform</b><small className="text-white/40">플레이스 자동 숏폼 제작</small></span></button><div className="flex items-center gap-2 text-xs text-white/40"><span className="hidden sm:inline">{step === "search" ? "업체 검색" : step === "analyze" ? "가게 분석" : "영상 편집"}</span><span className="rounded-full bg-white/8 px-3 py-1.5">개인용</span></div></div></header>
    {step === "search" && <section className="mx-auto max-w-5xl px-5 py-12 sm:py-20"><div className="mx-auto max-w-3xl text-center"><div className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1.5 text-sm font-bold text-violet-200"><Sparkles size={15} /> 업체명 하나면 준비 끝</div><h1 className="text-4xl font-black leading-tight tracking-[-.055em] sm:text-6xl">가게를 찾으면<br /><span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-orange-200 bg-clip-text text-transparent">숏폼 재료가 자동으로.</span></h1><p className="mx-auto mt-5 max-w-xl text-base leading-7 text-white/50">플레이스의 업체 정보, 메뉴, 리뷰와 사진을 모아 25~30초 홍보영상을 구성해요. 부족한 사진은 직접 추가할 수 있어요.</p></div><div className="mx-auto mt-9 max-w-3xl rounded-2xl border border-white/10 bg-white/[.055] p-3 shadow-2xl"><div className="flex gap-2"><div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl bg-black/25 px-4"><Search size={19} className="shrink-0 text-violet-300" /><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && searchPlaces()} placeholder="예: 명도찜닭 마포점" className="h-14 w-full bg-transparent text-base outline-none placeholder:text-white/25" /></div><button onClick={searchPlaces} disabled={loading} className="grid h-14 w-14 place-items-center rounded-xl bg-white text-black disabled:opacity-50 sm:w-auto sm:px-6"><span className="hidden font-bold sm:inline">검색</span>{loading ? <LoaderCircle className="animate-spin sm:ml-2" size={18} /> : <ChevronRight className="sm:ml-2" size={18} />}</button></div></div>{status && <p className="mt-4 text-center text-sm text-white/45">{status}</p>}<div className="mx-auto mt-6 grid max-w-3xl gap-3">{places.map((place) => <button key={place.id} onClick={() => analyze(place)} className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[.035] p-4 text-left transition hover:border-violet-400/50 hover:bg-violet-400/[.07]">{place.image ? <img src={proxyImage(place.image)} alt="" className="h-16 w-16 rounded-xl object-cover" /> : <span className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-white/8"><Store className="text-white/35" /></span>}<span className="min-w-0 flex-1"><b className="block truncate text-base">{place.name}</b><span className="mt-1 block truncate text-sm text-white/40">{place.category}</span><span className="mt-1 flex items-center gap-1 truncate text-xs text-white/35"><MapPin size={12} />{place.address}</span></span><ChevronRight className="text-white/25 transition group-hover:translate-x-1 group-hover:text-violet-300" /></button>)}</div></section>}
    {step === "analyze" && <section className="mx-auto max-w-4xl px-5 py-10"><button onClick={() => setStep("search")} className="mb-8 flex items-center gap-2 text-sm text-white/45 hover:text-white"><ArrowLeft size={16} /> 업체 다시 선택</button>{loading ? <div className="mx-auto max-w-2xl py-16 text-center"><div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-violet-400/10"><LoaderCircle size={36} className="animate-spin text-violet-300" /></div><h1 className="mt-7 text-3xl font-black tracking-tight">{selected.name}을 분석하고 있어요</h1><p className="mt-3 text-white/45">{status}</p><div className="mx-auto mt-8 h-2 max-w-lg overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400 transition-all" style={{ width: `${progress}%` }} /></div><p className="mt-3 text-sm font-bold text-violet-200">{progress}%</p></div> : <div><div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[.07] to-white/[.025] p-6 sm:p-9"><div className="flex flex-col gap-5 sm:flex-row sm:items-center">{images[0] ? <img src={proxyImage(images[0])} alt="" className="h-24 w-24 rounded-2xl object-cover" /> : <span className="grid h-24 w-24 place-items-center rounded-2xl bg-white/8"><Store /></span>}<div className="flex-1"><span className="text-sm font-bold text-violet-300">AI 가게 분석 완료</span><h1 className="mt-1 text-3xl font-black tracking-tight">{selected.name}</h1><p className="mt-2 text-sm text-white/45">{selected.category} · {selected.address}</p></div><div className="grid grid-cols-3 gap-4 text-center"><div><b className="block text-xl">{images.length}</b><span className="text-xs text-white/35">사진</span></div><div><b className="block text-xl">{menus.length}</b><span className="text-xs text-white/35">메뉴</span></div><div><b className="block text-xl">{reviews.length || selected.reviewCount}</b><span className="text-xs text-white/35">리뷰</span></div></div></div><p className="mt-7 text-base leading-8 text-white/70">{selected.name}은 {menus[0]?.name ? <><b className="text-white">{menus.slice(0,2).map((m) => m.name).join("·")}</b>처럼 화면에 잘 잡히는 메뉴가 있고, </> : null}{selected.rating ? <>평점 <b className="text-white">{selected.rating}</b>와 </> : null}방문자 반응을 활용해 <b className="text-white">메뉴 비주얼·후기·위치</b>를 묶은 숏폼으로 구성하기 좋아요.</p><div className={`mt-5 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${sourceState === "ok" ? "border-emerald-400/20 bg-emerald-400/[.06] text-emerald-100" : "border-amber-400/20 bg-amber-400/[.06] text-amber-100"}`}><Check size={17} className="mt-0.5 shrink-0" />{sourceState === "ok" ? "플레이스 사진과 상세 정보를 불러왔어요." : "플레이스에서 불러온 사진이 적어요. 편집 화면에서 내 사진을 추가하면 됩니다."}</div></div><button onClick={enterEditor} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-4 text-base font-black text-black hover:bg-violet-100">이 정보로 숏폼 만들기 <ChevronRight size={19} /></button></div>}</section>}
    {step === "editor" && <section className="mx-auto max-w-[1500px] px-4 py-5 sm:px-8"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><button onClick={() => setStep("analyze")} className="grid h-9 w-9 place-items-center rounded-lg bg-white/8"><ArrowLeft size={17} /></button><div><h1 className="font-black">{selected.name}</h1><p className="text-xs text-white/35">{scenes.length}장면 · {totalSeconds}초 · 9:16</p></div></div><div className="flex gap-2"><button onClick={saveLocal} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold">저장</button><button onClick={renderVideo} disabled={progress > 0 && progress < 100} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2.5 text-sm font-black disabled:opacity-50"><Download size={16} /> 영상 만들기</button></div></div><div className="grid gap-4 xl:grid-cols-[330px_minmax(0,1fr)_390px]"><aside className="rounded-2xl border border-white/10 bg-white/[.035] p-4"><div className="mb-3 flex items-center justify-between"><b className="text-sm">사진 보관함</b><span className="text-xs text-white/35">{images.length}장</span></div><label className="mb-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-violet-400/35 bg-violet-400/[.06] py-3 text-sm font-bold text-violet-200"><ImagePlus size={17} /> 내 사진 추가<input type="file" multiple accept="image/*" onChange={addImages} className="hidden" /></label><div className="grid max-h-[640px] grid-cols-3 gap-2 overflow-auto pr-1">{images.map((url, i) => <button key={`${url}-${i}`} onClick={() => updateScene(active, { image: url })} className={`relative aspect-square overflow-hidden rounded-lg border-2 ${scenes[active]?.image === url ? "border-violet-400" : "border-transparent"}`}><img src={proxyImage(url)} alt={`사진 ${i+1}`} className="h-full w-full object-cover" />{scenes[active]?.image === url && <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-violet-500"><Check size={12} /></span>}</button>)}</div></aside><div className="rounded-2xl border border-white/10 bg-[#13151e] p-4 sm:p-6"><div className="mb-4 flex items-center justify-between"><div><b className="text-sm">영상 미리보기</b><p className="mt-1 text-xs text-white/35">재생하며 전체 장면을 확인하세요</p></div><button onClick={togglePreview} className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-black text-black">{playing ? <Pause size={16} /> : <Play size={16} />} {playing ? "정지" : "재생"}</button></div><div className="mx-auto max-w-[350px]"><div className="relative aspect-[9/16] overflow-hidden rounded-[26px] bg-[#261c2c] shadow-2xl">{current?.image ? <img src={proxyImage(current.image)} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-white/25"><ImagePlus size={40} /></div>}<div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/25" /><span className="absolute left-4 top-4 rounded-full bg-black/45 px-3 py-1.5 text-xs font-bold">{selected.name}</span><div className="absolute inset-x-5 bottom-8"><p className="text-2xl font-black leading-tight tracking-[-.045em] drop-shadow-xl">{current?.text}</p><div className="mt-3 h-1 w-16 rounded-full bg-violet-300" /></div></div></div><div className="mt-4 flex gap-1.5">{scenes.map((scene, i) => <button key={i} onClick={() => { setActive(i); setPlaying(false); }} className={`h-2 flex-1 rounded-full ${active === i || playing && previewIndex === i ? "bg-violet-400" : "bg-white/12"}`} title={scene.type} />)}</div>{progress > 0 && <div className="mt-5"><div className="flex justify-between text-xs"><span>{status}</span><b>{progress}%</b></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-400" style={{width:`${progress}%`}} /></div></div>}</div><aside className="rounded-2xl border border-white/10 bg-white/[.035] p-4"><div className="mb-3 flex items-center justify-between"><b className="text-sm">AI 장면 구성</b><button onClick={regenerate} className="flex items-center gap-1.5 rounded-lg bg-white/8 px-2.5 py-2 text-xs font-bold text-white/60"><RefreshCw size={13} /> 대본 다시</button></div><div className="max-h-[590px] space-y-2 overflow-auto pr-1">{scenes.map((scene, i) => <button key={i} onClick={() => setActive(i)} className={`w-full rounded-xl border p-3 text-left ${active === i ? "border-violet-400/60 bg-violet-400/10" : "border-transparent bg-black/15"}`}><div className="mb-1 flex justify-between text-xs"><b className="text-violet-200">{i+1}. {scene.type}</b><span className="text-white/30">{scene.seconds}초</span></div><p className="text-sm leading-5">{scene.text}</p></button>)}</div>{scenes[active] && <div className="mt-4 border-t border-white/10 pt-4"><label className="text-xs font-bold text-white/45">선택 장면 자막</label><textarea value={scenes[active].text} onChange={(e) => updateScene(active,{text:e.target.value})} rows={3} className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/25 p-3 text-sm leading-5 outline-none focus:border-violet-400/60" /><div className="mt-3 flex items-center gap-2 text-xs text-white/35"><Volume2 size={14} /> 전체 자막을 한국어 성우로 자동 합성</div></div>}</aside></div></section>}
  </main>;
}
