/**
 * 卡片美术：拍立得正面、登机牌、背面纸张、阴影、灯泡光晕、邮票、导出明信片。
 * 所有函数都返回 <canvas>，既能当 Three.js 贴图，也能直接放进 DOM。
 */
import { paintScene } from "./scenes.js";
import { formatDate, formatCoord, hashString, rng, wrapText } from "../lib/util.js";

export const CARD_RATIO = 1.22;
export const HAND = '"Long Cang", "Caveat", "Kaiti SC", cursive';
export const HAND_LATIN = '"Caveat", "Long Cang", cursive';
export const SERIF = '"Noto Serif SC", "Songti SC", serif';

function canvas(w, h) {
  const cv = document.createElement("canvas");
  cv.width = Math.round(w);
  cv.height = Math.round(h);
  return cv;
}

function rrect(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function paper(c, w, h, seed, base = "#fbf9f3") {
  rrect(c, 0, 0, w, h, w * 0.018);
  c.fillStyle = base;
  c.fill();
  c.save();
  c.clip();
  const g = c.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "rgba(255,255,255,.5)");
  g.addColorStop(1, "rgba(120,100,70,.08)");
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  const r = rng(seed);
  c.globalAlpha = 0.04;
  for (let i = 0; i < (w * h) / 260; i++) {
    c.fillStyle = r() > 0.5 ? "#000" : "#fff";
    c.fillRect(r() * w, r() * h, 1.4, 1.4);
  }
  c.restore();
}

function fitFont(c, text, family, weight, size, maxW) {
  let s = size;
  do {
    c.font = `${weight} ${s}px ${family}`;
    if (c.measureText(text).width <= maxW) break;
    s *= 0.92;
  } while (s > size * 0.4);
  return s;
}

/** 在 box 里按 cover 方式绘制图片 */
export function drawCover(c, img, x, y, w, h) {
  const iw = img.width || img.naturalWidth;
  const ih = img.height || img.naturalHeight;
  const s = Math.max(w / iw, h / ih);
  c.drawImage(img, x + (w - iw * s) / 2, y + (h - ih * s) / 2, iw * s, ih * s);
}

/* ------------------------------------------------------------ 拍立得正面 */

/**
 * @param item    站点数据
 * @param W       宽度（像素）
 * @param image   已加载的真实照片（可选）
 * @param develop 0→1，拍立得显影进度
 */
export function makePolaroid(item, W, image = null, develop = 1) {
  const H = W * CARD_RATIO;
  const cv = canvas(W, H);
  const c = cv.getContext("2d");
  const seed = hashString(item.id);
  paper(c, W, H, seed);

  const pad = W * 0.06;
  const iw = W - pad * 2;
  const ih = iw;
  c.save();
  c.beginPath();
  c.rect(pad, pad, iw, ih);
  c.clip();
  if (image) {
    drawCover(c, image, pad, pad, iw, ih);
  } else {
    c.translate(pad, pad);
    // 在固定分辨率上作画再缩放，保证不同尺寸的卡片画面一致
    const base = 640;
    c.scale(iw / base, ih / base);
    paintScene(c, base, base, item.scene, seed);
  }
  c.restore();

  if (develop < 1) {
    const k = 1 - develop;
    c.save();
    c.globalAlpha = Math.min(1, k * 1.15);
    c.fillStyle = "#2c2a26";
    c.fillRect(pad, pad, iw, ih);
    c.globalAlpha = k * 0.5;
    c.fillStyle = "#6a8c86";
    c.fillRect(pad, pad, iw, ih);
    c.restore();
  }

  // 照片内边缘
  c.strokeStyle = "rgba(0,0,0,.12)";
  c.lineWidth = Math.max(1, W * 0.003);
  c.strokeRect(pad, pad, iw, ih);

  // 求学阶段：左上角贴一条纸胶带标签
  if (item.stage) {
    c.save();
    c.translate(pad + W * 0.02, pad + W * 0.05);
    c.rotate(-0.12);
    c.fillStyle = "rgba(200,55,45,.9)";
    c.fillRect(-W * 0.05, -W * 0.045, W * 0.26, W * 0.085);
    c.fillStyle = "#fff";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.font = `400 ${W * 0.06}px ${HAND}`;
    c.fillText(item.stage, W * 0.08, 0);
    c.restore();
  }

  // 手写标题
  const capTop = pad + ih;
  const capH = H - capTop;
  c.fillStyle = "#2b2622";
  c.textBaseline = "alphabetic";
  fitFont(c, item.place || "未命名", HAND, 400, W * 0.1, iw * 0.95);
  c.fillText(item.place || "未命名", pad + W * 0.01, capTop + capH * 0.56);
  c.fillStyle = "#8d8378";
  c.font = `400 ${W * 0.05}px ${HAND_LATIN}`;
  const sub = [item.area || item.country, formatDate(item.date)].filter(Boolean).join(" · ");
  c.fillText(sub, pad + W * 0.012, capTop + capH * 0.86);
  if (item.en) {
    c.textAlign = "right";
    c.fillStyle = "#b5aa9d";
    fitFont(c, item.en, HAND_LATIN, 400, W * 0.05, iw * 0.45);
    c.fillText(item.en, W - pad, capTop + capH * 0.86);
    c.textAlign = "left";
  }
  return cv;
}

/* ------------------------------------------------------------ 登机牌 */

export function makeTicket(trip, W, stats) {
  const H = W * CARD_RATIO;
  const cv = canvas(W, H);
  const c = cv.getContext("2d");
  const seed = hashString(trip.id);
  paper(c, W, H, seed, "#fffdf6");

  c.save();
  rrect(c, 0, 0, W, H, W * 0.018);
  c.clip();
  // 顶部色条
  c.fillStyle = trip.color;
  c.fillRect(0, 0, W, H * 0.2);
  c.fillStyle = "rgba(255,255,255,.95)";
  c.font = `700 ${W * 0.045}px ui-sans-serif, system-ui, sans-serif`;
  c.fillText("BOARDING PASS", W * 0.07, H * 0.085);
  c.font = `500 ${W * 0.05}px ${SERIF}`;
  c.fillText("登机牌", W * 0.07, H * 0.155);
  // 飞机图标
  c.save();
  c.translate(W * 0.84, H * 0.1);
  c.rotate(Math.PI / 4);
  c.scale(W / 640, W / 640);
  c.beginPath();
  c.moveTo(0, -38);
  c.quadraticCurveTo(6, -38, 6, -26);
  c.lineTo(6, -8);
  c.lineTo(38, 10);
  c.lineTo(38, 18);
  c.lineTo(6, 8);
  c.lineTo(6, 26);
  c.lineTo(16, 34);
  c.lineTo(16, 40);
  c.lineTo(0, 35);
  c.lineTo(-16, 40);
  c.lineTo(-16, 34);
  c.lineTo(-6, 26);
  c.lineTo(-6, 8);
  c.lineTo(-38, 18);
  c.lineTo(-38, 10);
  c.lineTo(-6, -8);
  c.lineTo(-6, -26);
  c.quadraticCurveTo(-6, -38, 0, -38);
  c.fill();
  c.restore();

  // 出发 → 到达
  const [from, to] = trip.codes;
  c.fillStyle = "#9a9087";
  c.font = `500 ${W * 0.036}px ui-sans-serif, system-ui, sans-serif`;
  c.fillText("FROM", W * 0.07, H * 0.28);
  c.textAlign = "right";
  c.fillText("TO", W * 0.93, H * 0.28);
  c.fillStyle = "#231f1c";
  c.font = `700 ${W * 0.13}px ui-monospace, "SF Mono", Menlo, monospace`;
  c.fillText(to, W * 0.93, H * 0.38);
  c.textAlign = "left";
  c.fillText(from, W * 0.07, H * 0.38);
  c.strokeStyle = trip.color;
  c.lineWidth = W * 0.006;
  c.setLineDash([W * 0.015, W * 0.012]);
  c.beginPath();
  c.moveTo(W * 0.42, H * 0.345);
  c.lineTo(W * 0.58, H * 0.345);
  c.stroke();
  c.setLineDash([]);

  // 行程名
  c.fillStyle = "#2b2622";
  fitFont(c, trip.title, HAND, 400, W * 0.1, W * 0.86);
  c.fillText(trip.title, W * 0.07, H * 0.52);

  // 信息格
  const cells = [
    ["日期", stats.range],
    ["站点", `${stats.stops} 站`],
    ["里程", stats.km ? `${stats.km.toLocaleString()} km` : "—"],
  ];
  cells.forEach(([k, v], i) => {
    const x = W * 0.07 + i * W * 0.3;
    c.fillStyle = "#9a9087";
    c.font = `500 ${W * 0.034}px ui-sans-serif, system-ui, sans-serif`;
    c.fillText(k, x, H * 0.61);
    c.fillStyle = "#231f1c";
    fitFont(c, v, "ui-sans-serif, system-ui, sans-serif", 600, W * 0.045, W * 0.28);
    c.fillText(v, x, H * 0.665);
  });

  // 撕线 + 两侧缺口
  c.strokeStyle = "rgba(0,0,0,.2)";
  c.lineWidth = 2;
  c.setLineDash([W * 0.012, W * 0.012]);
  c.beginPath();
  c.moveTo(W * 0.06, H * 0.73);
  c.lineTo(W * 0.94, H * 0.73);
  c.stroke();
  c.setLineDash([]);
  c.globalCompositeOperation = "destination-out";
  c.beginPath();
  c.arc(0, H * 0.73, W * 0.035, 0, Math.PI * 2);
  c.arc(W, H * 0.73, W * 0.035, 0, Math.PI * 2);
  c.fill();
  c.globalCompositeOperation = "source-over";

  // 条形码
  const r = rng(seed);
  let x = W * 0.08;
  c.fillStyle = "#231f1c";
  while (x < W * 0.92) {
    const bw = W * (0.003 + r() * 0.01);
    if (r() > 0.35) c.fillRect(x, H * 0.78, bw, H * 0.12);
    x += bw + W * 0.004;
  }
  c.fillStyle = "#9a9087";
  c.font = `500 ${W * 0.032}px ui-monospace, Menlo, monospace`;
  c.fillText(`${trip.en.toUpperCase()}`, W * 0.08, H * 0.945);
  c.textAlign = "right";
  c.fillText("拖动 → 出发", W * 0.92, H * 0.945);
  c.restore();
  return cv;
}


/* ------------------------------------------------------------ 故乡卡（代替登机牌） */

export function makeHomeCard(trip, W, stats) {
  const H = W * CARD_RATIO;
  const cv = canvas(W, H);
  const c = cv.getContext("2d");
  paper(c, W, H, hashString(trip.id), "#fffaf2");
  c.save();
  rrect(c, 0, 0, W, H, W * 0.018);
  c.clip();

  // 顶部色条 + 小房子
  c.fillStyle = trip.color;
  c.fillRect(0, 0, W, H * 0.13);
  c.fillStyle = "rgba(255,255,255,.95)";
  c.font = `700 ${W * 0.042}px ui-sans-serif, system-ui, sans-serif`;
  c.fillText("HOMETOWN · 故乡", W * 0.07, H * 0.085);
  c.save();
  c.translate(W * 0.87, H * 0.065);
  c.beginPath();
  c.moveTo(-W * 0.045, 0);
  c.lineTo(0, -W * 0.04);
  c.lineTo(W * 0.045, 0);
  c.lineTo(W * 0.032, 0);
  c.lineTo(W * 0.032, W * 0.04);
  c.lineTo(-W * 0.032, W * 0.04);
  c.lineTo(-W * 0.032, 0);
  c.closePath();
  c.fill();
  c.restore();

  // 城市插画
  const ix = W * 0.06;
  const iy = H * 0.16;
  const iw = W * 0.88;
  const ih = H * 0.36;
  c.save();
  c.beginPath();
  c.rect(ix, iy, iw, ih);
  c.clip();
  c.translate(ix, iy - (iw - ih) * 0.5);
  c.scale(iw / 640, iw / 640);
  paintScene(c, 640, 640, "cantonTower", hashString(trip.id));
  c.restore();

  // 城市名
  c.fillStyle = "#2b2622";
  c.font = `400 ${W * 0.17}px ${HAND}`;
  c.fillText(trip.title.split(" ")[0], W * 0.06, H * 0.68);
  c.fillStyle = "#8d8378";
  c.font = `700 ${W * 0.04}px ui-sans-serif, system-ui, sans-serif`;
  c.fillText(`${trip.en.toUpperCase()} · ${trip.codes[0]}`, W * 0.07, H * 0.735);
  c.textAlign = "right";
  c.font = `400 ${W * 0.055}px ${HAND}`;
  c.fillText("羊城 · 花城", W * 0.94, H * 0.66);
  c.textAlign = "left";

  // 求学路线
  c.strokeStyle = "rgba(0,0,0,.15)";
  c.setLineDash([W * 0.012, W * 0.012]);
  c.beginPath();
  c.moveTo(W * 0.06, H * 0.77);
  c.lineTo(W * 0.94, H * 0.77);
  c.stroke();
  c.setLineDash([]);
  const stops = trip.stops;
  const y = H * 0.845;
  const x0 = W * 0.12;
  const x1 = W * 0.88;
  c.strokeStyle = trip.color;
  c.lineWidth = W * 0.006;
  c.beginPath();
  c.moveTo(x0, y);
  c.lineTo(x1, y);
  c.stroke();
  stops.forEach((st, i) => {
    const x = stops.length > 1 ? x0 + ((x1 - x0) * i) / (stops.length - 1) : (x0 + x1) / 2;
    c.fillStyle = "#fffaf2";
    c.beginPath();
    c.arc(x, y, W * 0.022, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillStyle = "#5b4f45";
    c.textAlign = "center";
    c.font = `400 ${W * 0.045}px ${HAND}`;
    c.fillText(st.stage || st.place, x, y - W * 0.04);
  });
  c.textAlign = "left";
  c.fillStyle = "#9a9087";
  c.font = `500 ${W * 0.032}px ui-sans-serif, system-ui, sans-serif`;
  c.fillText(`从这里出发 · 走出 ${stats.km.toLocaleString()} km`, W * 0.07, H * 0.95);
  c.restore();
  return cv;
}

/* ------------------------------------------------------------ 背面 / 阴影 / 光晕 */

export function makeCardBack(W) {
  const H = W * CARD_RATIO;
  const cv = canvas(W, H);
  const c = cv.getContext("2d");
  paper(c, W, H, 99, "#f3ede0");
  c.save();
  // 背面在 3D 里是镜像看到的，文字要翻转回来
  c.translate(W, 0);
  c.scale(-1, 1);
  c.fillStyle = "#b8ab98";
  c.font = `600 ${W * 0.04}px ui-sans-serif, system-ui, sans-serif`;
  c.fillText("POST CARD · 旅行明信片", W * 0.08, H * 0.1);
  c.strokeStyle = "rgba(150,130,100,.3)";
  c.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    c.beginPath();
    c.moveTo(W * 0.08, H * (0.45 + i * 0.08));
    c.lineTo(W * 0.92, H * (0.45 + i * 0.08));
    c.stroke();
  }
  c.strokeRect(W * 0.66, H * 0.16, W * 0.24, W * 0.28);
  c.restore();
  return cv;
}

export function makeShadow(size = 256) {
  const cv = canvas(size, size);
  const c = cv.getContext("2d");
  c.shadowColor = "rgba(0,0,0,1)";
  c.shadowBlur = size * 0.1;
  c.shadowOffsetX = size * 4;
  c.fillStyle = "#000";
  rrect(c, size * 0.18 - size * 4, size * 0.16, size * 0.64, size * 0.68, size * 0.03);
  c.fill();
  return cv;
}

export function makeGlow(size = 128) {
  const cv = canvas(size, size);
  const c = cv.getContext("2d");
  const g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,240,200,1)");
  g.addColorStop(0.18, "rgba(255,200,110,.75)");
  g.addColorStop(0.5, "rgba(255,150,60,.18)");
  g.addColorStop(1, "rgba(255,120,40,0)");
  c.fillStyle = g;
  c.fillRect(0, 0, size, size);
  return cv;
}

/* ------------------------------------------------------------ 邮票 / 邮戳 */

export function makeStamp(item, W = 220, image = null) {
  const H = W * 1.2;
  const cv = canvas(W, H);
  const c = cv.getContext("2d");
  const hole = W * 0.035;
  c.fillStyle = "#fffdf8";
  c.fillRect(0, 0, W, H);
  // 齿孔
  c.globalCompositeOperation = "destination-out";
  for (let x = hole; x < W; x += hole * 2.6) {
    c.beginPath();
    c.arc(x, 0, hole, 0, Math.PI * 2);
    c.arc(x, H, hole, 0, Math.PI * 2);
    c.fill();
  }
  for (let y = hole; y < H; y += hole * 2.6) {
    c.beginPath();
    c.arc(0, y, hole, 0, Math.PI * 2);
    c.arc(W, y, hole, 0, Math.PI * 2);
    c.fill();
  }
  c.globalCompositeOperation = "source-over";
  const m = W * 0.1;
  c.save();
  c.beginPath();
  c.rect(m, m, W - m * 2, H - m * 2.8);
  c.clip();
  if (image) drawCover(c, image, m, m, W - m * 2, H - m * 2.8);
  else {
    c.translate(m, m);
    const base = 640;
    c.scale((W - m * 2) / base, (H - m * 2.8) / base);
    paintScene(c, base, base, item.scene, hashString(item.id));
  }
  c.restore();
  c.fillStyle = "#5b4f45";
  fitFont(c, (item.en || item.place || "").toUpperCase(), "ui-sans-serif, system-ui, sans-serif", 700, W * 0.075, W - m * 2);
  c.fillText((item.en || item.place || "").toUpperCase(), m, H - m * 0.75);
  return cv;
}

export function drawPostmark(c, x, y, R, lines, color = "rgba(40,60,120,.75)") {
  c.save();
  c.translate(x, y);
  c.rotate(-0.2);
  c.strokeStyle = color;
  c.fillStyle = color;
  c.lineWidth = R * 0.05;
  c.beginPath();
  c.arc(0, 0, R, 0, Math.PI * 2);
  c.stroke();
  c.lineWidth = R * 0.025;
  c.beginPath();
  c.arc(0, 0, R * 0.72, 0, Math.PI * 2);
  c.stroke();
  // 环形文字
  const ring = lines.top.toUpperCase();
  c.font = `700 ${R * 0.17}px ui-sans-serif, system-ui, sans-serif`;
  const step = Math.min(0.26, (Math.PI * 1.1) / ring.length);
  [...ring].forEach((ch, i) => {
    c.save();
    c.rotate(-((ring.length - 1) * step) / 2 + i * step);
    c.textAlign = "center";
    c.fillText(ch, 0, -R * 0.78);
    c.restore();
  });
  c.textAlign = "center";
  c.font = `700 ${R * 0.22}px ui-monospace, Menlo, monospace`;
  c.fillText(lines.mid, 0, R * 0.08);
  c.font = `600 ${R * 0.16}px ui-sans-serif, system-ui, sans-serif`;
  c.fillText(lines.bottom, 0, R * 0.38);
  // 波浪注销线
  c.lineWidth = R * 0.04;
  for (let k = 0; k < 4; k++) {
    c.beginPath();
    for (let t = 0; t <= 1; t += 0.05) {
      const px = R * 1.1 + t * R * 2.4;
      c.lineTo(px, -R * 0.45 + k * R * 0.3 + Math.sin(t * Math.PI * 4) * R * 0.08);
    }
    c.stroke();
  }
  c.restore();
}

/* ------------------------------------------------------------ 导出明信片 */

export function makePostcardExport(item, polaroid, note, image) {
  const W = 2400,
    H = 1600;
  const cv = canvas(W, H);
  const c = cv.getContext("2d");
  // 牛皮纸背景
  c.fillStyle = "#efe6d4";
  c.fillRect(0, 0, W, H);
  const r = rng(hashString(item.id));
  c.globalAlpha = 0.06;
  for (let i = 0; i < 60000; i++) {
    c.fillStyle = r() > 0.5 ? "#6b5436" : "#fff";
    c.fillRect(r() * W, r() * H, 2, 2);
  }
  c.globalAlpha = 1;

  // 左边：拍立得
  const pw = 860;
  const ph = pw * CARD_RATIO;
  c.save();
  c.translate(560, H / 2);
  c.rotate(-0.05);
  c.shadowColor = "rgba(60,40,20,.35)";
  c.shadowBlur = 60;
  c.shadowOffsetY = 24;
  c.drawImage(polaroid, -pw / 2, -ph / 2, pw, ph);
  c.restore();

  // 右边：明信片背面
  const x0 = 1120;
  c.strokeStyle = "rgba(90,70,50,.35)";
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(x0 + 520, 260);
  c.lineTo(x0 + 520, H - 200);
  c.stroke();
  c.fillStyle = "#6f5e4c";
  c.font = `700 44px ui-sans-serif, system-ui, sans-serif`;
  c.fillText("POST CARD", x0, 200);

  const stamp = makeStamp(item, 250, image);
  c.save();
  c.translate(W - 360, 170);
  c.rotate(0.04);
  c.drawImage(stamp, 0, 0);
  c.restore();
  drawPostmark(c, W - 420, 430, 120, {
    top: item.en || item.place || "TRAVEL",
    mid: formatDate(item.date) || "—",
    bottom: item.country || "",
  });

  // 手写游记
  c.fillStyle = "#2f2a26";
  c.font = `400 64px ${HAND}`;
  const lines = wrapText(c, note || "……", 460).slice(0, 12);
  lines.forEach((ln, i) => c.fillText(ln, x0, 320 + i * 92));

  // 地址栏
  const ax = x0 + 580;
  c.strokeStyle = "rgba(90,70,50,.4)";
  c.lineWidth = 3;
  for (let i = 0; i < 4; i++) {
    c.beginPath();
    c.moveTo(ax, 900 + i * 130);
    c.lineTo(W - 140, 900 + i * 130);
    c.stroke();
  }
  c.fillStyle = "#2f2a26";
  c.font = `400 68px ${HAND}`;
  c.fillText("寄给：未来的自己", ax + 10, 880);
  c.fillText(`${item.place || ""}${item.country ? " · " + item.country : ""}`, ax + 10, 1010);
  c.font = `400 56px ${HAND_LATIN}`;
  c.fillText(formatCoord(item.lat, item.lon), ax + 10, 1140);
  c.fillText(formatDate(item.date, " / "), ax + 10, 1270);
  c.fillStyle = "rgba(90,70,50,.5)";
  c.font = `500 30px ui-sans-serif, system-ui, sans-serif`;
  c.fillText("Clothesline Travel Wall", x0, H - 100);
  if (item.credit) {
    c.font = `500 24px ui-sans-serif, system-ui, sans-serif`;
    c.fillText(`Photo: ${item.credit.artist} · ${item.credit.license} · Wikimedia Commons`, x0, H - 60);
  }
  return cv;
}

/* ------------------------------------------------------------ 空卡片（我的旅行还没有照片时） */

export function makeEmptyCard(W) {
  const H = W * CARD_RATIO;
  const cv = canvas(W, H);
  const c = cv.getContext("2d");
  paper(c, W, H, 7);
  const pad = W * 0.06;
  const iw = W - pad * 2;
  c.fillStyle = "#efe9dd";
  c.fillRect(pad, pad, iw, iw);
  c.strokeStyle = "#c4b6a2";
  c.lineWidth = W * 0.006;
  c.setLineDash([W * 0.03, W * 0.02]);
  c.strokeRect(pad + W * 0.04, pad + W * 0.04, iw - W * 0.08, iw - W * 0.08);
  c.setLineDash([]);
  c.strokeStyle = "#b3a38c";
  c.lineWidth = W * 0.014;
  c.lineCap = "round";
  const cx = W / 2;
  const cy = pad + iw * 0.44;
  c.beginPath();
  c.moveTo(cx - W * 0.08, cy);
  c.lineTo(cx + W * 0.08, cy);
  c.moveTo(cx, cy - W * 0.08);
  c.lineTo(cx, cy + W * 0.08);
  c.stroke();
  c.fillStyle = "#8d8378";
  c.textAlign = "center";
  c.font = `400 ${W * 0.075}px ${HAND}`;
  c.fillText("把照片拖进来", cx, pad + iw * 0.72);
  c.font = `400 ${W * 0.05}px ${HAND}`;
  c.fillText("或者点我选择", cx, pad + iw * 0.84);
  c.fillStyle = "#2b2622";
  c.textAlign = "left";
  c.font = `400 ${W * 0.09}px ${HAND}`;
  c.fillText("下一站……", pad + W * 0.01, pad + iw + (H - pad - iw) * 0.56);
  return cv;
}
