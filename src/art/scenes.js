/**
 * 占位插画：没有真实照片时，用 Canvas 程序化画出每个目的地。
 * 每个画家函数签名：(ctx, w, h, rand) → 在 0,0 → w,h 的区域里作画。
 */
import { rng } from "../lib/util.js";

/* ---------------------------------------------------------------- 基础笔刷 */

function lin(c, x0, y0, x1, y1, stops) {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
}

function sky(c, w, h, stops) {
  c.fillStyle = lin(c, 0, 0, 0, h, stops);
  c.fillRect(0, 0, w, h);
}

function glow(c, x, y, r, color, alpha = 1) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  c.save();
  c.globalAlpha = alpha;
  c.fillStyle = g;
  c.fillRect(x - r, y - r, r * 2, r * 2);
  c.restore();
}

function disc(c, x, y, r, color) {
  c.fillStyle = color;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
}

function stars(c, w, maxY, n, rand, alpha = 0.9) {
  for (let i = 0; i < n; i++) {
    const s = rand() * 1.8 + 0.4;
    c.globalAlpha = alpha * (0.3 + rand() * 0.7);
    disc(c, rand() * w, rand() * maxY, s, "#fff");
  }
  c.globalAlpha = 1;
}

/** 中点位移法生成山脊线，填充到底部 */
function ridge(c, w, h, { y, amp, rough = 0.55, detail = 7, fill, rand }) {
  let pts = [y + (rand() - 0.5) * amp, y + (rand() - 0.5) * amp];
  let d = amp;
  for (let k = 0; k < detail; k++) {
    const next = [];
    for (let i = 0; i < pts.length - 1; i++) {
      next.push(pts[i], (pts[i] + pts[i + 1]) / 2 + (rand() - 0.5) * d);
    }
    next.push(pts[pts.length - 1]);
    pts = next;
    d *= rough;
  }
  c.fillStyle = fill;
  c.beginPath();
  c.moveTo(0, h);
  pts.forEach((py, i) => c.lineTo((i / (pts.length - 1)) * w, py));
  c.lineTo(w, h);
  c.closePath();
  c.fill();
  return pts;
}

function shimmer(c, x0, x1, y0, y1, rand, color, n = 60) {
  c.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const y = y0 + rand() ** 1.4 * (y1 - y0);
    const len = (x1 - x0) * (0.02 + rand() * 0.08) * (0.4 + (y - y0) / (y1 - y0));
    c.globalAlpha = 0.15 + rand() * 0.35;
    c.fillRect(x0 + rand() * (x1 - x0), y, len, 1.5 + rand() * 1.5);
  }
  c.globalAlpha = 1;
}

function cloud(c, x, y, s, color = "rgba(255,255,255,.8)") {
  c.fillStyle = color;
  c.beginPath();
  c.ellipse(x, y, s, s * 0.32, 0, 0, Math.PI * 2);
  c.ellipse(x - s * 0.45, y + s * 0.08, s * 0.5, s * 0.25, 0, 0, Math.PI * 2);
  c.ellipse(x + s * 0.5, y + s * 0.06, s * 0.55, s * 0.24, 0, 0, Math.PI * 2);
  c.fill();
}

function palm(c, x, y, s, color) {
  c.strokeStyle = color;
  c.fillStyle = color;
  c.lineWidth = s * 0.05;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(x, y);
  c.quadraticCurveTo(x + s * 0.12, y - s * 0.5, x + s * 0.05, y - s);
  c.stroke();
  const tx = x + s * 0.05,
    ty = y - s;
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI + (i / 6) * Math.PI;
    c.beginPath();
    c.moveTo(tx, ty);
    c.quadraticCurveTo(
      tx + Math.cos(a) * s * 0.3,
      ty + Math.sin(a) * s * 0.3 - s * 0.08,
      tx + Math.cos(a) * s * 0.45,
      ty + Math.sin(a) * s * 0.2 + s * 0.12,
    );
    c.lineWidth = s * 0.035;
    c.stroke();
  }
}

/* ---------------------------------------------------------------- 场景 */

export const SCENES = {
  tokyoNight(c, w, h, r) {
    sky(c, w, h, [
      [0, "#1b1a47"],
      [0.5, "#5b347a"],
      [0.78, "#dd7560"],
      [1, "#f4b67c"],
    ]);
    stars(c, w, h * 0.35, 50, r, 0.8);
    const base = h * 0.8;
    // 远景楼群
    for (let x = -10; x < w; ) {
      const bw = w * (0.04 + r() * 0.07);
      const bh = h * (0.12 + r() * 0.3);
      c.fillStyle = "#3a2b55";
      c.fillRect(x, base - bh, bw, bh);
      x += bw + 2;
    }
    // 东京塔
    const tx = w * 0.62,
      top = h * 0.14,
      bw = w * 0.16;
    c.fillStyle = lin(c, 0, top, 0, base, [
      [0, "#ffe4d0"],
      [0.08, "#ff6a4a"],
      [1, "#b52e22"],
    ]);
    c.beginPath();
    c.moveTo(tx - 2, top);
    c.lineTo(tx + 2, top);
    c.quadraticCurveTo(tx + bw * 0.15, base - h * 0.25, tx + bw, base);
    c.lineTo(tx - bw, base);
    c.quadraticCurveTo(tx - bw * 0.15, base - h * 0.25, tx - 2, top);
    c.fill();
    c.strokeStyle = "rgba(60,10,10,.45)";
    c.lineWidth = 1.2;
    for (let i = 1; i < 14; i++) {
      const y = top + ((base - top) * i) / 14;
      const half = bw * ((y - top) / (base - top)) ** 2.2 + 3;
      c.beginPath();
      c.moveTo(tx - half, y);
      c.lineTo(tx + half, y + (base - top) / 14);
      c.moveTo(tx + half, y);
      c.lineTo(tx - half, y + (base - top) / 14);
      c.stroke();
    }
    c.fillStyle = "#fff4e0";
    c.fillRect(tx - bw * 0.2, base - h * 0.3, bw * 0.4, h * 0.022);
    c.fillRect(tx - bw * 0.1, top + h * 0.2, bw * 0.2, h * 0.015);
    glow(c, tx, top + h * 0.2, w * 0.2, "rgba(255,140,90,.5)");
    // 近景楼群 + 亮着的窗
    for (let x = -5; x < w; ) {
      const bw2 = w * (0.07 + r() * 0.1);
      const bh = h * (0.08 + r() * 0.22);
      c.fillStyle = "#171230";
      c.fillRect(x, base - bh, bw2, bh + 2);
      for (let wy = base - bh + 8; wy < base - 6; wy += 11)
        for (let wx = x + 5; wx < x + bw2 - 6; wx += 9)
          if (r() < 0.35) {
            c.fillStyle = r() < 0.8 ? "#ffd47a" : "#8fd8ff";
            c.fillRect(wx, wy, 4, 5);
          }
      x += bw2 + 1;
    }
    // 河面倒影
    c.fillStyle = lin(c, 0, base, 0, h, [
      [0, "#241b3d"],
      [1, "#0e0b1d"],
    ]);
    c.fillRect(0, base, w, h - base);
    shimmer(c, 0, w, base + 3, h, r, "#ffc27a", 90);
    shimmer(c, tx - bw * 0.5, tx + bw * 0.5, base + 3, h, r, "#ff6a4a", 40);
  },

  fuji(c, w, h, r) {
    sky(c, w, h, [
      [0, "#6fa8dc"],
      [0.55, "#cfe5f4"],
      [1, "#f8e8e0"],
    ]);
    glow(c, w * 0.8, h * 0.18, w * 0.3, "rgba(255,250,230,.8)");
    cloud(c, w * 0.2, h * 0.2, w * 0.12, "rgba(255,255,255,.7)");
    const drawFuji = () => {
      c.beginPath();
      c.moveTo(-w * 0.15, h * 0.64);
      c.quadraticCurveTo(w * 0.3, h * 0.45, w * 0.45, h * 0.21);
      c.lineTo(w * 0.55, h * 0.21);
      c.quadraticCurveTo(w * 0.7, h * 0.45, w * 1.15, h * 0.64);
      c.closePath();
    };
    c.fillStyle = lin(c, 0, h * 0.2, 0, h * 0.64, [
      [0, "#4d6c9b"],
      [1, "#93abcc"],
    ]);
    drawFuji();
    c.fill();
    // 雪顶
    c.save();
    drawFuji();
    c.clip();
    c.fillStyle = "#fbfdff";
    c.beginPath();
    c.moveTo(0, h * 0.2);
    c.lineTo(w, h * 0.2);
    c.lineTo(w, h * 0.33);
    const steps = 14;
    for (let i = steps; i >= 0; i--) {
      const x = (i / steps) * w;
      const y = h * (0.3 + 0.07 * Math.abs(Math.sin(i * 1.7)) + r() * 0.03);
      c.lineTo(x, y);
    }
    c.closePath();
    c.fill();
    c.restore();
    ridge(c, w, h, { y: h * 0.64, amp: h * 0.05, fill: "#2e4a3a", rand: r, detail: 7 });
    // 湖面 + 倒影
    const lake = h * 0.67;
    c.fillStyle = lin(c, 0, lake, 0, h, [
      [0, "#9cc2df"],
      [1, "#557fa6"],
    ]);
    c.fillRect(0, lake, w, h - lake);
    c.save();
    c.beginPath();
    c.rect(0, lake, w, h - lake);
    c.clip();
    c.globalAlpha = 0.28;
    c.translate(0, lake * 2 - h * 0.03);
    c.scale(1, -1);
    c.fillStyle = "#e9f1f8";
    drawFuji();
    c.fill();
    c.restore();
    shimmer(c, 0, w, lake + 4, h, r, "#ffffff", 70);
    // 樱花枝
    c.strokeStyle = "#4a3128";
    c.lineCap = "round";
    const branch = (x0, y0, x1, y1, lw) => {
      c.lineWidth = lw;
      c.beginPath();
      c.moveTo(x0, y0);
      c.quadraticCurveTo((x0 + x1) / 2, y0 + (y1 - y0) * 0.2, x1, y1);
      c.stroke();
    };
    branch(-10, h * 0.02, w * 0.42, h * 0.14, 9);
    branch(w * 0.18, h * 0.07, w * 0.3, h * 0.28, 5);
    branch(w * 0.32, h * 0.12, w * 0.55, h * 0.06, 4);
    for (let i = 0; i < 160; i++) {
      const t = r();
      const bx = t * w * 0.55 + (r() - 0.5) * w * 0.08;
      const by = h * (0.02 + t * 0.12) + (r() - 0.5) * h * 0.14;
      c.globalAlpha = 0.6 + r() * 0.4;
      disc(c, bx, by, 3 + r() * 6, r() < 0.5 ? "#f7b6c8" : "#fbd5df");
    }
    c.globalAlpha = 1;
  },

  torii(c, w, h, r) {
    sky(c, w, h, [
      [0, "#1f3a26"],
      [0.5, "#35523a"],
      [1, "#23301f"],
    ]);
    const vx = w * 0.52,
      vy = h * 0.42;
    glow(c, vx, vy, w * 0.35, "rgba(255,236,190,.9)");
    // 石板路
    c.fillStyle = lin(c, 0, vy, 0, h, [
      [0, "#a59a86"],
      [1, "#5d554a"],
    ]);
    c.beginPath();
    c.moveTo(vx - 6, vy);
    c.lineTo(vx + 6, vy);
    c.lineTo(w * 0.95, h);
    c.lineTo(w * 0.05, h);
    c.closePath();
    c.fill();
    const gate = (cx, ground, s, fog) => {
      const col = `rgb(${Math.round(226 * (1 - fog) + 240 * fog)},${Math.round(
        70 * (1 - fog) + 220 * fog,
      )},${Math.round(40 * (1 - fog) + 180 * fog)})`;
      const top = ground - s * 1.05;
      const pw = s * 0.075;
      c.fillStyle = col;
      c.fillRect(cx - s * 0.45 - pw / 2, top, pw, s * 1.05);
      c.fillRect(cx + s * 0.45 - pw / 2, top, pw, s * 1.05);
      c.fillRect(cx - s * 0.56, top + s * 0.2, s * 1.12, s * 0.06);
      c.beginPath();
      c.moveTo(cx - s * 0.66, top - s * 0.02);
      c.quadraticCurveTo(cx, top + s * 0.05, cx + s * 0.66, top - s * 0.02);
      c.lineTo(cx + s * 0.62, top + s * 0.08);
      c.quadraticCurveTo(cx, top + s * 0.13, cx - s * 0.62, top + s * 0.08);
      c.closePath();
      c.fill();
      c.fillStyle = fog > 0.5 ? "rgba(40,30,25,.5)" : "#1c1411";
      c.beginPath();
      c.moveTo(cx - s * 0.68, top - s * 0.03);
      c.quadraticCurveTo(cx, top + s * 0.03, cx + s * 0.68, top - s * 0.03);
      c.lineTo(cx + s * 0.68, top - s * 0.07);
      c.quadraticCurveTo(cx, top - s * 0.01, cx - s * 0.68, top - s * 0.07);
      c.closePath();
      c.fill();
      // 立柱底部黑色
      c.fillRect(cx - s * 0.45 - pw / 2, ground - s * 0.08, pw, s * 0.08);
      c.fillRect(cx + s * 0.45 - pw / 2, ground - s * 0.08, pw, s * 0.08);
    };
    for (let i = 16; i >= 0; i--) {
      const z = 1 + i * 0.42;
      const s = (w * 1.05) / z;
      const ground = vy + (h * 1.02 - vy) / z;
      gate(vx + (w * 0.02) / z, ground, s, Math.min(0.85, (1 - 1 / z) * 0.95));
    }
    // 光斑
    for (let i = 0; i < 20; i++)
      glow(c, r() * w, r() * h * 0.6, 6 + r() * 16, "rgba(255,240,200,.5)");
  },

  bamboo(c, w, h, r) {
    sky(c, w, h, [
      [0, "#eef6d8"],
      [0.5, "#b9d69a"],
      [1, "#5f8a4c"],
    ]);
    glow(c, w * 0.5, 0, w * 0.6, "rgba(255,255,230,.9)");
    const layers = [
      { n: 26, wMin: 0.012, wMax: 0.022, col: [150, 190, 120], a: 0.55 },
      { n: 16, wMin: 0.022, wMax: 0.04, col: [95, 150, 70], a: 0.85 },
      { n: 9, wMin: 0.045, wMax: 0.075, col: [60, 115, 50], a: 1 },
    ];
    for (const L of layers) {
      for (let i = 0; i < L.n; i++) {
        const bw = w * (L.wMin + r() * (L.wMax - L.wMin));
        const x = r() * w;
        const lean = (r() - 0.5) * w * 0.06;
        const [cr, cg, cb] = L.col.map((v) => v + (r() - 0.5) * 30);
        c.globalAlpha = L.a;
        c.fillStyle = lin(c, x, 0, x + bw, 0, [
          [0, `rgb(${cr * 0.8},${cg * 0.8},${cb * 0.8})`],
          [0.4, `rgb(${cr},${cg},${cb})`],
          [1, `rgb(${cr * 0.7},${cg * 0.7},${cb * 0.7})`],
        ]);
        c.beginPath();
        c.moveTo(x + lean, -5);
        c.lineTo(x + lean + bw, -5);
        c.lineTo(x + bw, h + 5);
        c.lineTo(x, h + 5);
        c.fill();
        c.fillStyle = `rgba(30,50,20,.45)`;
        for (let y = r() * h * 0.15; y < h; y += h * (0.12 + r() * 0.06)) {
          const k = 1 - y / h;
          c.fillRect(x + lean * k - 1, y, bw + 2, Math.max(2, bw * 0.1));
        }
      }
    }
    c.globalAlpha = 1;
    // 叶子
    for (let i = 0; i < 90; i++) {
      c.save();
      c.translate(r() * w, r() * h * 0.35);
      c.rotate(r() * Math.PI);
      c.fillStyle = r() < 0.5 ? "rgba(70,120,50,.8)" : "rgba(120,170,80,.7)";
      c.beginPath();
      c.ellipse(0, 0, 14 + r() * 10, 3 + r() * 2, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
    c.fillStyle = lin(c, 0, h * 0.86, 0, h, [
      [0, "rgba(200,185,150,0)"],
      [1, "rgba(200,185,150,.9)"],
    ]);
    c.fillRect(0, h * 0.86, w, h * 0.14);
  },

  reykjavik(c, w, h, r) {
    sky(c, w, h, [
      [0, "#86abd6"],
      [0.55, "#e6c7cf"],
      [1, "#f6dcc6"],
    ]);
    ridge(c, w, h, { y: h * 0.42, amp: h * 0.12, fill: "#b5c3d6", rand: r });
    ridge(c, w, h, { y: h * 0.47, amp: h * 0.03, fill: "#7b95b3", rand: r, detail: 5 });
    c.fillStyle = "#6283a5";
    c.fillRect(0, h * 0.5, w, h * 0.1);
    shimmer(c, 0, w, h * 0.5, h * 0.6, r, "#e8eef6", 40);
    // 哈尔格林姆斯教堂
    const cx = w * 0.7,
      base = h * 0.7;
    c.fillStyle = "#dad6cc";
    c.beginPath();
    c.moveTo(cx - 5, h * 0.11);
    c.lineTo(cx + 5, h * 0.11);
    c.lineTo(cx + w * 0.03, h * 0.3);
    c.lineTo(cx + w * 0.03, base);
    c.lineTo(cx - w * 0.03, base);
    c.lineTo(cx - w * 0.03, h * 0.3);
    c.fill();
    for (let i = 1; i <= 5; i++) {
      const x = w * 0.03 + i * w * 0.018;
      const top = h * (0.3 + i * 0.065);
      c.fillStyle = i % 2 ? "#cfcac0" : "#e2ded5";
      c.fillRect(cx - x - w * 0.018, top, w * 0.018, base - top);
      c.fillRect(cx + x, top, w * 0.018, base - top);
    }
    c.fillStyle = "#6f7c86";
    c.fillRect(cx - 4, h * 0.2, 8, 10);
    // 彩色房子
    const colors = ["#e4574a", "#f2c14e", "#3f8bc2", "#6bbf8a", "#f4efe4", "#2f4858", "#e98a5a"];
    const row = (y, sMin, sMax) => {
      for (let x = -10; x < w; ) {
        const hw = w * (sMin + r() * (sMax - sMin));
        const hh = hw * (0.7 + r() * 0.4);
        const col = colors[Math.floor(r() * colors.length)];
        c.fillStyle = col;
        c.fillRect(x, y - hh, hw, hh + h);
        c.fillStyle = r() < 0.5 ? "#3b3b3f" : "#8a2e2a";
        c.beginPath();
        c.moveTo(x - 3, y - hh);
        c.lineTo(x + hw / 2, y - hh - hw * 0.45);
        c.lineTo(x + hw + 3, y - hh);
        c.fill();
        c.fillStyle = "rgba(255,255,255,.9)";
        const ww = hw * 0.16;
        for (let k = 0; k < 2; k++)
          c.fillRect(x + hw * (0.22 + k * 0.42), y - hh * 0.72, ww, ww * 1.3);
        c.fillStyle = "rgba(255,210,120,.9)";
        c.fillRect(x + hw * 0.43, y - hh * 0.3, ww, ww * 1.4);
        x += hw + 2;
      }
    };
    row(h * 0.8, 0.09, 0.13);
    row(h * 0.97, 0.15, 0.2);
    c.fillStyle = lin(c, 0, h * 0.94, 0, h, [
      [0, "#f5f7fb"],
      [1, "#d6e0ec"],
    ]);
    c.fillRect(0, h * 0.94, w, h * 0.06);
  },

  waterfall(c, w, h, r) {
    sky(c, w, h, [
      [0, "#9aa6ad"],
      [1, "#d9dcd6"],
    ]);
    // 悬崖
    c.fillStyle = lin(c, 0, h * 0.15, 0, h * 0.85, [
      [0, "#4b5a3a"],
      [0.08, "#3a3a32"],
      [1, "#23231f"],
    ]);
    c.beginPath();
    c.moveTo(-5, h * 0.3);
    c.quadraticCurveTo(w * 0.2, h * 0.16, w * 0.4, h * 0.19);
    c.lineTo(w * 1.05, h * 0.14);
    c.lineTo(w * 1.05, h * 0.85);
    c.lineTo(-5, h * 0.85);
    c.fill();
    c.fillStyle = "#6f8a45";
    c.beginPath();
    c.moveTo(-5, h * 0.3);
    c.quadraticCurveTo(w * 0.2, h * 0.16, w * 0.4, h * 0.19);
    c.lineTo(w * 1.05, h * 0.14);
    c.lineTo(w * 1.05, h * 0.18);
    c.lineTo(w * 0.4, h * 0.23);
    c.quadraticCurveTo(w * 0.2, h * 0.2, -5, h * 0.34);
    c.fill();
    // 岩石纹理
    c.strokeStyle = "rgba(0,0,0,.25)";
    for (let i = 0; i < 50; i++) {
      c.lineWidth = 1 + r() * 2;
      const x = r() * w,
        y = h * (0.25 + r() * 0.55);
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + (r() - 0.5) * 20, y + 20 + r() * 50);
      c.stroke();
    }
    // 瀑布
    const x0 = w * 0.44,
      x1 = w * 0.58;
    c.fillStyle = lin(c, x0, 0, x1, 0, [
      [0, "rgba(230,240,245,.75)"],
      [0.5, "rgba(255,255,255,.98)"],
      [1, "rgba(220,232,238,.8)"],
    ]);
    c.beginPath();
    c.moveTo(x0, h * 0.19);
    c.lineTo(x1, h * 0.185);
    c.lineTo(x1 + w * 0.03, h * 0.82);
    c.lineTo(x0 - w * 0.03, h * 0.82);
    c.fill();
    c.strokeStyle = "rgba(160,180,190,.4)";
    c.lineWidth = 1.5;
    for (let i = 0; i < 26; i++) {
      const x = x0 + r() * (x1 - x0);
      c.beginPath();
      c.moveTo(x, h * 0.2);
      c.lineTo(x + (x - (x0 + x1) / 2) * 0.2, h * 0.82);
      c.stroke();
    }
    for (let i = 0; i < 8; i++)
      glow(c, w * (0.35 + r() * 0.35), h * (0.78 + r() * 0.08), w * (0.12 + r() * 0.1), "rgba(255,255,255,.8)");
    // 彩虹
    c.lineWidth = w * 0.012;
    ["#ff6b6b", "#ffb86b", "#fff06b", "#7be07b", "#6bb8ff", "#b58cff"].forEach((col, i) => {
      c.strokeStyle = col;
      c.globalAlpha = 0.22;
      c.beginPath();
      c.arc(w * 0.62, h * 0.95, w * 0.34 - i * w * 0.012, Math.PI * 1.1, Math.PI * 1.6);
      c.stroke();
    });
    c.globalAlpha = 1;
    // 地面 + 小人
    c.fillStyle = lin(c, 0, h * 0.84, 0, h, [
      [0, "#5f6358"],
      [1, "#3a3c36"],
    ]);
    c.fillRect(0, h * 0.84, w, h * 0.16);
    c.fillStyle = "#1d1d1d";
    c.fillRect(w * 0.3, h * 0.855, 3, 12);
    disc(c, w * 0.3 + 1.5, h * 0.85, 3, "#1d1d1d");
    c.fillStyle = "#e8612c";
    c.fillRect(w * 0.3 - 1, h * 0.857, 5, 7);
  },

  blackBeach(c, w, h, r) {
    sky(c, w, h, [
      [0, "#727d88"],
      [0.6, "#b8bfc4"],
      [1, "#d8dcdd"],
    ]);
    for (let i = 0; i < 6; i++)
      cloud(c, r() * w, h * (0.05 + r() * 0.25), w * (0.1 + r() * 0.15), "rgba(90,98,108,.35)");
    // 海蚀柱
    const stack = (x, bw, top) => {
      c.beginPath();
      c.moveTo(x - bw, h * 0.56);
      c.lineTo(x - bw * 0.35, top + 10);
      c.lineTo(x, top);
      c.lineTo(x + bw * 0.4, top + 25);
      c.lineTo(x + bw, h * 0.56);
      c.fill();
    };
    c.fillStyle = "rgba(55,60,66,.7)";
    stack(w * 0.62, w * 0.05, h * 0.3);
    c.fillStyle = "#2a2e33";
    stack(w * 0.76, w * 0.07, h * 0.2);
    stack(w * 0.88, w * 0.05, h * 0.33);
    // 海岬
    c.fillStyle = "#24282b";
    c.beginPath();
    c.moveTo(-5, h * 0.2);
    c.lineTo(w * 0.12, h * 0.24);
    c.lineTo(w * 0.28, h * 0.42);
    c.lineTo(w * 0.36, h * 0.58);
    c.lineTo(-5, h * 0.62);
    c.fill();
    // 海 + 浪
    c.fillStyle = lin(c, 0, h * 0.55, 0, h * 0.72, [
      [0, "#5b6d7a"],
      [1, "#8a9aa3"],
    ]);
    c.fillRect(0, h * 0.55, w, h * 0.17);
    for (let k = 0; k < 5; k++) {
      const y = h * (0.6 + k * 0.03);
      c.strokeStyle = `rgba(255,255,255,${0.35 + k * 0.12})`;
      c.lineWidth = 2 + k * 1.5;
      c.beginPath();
      for (let x = 0; x <= w; x += 8)
        c.lineTo(x, y + Math.sin(x * 0.02 + k * 2 + r()) * 3);
      c.stroke();
    }
    // 黑沙
    c.fillStyle = lin(c, 0, h * 0.72, 0, h, [
      [0, "#3d3f42"],
      [0.25, "#1d1e20"],
      [1, "#0f1011"],
    ]);
    c.beginPath();
    c.moveTo(0, h * 0.73);
    for (let x = 0; x <= w; x += 10) c.lineTo(x, h * 0.73 + Math.sin(x * 0.015) * 5);
    c.lineTo(w, h);
    c.lineTo(0, h);
    c.fill();
    c.fillStyle = "rgba(200,210,215,.12)";
    c.fillRect(0, h * 0.75, w, h * 0.05);
    // 穿橙色冲锋衣的人
    const px = w * 0.34,
      py = h * 0.86;
    c.fillStyle = "#111";
    c.fillRect(px - 2, py, 2, 12);
    c.fillRect(px + 2, py, 2, 12);
    c.fillStyle = "#f07a2a";
    c.fillRect(px - 4, py - 13, 10, 14);
    disc(c, px + 1, py - 17, 4, "#1a1a1a");
  },

  glacier(c, w, h, r) {
    sky(c, w, h, [
      [0, "#a9c4dc"],
      [0.6, "#e3e8f2"],
      [1, "#f4eef0"],
    ]);
    ridge(c, w, h, { y: h * 0.3, amp: h * 0.14, fill: "#7d8fa6", rand: r });
    ridge(c, w, h, { y: h * 0.42, amp: h * 0.05, fill: "#e8f1f8", rand: r, detail: 6 });
    c.fillStyle = "rgba(120,140,160,.35)";
    for (let i = 0; i < 12; i++) c.fillRect(0, h * (0.43 + i * 0.008), w, 1.5);
    // 湖
    c.fillStyle = lin(c, 0, h * 0.5, 0, h, [
      [0, "#3f7f9c"],
      [1, "#123a52"],
    ]);
    c.fillRect(0, h * 0.5, w, h * 0.5);
    shimmer(c, 0, w, h * 0.5, h, r, "#bfe3f2", 60);
    const berg = (x, y, s, blue) => {
      const pts = [];
      const n = 6 + Math.floor(r() * 3);
      for (let i = 0; i <= n; i++) pts.push([x - s + (2 * s * i) / n, y - s * (0.2 + r() * 0.5) * Math.sin((i / n) * Math.PI)]);
      c.fillStyle = blue ? "#7fd6ef" : "#f4fbff";
      c.beginPath();
      c.moveTo(x - s, y);
      pts.forEach(([px, py]) => c.lineTo(px, py));
      c.lineTo(x + s, y);
      c.fill();
      c.fillStyle = blue ? "rgba(20,110,160,.45)" : "rgba(90,150,190,.35)";
      c.beginPath();
      c.moveTo(x, y);
      pts.slice(Math.floor(n / 2)).forEach(([px, py]) => c.lineTo(px, py));
      c.lineTo(x + s, y);
      c.fill();
      // 倒影
      c.globalAlpha = 0.25;
      c.fillStyle = blue ? "#7fd6ef" : "#e8f6ff";
      c.beginPath();
      c.moveTo(x - s, y);
      pts.forEach(([px, py]) => c.lineTo(px, y + (y - py) * 0.6));
      c.lineTo(x + s, y);
      c.fill();
      c.globalAlpha = 1;
    };
    berg(w * 0.2, h * 0.6, w * 0.08, false);
    berg(w * 0.7, h * 0.58, w * 0.06, false);
    berg(w * 0.5, h * 0.72, w * 0.14, true);
    berg(w * 0.88, h * 0.8, w * 0.1, false);
    berg(w * 0.12, h * 0.86, w * 0.09, true);
  },

  aurora(c, w, h, r) {
    sky(c, w, h, [
      [0, "#030b17"],
      [0.6, "#0a2233"],
      [1, "#123447"],
    ]);
    stars(c, w, h * 0.7, 140, r);
    c.save();
    c.globalCompositeOperation = "lighter";
    const ribbons = [
      { y: 0.34, a: 0.09, f: 0.011, len: 0.3, col: "94,255,170", al: 0.35 },
      { y: 0.26, a: 0.06, f: 0.017, len: 0.22, col: "120,255,200", al: 0.25 },
      { y: 0.42, a: 0.05, f: 0.008, len: 0.35, col: "180,110,255", al: 0.12 },
    ];
    for (const rb of ribbons) {
      const ph = r() * 10;
      const len = h * rb.len;
      const g = c.createLinearGradient(0, 0, 0, len);
      g.addColorStop(0, `rgba(${rb.col},0)`);
      g.addColorStop(0.85, `rgba(${rb.col},${rb.al})`);
      g.addColorStop(1, `rgba(${rb.col},0)`);
      c.fillStyle = g;
      for (let x = 0; x < w; x += 2) {
        const yc = h * (rb.y + rb.a * Math.sin(x * rb.f + ph) + 0.02 * Math.sin(x * 0.05 + ph * 2));
        const k = 0.6 + 0.4 * Math.sin(x * 0.03 + ph);
        c.save();
        c.translate(x, yc - len * k);
        c.scale(1, k);
        c.fillRect(0, 0, 2.5, len);
        c.restore();
      }
    }
    c.restore();
    ridge(c, w, h, { y: h * 0.62, amp: h * 0.16, fill: "#050b10", rand: r });
    const lake = h * 0.72;
    c.fillStyle = lin(c, 0, lake, 0, h, [
      [0, "#0e2a33"],
      [1, "#04090d"],
    ]);
    c.fillRect(0, lake, w, h - lake);
    glow(c, w * 0.5, lake + h * 0.05, w * 0.5, "rgba(80,255,170,.18)");
    shimmer(c, 0, w, lake + 3, h, r, "#7dffc0", 50);
    // 发光的小帐篷
    const tx = w * 0.26,
      ty = lake - 2;
    glow(c, tx, ty - 10, 50, "rgba(255,170,80,.6)");
    c.fillStyle = "#ffb45e";
    c.beginPath();
    c.moveTo(tx - 16, ty);
    c.lineTo(tx, ty - 22);
    c.lineTo(tx + 16, ty);
    c.fill();
  },

  marrakech(c, w, h, r) {
    sky(c, w, h, [
      [0, "#e9b77a"],
      [0.6, "#f5d49a"],
      [1, "#f0c186"],
    ]);
    glow(c, w * 0.75, h * 0.25, w * 0.35, "rgba(255,240,200,.8)");
    ridge(c, w, h, { y: h * 0.5, amp: h * 0.1, fill: "rgba(190,150,140,.55)", rand: r });
    // 库图比亚清真寺宣礼塔
    const mx = w * 0.3,
      mw = w * 0.11,
      mt = h * 0.16;
    c.fillStyle = lin(c, mx - mw / 2, 0, mx + mw / 2, 0, [
      [0, "#b76a45"],
      [1, "#d88a5c"],
    ]);
    c.fillRect(mx - mw / 2, mt, mw, h);
    c.fillStyle = "#c97a50";
    c.fillRect(mx - mw * 0.22, mt - h * 0.07, mw * 0.44, h * 0.07);
    disc(c, mx, mt - h * 0.085, 4, "#f2c04a");
    disc(c, mx, mt - h * 0.1, 3, "#f2c04a");
    c.fillStyle = "rgba(70,30,20,.5)";
    for (let k = 0; k < 4; k++) {
      const y = mt + h * (0.06 + k * 0.13);
      c.beginPath();
      c.moveTo(mx - mw * 0.18, y + h * 0.07);
      c.lineTo(mx - mw * 0.18, y + h * 0.02);
      c.arc(mx, y + h * 0.02, mw * 0.18, Math.PI, 0);
      c.lineTo(mx + mw * 0.18, y + h * 0.07);
      c.fill();
    }
    c.fillStyle = "#3f8a6d";
    c.fillRect(mx - mw / 2, mt + h * 0.015, mw, h * 0.012);
    // 城墙 + 拱门
    const wallTop = h * 0.62;
    c.fillStyle = lin(c, 0, wallTop, 0, h, [
      [0, "#c96f45"],
      [1, "#9c4f30"],
    ]);
    c.fillRect(0, wallTop, w, h - wallTop);
    c.fillStyle = "#b35d3a";
    for (let x = 0; x < w; x += w * 0.06) c.fillRect(x, wallTop - h * 0.03, w * 0.035, h * 0.03);
    const arch = (x, aw, top) => {
      c.fillStyle = "#3b1d12";
      c.beginPath();
      c.moveTo(x - aw / 2, h);
      c.lineTo(x - aw / 2, top + aw * 0.5);
      c.arc(x, top + aw * 0.5, aw / 2, Math.PI, 0);
      c.lineTo(x + aw / 2, h);
      c.fill();
      c.strokeStyle = "#e7b77f";
      c.lineWidth = 4;
      c.stroke();
    };
    arch(w * 0.62, w * 0.2, h * 0.7);
    arch(w * 0.88, w * 0.12, h * 0.78);
    arch(w * 0.12, w * 0.12, h * 0.78);
    palm(c, w * 0.42, h * 0.66, h * 0.32, "#2f4a2b");
    palm(c, w * 0.95, h * 0.64, h * 0.26, "#3a5633");
    // 灯笼
    glow(c, w * 0.62, h * 0.82, 40, "rgba(255,200,90,.9)");
  },

  sahara(c, w, h, r) {
    sky(c, w, h, [
      [0, "#3c3a6b"],
      [0.35, "#b95f7c"],
      [0.6, "#f2a262"],
      [0.78, "#f8d79d"],
    ]);
    stars(c, w, h * 0.2, 30, r, 0.6);
    glow(c, w * 0.62, h * 0.55, w * 0.45, "rgba(255,210,140,.8)");
    disc(c, w * 0.62, h * 0.55, w * 0.09, "#ffe2a8");
    const dune = (y, amp, f, ph, a, b) => {
      c.fillStyle = lin(c, 0, y - amp, 0, h, [
        [0, a],
        [1, b],
      ]);
      c.beginPath();
      c.moveTo(0, h);
      for (let x = 0; x <= w; x += 6) c.lineTo(x, y + Math.sin(x * f + ph) * amp + Math.sin(x * f * 2.3 + ph) * amp * 0.3);
      c.lineTo(w, h);
      c.fill();
    };
    dune(h * 0.6, h * 0.04, 0.008, r() * 6, "#e7a07a", "#c47a5e");
    dune(h * 0.68, h * 0.06, 0.006, r() * 6, "#e98b52", "#b85a36");
    // 驼队
    const camel = (x, y, s) => {
      c.fillStyle = "#2a1a22";
      c.beginPath();
      c.ellipse(x, y, s * 0.5, s * 0.22, 0, 0, Math.PI * 2);
      c.ellipse(x - s * 0.05, y - s * 0.2, s * 0.22, s * 0.18, 0, 0, Math.PI * 2);
      c.fill();
      c.lineWidth = s * 0.08;
      c.strokeStyle = "#2a1a22";
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(x + s * 0.4, y - s * 0.05);
      c.quadraticCurveTo(x + s * 0.65, y - s * 0.1, x + s * 0.68, y - s * 0.45);
      c.lineTo(x + s * 0.85, y - s * 0.42);
      c.stroke();
      c.lineWidth = s * 0.06;
      for (const lx of [-0.35, -0.2, 0.2, 0.35]) {
        c.beginPath();
        c.moveTo(x + s * lx, y + s * 0.1);
        c.lineTo(x + s * lx, y + s * 0.62);
        c.stroke();
      }
      c.fillRect(x - s * 0.08, y - s * 0.62, s * 0.12, s * 0.3);
      disc(c, x - s * 0.02, y - s * 0.68, s * 0.08, "#2a1a22");
    };
    camel(w * 0.3, h * 0.62, w * 0.07);
    camel(w * 0.42, h * 0.635, w * 0.065);
    camel(w * 0.53, h * 0.645, w * 0.06);
    dune(h * 0.78, h * 0.07, 0.005, r() * 6, "#d9743d", "#8f3e22");
    // 沙丘阴影面
    c.fillStyle = "rgba(90,30,40,.25)";
    c.beginPath();
    c.moveTo(w * 0.55, h);
    c.quadraticCurveTo(w * 0.72, h * 0.8, w * 0.9, h * 0.78);
    c.lineTo(w, h * 0.82);
    c.lineTo(w, h);
    c.fill();
  },

  chefchaouen(c, w, h, r) {
    c.fillStyle = "#4f86c6";
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) {
      c.fillStyle = ["#6fa3dc", "#3f73b5", "#5b92d1", "#88b6e6"][Math.floor(r() * 4)];
      c.globalAlpha = 0.4;
      c.fillRect(r() * w, r() * h, w * (0.05 + r() * 0.2), h * (0.03 + r() * 0.1));
    }
    c.globalAlpha = 1;
    // 门
    const dx = w * 0.58,
      dw = w * 0.26,
      dt = h * 0.2,
      db = h * 0.72;
    c.fillStyle = "#9cc3ec";
    c.beginPath();
    c.moveTo(dx - dw / 2 - 14, db);
    c.lineTo(dx - dw / 2 - 14, dt + dw / 2);
    c.arc(dx, dt + dw / 2, dw / 2 + 14, Math.PI, 0);
    c.lineTo(dx + dw / 2 + 14, db);
    c.fill();
    c.fillStyle = lin(c, dx - dw / 2, 0, dx + dw / 2, 0, [
      [0, "#1c3a78"],
      [1, "#2b56a3"],
    ]);
    c.beginPath();
    c.moveTo(dx - dw / 2, db);
    c.lineTo(dx - dw / 2, dt + dw / 2);
    c.arc(dx, dt + dw / 2, dw / 2, Math.PI, 0);
    c.lineTo(dx + dw / 2, db);
    c.fill();
    for (let y = dt + dw * 0.4; y < db - 10; y += 22)
      for (let x = dx - dw / 2 + 14; x < dx + dw / 2 - 8; x += 22) disc(c, x, y, 2.5, "#c9d6ea");
    disc(c, dx + dw * 0.3, (dt + db) / 2 + 20, 5, "#e0b75a");
    // 花盆
    const pot = (x, y) => {
      c.fillStyle = "#c8643c";
      c.beginPath();
      c.moveTo(x - 16, y);
      c.lineTo(x + 16, y);
      c.lineTo(x + 11, y + 26);
      c.lineTo(x - 11, y + 26);
      c.fill();
      for (let i = 0; i < 12; i++) disc(c, x + (r() - 0.5) * 38, y - r() * 26, 4 + r() * 4, r() < 0.7 ? "#3f8f4f" : "#f06a9a");
    };
    pot(w * 0.14, h * 0.3);
    pot(w * 0.24, h * 0.44);
    pot(w * 0.9, h * 0.34);
    // 台阶
    for (let k = 0; k < 6; k++) {
      const y = h * 0.72 + k * h * 0.047;
      c.fillStyle = k % 2 ? "#7fb0e4" : "#a8cdf2";
      c.fillRect(0, y, w, h * 0.047);
      c.fillStyle = "rgba(255,255,255,.6)";
      c.fillRect(0, y, w, 3);
    }
    // 睡觉的猫
    const cx = w * 0.26,
      cy = h * 0.71;
    c.fillStyle = "#e8913a";
    c.beginPath();
    c.ellipse(cx, cy, 34, 16, 0, 0, Math.PI * 2);
    c.fill();
    disc(c, cx + 28, cy - 6, 13, "#e8913a");
    c.beginPath();
    c.moveTo(cx + 20, cy - 14);
    c.lineTo(cx + 22, cy - 28);
    c.lineTo(cx + 30, cy - 17);
    c.moveTo(cx + 30, cy - 17);
    c.lineTo(cx + 38, cy - 26);
    c.lineTo(cx + 40, cy - 12);
    c.fill();
    c.strokeStyle = "#e8913a";
    c.lineWidth = 7;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(cx - 30, cy + 4);
    c.quadraticCurveTo(cx - 50, cy + 16, cx - 20, cy + 18);
    c.stroke();
    c.strokeStyle = "#b3652a";
    c.lineWidth = 2;
    for (let i = -2; i <= 2; i++) {
      c.beginPath();
      c.moveTo(cx + i * 10, cy - 14);
      c.lineTo(cx + i * 10 + 4, cy - 4);
      c.stroke();
    }
    // 斜射的阳光
    c.fillStyle = "rgba(255,245,220,.16)";
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(w * 0.45, 0);
    c.lineTo(w, h * 0.55);
    c.lineTo(w, h);
    c.fill();
  },

  terraces(c, w, h, r) {
    sky(c, w, h, [
      [0, "#f3c4a6"],
      [0.5, "#f9dfb5"],
      [1, "#f7e6c8"],
    ]);
    glow(c, w * 0.3, h * 0.16, w * 0.3, "rgba(255,240,200,.9)");
    ridge(c, w, h, { y: h * 0.22, amp: h * 0.1, fill: "rgba(150,140,160,.6)", rand: r });
    const refl = ["#f7c59f", "#a9cde0", "#f1b1a9", "#fbe0b0", "#8fbcd4", "#7aa55a"];
    let prev = null;
    for (let k = 0; k < 18; k++) {
      const base = h * (0.3 + k * 0.042 + k * k * 0.0008);
      const amp = h * (0.02 + k * 0.004);
      const ph = r() * 6;
      const f = 0.006 + r() * 0.004;
      const ys = [];
      for (let x = 0; x <= w + 8; x += 8) ys.push(base + Math.sin(x * f + ph) * amp + Math.sin(x * f * 3 + ph) * amp * 0.25);
      if (prev) {
        c.fillStyle = refl[Math.floor(r() * refl.length)];
        c.beginPath();
        prev.forEach((y, i) => c.lineTo(i * 8, y));
        for (let i = ys.length - 1; i >= 0; i--) c.lineTo(i * 8, ys[i]);
        c.fill();
      }
      c.strokeStyle = "#4d5e3a";
      c.lineWidth = 2 + k * 0.35;
      c.beginPath();
      ys.forEach((y, i) => c.lineTo(i * 8, y));
      c.stroke();
      prev = ys;
    }
    c.fillStyle = "#4d5e3a";
    c.beginPath();
    prev.forEach((y, i) => c.lineTo(i * 8, y));
    c.lineTo(w, h);
    c.lineTo(0, h);
    c.fill();
    for (let i = 0; i < 6; i++) glow(c, r() * w, h * (0.3 + r() * 0.3), w * 0.25, "rgba(255,255,255,.5)");
  },

  erhai(c, w, h, r) {
    sky(c, w, h, [
      [0, "#5ea3e0"],
      [0.6, "#bfe0f5"],
      [1, "#e8f4fa"],
    ]);
    for (let i = 0; i < 5; i++) cloud(c, r() * w, h * (0.08 + r() * 0.18), w * (0.08 + r() * 0.1));
    ridge(c, w, h, { y: h * 0.38, amp: h * 0.14, fill: "#6f8fa3", rand: r });
    for (let i = 0; i < 5; i++) cloud(c, r() * w, h * 0.4, w * 0.12, "rgba(255,255,255,.55)");
    ridge(c, w, h, { y: h * 0.47, amp: h * 0.03, fill: "#557a6a", rand: r, detail: 5 });
    const lake = h * 0.5;
    c.fillStyle = lin(c, 0, lake, 0, h, [
      [0, "#7ec9d6"],
      [1, "#2a8aa6"],
    ]);
    c.fillRect(0, lake, w, h - lake);
    shimmer(c, 0, w, lake + 3, h, r, "#ffffff", 90);
    // 水中的树
    const tx = w * 0.64,
      ty = h * 0.72;
    const tree = (flip) => {
      const s = flip ? -1 : 1;
      c.fillStyle = "#2d2a22";
      c.fillRect(tx - 3, ty - (flip ? 0 : h * 0.2), 6, h * 0.2);
      for (let i = 0; i < 22; i++) {
        const ang = r() * Math.PI;
        const d = r() * w * 0.09;
        disc(c, tx + Math.cos(ang) * d, ty - s * (h * 0.24 + Math.sin(ang) * d * 0.7), w * (0.025 + r() * 0.03), i % 3 ? "#2f5a34" : "#467a45");
      }
    };
    c.globalAlpha = 0.28;
    tree(true);
    c.globalAlpha = 1;
    tree(false);
    // 岸边石头
    c.fillStyle = "#6a6a5e";
    for (let i = 0; i < 6; i++) {
      c.beginPath();
      c.ellipse(w * (0.05 + i * 0.07), h * (0.94 + r() * 0.04), 26 + r() * 20, 12 + r() * 6, 0, 0, Math.PI * 2);
      c.fill();
    }
  },

  lijiang(c, w, h, r) {
    sky(c, w, h, [
      [0, "#9ccbe8"],
      [1, "#eef5ef"],
    ]);
    // 远处雪山
    c.fillStyle = "rgba(240,246,250,.95)";
    c.beginPath();
    c.moveTo(w * 0.35, h * 0.35);
    c.lineTo(w * 0.62, h * 0.08);
    c.lineTo(w * 0.7, h * 0.14);
    c.lineTo(w * 0.78, h * 0.1);
    c.lineTo(w * 1.05, h * 0.35);
    c.fill();
    ridge(c, w, h, { y: h * 0.32, amp: h * 0.06, fill: "#7f9b8d", rand: r, detail: 6 });
    const roofRow = (y, sMin, sMax, tone) => {
      for (let x = -w * 0.1; x < w * 1.1; ) {
        const rw = w * (sMin + r() * (sMax - sMin));
        const rh = rw * 0.35;
        // 墙
        c.fillStyle = tone.wall;
        c.fillRect(x + rw * 0.1, y, rw * 0.8, rh * 1.2);
        c.fillStyle = tone.wood;
        for (let k = 0; k < 3; k++) c.fillRect(x + rw * (0.2 + k * 0.25), y + rh * 0.25, rw * 0.12, rh * 0.8);
        // 飞檐屋顶
        c.fillStyle = tone.roof;
        c.beginPath();
        c.moveTo(x - rw * 0.04, y - rh * 0.1);
        c.quadraticCurveTo(x + rw * 0.1, y, x + rw * 0.2, y - rh * 0.6);
        c.lineTo(x + rw * 0.8, y - rh * 0.6);
        c.quadraticCurveTo(x + rw * 0.9, y, x + rw * 1.04, y - rh * 0.1);
        c.lineTo(x + rw * 1.0, y + rh * 0.05);
        c.lineTo(x, y + rh * 0.05);
        c.fill();
        c.strokeStyle = "rgba(255,255,255,.12)";
        c.lineWidth = 1;
        for (let k = 0.24; k < 0.8; k += 0.04) {
          c.beginPath();
          c.moveTo(x + rw * k, y - rh * 0.58);
          c.lineTo(x + rw * (k + (k - 0.5) * 0.25), y);
          c.stroke();
        }
        if (r() < 0.5) {
          glow(c, x + rw * 0.5, y + rh * 0.4, 18, "rgba(255,80,60,.9)");
          disc(c, x + rw * 0.5, y + rh * 0.4, 6, "#e53d2f");
        }
        x += rw * 0.92;
      }
    };
    roofRow(h * 0.42, 0.12, 0.18, { wall: "#c9b79b", wood: "#8a5a3c", roof: "#6a747a" });
    roofRow(h * 0.58, 0.2, 0.28, { wall: "#bea27f", wood: "#7a4a2e", roof: "#4b555c" });
    roofRow(h * 0.8, 0.34, 0.44, { wall: "#b08e68", wood: "#6a3e24", roof: "#343d44" });
    // 前景灯笼串
    c.strokeStyle = "#2a2020";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, h * 0.06);
    c.quadraticCurveTo(w * 0.5, h * 0.2, w, h * 0.04);
    c.stroke();
    for (let i = 1; i < 6; i++) {
      const t = i / 6;
      const x = t * w;
      const y = (1 - t) * (1 - t) * h * 0.06 + 2 * (1 - t) * t * h * 0.2 + t * t * h * 0.04;
      glow(c, x, y + 22, 30, "rgba(255,90,60,.6)");
      c.fillStyle = "#d8322a";
      c.beginPath();
      c.ellipse(x, y + 22, 13, 17, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#f2c04a";
      c.fillRect(x - 5, y + 4, 10, 4);
      c.fillRect(x - 1, y + 39, 2, 10);
    }
  },

  snowPeak(c, w, h, r) {
    sky(c, w, h, [
      [0, "#1a56a0"],
      [0.6, "#5f9ad8"],
      [1, "#b7d6ef"],
    ]);
    const peak = () => {
      c.beginPath();
      c.moveTo(-10, h * 0.7);
      c.lineTo(w * 0.12, h * 0.45);
      c.lineTo(w * 0.24, h * 0.5);
      c.lineTo(w * 0.36, h * 0.24);
      c.lineTo(w * 0.44, h * 0.3);
      c.lineTo(w * 0.52, h * 0.1);
      c.lineTo(w * 0.6, h * 0.22);
      c.lineTo(w * 0.7, h * 0.18);
      c.lineTo(w * 0.8, h * 0.38);
      c.lineTo(w * 0.92, h * 0.34);
      c.lineTo(w + 10, h * 0.5);
      c.lineTo(w + 10, h * 0.7);
      c.closePath();
    };
    c.fillStyle = lin(c, 0, h * 0.1, 0, h * 0.7, [
      [0, "#5d6674"],
      [1, "#394150"],
    ]);
    peak();
    c.fill();
    c.save();
    peak();
    c.clip();
    for (let i = 0; i < 70; i++) {
      const x = r() * w;
      const y = h * (0.08 + r() * 0.35);
      c.fillStyle = r() < 0.7 ? "rgba(250,252,255,.95)" : "rgba(200,215,230,.9)";
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + w * (0.02 + r() * 0.06), y + h * (0.08 + r() * 0.2));
      c.lineTo(x - w * (0.01 + r() * 0.03), y + h * (0.05 + r() * 0.12));
      c.fill();
    }
    c.fillStyle = "rgba(0,20,60,.18)";
    c.beginPath();
    c.moveTo(w * 0.52, h * 0.1);
    c.lineTo(w * 0.6, h * 0.22);
    c.lineTo(w * 0.7, h * 0.7);
    c.lineTo(w * 0.45, h * 0.7);
    c.fill();
    c.restore();
    for (let i = 0; i < 10; i++) glow(c, r() * w, h * (0.62 + r() * 0.1), w * (0.12 + r() * 0.12), "rgba(255,255,255,.85)");
    ridge(c, w, h, { y: h * 0.8, amp: h * 0.06, fill: "#6b7d4a", rand: r, detail: 6 });
    // 栈道
    c.strokeStyle = "#7a5230";
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(-10, h * 0.98);
    c.quadraticCurveTo(w * 0.4, h * 0.84, w * 0.8, h * 0.9);
    c.stroke();
    c.lineWidth = 2;
    for (let i = 0; i < 16; i++) {
      const t = i / 15;
      const x = (1 - t) * (1 - t) * -10 + 2 * (1 - t) * t * w * 0.4 + t * t * w * 0.8;
      const y = (1 - t) * (1 - t) * h * 0.98 + 2 * (1 - t) * t * h * 0.84 + t * t * h * 0.9;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x, y - 18);
      c.stroke();
    }
  },
};

/* ---------------------------------------------------------------- 故乡 · 求学路线 */

function kapok(c, x, y, s, r) {
  // 木棉：广州市花，枝干笔直横展，满树红花
  c.strokeStyle = "#5a4636";
  c.lineCap = "round";
  c.lineWidth = s * 0.06;
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x, y - s);
  c.stroke();
  for (let k = 0; k < 4; k++) {
    const by = y - s * (0.45 + k * 0.18);
    const len = s * (0.45 - k * 0.08);
    c.lineWidth = s * 0.025;
    c.beginPath();
    c.moveTo(x - len, by - s * 0.05);
    c.lineTo(x + len, by + s * 0.03);
    c.stroke();
    for (let i = 0; i < 14; i++) disc(c, x + (r() - 0.5) * len * 2, by + (r() - 0.6) * s * 0.12, s * (0.02 + r() * 0.025), r() < 0.8 ? "#e2372b" : "#f5783c");
  }
}

function flag(c, x, y, s, t) {
  c.fillStyle = "#cfd3d6";
  c.fillRect(x, y - s, s * 0.018, s);
  c.fillStyle = "#de2910";
  c.beginPath();
  c.moveTo(x + s * 0.018, y - s);
  for (let i = 0; i <= 10; i++) c.lineTo(x + s * 0.018 + (i / 10) * s * 0.3, y - s + Math.sin(i * 0.8 + t) * s * 0.012);
  for (let i = 10; i >= 0; i--) c.lineTo(x + s * 0.018 + (i / 10) * s * 0.3, y - s + s * 0.2 + Math.sin(i * 0.8 + t) * s * 0.012);
  c.fill();
  c.fillStyle = "#ffde00";
  disc(c, x + s * 0.07, y - s + s * 0.06, s * 0.02, "#ffde00");
}

function windowsGrid(c, x, y, w, h, cols, rows, col, r) {
  const gw = w / cols;
  const gh = h / rows;
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++) {
      c.fillStyle = typeof col === "function" ? col(r) : col;
      c.fillRect(x + i * gw + gw * 0.18, y + j * gh + gh * 0.22, gw * 0.64, gh * 0.5);
    }
}

Object.assign(SCENES, {
  cantonTower(c, w, h, r) {
    sky(c, w, h, [
      [0, "#2a2352"],
      [0.45, "#7a4a86"],
      [0.72, "#f08a6c"],
      [1, "#f8c48c"],
    ]);
    stars(c, w, h * 0.3, 30, r, 0.6);
    const river = h * 0.76;
    // 珠江新城天际线
    for (let x = -10; x < w; ) {
      const bw = w * (0.05 + r() * 0.07);
      const bh = h * (0.1 + r() * 0.28);
      c.fillStyle = "#2b2342";
      c.fillRect(x, river - bh, bw, bh);
      windowsGrid(c, x, river - bh, bw, bh, 3, Math.max(3, Math.round(bh / 14)), () => (r() < 0.35 ? "rgba(255,210,130,.85)" : "rgba(0,0,0,0)"), r);
      x += bw + 3;
    }
    // 西塔
    c.fillStyle = "#3a3358";
    c.beginPath();
    c.moveTo(w * 0.2, river);
    c.lineTo(w * 0.21, h * 0.2);
    c.lineTo(w * 0.24, h * 0.17);
    c.lineTo(w * 0.27, h * 0.2);
    c.lineTo(w * 0.28, river);
    c.fill();
    // 广州塔「小蛮腰」：上下宽、中间细的扭转网格
    const cx = w * 0.64;
    const top = h * 0.06;
    const half = (t) => w * (0.02 + 0.075 * (1 - t) ** 2.2 + 0.03 * t ** 3);
    c.save();
    c.beginPath();
    const N = 40;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      c.lineTo(cx + half(1 - t) * (1 - t * 0.0), river - (river - top) * (1 - t));
    }
    for (let i = N; i >= 0; i--) {
      const t = i / N;
      c.lineTo(cx - half(1 - t), river - (river - top) * (1 - t));
    }
    c.closePath();
    const g = lin(c, 0, top, 0, river, [
      [0, "#9be7ff"],
      [0.45, "#ff7bd0"],
      [1, "#ff9b5a"],
    ]);
    c.globalAlpha = 0.28;
    c.fillStyle = g;
    c.fill();
    c.clip();
    c.globalAlpha = 1;
    c.strokeStyle = g;
    c.lineWidth = 2.2;
    for (let k = -30; k < 30; k++) {
      c.beginPath();
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const y = river - (river - top) * t;
        const x = cx + half(t) * Math.sin(k * 0.35 + t * 2.6);
        c.lineTo(x, y);
      }
      c.stroke();
    }
    c.lineWidth = 1.4;
    for (let i = 0; i < 26; i++) {
      const t = i / 26;
      const y = river - (river - top) * t;
      c.beginPath();
      c.moveTo(cx - half(t), y);
      c.lineTo(cx + half(t), y);
      c.stroke();
    }
    c.restore();
    c.fillStyle = "#dff6ff";
    c.fillRect(cx - 2, top - h * 0.05, 4, h * 0.05);
    glow(c, cx, h * 0.45, w * 0.28, "rgba(255,120,200,.35)");
    // 珠江
    c.fillStyle = lin(c, 0, river, 0, h, [
      [0, "#3b2c52"],
      [1, "#120e22"],
    ]);
    c.fillRect(0, river, w, h - river);
    shimmer(c, 0, w, river + 3, h, r, "#ffc37a", 80);
    shimmer(c, cx - w * 0.08, cx + w * 0.08, river + 3, h, r, "#ff7bd0", 50);
    // 游船
    c.fillStyle = "#1a1428";
    c.fillRect(w * 0.1, river + h * 0.06, w * 0.22, h * 0.03);
    for (let i = 0; i < 8; i++) disc(c, w * (0.12 + i * 0.025), river + h * 0.07, 2.5, "#ffe09a");
  },

  schoolYard(c, w, h, r) {
    sky(c, w, h, [
      [0, "#7cbcf0"],
      [1, "#dff0fb"],
    ]);
    cloud(c, w * 0.25, h * 0.14, w * 0.1);
    cloud(c, w * 0.75, h * 0.1, w * 0.08);
    // 白瓷砖教学楼
    const bx = w * 0.08;
    const by = h * 0.26;
    const bw = w * 0.84;
    const bh = h * 0.36;
    c.fillStyle = "#f1efe8";
    c.fillRect(bx, by, bw, bh);
    c.fillStyle = "#d9d4c7";
    for (let i = 1; i < 4; i++) c.fillRect(bx, by + (bh * i) / 4 - 3, bw, 6);
    windowsGrid(c, bx, by, bw, bh, 10, 4, "#6b9ac4", r);
    c.fillStyle = "#c8453a";
    c.fillRect(bx + bw * 0.38, by - h * 0.05, bw * 0.24, h * 0.05);
    c.fillStyle = "#fff4d8";
    c.font = `700 ${w * 0.03}px ui-sans-serif, system-ui, sans-serif`;
    c.textAlign = "center";
    c.fillText("好好学习 天天向上", bx + bw * 0.5, by - h * 0.015);
    c.textAlign = "left";
    // 操场
    c.fillStyle = "#3d9a55";
    c.fillRect(0, h * 0.62, w, h * 0.38);
    c.strokeStyle = "#c9573f";
    c.lineWidth = h * 0.05;
    c.beginPath();
    c.ellipse(w * 0.5, h * 0.86, w * 0.52, h * 0.13, 0, Math.PI, 0);
    c.stroke();
    c.strokeStyle = "rgba(255,255,255,.8)";
    c.lineWidth = 2;
    for (let k = -1; k <= 1; k++) {
      c.beginPath();
      c.ellipse(w * 0.5, h * 0.86, w * 0.52 + k * h * 0.016, h * 0.13 + k * h * 0.016, 0, Math.PI, 0);
      c.stroke();
    }
    flag(c, w * 0.16, h * 0.64, h * 0.4, r() * 6);
    kapok(c, w * 0.86, h * 0.72, h * 0.34, r);
    // 背着书包的小朋友
    for (let i = 0; i < 4; i++) {
      const x = w * (0.34 + i * 0.09);
      const y = h * 0.92;
      c.fillStyle = ["#e94f3b", "#3a78c9", "#f2b632", "#46a36b"][i];
      c.fillRect(x - 6, y - 26, 12, 16);
      disc(c, x, y - 32, 6, "#2d2420");
      c.fillStyle = "#2d2420";
      c.fillRect(x - 5, y - 10, 3, 10);
      c.fillRect(x + 2, y - 10, 3, 10);
    }
  },

  schoolTrack(c, w, h, r) {
    sky(c, w, h, [
      [0, "#f6b77e"],
      [0.5, "#f9d9a8"],
      [1, "#f3e6cf"],
    ]);
    glow(c, w * 0.2, h * 0.3, w * 0.3, "rgba(255,230,170,.9)");
    // 高层教学楼 + 钟
    const bx = w * 0.42;
    const bw = w * 0.5;
    const top = h * 0.14;
    c.fillStyle = "#e9dfcf";
    c.fillRect(bx, top, bw, h * 0.54);
    c.fillStyle = "#b6453b";
    c.fillRect(bx, top, bw, h * 0.03);
    c.fillRect(bx + bw * 0.44, top - h * 0.08, bw * 0.12, h * 0.08);
    disc(c, bx + bw * 0.5, top - h * 0.04, w * 0.022, "#fff");
    c.strokeStyle = "#333";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(bx + bw * 0.5, top - h * 0.04);
    c.lineTo(bx + bw * 0.5, top - h * 0.055);
    c.moveTo(bx + bw * 0.5, top - h * 0.04);
    c.lineTo(bx + bw * 0.51, top - h * 0.035);
    c.stroke();
    windowsGrid(c, bx, top + h * 0.04, bw, h * 0.48, 6, 7, () => (r() < 0.2 ? "#ffd98a" : "#7e98ad"), r);
    c.fillStyle = "#c9573f";
    c.fillRect(bx + bw * 0.1, top + h * 0.36, bw * 0.8, h * 0.04);
    c.fillStyle = "#fff3dc";
    c.font = `700 ${w * 0.026}px ui-sans-serif, system-ui, sans-serif`;
    c.textAlign = "center";
    c.fillText("青春无悔 · 奋斗有我", bx + bw * 0.5, top + h * 0.388);
    c.textAlign = "left";
    // 篮球场
    c.fillStyle = "#4f7f9e";
    c.fillRect(0, h * 0.68, w, h * 0.32);
    c.strokeStyle = "rgba(255,255,255,.75)";
    c.lineWidth = 3;
    c.strokeRect(w * 0.05, h * 0.72, w * 0.9, h * 0.26);
    c.beginPath();
    c.arc(w * 0.5, h * 0.98, h * 0.08, Math.PI, 0);
    c.stroke();
    const hoop = (x) => {
      c.fillStyle = "#555";
      c.fillRect(x - 2, h * 0.46, 4, h * 0.26);
      c.fillStyle = "#fff";
      c.fillRect(x - w * 0.05, h * 0.4, w * 0.1, h * 0.07);
      c.strokeStyle = "#e0602c";
      c.beginPath();
      c.ellipse(x, h * 0.48, w * 0.025, h * 0.008, 0, 0, Math.PI * 2);
      c.stroke();
    };
    hoop(w * 0.18);
    kapok(c, w * 0.08, h * 0.7, h * 0.4, r);
    // 投篮的剪影
    c.fillStyle = "#2d2420";
    c.fillRect(w * 0.3, h * 0.8, 8, 26);
    disc(c, w * 0.3 + 4, h * 0.785, 7, "#2d2420");
    disc(c, w * 0.24, h * 0.62, 9, "#e0602c");
  },

  gflsCampus(c, w, h, r) {
    sky(c, w, h, [
      [0, "#8fc4ea"],
      [0.6, "#d4ecf5"],
      [1, "#eef7f4"],
    ]);
    cloud(c, w * 0.7, h * 0.16, w * 0.12);
    // 远处的南沙大桥
    c.strokeStyle = "rgba(90,110,130,.6)";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(0, h * 0.44);
    c.lineTo(w, h * 0.42);
    c.stroke();
    for (const tx of [0.3, 0.72]) {
      c.fillStyle = "rgba(90,110,130,.7)";
      c.fillRect(w * tx - 3, h * 0.28, 6, h * 0.16);
      c.lineWidth = 1;
      for (let i = 1; i < 8; i++) {
        c.beginPath();
        c.moveTo(w * tx, h * 0.29);
        c.lineTo(w * tx + i * w * 0.025, h * 0.43);
        c.moveTo(w * tx, h * 0.29);
        c.lineTo(w * tx - i * w * 0.025, h * 0.435);
        c.stroke();
      }
    }
    c.fillStyle = "#8fb7c9";
    c.fillRect(0, h * 0.44, w, h * 0.08);
    shimmer(c, 0, w, h * 0.44, h * 0.52, r, "#fff", 30);
    // 现代校园建筑
    const blocks = [
      [0.02, 0.5, 0.36, 0.22, "#f4f1ea"],
      [0.34, 0.4, 0.34, 0.32, "#fbfaf6"],
      [0.66, 0.48, 0.32, 0.24, "#ece6da"],
    ];
    for (const [x, y, bw, bh, col] of blocks) {
      c.fillStyle = col;
      c.fillRect(w * x, h * y, w * bw, h * bh);
      windowsGrid(c, w * x, h * y + h * 0.02, w * bw, h * bh - h * 0.04, 7, 4, "#5f8fb0", r);
      c.fillStyle = "#1f5c8f";
      c.fillRect(w * x, h * y, w * bw, h * 0.012);
    }
    c.fillStyle = "#1f5c8f";
    c.font = `700 ${w * 0.03}px ui-sans-serif, system-ui, sans-serif`;
    c.textAlign = "center";
    c.fillText("GUANGZHOU FOREIGN LANGUAGE SCHOOL", w * 0.51, h * 0.385);
    c.textAlign = "left";
    // 草坪 + 红树林
    c.fillStyle = "#6fae5c";
    c.fillRect(0, h * 0.72, w, h * 0.28);
    for (let i = 0; i < 9; i++) {
      const x = w * (0.05 + i * 0.11);
      c.fillStyle = "#3f7a45";
      c.beginPath();
      c.ellipse(x, h * 0.74, w * 0.06, h * 0.05, 0, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = "#e8e2d2";
    c.beginPath();
    c.moveTo(w * 0.45, h);
    c.quadraticCurveTo(w * 0.55, h * 0.84, w * 0.5, h * 0.76);
    c.lineTo(w * 0.54, h * 0.76);
    c.quadraticCurveTo(w * 0.62, h * 0.86, w * 0.6, h);
    c.fill();
  },

  hainanCampus(c, w, h, r) {
    sky(c, w, h, [
      [0, "#2f8fe0"],
      [0.6, "#8fd0f5"],
      [1, "#dff4fb"],
    ]);
    glow(c, w * 0.82, h * 0.12, w * 0.25, "rgba(255,255,220,.95)");
    disc(c, w * 0.82, h * 0.12, w * 0.05, "#fffbe6");
    cloud(c, w * 0.3, h * 0.2, w * 0.13);
    // 大海
    c.fillStyle = lin(c, 0, h * 0.46, 0, h * 0.6, [
      [0, "#1c86b8"],
      [1, "#4cc3d6"],
    ]);
    c.fillRect(0, h * 0.46, w, h * 0.14);
    shimmer(c, 0, w, h * 0.46, h * 0.6, r, "#fff", 50);
    // 教学楼（骑楼风格拱廊）
    const bx = w * 0.12;
    const by = h * 0.4;
    const bw = w * 0.62;
    const bh = h * 0.3;
    c.fillStyle = "#f3e7d3";
    c.fillRect(bx, by, bw, bh);
    c.fillStyle = "#c86b4a";
    c.fillRect(bx - w * 0.02, by - h * 0.03, bw + w * 0.04, h * 0.035);
    for (let i = 0; i < 6; i++) {
      const ax = bx + (i + 0.5) * (bw / 6);
      c.fillStyle = "#8a5a3c";
      c.beginPath();
      c.moveTo(ax - bw * 0.045, by + bh);
      c.lineTo(ax - bw * 0.045, by + bh * 0.62);
      c.arc(ax, by + bh * 0.62, bw * 0.045, Math.PI, 0);
      c.lineTo(ax + bw * 0.045, by + bh);
      c.fill();
    }
    windowsGrid(c, bx, by + h * 0.02, bw, bh * 0.4, 8, 1, "#5d93b8", r);
    // 地面 + 椰子树
    c.fillStyle = "#e9d9b0";
    c.fillRect(0, h * 0.7, w, h * 0.3);
    c.fillStyle = "#7cbf5a";
    c.fillRect(0, h * 0.7, w, h * 0.05);
    const coconut = (x, s, lean) => {
      c.strokeStyle = "#8a6a44";
      c.lineWidth = s * 0.05;
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(x, h * 0.95);
      c.quadraticCurveTo(x + lean * 0.5, h * 0.95 - s * 0.5, x + lean, h * 0.95 - s);
      c.stroke();
      const tx = x + lean;
      const ty = h * 0.95 - s;
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        c.strokeStyle = i % 2 ? "#2f7d3a" : "#3f9a47";
        c.lineWidth = s * 0.04;
        c.beginPath();
        c.moveTo(tx, ty);
        c.quadraticCurveTo(tx + Math.cos(a) * s * 0.3, ty + Math.sin(a) * s * 0.12 - s * 0.12, tx + Math.cos(a) * s * 0.45, ty + Math.abs(Math.sin(a)) * s * 0.2 + s * 0.05);
        c.stroke();
      }
      for (let i = 0; i < 3; i++) disc(c, tx + (i - 1) * s * 0.03, ty + s * 0.03, s * 0.025, "#6b4a2a");
    };
    coconut(w * 0.08, h * 0.62, w * 0.06);
    coconut(w * 0.86, h * 0.7, -w * 0.08);
    coconut(w * 0.66, h * 0.45, w * 0.04);
  },

  utsGehry(c, w, h, r) {
    sky(c, w, h, [
      [0, "#5aa3de"],
      [1, "#d6eaf6"],
    ]);
    // 背后的 UTS 塔楼
    c.fillStyle = "#9aa0a6";
    c.fillRect(w * 0.62, h * 0.02, w * 0.3, h * 0.8);
    c.fillStyle = "#80868c";
    for (let y = h * 0.05; y < h * 0.8; y += h * 0.035) c.fillRect(w * 0.62, y, w * 0.3, h * 0.012);
    // 周泽荣大楼：波浪起伏的砖墙
    const x0 = w * 0.02;
    const x1 = w * 0.74;
    const brickH = h * 0.022;
    for (let row = 0, y = h * 0.14; y < h * 0.9; row++, y += brickH) {
      const bulge = Math.sin(row * 0.22 + 1) * w * 0.035 + Math.sin(row * 0.09) * w * 0.02;
      const shade = 150 + Math.sin(row * 0.22 + 1) * 30;
      for (let x = x0 + (row % 2) * w * 0.02; x < x1; x += w * 0.04) {
        const k = (x - x0) / (x1 - x0);
        const off = bulge * Math.sin(k * Math.PI);
        c.fillStyle = `rgb(${shade + 30 + r() * 20},${shade * 0.55 + r() * 15},${shade * 0.35})`;
        c.fillRect(x + off, y, w * 0.037, brickH - 2);
      }
    }
    // 窗
    for (let i = 0; i < 5; i++)
      for (let j = 0; j < 7; j++) {
        const wx = w * (0.08 + i * 0.13);
        const wy = h * (0.2 + j * 0.1);
        const off = Math.sin(j * 1.3 + 1) * w * 0.02 * Math.sin(((wx - x0) / (x1 - x0)) * Math.PI);
        c.fillStyle = "rgba(160,200,225,.9)";
        c.fillRect(wx + off, wy, w * 0.05, h * 0.055);
      }
    // 街道 + 树
    c.fillStyle = "#6c6f73";
    c.fillRect(0, h * 0.9, w, h * 0.1);
    for (let i = 0; i < 3; i++) {
      disc(c, w * (0.12 + i * 0.35), h * 0.84, w * 0.07, "#4f8a4a");
      c.fillStyle = "#5a4636";
      c.fillRect(w * (0.12 + i * 0.35) - 3, h * 0.86, 6, h * 0.06);
    }
  },
});

/** 胶片质感：暗角、颗粒、偶尔漏光 */
export function filmFinish(c, w, h, seed) {
  const r = rng(seed * 7 + 3);
  const v = c.createRadialGradient(w / 2, h / 2, w * 0.35, w / 2, h / 2, w * 0.78);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(20,10,0,.32)");
  c.fillStyle = v;
  c.fillRect(0, 0, w, h);
  if (r() < 0.5) {
    c.save();
    c.globalCompositeOperation = "screen";
    glow(c, r() < 0.5 ? 0 : w, r() * h, w * 0.5, "rgba(255,120,40,.35)");
    c.restore();
  }
  c.globalAlpha = 0.05;
  for (let i = 0; i < (w * h) / 180; i++) {
    c.fillStyle = r() > 0.5 ? "#fff" : "#000";
    c.fillRect(r() * w, r() * h, 1.6, 1.6);
  }
  c.globalAlpha = 1;
}

export function paintScene(c, w, h, key, seed) {
  const fn = SCENES[key] || SCENES.erhai;
  c.save();
  fn(c, w, h, rng(seed));
  c.restore();
  filmFinish(c, w, h, seed);
}
