"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Download,
  ImagePlus,
  LoaderCircle,
  MapPin,
  Pause,
  Play,
  RefreshCw,
  Search,
  Sparkles,
  Store,
  Trash2,
  Volume2,
  WandSparkles,
} from "lucide-react";

type Place = {
  id: string;
  name: string;
  category: string;
  address: string;
  phone: string;
  image: string;
  reviewCount: number;
  photoCount: number;
  rating: string;
};
type Menu = { name: string; price: string };
type Scene = { type: string; text: string; seconds: number; image: string };
type TypecastVoice = { id: string; name: string; label: string; originalName: string };
type TransitionStyle = "cut" | "fade" | "slide" | "rise" | "zoom" | "wipe" | "flash";
type SceneTiming = { start: number; seconds: number };
type Step = "search" | "analyze" | "editor";
type SearchResponse = { places?: Place[]; error?: string };
type PlaceResponse = {
  images?: string[];
  placeImages?: string[];
  blogImages?: string[];
  menus?: Menu[];
  reviews?: string[];
  pending?: boolean;
  error?: string;
};
type BgmStyle = "pop" | "vlog" | "funk" | "dance" | "warm" | "lofi" | "ambient" | "bright" | "none";
const bgmStyles: { id: BgmStyle; name: string }[] = [
  { id: "pop", name: "트렌디 팝 쇼츠" },
  { id: "vlog", name: "업비트 브이로그" },
  { id: "funk", name: "펑키 그루브" },
  { id: "dance", name: "댄스 하우스" },
  { id: "warm", name: "따뜻한 피아노" },
  { id: "lofi", name: "잔잔한 로파이" },
  { id: "ambient", name: "고요한 앰비언트" },
  { id: "bright", name: "산뜻한 어쿠스틱" },
  { id: "none", name: "배경음 없음" },
];
const transitionStyles: { id: TransitionStyle; name: string }[] = [
  { id: "cut", name: "바로 전환" },
  { id: "fade", name: "부드러운 페이드" },
  { id: "slide", name: "오른쪽에서 밀기" },
  { id: "rise", name: "아래에서 올라오기" },
  { id: "zoom", name: "줌 인" },
  { id: "wipe", name: "와이프" },
  { id: "flash", name: "화이트 플래시" },
];

const defaultPlace: Place = {
  id: "",
  name: "",
  category: "음식점",
  address: "",
  phone: "",
  image: "",
  reviewCount: 0,
  photoCount: 0,
  rating: "",
};
const hooks = [
  "여기 아직 모르면 손해예요",
  "요즘 이 동네에서 가장 궁금한 곳",
  "한 번 먹으면 또 찾게 되는 이유",
  "메뉴 고르기 어렵다면 이것부터",
];

function proxyImage(url: string) {
  return url.startsWith("blob:") || url.startsWith("data:")
    ? url
    : `/api/image?url=${encodeURIComponent(url)}`;
}

function isVideo(url: string, videos: string[]) {
  return videos.includes(url) || /\.(?:mp4|webm|mov|m4v)(?:$|[?#])/i.test(url);
}

function makeScenes(
  place: Place,
  menus: Menu[],
  reviews: string[],
  images: string[],
  variant = 0,
): Scene[] {
  const menuNames = menus.map((m) => m.name).filter(Boolean);
  const first = menuNames[0] || place.category.split(",")[0] || "대표 메뉴";
  const second = menuNames[1] || "푸짐한 구성";
  const review =
    reviews[0]?.replace(/<[^>]+>/g, "").slice(0, 34) ||
    "맛과 양 모두 만족스럽다는 후기가 가득해요";
  const texts = [
    hooks[variant % hooks.length],
    `${place.name}, 첫 장면부터 시선 집중`,
    `가장 먼저 찾는 ${first}`,
    `${second}까지 제대로 즐기고`,
    `“${review}”`,
    `${place.address.split(" ").slice(0, 3).join(" ")}에서 만나보세요`,
  ];
  const types = [
    "후킹",
    "매장 소개",
    "대표 메뉴",
    "메뉴 소개",
    "리뷰",
    "위치·마무리",
  ];
  const seconds = [3, 4, 5, 5, 5, 4];
  return texts.map((text, i) => ({
    type: types[i],
    text,
    seconds: seconds[i],
    image: images[i % Math.max(images.length, 1)] || "",
  }));
}

export default function Home() {
  const [step, setStep] = useState<Step>("search");
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [selected, setSelected] = useState<Place>(defaultPlace);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [reviews, setReviews] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [videoUrls, setVideoUrls] = useState<string[]>([]);
  const [placeImages, setPlaceImages] = useState<string[]>([]);
  const [blogImages, setBlogImages] = useState<string[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [variant, setVariant] = useState(0);
  const [sourceState, setSourceState] = useState<"idle" | "ok" | "partial">(
    "idle",
  );
  const [voices, setVoices] = useState<TypecastVoice[]>([]);
  const [voiceId, setVoiceId] = useState("");
  const [voiceTempo, setVoiceTempo] = useState(1);
  const [voicesError, setVoicesError] = useState("");
  const [bgmStyle, setBgmStyle] = useState<BgmStyle>("warm");
  const [bgmVolume, setBgmVolume] = useState(18);
  const [transitionStyle, setTransitionStyle] = useState<TransitionStyle>("fade");
  const [extensionBusy, setExtensionBusy] = useState(false);
  const previewAudio = useRef<{
    audio?: HTMLAudioElement;
    context?: AudioContext;
  } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const extensionAcknowledged = useRef(false);

  const totalSeconds = useMemo(
    () => scenes.reduce((sum, scene) => sum + scene.seconds, 0),
    [scenes],
  );
  const current = scenes[playing ? previewIndex : active];

  useEffect(() => {
    const saved = localStorage.getItem("hoya-shortform-last");
    if (!saved) return;
    try {
      const data = JSON.parse(saved);
      if (data?.place?.name) queueMicrotask(() => {
        setSelected(data.place); setMenus(data.menus || []); setReviews(data.reviews || []);
        setImages(data.images || []); setScenes(data.scenes || []);
      });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(
    () => () => {
      if (previewTimer.current) clearInterval(previewTimer.current);
      stopAudioPreview();
    },
    [],
  );

  async function loadVoices() {
    setVoicesError("");
    try {
      const response = await fetch("/api/voices");
      const data = await response.json() as { voices?: TypecastVoice[]; error?: string };
      if (!response.ok || !data.voices?.length) throw new Error(data.error || "음성 목록을 불러오지 못했습니다");
      setVoices(data.voices);
      setVoiceId((current) => current || data.voices![0].id);
    } catch (error) { setVoicesError(error instanceof Error ? error.message : "음성 목록을 불러오지 못했습니다"); }
  }

  useEffect(() => { const timer = window.setTimeout(() => { void loadVoices(); }, 0); return () => window.clearTimeout(timer); }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window || event.data?.source !== "hoya-naver-media-extension") return;
      if (event.data.type === "collecting") {
        extensionAcknowledged.current = true;
        setExtensionBusy(true);
        setStatus("크롬에서 네이버 플레이스·블로그 사진을 수집하고 있어요");
      }
      if (event.data.type === "media-result") {
        setExtensionBusy(false);
        const received = (event.data.images as string[] | undefined)?.filter((url) => typeof url === "string" && (url.startsWith("data:image/") || /^https?:/i.test(url))) || [];
        if (!received.length) { setStatus("가져올 사진을 찾지 못했어요"); return; }
        setImages((old) => {
          const merged = [...old, ...received.filter((url) => !old.includes(url))].slice(0, 50);
          setScenes((previous) => previous.map((scene, index) => ({ ...scene, image: scene.image || merged[index % Math.max(merged.length, 1)] || "" })));
          return merged;
        });
        setPlaceImages((old) => [...old, ...received.filter((url) => !old.includes(url))].slice(-50));
        setBlogImages((old) => [...old, ...received.filter((url) => !old.includes(url))].slice(-50));
        setStatus(`네이버 플레이스·블로그 사진 ${received.length}장을 크롬에서 가져왔어요`);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  function ttsUrl(text: string) {
    const params = new URLSearchParams({ text });
    if (voiceId) { params.set("voiceId", voiceId); params.set("tempo", String(voiceTempo)); }
    return `/api/tts?${params}`;
  }

  function collectWithChrome() {
    const businessName = selected.name || query.trim();
    if (!businessName) { setStatus("먼저 업체를 선택해 주세요"); return; }
    extensionAcknowledged.current = false;
    setExtensionBusy(true);
    setStatus("크롬 확장프로그램에 네이버 수집을 요청했어요");
    window.postMessage({ source: "hoya-shortform-site", type: "collect-media", query: businessName }, window.location.origin);
    window.setTimeout(() => {
      if (!extensionAcknowledged.current) {
        setExtensionBusy(false);
        setStatus("크롬 확장을 설치한 뒤 다시 눌러 주세요");
      }
    }, 2200);
  }

  async function searchPlaces() {
    if (!query.trim()) return;
    setLoading(true);
    setStatus("업체명과 주소를 찾고 있어요");
    setPlaces([]);
    try {
      const res = await fetch(
        `/api/places?query=${encodeURIComponent(query.trim())}`,
      );
      const data = (await res.json()) as SearchResponse;
      if (!res.ok || !data.places?.length)
        throw new Error(data.error || "검색 결과가 없습니다");
      setPlaces(data.places);
      setStatus(`${data.places.length}곳을 찾았어요`);
    } catch (error) {
      setStatus(
        error instanceof Error
          ? `자동 검색 실패: ${error.message}`
          : "검색에 실패했어요",
      );
    } finally {
      setLoading(false);
    }
  }

  async function analyze(place: Place) {
    setSelected(place);
    setVideoUrls([]);
    setStep("analyze");
    setLoading(true);
    setProgress(12);
    setStatus("주소와 업종을 확인하고 있어요");
    const ticker = setInterval(
      () => setProgress((p) => Math.min(p + Math.ceil(Math.random() * 9), 88)),
      650,
    );
    try {
      const params = new URLSearchParams({
        id: place.id,
        name: place.name,
        category: place.category,
        image: place.image || "",
      });
      params.set("address", place.address || "");
      let res = await fetch(`/api/place?${params}`);
      let data = (await res.json()) as PlaceResponse;
      let attempts = 0;
      while (res.status === 202 && attempts < 30) {
        setStatus(
          `플레이스·블로그 사진과 메뉴·리뷰 수집 중 · 약 ${Math.max(5, 90 - attempts * 3)}초 남음`,
        );
        await new Promise((resolve) => setTimeout(resolve, 5000));
        const pollParams = new URLSearchParams(params);
        pollParams.set("poll", "1");
        res = await fetch(`/api/place?${pollParams}`);
        data = (await res.json()) as PlaceResponse;
        attempts += 1;
      }
      if (!res.ok || data.pending)
        throw new Error(data.error || "수집 시간이 초과됐어요");
      const fetchedImages: string[] = (data.images || []).filter(Boolean);
      setPlaceImages((data.placeImages || fetchedImages).filter(Boolean));
      setBlogImages((data.blogImages || []).filter(Boolean));
      const fetchedMenus: Menu[] = data.menus || [];
      const fetchedReviews: string[] = data.reviews || [];
      setImages(fetchedImages);
      setMenus(fetchedMenus);
      setReviews(fetchedReviews);
      setScenes(makeScenes(place, fetchedMenus, fetchedReviews, fetchedImages));
      setSourceState(fetchedImages.length >= 4 ? "ok" : "partial");
      setProgress(100);
      setStatus("가게 분석이 끝났어요");
    } catch {
      setImages(place.image ? [place.image] : []);
      setPlaceImages(place.image ? [place.image] : []);
      setBlogImages([]);
      setScenes(makeScenes(place, [], [], place.image ? [place.image] : []));
      setSourceState("partial");
      setProgress(100);
      setStatus("기본 정보 분석을 마쳤어요");
    } finally {
      clearInterval(ticker);
      setLoading(false);
    }
  }

  function enterEditor() {
    setStep("editor");
    setActive(0);
    setPreviewIndex(0);
  }
  function addImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, Math.max(0, 50 - images.length));
    const uploaded = files.map((file) => ({ url: URL.createObjectURL(file), isVideo: file.type.startsWith("video/") }));
    const next = uploaded.map((file) => file.url);
    const videos = uploaded.filter((file) => file.isVideo).map((file) => file.url);
    setVideoUrls((old) => [...old, ...videos]);
    const merged = [...images, ...next].slice(0, 50);
    setImages(merged);
    setScenes((old) =>
      old.map((scene, i) => ({
        ...scene,
        image: scene.image || merged[i % merged.length] || "",
      })),
    );
    event.target.value = "";
  }
  function updateScene(index: number, patch: Partial<Scene>) {
    setScenes((old) =>
      old.map((scene, i) => (i === index ? { ...scene, ...patch } : scene)),
    );
  }
  function removeImage(url: string) {
    const next = images.filter((image) => image !== url);
    setImages(next);
    setPlaceImages((old) => old.filter((image) => image !== url));
    setBlogImages((old) => old.filter((image) => image !== url));
    setVideoUrls((old) => old.filter((video) => video !== url));
    setScenes((old) =>
      old.map((scene, i) =>
        scene.image === url
          ? { ...scene, image: next[i % Math.max(next.length, 1)] || "" }
          : scene,
      ),
    );
  }
  function regenerate() {
    const next = variant + 1;
    setVariant(next);
    setScenes(makeScenes(selected, menus, reviews, images, next));
    setActive(0);
  }
  function saveLocal() {
    const savedImages = images.filter((image) => !image.startsWith("blob:") && !image.startsWith("data:"));
    localStorage.setItem(
      "hoya-shortform-last",
      JSON.stringify({
        place: selected,
        menus,
        reviews,
        images: savedImages,
        scenes: scenes.map((scene) => ({ ...scene, image: scene.image.startsWith("blob:") || scene.image.startsWith("data:") ? "" : scene.image })),
      }),
    );
    setStatus("현재 프로젝트를 이 기기에 저장했어요");
  }

  async function togglePreview() {
    if (playing) {
      if (previewTimer.current) clearInterval(previewTimer.current);
      stopAudioPreview();
      setPlaying(false);
      return;
    }
    setPlaying(true);
    setPreviewIndex(0);
    const timing = await previewFullAudio();
    const timeline = timing || scenes.reduce<SceneTiming[]>((all, scene) => {
      const start = all.at(-1) ? all.at(-1)!.start + all.at(-1)!.seconds : 0;
      all.push({ start, seconds: scene.seconds });
      return all;
    }, []);
    const started = performance.now();
    previewTimer.current = setInterval(() => {
      const elapsed = (performance.now() - started) / 1000;
      const idx = timeline.findIndex((scene) => elapsed < scene.start + scene.seconds);
      if (idx < 0) {
        if (previewTimer.current) clearInterval(previewTimer.current);
        stopAudioPreview();
        setPlaying(false);
        setPreviewIndex(0);
      } else setPreviewIndex(idx);
    }, 1000);
  }

  async function loadMedia(url: string): Promise<HTMLImageElement | HTMLVideoElement> {
    if (isVideo(url, videoUrls)) {
      return new Promise<HTMLVideoElement>((resolve, reject) => {
        const video = document.createElement("video");
        video.src = url; video.muted = true; video.loop = true; video.playsInline = true;
        video.onloadeddata = () => resolve(video); video.onerror = () => reject(new Error("영상 로드 실패"));
      });
    }
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = proxyImage(url);
    });
  }

  function drawCover(
    ctx: CanvasRenderingContext2D,
    media: HTMLImageElement | HTMLVideoElement,
    width: number,
    height: number,
    scale = 1,
  ) {
    const mediaWidth = media instanceof HTMLVideoElement ? media.videoWidth : media.width;
    const mediaHeight = media instanceof HTMLVideoElement ? media.videoHeight : media.height;
    const ratio = Math.max(width / mediaWidth, height / mediaHeight) * scale;
    const w = mediaWidth * ratio;
    const h = mediaHeight * ratio;
    ctx.drawImage(media, (width - w) / 2, (height - h) / 2, w, h);
  }

  function drawSceneTransition(
    ctx: CanvasRenderingContext2D,
    previous: HTMLImageElement | HTMLVideoElement | null,
    currentMedia: HTMLImageElement | HTMLVideoElement | null,
    progress: number,
    scale: number,
  ) {
    const draw = (media: HTMLImageElement | HTMLVideoElement | null, mediaScale = 1) => {
      if (media) drawCover(ctx, media, 1080, 1920, mediaScale);
    };
    if (!previous || !currentMedia || transitionStyle === "cut" || progress >= 1) { draw(currentMedia, scale); return; }
    if (transitionStyle === "fade") {
      draw(previous, 1);
      ctx.save(); ctx.globalAlpha = progress; draw(currentMedia, scale); ctx.restore();
    } else if (transitionStyle === "slide") {
      ctx.save(); ctx.translate(-1080 * progress, 0); draw(previous, 1); ctx.restore();
      ctx.save(); ctx.translate(1080 * (1 - progress), 0); draw(currentMedia, scale); ctx.restore();
    } else if (transitionStyle === "rise") {
      ctx.save(); ctx.translate(0, -1920 * progress); draw(previous, 1); ctx.restore();
      ctx.save(); ctx.translate(0, 1920 * (1 - progress)); draw(currentMedia, scale); ctx.restore();
    } else if (transitionStyle === "zoom") {
      draw(previous, 1);
      ctx.save(); ctx.globalAlpha = progress; draw(currentMedia, 1.15 - 0.15 * progress); ctx.restore();
    } else if (transitionStyle === "wipe") {
      draw(previous, 1);
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 1080 * progress, 1920); ctx.clip(); draw(currentMedia, scale); ctx.restore();
    } else {
      draw(previous, 1);
      ctx.save(); ctx.globalAlpha = progress; draw(currentMedia, scale); ctx.restore();
      ctx.save(); ctx.fillStyle = `rgba(255,255,255,${Math.sin(progress * Math.PI) * 0.72})`; ctx.fillRect(0, 0, 1080, 1920); ctx.restore();
    }
  }

  function startBgm(
    context: AudioContext,
    destination: AudioNode,
    style: BgmStyle,
    volume: number,
    duration: number,
  ) {
    if (style === "none" || volume <= 0) return;
    const chords: Record<Exclude<BgmStyle, "none">, number[][]> = {
      pop: [[261.6, 329.6, 392], [220, 277.2, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7]],
      vlog: [[293.7, 369.9, 440], [261.6, 329.6, 392], [220, 277.2, 329.6], [246.9, 311.1, 370]],
      funk: [[220, 261.6, 329.6], [246.9, 293.7, 370], [196, 246.9, 293.7], [220, 277.2, 329.6]],
      dance: [[261.6, 329.6, 392], [293.7, 370, 440], [220, 277.2, 329.6], [246.9, 311.1, 370]],
      warm: [
        [261.6, 329.6, 392],
        [220, 261.6, 329.6],
        [174.6, 220, 261.6],
        [196, 246.9, 293.7],
      ],
      lofi: [
        [220, 261.6, 329.6],
        [196, 246.9, 293.7],
        [174.6, 220, 261.6],
        [196, 246.9, 329.6],
      ],
      ambient: [
        [130.8, 196, 261.6],
        [146.8, 220, 293.7],
        [164.8, 246.9, 329.6],
        [146.8, 220, 293.7],
      ],
      bright: [
        [261.6, 329.6, 392],
        [293.7, 370, 440],
        [220, 277.2, 329.6],
        [246.9, 311.1, 370],
      ],
    };
    const master = context.createGain();
    master.gain.value = Math.min(0.18, (volume / 100) * 0.18);
    master.connect(destination);
    const selected = chords[style as Exclude<BgmStyle, "none">];
    for (let t = 0, chord = 0; t < duration; t += 4, chord += 1)
      selected[chord % selected.length].forEach((frequency, i) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = style === "lofi" ? "triangle" : "sine";
        oscillator.frequency.value =
          frequency * (i === 0 && style === "ambient" ? 0.5 : 1);
        gain.gain.setValueAtTime(0, context.currentTime + t);
        gain.gain.linearRampToValueAtTime(
          i ? 0.12 : 0.18,
          context.currentTime + t + 0.6,
        );
        gain.gain.setValueAtTime(
          i ? 0.1 : 0.15,
          context.currentTime + Math.min(t + 3.4, duration),
        );
        gain.gain.linearRampToValueAtTime(
          0,
          context.currentTime + Math.min(t + 4, duration),
        );
        oscillator.connect(gain).connect(master);
        oscillator.start(context.currentTime + t);
        oscillator.stop(context.currentTime + Math.min(t + 4.1, duration));
      });
    const bpm = style === "dance" ? 126 : style === "pop" ? 118 : style === "vlog" ? 112 : style === "funk" ? 104 : 84;
    const beat = 60 / bpm;
    const hasBeat = ["pop", "vlog", "funk", "dance"].includes(style);
    const noise = (start: number, length: number, gainValue: number) => { const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * length), context.sampleRate); const channel = buffer.getChannelData(0); for (let i = 0; i < channel.length; i++) channel[i] = Math.random() * 2 - 1; const source = context.createBufferSource(); const gain = context.createGain(); gain.gain.setValueAtTime(gainValue, start); gain.gain.exponentialRampToValueAtTime(.001, start + length); source.buffer = buffer; source.connect(gain).connect(master); source.start(start); };
    if (hasBeat) for (let t = 0; t < duration; t += beat) { const at = context.currentTime + t; const kick = context.createOscillator(); const kickGain = context.createGain(); kick.frequency.setValueAtTime(120, at); kick.frequency.exponentialRampToValueAtTime(45, at + .13); kickGain.gain.setValueAtTime(.34, at); kickGain.gain.exponentialRampToValueAtTime(.001, at + .14); kick.connect(kickGain).connect(master); kick.start(at); kick.stop(at + .15); if (Math.round(t / beat) % 4 === 1 || Math.round(t / beat) % 4 === 3) noise(at, .12, .12); noise(at + beat / 2, .035, .035); }
  }

  function stopAudioPreview() {
    previewAudio.current?.audio?.pause();
    previewAudio.current?.context?.close();
    previewAudio.current = null;
  }

  async function loadSceneAudio(context: AudioContext) {
    const buffers = await Promise.all(scenes.map(async (scene) => {
      const response = await fetch(ttsUrl(scene.text));
      if (!response.ok) throw new Error("음성 생성 실패");
      return context.decodeAudioData(await response.arrayBuffer());
    }));
    let cursor = 0;
    const timing = buffers.map((buffer) => {
      const seconds = Math.max(0.8, buffer.duration);
      const item = { start: cursor, seconds };
      cursor += seconds;
      return item;
    });
    return { buffers, timing, duration: cursor };
  }
  async function previewVoice() {
    stopAudioPreview();
    const text =
      scenes[active]?.text ||
      `${selected.name}, 오늘 꼭 가봐야 할 맛집을 소개합니다`;
    const audio = new Audio(ttsUrl(text));
    previewAudio.current = { audio };
    await audio.play();
  }
  async function previewBgm() {
    stopAudioPreview();
    if (bgmStyle === "none") return;
    const context = new AudioContext();
    const gain = context.createGain();
    gain.connect(context.destination);
    startBgm(context, gain, bgmStyle, Math.max(bgmVolume, 35), 8);
    previewAudio.current = { context };
    setTimeout(() => {
      if (previewAudio.current?.context === context) stopAudioPreview();
    }, 8000);
  }

  async function previewFullAudio(): Promise<SceneTiming[] | null> {
    stopAudioPreview();
    if (!scenes.length) return null;
    try {
      const context = new AudioContext();
      previewAudio.current = { context };
      const { buffers, timing, duration } = await loadSceneAudio(context);
      startBgm(context, context.destination, bgmStyle, bgmVolume, duration);
      buffers.forEach((buffer, index) => {
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(context.destination);
        source.start(context.currentTime + timing[index].start);
      });
      return timing;
    } catch {
      setStatus("음성 미리듣기를 시작하지 못했어요");
      return null;
    }
  }

  async function renderVideo() {
    if (!scenes.length || !canvasRef.current) return;
    setStatus("성우 음성과 영상을 준비하고 있어요");
    setProgress(1);
    const canvas = canvasRef.current;
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const loaded = await Promise.all(
      scenes.map((s) =>
        s.image ? loadMedia(s.image).catch(() => null) : Promise.resolve(null),
      ),
    );
    let audioBuffers: AudioBuffer[] = [];
    let timing: SceneTiming[] = scenes.reduce<SceneTiming[]>((all, scene) => {
      const start = all.at(-1) ? all.at(-1)!.start + all.at(-1)!.seconds : 0;
      all.push({ start, seconds: scene.seconds });
      return all;
    }, []);
    let audioContext: AudioContext | null = null;
    let destination: MediaStreamAudioDestinationNode | null = null;
    try {
      audioContext = new AudioContext();
      destination = audioContext.createMediaStreamDestination();
      const renderedAudio = await loadSceneAudio(audioContext);
      audioBuffers = renderedAudio.buffers;
      timing = renderedAudio.timing;
      startBgm(audioContext, destination, bgmStyle, bgmVolume, renderedAudio.duration);
    } catch {
      setStatus("음성 연결 없이 영상만 렌더링합니다");
    }
    const stream = canvas.captureStream(30);
    if (destination)
      destination.stream
        .getAudioTracks()
        .forEach((track) => stream.addTrack(track));
    const candidates = [
      "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
    ];
    const mime =
      candidates.find((type) => MediaRecorder.isTypeSupported(type)) ||
      "video/webm";
    const chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(stream, {
      mimeType: mime,
      videoBitsPerSecond: 8_000_000,
    });
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const done = new Promise<void>((resolve) => {
      recorder.onstop = () => {
        const ext = mime.startsWith("video/mp4") ? "mp4" : "webm";
        const blob = new Blob(chunks, { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${selected.name}-홍보숏폼.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
        resolve();
      };
    });
    recorder.start(1000);
    if (audioContext && destination) audioBuffers.forEach((buffer, index) => {
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(destination);
      source.start(audioContext.currentTime + timing[index].start);
    });
    loaded.forEach((media) => { if (media instanceof HTMLVideoElement) { media.currentTime = 0; void media.play(); } });
    const renderSeconds = timing.at(-1) ? timing.at(-1)!.start + timing.at(-1)!.seconds : totalSeconds;
    const duration = renderSeconds * 1000;
    const started = performance.now();
    await new Promise<void>((resolve) => {
      const frame = () => {
        const elapsed = performance.now() - started;
        const seconds = elapsed / 1000;
        const foundIndex = timing.findIndex((item) => seconds < item.start + item.seconds);
        const index = foundIndex < 0 ? scenes.length - 1 : foundIndex;
        const cursor = timing[index]?.start || 0;
        const scene = scenes[index];
        ctx.fillStyle = "#17131c";
        ctx.fillRect(0, 0, 1080, 1920);
        const img = loaded[index];
        const transitionProgress = index > 0 ? Math.min(1, Math.max(0, (seconds - cursor) / 0.42)) : 1;
        drawSceneTransition(
          ctx,
          loaded[index - 1] || null,
          img,
          transitionProgress,
          1 + ((seconds - cursor) / Math.max(timing[index]?.seconds || scene.seconds, 1)) * 0.05,
        );
        const gradient = ctx.createLinearGradient(0, 900, 0, 1920);
        gradient.addColorStop(0, "rgba(0,0,0,0)");
        gradient.addColorStop(1, "rgba(0,0,0,.88)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 800, 1080, 1120);
        ctx.fillStyle = "rgba(0,0,0,.48)";
        ctx.beginPath();
        ctx.roundRect(
          54,
          60,
          Math.min(720, 42 + selected.name.length * 34),
          72,
          36,
        );
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "700 34px Arial, sans-serif";
        ctx.fillText(selected.name, 84, 108);
        ctx.font = "900 76px Arial, sans-serif";
        ctx.textAlign = "left";
        const words = scene.text.split(" ");
        let line = "";
        const lines: string[] = [];
        words.forEach((word) => {
          const test = line ? `${line} ${word}` : word;
          if (ctx.measureText(test).width > 900) {
            lines.push(line);
            line = word;
          } else line = test;
        });
        if (line) lines.push(line);
        const y = 1570 - (lines.length - 1) * 48;
        lines.slice(0, 3).forEach((value, i) => {
          ctx.fillStyle = "#fff";
          ctx.fillText(value, 72, y + i * 92);
        });
        setProgress(Math.min(99, Math.round((elapsed / duration) * 100)));
        if (elapsed >= duration) resolve();
        else requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    recorder.stop();
    await done;
    loaded.forEach((media) => { if (media instanceof HTMLVideoElement) media.pause(); });
    if (audioContext) await audioContext.close();
    setProgress(100);
    setStatus("영상 다운로드가 완료됐어요");
  }

  return (
    <main className="min-h-screen bg-[#0b0d13] text-white">
      <canvas ref={canvasRef} className="hidden" />
      <header className="border-b border-white/8 bg-[#0b0d13]/92 px-5 backdrop-blur-xl sm:px-8">
        <div className="mx-auto flex h-16 max-w-[1460px] items-center justify-between">
          <button
            onClick={() => setStep("search")}
            className="flex items-center gap-3"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-400 to-fuchsia-500">
              <WandSparkles size={19} />
            </span>
            <span className="text-left">
              <b className="block text-sm">HOYA Shortform</b>
              <small className="text-white/40">플레이스 자동 숏폼 제작</small>
            </span>
          </button>
          <div className="flex items-center gap-2 text-xs text-white/40">
            <span className="hidden sm:inline">
              {step === "search"
                ? "업체 검색"
                : step === "analyze"
                  ? "가게 분석"
                  : "영상 편집"}
            </span>
            <span className="rounded-full bg-white/8 px-3 py-1.5">개인용</span>
          </div>
        </div>
      </header>
      {step === "search" && (
        <section className="mx-auto max-w-5xl px-5 py-12 sm:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1.5 text-sm font-bold text-violet-200">
              <Sparkles size={15} /> 업체명 하나면 준비 끝
            </div>
            <h1 className="text-4xl font-black leading-tight tracking-[-.055em] sm:text-6xl">
              가게를 찾으면
              <br />
              <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-orange-200 bg-clip-text text-transparent">
                숏폼 재료가 자동으로.
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-white/50">
              플레이스와 관련 블로그의 사진, 메뉴, 리뷰를 모아 음성·배경음이
              포함된 홍보영상을 구성해요. 내 사진도 직접 추가할 수 있어요.
            </p>
          </div>
          <div className="mx-auto mt-9 max-w-3xl rounded-2xl border border-white/10 bg-white/[.055] p-3 shadow-2xl">
            <div className="flex gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl bg-black/25 px-4">
                <Search size={19} className="shrink-0 text-violet-300" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchPlaces()}
                  placeholder="예: 명도찜닭 마포점"
                  className="h-14 w-full bg-transparent text-base outline-none placeholder:text-white/25"
                />
              </div>
              <button
                onClick={searchPlaces}
                disabled={loading}
                className="grid h-14 w-14 place-items-center rounded-xl bg-white text-black disabled:opacity-50 sm:w-auto sm:px-6"
              >
                <span className="hidden font-bold sm:inline">검색</span>
                {loading ? (
                  <LoaderCircle className="animate-spin sm:ml-2" size={18} />
                ) : (
                  <ChevronRight className="sm:ml-2" size={18} />
                )}
              </button>
            </div>
          </div>
          {status && (
            <p className="mt-4 text-center text-sm text-white/45">{status}</p>
          )}
          <div className="mx-auto mt-6 grid max-w-3xl gap-3">
            {places.map((place) => (
              <button
                key={place.id}
                onClick={() => analyze(place)}
                className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[.035] p-4 text-left transition hover:border-violet-400/50 hover:bg-violet-400/[.07]"
              >
                {place.image ? (
                  <img
                    src={proxyImage(place.image)}
                    alt=""
                    className="h-16 w-16 rounded-xl object-cover"
                  />
                ) : (
                  <span className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-white/8">
                    <Store className="text-white/35" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-base">{place.name}</b>
                  <span className="mt-1 block truncate text-sm text-white/40">
                    {place.category}
                  </span>
                  <span className="mt-1 flex items-center gap-1 truncate text-xs text-white/35">
                    <MapPin size={12} />
                    {place.address}
                  </span>
                </span>
                <ChevronRight className="text-white/25 transition group-hover:translate-x-1 group-hover:text-violet-300" />
              </button>
            ))}
          </div>
        </section>
      )}
      {step === "analyze" && (
        <section className="mx-auto max-w-4xl px-5 py-10">
          <button
            onClick={() => setStep("search")}
            className="mb-8 flex items-center gap-2 text-sm text-white/45 hover:text-white"
          >
            <ArrowLeft size={16} /> 업체 다시 선택
          </button>
          {loading ? (
            <div className="mx-auto max-w-2xl py-16 text-center">
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-violet-400/10">
                <LoaderCircle
                  size={36}
                  className="animate-spin text-violet-300"
                />
              </div>
              <h1 className="mt-7 text-3xl font-black tracking-tight">
                {selected.name}을 분석하고 있어요
              </h1>
              <p className="mt-3 text-white/45">{status}</p>
              <div className="mx-auto mt-8 h-2 max-w-lg overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-3 text-sm font-bold text-violet-200">
                {progress}%
              </p>
            </div>
          ) : (
            <div>
              <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[.07] to-white/[.025] p-6 sm:p-9">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                  {images[0] ? (
                    <img
                      src={proxyImage(images[0])}
                      alt=""
                      className="h-24 w-24 rounded-2xl object-cover"
                    />
                  ) : (
                    <span className="grid h-24 w-24 place-items-center rounded-2xl bg-white/8">
                      <Store />
                    </span>
                  )}
                  <div className="flex-1">
                    <span className="text-sm font-bold text-violet-300">
                      AI 가게 분석 완료
                    </span>
                    <h1 className="mt-1 text-3xl font-black tracking-tight">
                      {selected.name}
                    </h1>
                    <p className="mt-2 text-sm text-white/45">
                      {selected.category} · {selected.address}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <b className="block text-xl">{images.length}</b>
                      <span className="text-xs text-white/35">사진</span>
                    </div>
                    <div>
                      <b className="block text-xl">{menus.length}</b>
                      <span className="text-xs text-white/35">메뉴</span>
                    </div>
                    <div>
                      <b className="block text-xl">
                        {reviews.length || selected.reviewCount}
                      </b>
                      <span className="text-xs text-white/35">리뷰</span>
                    </div>
                  </div>
                </div>
                <p className="mt-7 text-base leading-8 text-white/70">
                  {selected.name}은{" "}
                  {menus[0]?.name ? (
                    <>
                      <b className="text-white">
                        {menus
                          .slice(0, 2)
                          .map((m) => m.name)
                          .join("·")}
                      </b>
                      처럼 화면에 잘 잡히는 메뉴가 있고,{" "}
                    </>
                  ) : null}
                  {selected.rating ? (
                    <>
                      평점 <b className="text-white">{selected.rating}</b>
                      와{" "}
                    </>
                  ) : null}
                  방문자 반응을 활용해{" "}
                  <b className="text-white">메뉴 비주얼·후기·위치</b>를 묶은
                  숏폼으로 구성하기 좋아요.
                </p>
                <div
                  className={`mt-5 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${sourceState === "ok" ? "border-emerald-400/20 bg-emerald-400/[.06] text-emerald-100" : "border-amber-400/20 bg-amber-400/[.06] text-amber-100"}`}
                >
                  <Check size={17} className="mt-0.5 shrink-0" />
                  {sourceState === "ok"
                    ? `플레이스 ${placeImages.length}장·블로그 ${blogImages.length}장과 상세 정보를 불러왔어요.`
                    : "플레이스에서 불러온 사진이 적어요. 편집 화면에서 내 사진을 추가하면 됩니다."}
                </div>
              </div>
              <button
                onClick={enterEditor}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-4 text-base font-black text-black hover:bg-violet-100"
              >
                이 정보로 숏폼 만들기 <ChevronRight size={19} />
              </button>
            </div>
          )}
        </section>
      )}
      {step === "editor" && (
        <section className="mx-auto max-w-[1500px] px-4 py-5 sm:px-8">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setStep("analyze")}
                className="grid h-9 w-9 place-items-center rounded-lg bg-white/8"
              >
                <ArrowLeft size={17} />
              </button>
              <div>
                <h1 className="font-black">{selected.name}</h1>
                <p className="text-xs text-white/35">
                  {scenes.length}장면 · {totalSeconds}초 · 9:16
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={saveLocal}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold"
              >
                저장
              </button>
              <button
                onClick={renderVideo}
                disabled={progress > 0 && progress < 100}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2.5 text-sm font-black disabled:opacity-50"
              >
                <Download size={16} /> 영상 만들기
              </button>
            </div>
          </div>
          <div className="grid gap-4 xl:grid-cols-[330px_minmax(0,1fr)_390px]">
            <aside className="rounded-2xl border border-white/10 bg-white/[.035] p-4">
              <div className="mb-3 flex items-center justify-between">
                <b className="text-sm">사진·영상 보관함</b>
                <span className="text-xs text-white/35">사진 {images.length - videoUrls.length}장 · 영상 {videoUrls.length}개</span>
              </div>
              <label className="mb-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-violet-400/35 bg-violet-400/[.06] py-3 text-sm font-bold text-violet-200">
                <ImagePlus size={17} /> 내 사진/영상 추가
                <input
                  type="file"
                  multiple
                  accept="image/*,video/mp4,video/webm,video/quicktime"
                  onChange={addImages}
                  className="hidden"
                />
              </label>
              <button
                onClick={collectWithChrome}
                disabled={extensionBusy}
                className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500 px-3 py-3 text-sm font-black text-white disabled:opacity-60"
              >
                {extensionBusy ? <LoaderCircle className="animate-spin" size={17} /> : <Store size={17} />}
                크롬으로 네이버 사진 자동 수집
              </button>
              <a
                href="/downloads/hoya-naver-media-importer.zip"
                download
                className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[.04] px-3 py-2.5 text-xs font-bold text-white/75"
              >
                <Download size={14} /> 크롬 확장 설치하기
              </a>
              <p className="mb-3 text-[10px] leading-4 text-white/35">처음 설치한 뒤 이 페이지를 한 번 새로고침하세요. 이후 업체명을 기준으로 네이버 플레이스와 블로그를 크롬에서 자동 수집하며, 사진은 서버에 저장하지 않습니다.</p>
              <div className="grid max-h-[640px] grid-cols-3 gap-2 overflow-auto pr-1">
                {images.map((url, i) => (
                  <div
                    key={`${url}-${i}`}
                    className={`relative aspect-square overflow-hidden rounded-lg border-2 ${scenes[active]?.image === url ? "border-violet-400" : "border-transparent"}`}
                  >
                    <button onClick={() => updateScene(active, { image: url })} className="h-full w-full">{isVideo(url, videoUrls) ? <video src={url} muted playsInline preload="metadata" className="h-full w-full object-cover" /> : <img src={proxyImage(url)} alt={`사진 ${i + 1}`} onError={() => removeImage(url)} className="h-full w-full object-cover" />}</button>
                    <span className="absolute bottom-1 left-1 rounded bg-black/65 px-1.5 py-0.5 text-[9px] font-bold">{isVideo(url, videoUrls) ? "내 영상" : blogImages.includes(url) ? "블로그" : placeImages.includes(url) ? "플레이스" : "직접"}</span>
                    <button onClick={() => removeImage(url)} aria-label="사진 삭제" className="absolute left-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/70 text-white/70 hover:bg-red-500"><Trash2 size={11} /></button>
                    {scenes[active]?.image === url && (
                      <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-violet-500">
                        <Check size={12} />
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </aside>
            <div className="rounded-2xl border border-white/10 bg-[#13151e] p-4 sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <b className="text-sm">영상 미리보기</b>
                  <p className="mt-1 text-xs text-white/35">
                    재생하며 전체 장면을 확인하세요
                  </p>
                </div>
                <button
                  onClick={togglePreview}
                  className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-black text-black"
                >
                  {playing ? <Pause size={16} /> : <Play size={16} />}{" "}
                  {playing ? "정지" : "재생"}
                </button>
              </div>
              <div className="mx-auto max-w-[350px]">
                <div className="relative aspect-[9/16] overflow-hidden rounded-[26px] bg-[#261c2c] shadow-2xl">
                  {current?.image ? isVideo(current.image, videoUrls) ? (
                    <video key={current.image} src={current.image} autoPlay muted loop playsInline className="h-full w-full object-cover" />
                  ) : (
                    <img
                      src={proxyImage(current.image)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-white/25">
                      <ImagePlus size={40} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/25" />
                  <span className="absolute left-4 top-4 rounded-full bg-black/45 px-3 py-1.5 text-xs font-bold">
                    {selected.name}
                  </span>
                  <div className="absolute inset-x-5 bottom-8">
                    <p className="text-2xl font-black leading-tight tracking-[-.045em] drop-shadow-xl">
                      {current?.text}
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex gap-1.5">
                {scenes.map((scene, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setActive(i);
                      if (previewTimer.current) clearInterval(previewTimer.current);
                      stopAudioPreview();
                      setPlaying(false);
                    }}
                    className={`h-2 flex-1 rounded-full ${active === i || (playing && previewIndex === i) ? "bg-violet-400" : "bg-white/12"}`}
                    title={scene.type}
                  />
                ))}
              </div>
              {progress > 0 && (
                <div className="mt-5">
                  <div className="flex justify-between text-xs">
                    <span>{status}</span>
                    <b>{progress}%</b>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-400"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
            <aside className="rounded-2xl border border-white/10 bg-white/[.035] p-4">
              <div className="mb-3 flex items-center justify-between">
                <b className="text-sm">AI 장면 구성</b>
                <button
                  onClick={regenerate}
                  className="flex items-center gap-1.5 rounded-lg bg-white/8 px-2.5 py-2 text-xs font-bold text-white/60"
                >
                  <RefreshCw size={13} /> 대본 다시
                </button>
              </div>
              <div className="max-h-[590px] space-y-2 overflow-auto pr-1">
                {scenes.map((scene, i) => (
                  <button
                    key={i}
                    onClick={() => setActive(i)}
                    className={`w-full rounded-xl border p-3 text-left ${active === i ? "border-violet-400/60 bg-violet-400/10" : "border-transparent bg-black/15"}`}
                  >
                    <div className="mb-1 flex justify-between text-xs">
                      <b className="text-violet-200">
                        {i + 1}. {scene.type}
                      </b>
                      <span className="text-white/30">{scene.seconds}초</span>
                    </div>
                    <p className="text-sm leading-5">{scene.text}</p>
                  </button>
                ))}
              </div>
              {scenes[active] && (
                <div className="mt-4 border-t border-white/10 pt-4">
                  <label className="text-xs font-bold text-white/45">
                    선택 장면 자막
                  </label>
                  <textarea
                    value={scenes[active].text}
                    onChange={(e) =>
                      updateScene(active, { text: e.target.value })
                    }
                    rows={3}
                    className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/25 p-3 text-sm leading-5 outline-none focus:border-violet-400/60"
                  />
                  <div className="mt-3 flex items-center gap-2 text-xs text-white/35">
                    <Volume2 size={14} /> 전체 자막을 한국어 성우로 자동 합성
                  </div>
                  <div className="mt-4 space-y-3 rounded-xl bg-black/20 p-3">
                    <label className="block text-xs font-bold text-white/45">타입캐스트 성우</label>
                    <div className="flex gap-2"><select value={voiceId} onChange={(e) => setVoiceId(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#151720] px-2 py-2 text-xs" disabled={!voices.length}>{voices.length ? voices.map((voice) => <option key={voice.id} value={voice.id}>{voice.label}</option>) : <option>음성 목록 불러오는 중</option>}</select><button onClick={previewVoice} className="rounded-lg bg-white/10 px-3 text-xs font-bold">미리듣기</button></div>
                    <div className="flex items-center gap-2"><span className="text-[11px] text-white/40">말하기 속도</span><input aria-label="말하기 속도" type="range" min="0.8" max="1.2" step="0.05" value={voiceTempo} onChange={(e) => setVoiceTempo(Number(e.target.value))} className="flex-1 accent-violet-400" /><span className="w-7 text-right text-[11px] text-white/40">{voiceTempo.toFixed(2)}</span><button onClick={loadVoices} className="text-[11px] text-violet-200">새로고침</button></div>
                    {voicesError && <p className="text-[10px] text-amber-200">음성 목록: {voicesError}</p>}
                    <label className="block text-xs font-bold text-white/45">배경음</label>
                    <div className="flex gap-2"><select value={bgmStyle} onChange={(e) => setBgmStyle(e.target.value as BgmStyle)} className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#151720] px-2 py-2 text-xs">{bgmStyles.map((bgm) => <option key={bgm.id} value={bgm.id}>{bgm.name}</option>)}</select><button onClick={previewBgm} className="rounded-lg bg-white/10 px-3 text-xs font-bold">미리듣기</button></div>
                    <div className="flex items-center gap-2"><span className="text-[11px] text-white/40">BGM {bgmVolume}%</span><input aria-label="배경음 볼륨" type="range" min="0" max="45" value={bgmVolume} onChange={(e) => setBgmVolume(Number(e.target.value))} className="flex-1 accent-violet-400" /></div>
                    <label className="block text-xs font-bold text-white/45">장면 전환 효과</label>
                    <select value={transitionStyle} onChange={(e) => setTransitionStyle(e.target.value as TransitionStyle)} className="w-full rounded-lg border border-white/10 bg-[#151720] px-2 py-2 text-xs">{transitionStyles.map((transition) => <option key={transition.id} value={transition.id}>{transition.name}</option>)}</select>
                    <p className="text-[10px] leading-4 text-white/30">성우 속도에 맞춰 장면 길이가 자동 조정됩니다. 전환 효과는 영상 만들기 결과에 적용됩니다. 직접 추가한 영상은 무음 배경으로 사용됩니다.</p>
                  </div>
                </div>
              )}
            </aside>
          </div>
        </section>
      )}
    </main>
  );
}
