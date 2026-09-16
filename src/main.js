import "./style.css";
import * as THREE from "three";
import { MY_TRIP_ID, TRIPS, makeMyTrip } from "./data/trips.js";
import { Stage } from "./scene/stage.js";
import { Rope } from "./scene/rope.js";
import { Bulbs } from "./scene/bulbs.js";
import { Cards } from "./scene/cards.js";
import { TextureBank } from "./scene/textures.js";
import { Lightbox } from "./ui/lightbox.js";
import { Minimap } from "./ui/minimap.js";
import { setupUploader } from "./ui/uploader.js";
import { store } from "./lib/store.js";
import { sound } from "./lib/sound.js";
import { daysBetween, formatDate, haversine, lerp, mod, prefersReducedMotion } from "./lib/util.js";

const $ = (s) => document.querySelector(s);
const canvas = $("#stage");
const REDUCED = prefersReducedMotion();

/* ================================================================ 初始化 3D */

let stage;
try {
  stage = new Stage(canvas);
} catch (err) {
  document.body.insertAdjacentHTML(
    "beforeend",
    `<div class="fallback"><div><h2>这个浏览器暂时显示不了 3D 照片墙</h2><p>请尝试开启硬件加速，或换用最新版 Chrome / Safari / Edge。</p></div></div>`,
  );
  throw err;
}

const rope = new Rope(stage.world);
const bulbs = new Bulbs(stage.world);
const bank = new TextureBank(stage.renderer);
const cards = new Cards(stage, rope, bank);
if (import.meta.env.DEV) window.__app = { stage, rope, cards, bank };

const state = {
  tripId: readPref("trip") || TRIPS[0].id,
  filter: "全部",
  night: matchMedia("(prefers-color-scheme: dark)").matches,
  wind: false,
  autoplay: false,
  notes: {},
  mine: [],
  trip: null,
};

function readPref(k) {
  try {
    return localStorage.getItem(`clothesline:${k}`);
  } catch {
    return null;
  }
}
function writePref(k, v) {
  try {
    localStorage.setItem(`clothesline:${k}`, v);
  } catch {}
}

/* ================================================================ 数据 → 卡片 */

function tripById(id) {
  if (id === MY_TRIP_ID) return makeMyTrip(state.mine);
  return TRIPS.find((t) => t.id === id) || TRIPS[0];
}

function tripStats(trip) {
  const stops = trip.stops;
  const geo = stops.filter((s) => s.lat != null && s.lon != null);
  let km = 0;
  for (let i = 1; i < geo.length; i++) km += haversine(geo[i - 1], geo[i]);
  const dates = stops.map((s) => s.date).filter(Boolean).sort();
  const first = dates[0];
  const last = dates[dates.length - 1];
  let range = "—";
  if (first) {
    range = formatDate(first);
    if (last !== first) range += ` – ${last.slice(0, 4) === first.slice(0, 4) ? formatDate(last).slice(5) : formatDate(last)}`;
  }
  return {
    stops: stops.length,
    km: Math.round(km),
    // 只写到月份时算不出天数，就不显示
    days: first?.length >= 10 && last?.length >= 10 ? daysBetween(first, last) : 0,
    countries: new Set(stops.map((s) => s.country).filter(Boolean)).size,
    range,
  };
}

function buildItems(trip) {
  const stats = tripStats(trip);
  const stops = state.filter === "全部" ? trip.stops : trip.stops.filter((s) => s.tags?.includes(state.filter));
  const first = trip.stops[0];
  const ticket = {
    id: `ticket-${trip.id}`,
    kind: "ticket",
    trip,
    stats,
    place: trip.title,
    en: trip.en,
    date: first?.date,
    scene: trip.home ? "cantonTower" : first?.scene,
    country: "",
    note: trip.intro,
  };
  bank.forget(ticket.id);
  const items = [ticket, ...stops];
  if (trip.id === MY_TRIP_ID) items.push({ id: "empty", kind: "empty", place: "下一站" });
  return items;
}

function applyTrip(id, animate = true, focusId = null) {
  state.tripId = id;
  state.filter = "全部";
  writePref("trip", id);
  refresh(animate, focusId);
}

function applyFilter(tag) {
  if (tag === state.filter) return;
  state.filter = tag;
  refresh(true);
}

function refresh(animate, focusId = null) {
  const trip = tripById(state.tripId);
  state.trip = trip;
  document.documentElement.style.setProperty("--trip", trip.color);
  const items = buildItems(trip);
  const focus = focusId ? items.findIndex((i) => i.id === focusId) : -1;
  cards.setItems(items, animate, focus > 0 ? focus : null);
  minimap.setItems(trip, items);
  lastCenter = -1;
  renderTrips();
  renderFilters();
  renderStats();
}

/* ================================================================ 界面 */

function renderTrips() {
  const nav = $("#trips");
  nav.innerHTML = "";
  const all = [...TRIPS, makeMyTrip(state.mine)];
  for (const t of all) {
    const b = document.createElement("button");
    b.setAttribute("aria-selected", t.id === state.tripId);
    b.style.setProperty("--c", t.color);
    b.innerHTML = t.home
      ? `<svg class="home-icon" viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg><span></span>`
      : `<i class="dot"></i><span></span>`;
    if (t.home) b.classList.add("home");
    b.querySelector("span").textContent = t.title;
    if (t.id === MY_TRIP_ID) b.insertAdjacentHTML("beforeend", `<em class="badge">${state.mine.length || "+"}</em>`);
    b.addEventListener("click", () => {
      if (t.id !== state.tripId) {
        stopAutoplay();
        applyTrip(t.id);
      }
    });
    nav.appendChild(b);
  }
}

function renderFilters() {
  const box = $("#filters");
  box.innerHTML = "";
  const counts = {};
  for (const s of state.trip.stops) for (const t of s.tags || []) counts[t] = (counts[t] || 0) + 1;
  const tags = Object.keys(counts);
  if (tags.length < 2) return;
  for (const tag of ["全部", ...tags]) {
    const b = document.createElement("button");
    b.setAttribute("aria-pressed", tag === state.filter);
    b.innerHTML = `<span></span><small>${tag === "全部" ? state.trip.stops.length : counts[tag]}</small>`;
    b.querySelector("span").textContent = tag;
    b.addEventListener("click", () => {
      stopAutoplay();
      applyFilter(tag);
    });
    box.appendChild(b);
  }
}

function renderStats() {
  const s = tripStats(state.trip);
  const el = $("#stats");
  if (!s.stops) {
    el.textContent = "还没有照片 · 拖进来试试";
    return;
  }
  if (state.trip.home) {
    el.innerHTML = `从广州出发 · <b>${s.stops}</b> 个求学阶段 · 走出 <b>${s.km.toLocaleString()}</b> km`;
    return;
  }
  const parts = [`<b>${s.stops}</b> 站`];
  if (s.countries) parts.push(`<b>${s.countries}</b> 个国家`);
  if (s.km) parts.push(`<b>${s.km.toLocaleString()}</b> km`);
  if (s.days) parts.push(`<b>${s.days}</b> 天`);
  el.innerHTML = parts.join(" · ");
}

let wmTimer = 0;
function updateWatermark(item) {
  const wm = $("#watermark");
  wm.classList.add("swap");
  clearTimeout(wmTimer);
  wmTimer = setTimeout(() => {
    let place = item?.en || item?.place || "";
    let meta = "";
    if (item?.kind === "ticket") meta = item.trip.subtitle || item.stats.range;
    else if (item?.stage) meta = [item.stage, item.place].join(" · ");
    else if (item?.kind === "empty") place = "Next Stop";
    else if (item) meta = [item.place, formatDate(item.date)].filter(Boolean).join(" · ");
    $("#wmPlace").textContent = place;
    // 长地名自动缩小字号，避免超出屏幕
    $("#wmPlace").style.fontSize = `clamp(40px, min(11vw, ${(160 / Math.max(place.length, 1)).toFixed(2)}vw), 190px)`;
    $("#wmMeta").textContent = meta;
    wm.classList.remove("swap");
  }, 260);
}

let toastTimer = 0;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
}

const hint = $("#hint");
let hintTimer = setTimeout(() => hint.classList.add("show"), 1600);
function hideHint() {
  clearTimeout(hintTimer);
  hint.classList.remove("show");
}
setTimeout(hideHint, 9000);

/* ================================================================ 工具栏 */

const dock = $("#dock");
const btn = (a) => dock.querySelector(`[data-action="${a}"]`);
const minimapEl = $("#minimap");

function setNight(on, instant = false) {
  state.night = on;
  document.body.classList.toggle("night", on);
  stage.setNight(on);
  if (instant) stage.night = on ? 1 : 0;
  btn("night").setAttribute("aria-pressed", on);
}

function setWind(on) {
  state.wind = on;
  btn("wind").setAttribute("aria-pressed", on);
}

function startAutoplay() {
  state.autoplay = true;
  autoTimer = 1.2;
  btn("play").setAttribute("aria-pressed", true);
  btn("play").querySelector("span").textContent = "暂停回放";
  hideHint();
}
function stopAutoplay() {
  if (!state.autoplay) return;
  state.autoplay = false;
  btn("play").setAttribute("aria-pressed", false);
  btn("play").querySelector("span").textContent = "回放旅程";
}

function setMap(show) {
  minimapEl.classList.toggle("hidden", !show);
  btn("map").setAttribute("aria-pressed", show);
}

dock.addEventListener("click", (e) => {
  const action = e.target.closest("button")?.dataset.action;
  if (action === "play") state.autoplay ? stopAutoplay() : startAutoplay();
  if (action === "night") setNight(!state.night);
  if (action === "wind") setWind(!state.wind);
  if (action === "add") fileInput.click();
  if (action === "map") setMap(minimapEl.classList.contains("hidden"));
  if (action === "sound") {
    btn("sound").setAttribute("aria-pressed", sound.toggle());
    sound.play("clip");
  }
});

/* ================================================================ 灯箱 / 地图 / 上传 */

const lightbox = new Lightbox($("#lightbox"), {
  bank,
  getItem: (g) => cards.items[mod(g, cards.items.length)],
  position: (g) => {
    const real = cards.items.filter((i) => i.kind !== "empty").length;
    return { index: mod(g, cards.items.length), total: real };
  },
  returnInfo: (g) => {
    const s = cards.slotForG(g);
    return s ? cards.screenInfo(s) : null;
  },
  onNavigate: (g) => {
    cards.hiddenG = g;
    cards.scrollToG(g);
  },
  onClose: (g) => {
    const s = cards.slotForG(g);
    cards.hiddenG = null;
    if (s) {
      s.thetaV += (Math.random() < 0.5 ? -1 : 1) * 2.4;
      rope.impulse(s.x, -stage.L.cardH * 1.4);
    }
    sound.play("clip");
  },
  getNote: (item) => state.notes[item.id] ?? item.note ?? "",
  setNote: (item, text) => {
    if ((state.notes[item.id] ?? item.note ?? "") === text) return;
    state.notes[item.id] = text;
    store.setNote(item.id, text);
  },
  onRename: async (item, text) => {
    item.place = text;
    try {
      await document.fonts.load('40px "Long Cang"', text);
    } catch {}
    bank.refresh(item);
    store.putPhoto(item);
    lastCenter = -1;
  },
  onDelete: async (item) => {
    await store.deletePhoto(item.id);
    state.mine = state.mine.filter((p) => p.id !== item.id);
    bank.forget(item.id);
    cards.hiddenG = null;
    refresh(true);
    toast("已经从绳子上取下来了");
  },
  toast,
});

if (import.meta.env.DEV) window.__app.lightbox = lightbox;

const minimap = new Minimap(minimapEl, {
  onPick: (i) => {
    stopAutoplay();
    cards.scrollToG(cards.nearestG(i));
  },
});

const fileInput = $("#fileInput");
setupUploader({
  dropzone: $("#dropzone"),
  input: fileInput,
  toast,
  onPhotos: async (photos) => {
    for (const p of photos) {
      await store.putPhoto(p);
      p.fresh = true;
    }
    state.mine = [...state.mine, ...photos].sort(
      (a, b) => (a.date || "").localeCompare(b.date || "") || a.added - b.added,
    );
    try {
      await document.fonts.load('40px "Long Cang"', photos.map((p) => p.place).join(""));
    } catch {}
    applyTrip(MY_TRIP_ID, true, photos[0].id);
    const withGps = photos.filter((p) => p.lat != null).length;
    toast(`夹上了 ${photos.length} 张照片${withGps ? `，${withGps} 张带定位` : ""}，正在显影……`);
  },
});

/* ================================================================ 输入 */

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const ptr = { down: false, over: false, x: 0, y: 0, sx: 0, t: 0, lastT: 0, moved: 0, vx: 0 };
let hoverSlot = null;

function pickAt(x, y) {
  ndc.set((x / stage.L.W) * 2 - 1, -(y / stage.L.H) * 2 + 1);
  raycaster.setFromCamera(ndc, stage.camera);
  return cards.pick(raycaster);
}

canvas.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "mouse" && e.button !== 0) return;
  ptr.down = true;
  ptr.x = ptr.sx = e.clientX;
  ptr.y = e.clientY;
  ptr.t = ptr.lastT = performance.now();
  ptr.moved = 0;
  try {
    canvas.setPointerCapture(e.pointerId);
  } catch {}
  cards.dragStart();
  canvas.classList.add("dragging");
  hideHint();
});

canvas.addEventListener("pointermove", (e) => {
  const now = performance.now();
  const dt = Math.max(0.004, (now - ptr.lastT) / 1000);
  const dx = e.clientX - ptr.x;
  if (ptr.down) {
    cards.dragMove(dx, dt);
    ptr.moved += Math.abs(dx) + Math.abs(e.clientY - ptr.y);
    if (ptr.moved > 6) stopAutoplay();
  }
  ptr.vx = lerp(ptr.vx, dx / dt, 0.5);
  ptr.x = e.clientX;
  ptr.y = e.clientY;
  ptr.lastT = now;
  ptr.over = e.pointerType === "mouse";
  stage.setPointer((e.clientX / stage.L.W) * 2 - 1, (e.clientY / stage.L.H) * 2 - 1);
});

function endPointer(e, cancelled) {
  if (!ptr.down) return;
  ptr.down = false;
  cards.dragEnd();
  canvas.classList.remove("dragging");
  if (!cancelled && ptr.moved < 8 && performance.now() - ptr.t < 450) {
    const slot = pickAt(e.clientX, e.clientY);
    if (slot) openSlot(slot);
  }
}
canvas.addEventListener("pointerup", (e) => endPointer(e, false));
canvas.addEventListener("pointercancel", (e) => endPointer(e, true));
canvas.addEventListener("pointerleave", () => {
  ptr.over = false;
  canvas.classList.remove("over-card");
});

canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    const px = e.deltaMode === 1 ? d * 30 : d;
    cards.wheel(px);
    stopAutoplay();
    hideHint();
  },
  { passive: false },
);

function openSlot(slot) {
  const item = cards.items[slot.itemIndex];
  if (!item || lightbox.isOpen || cards.swap) return;
  if (item.kind === "empty") return fileInput.click();
  stopAutoplay();
  hideHint();
  const info = cards.screenInfo(slot);
  cards.hiddenG = slot.g;
  cards.scrollToG(slot.g);
  rope.impulse(slot.x, stage.L.cardH * 1.2);
  canvas.classList.remove("over-card");
  lightbox.open(slot.g, info);
}

window.addEventListener("keydown", (e) => {
  if (lightbox.handleKey(e)) return;
  if (e.target.isContentEditable || e.target.tagName === "INPUT" || e.metaKey || e.ctrlKey) return;
  switch (e.key) {
    case "ArrowRight":
      cards.scrollBy(1);
      stopAutoplay();
      hideHint();
      break;
    case "ArrowLeft":
      cards.scrollBy(-1);
      stopAutoplay();
      hideHint();
      break;
    case "Enter": {
      const s = cards.slotForG(Math.round(cards.centerFloat()));
      if (s) openSlot(s);
      break;
    }
    case " ":
      e.preventDefault();
      state.autoplay ? stopAutoplay() : startAutoplay();
      break;
    case "n":
    case "N":
      setNight(!state.night);
      break;
    case "w":
    case "W":
      setWind(!state.wind);
      break;
    case "m":
    case "M":
      btn("sound").setAttribute("aria-pressed", sound.toggle());
      break;
  }
});

cards.onClipOn = () => sound.play("clip", Math.random() * 0.03);

/* ================================================================ 主循环 */

let lastCenter = -1;
let autoTimer = 0;
let windLevel = 0;
let time = 0;
let last = performance.now();

function onResize() {
  const L = stage.layout();
  stage.renderer.setPixelRatio(stage.dpr);
  stage.renderer.setSize(L.W, L.H, false);
  rope.resize(L);
  bulbs.resize(L);
  cards.resize(L);
}

let resizeRaf = 0;
window.addEventListener("resize", () => {
  cancelAnimationFrame(resizeRaf);
  if (document.hidden) onResize();
  else resizeRaf = requestAnimationFrame(onResize);
});
document.addEventListener("visibilitychange", () => {
  last = performance.now();
});

function frame(now) {
  requestAnimationFrame(frame);
  if (document.hidden) return;
  const dt = Math.min(1 / 30, Math.max(1 / 240, (now - last) / 1000));
  last = now;
  step(dt);
}

function step(dt) {
  time += dt;

  windLevel = lerp(windLevel, state.wind ? 1 : 0, 1 - Math.exp(-dt * 1.2));

  // 回放：停稳后等一会儿，滑到下一张
  if (state.autoplay && !lightbox.isOpen && !cards.swap && cards.mode === "snap") {
    if (Math.abs(cards.offset - cards.target) < stage.L.spacing * 0.02) autoTimer += dt;
    if (autoTimer > 2.2) {
      autoTimer = 0;
      const next = cards.items[mod(Math.round(cards.centerFloat()) + 1, cards.items.length)];
      cards.scrollBy(next?.kind === "empty" ? 2 : 1);
    }
  }

  cards.step(dt, time, { wind: windLevel, reduced: REDUCED });
  rope.step(dt);
  rope.setNight(stage.night);
  rope.updateMesh();
  bulbs.update(rope, stage.night, time);
  bank.update(dt);
  stage.update(dt, rope, REDUCED);

  if (ptr.over && !ptr.down && !lightbox.isOpen) {
    const slot = pickAt(ptr.x, ptr.y);
    canvas.classList.toggle("over-card", !!slot);
    if (slot && slot !== hoverSlot && !REDUCED) cards.poke(slot, ptr.vx);
    hoverSlot = slot;
  }

  if (!cards.swap && cards.items.length) {
    const ci = cards.centerItemIndex();
    if (ci !== lastCenter) {
      lastCenter = ci;
      updateWatermark(cards.items[ci]);
    }
    minimap.update(cards.centerFloat());
  }

  stage.render();
  adaptQuality(dt);
}

if (import.meta.env.DEV) {
  // 调试用：在后台标签页里手动推进动画
  Object.assign(window.__app, {
    advance(seconds, fps = 60) {
      for (let i = 0; i < seconds * fps; i++) step(1 / fps);
    },
  });
}

/* 帧率不够时降低渲染分辨率，恢复流畅后再慢慢调回来 */
const MAX_DPR = Math.min(2, window.devicePixelRatio || 1);
let fpsFrames = 0;
let fpsTime = 0;
let goodSeconds = 0;
function adaptQuality(dt) {
  fpsFrames++;
  fpsTime += dt;
  if (fpsTime < 1) return;
  const fps = fpsFrames / fpsTime;
  fpsFrames = fpsTime = 0;
  if (fps < 45 && stage.dpr > 1) {
    stage.dpr = Math.max(1, stage.dpr - 0.25);
    goodSeconds = -10;
    onResize();
  } else if (fps > 57 && stage.dpr < MAX_DPR && ++goodSeconds > 6) {
    stage.dpr = Math.min(MAX_DPR, stage.dpr + 0.25);
    goodSeconds = 0;
    onResize();
  }
}

/* ================================================================ 启动 */

async function loadFonts() {
  const text = [
    ...TRIPS.flatMap((t) => [t.title, ...t.stops.map((s) => s.place)]),
    ...state.mine.map((p) => p.place),
    "把照片拖进来或者点我选择下一站……未命名的一站",
  ].join("");
  const jobs = [
    document.fonts.load('40px "Long Cang"', text),
    document.fonts.load('40px "Caveat"', "Tokyo Reykjavík 0123456789 · /"),
    document.fonts.load('700 40px "Noto Serif SC"', "登机牌晾着的旅程"),
  ];
  await Promise.race([Promise.allSettled(jobs), new Promise((r) => setTimeout(r, 3500))]);
}

(async () => {
  const [notes, mine] = await Promise.all([store.allNotes(), store.allPhotos()]);
  state.notes = notes;
  state.mine = mine;
  const known = state.tripId === MY_TRIP_ID ? mine.length > 0 : TRIPS.some((t) => t.id === state.tripId);
  if (!known) state.tripId = TRIPS[0].id;
  await loadFonts();
  onResize();
  setNight(state.night, true);
  setWind(false);
  setMap(window.innerWidth >= 640);
  applyTrip(state.tripId, !REDUCED);
  requestAnimationFrame((t) => {
    last = t;
    frame(t);
  });
})();
