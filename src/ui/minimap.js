import { haversine, mod } from "../lib/util.js";

const NS = "http://www.w3.org/2000/svg";
const VW = 250;
const VH = 160;
const PAD = 26;

function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  parent?.appendChild(e);
  return e;
}

/**
 * 路线小地图：按经纬度把站点投影到一块纸上，画出虚线航线，
 * 小飞机会随着绳子的滚动位置在站点之间连续移动。
 */
export class Minimap {
  constructor(root, { onPick }) {
    this.root = root;
    this.onPick = onPick;
    this.pos = [];
    this.pins = [];
  }

  setItems(trip, items) {
    this.items = items;
    this.root.innerHTML = "";
    const stops = items.map((it, i) => ({ it, i })).filter(({ it }) => it.lat != null && it.lon != null);
    let km = 0;
    for (let k = 1; k < stops.length; k++) km += haversine(stops[k - 1].it, stops[k].it);

    const head = document.createElement("div");
    head.className = "mm-head";
    head.innerHTML = `<b>${trip.home ? "成长路线" : "路线"}</b><span>${stops.length} 个地点 · ${Math.round(km).toLocaleString()} km</span>`;
    this.root.appendChild(head);

    if (!stops.length) {
      const empty = document.createElement("div");
      empty.className = "mm-empty";
      empty.textContent =
        trip.id === "mine" ? "照片里没有 GPS 信息，暂时画不出路线。用手机原相机拍的照片通常会带定位。" : "这段旅程没有坐标";
      this.root.appendChild(empty);
      this.svg = null;
      return;
    }

    // 等距圆柱投影，经度按纬度余弦压缩，避免高纬度地区被拉宽
    const lats = stops.map((s) => s.it.lat);
    const lons = stops.map((s) => s.it.lon);
    const latMid = (Math.min(...lats) + Math.max(...lats)) / 2;
    const lonMid = (Math.min(...lons) + Math.max(...lons)) / 2;
    const k = Math.cos((latMid * Math.PI) / 180);
    const px = (it) => ({ x: (it.lon - lonMid) * k, y: -(it.lat - latMid) });
    const raw = stops.map((s) => px(s.it));
    const spanX = Math.max(0.04, Math.max(...raw.map((p) => p.x)) - Math.min(...raw.map((p) => p.x)));
    const spanY = Math.max(0.04, Math.max(...raw.map((p) => p.y)) - Math.min(...raw.map((p) => p.y)));
    const scale = Math.min((VW - PAD * 2) / spanX, (VH - PAD * 2) / spanY);
    const toView = (p) => ({ x: VW / 2 + p.x * scale, y: VH / 2 + p.y * scale + 4 });

    const svg = el("svg", { viewBox: `0 0 ${VW} ${VH}` }, this.root);
    this.svg = svg;

    // 经纬网
    const degSpan = Math.max(spanX / k, spanY);
    const step = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20].find((s) => degSpan / s < 6) || 30;
    const R = Math.max(degSpan * 4, step * 10);
    for (let lon = Math.floor((lonMid - R) / step) * step; lon <= lonMid + R; lon += step) {
      const x = VW / 2 + (lon - lonMid) * k * scale;
      if (x > 0 && x < VW) el("line", { x1: x, y1: 0, x2: x, y2: VH, class: "mm-grid" }, svg);
    }
    for (let lat = Math.floor((latMid - R) / step) * step; lat <= latMid + R; lat += step) {
      const y = VH / 2 - (lat - latMid) * scale + 4;
      if (y > 0 && y < VH) el("line", { x1: 0, y1: y, x2: VW, y2: y, class: "mm-grid" }, svg);
    }

    const pts = raw.map(toView);
    if (pts.length > 1) {
      let d = `M${pts[0].x},${pts[0].y}`;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        // 航线稍微弯一点，更像手绘
        const mx = (a.x + b.x) / 2 - (b.y - a.y) * 0.18;
        const my = (a.y + b.y) / 2 + (b.x - a.x) * 0.18;
        d += ` Q${mx},${my} ${b.x},${b.y}`;
      }
      el("path", { d, class: "mm-route" }, svg);
    }

    // 每个 item 的地图位置：没有坐标的沿用上一个有坐标的点
    this.pos = [];
    let last = pts[0];
    let si = 0;
    items.forEach((it, i) => {
      if (stops[si] && stops[si].i === i) last = pts[si++];
      this.pos[i] = last;
    });

    this.pins = stops.map((s, n) => {
      const p = pts[n];
      const g = el("g", { class: "mm-pin", transform: `translate(${p.x},${p.y})` }, svg);
      el("circle", { r: 7 }, g);
      el("text", {}, g).textContent = n + 1;
      el("title", {}, g).textContent = s.it.place;
      g.addEventListener("click", () => this.onPick(s.i));
      return { g, index: s.i };
    });

    this.label = el("text", { class: "mm-label" }, svg);
    this.plane = el("path", { class: "mm-plane", d: "M0,-7 L2,-2 L8,1 L8,3 L2,1.5 L1.5,5 L3.5,7 L0,6.5 L-3.5,7 L-1.5,5 L-2,1.5 L-8,3 L-8,1 L-2,-2 Z" }, svg);
    this.active = -1;
  }

  /** @param f 绳子中心对应的连续 item 序号 */
  update(f) {
    if (!this.svg || !this.items?.length) return;
    const n = this.items.length;
    const fm = mod(f, n);
    const i0 = Math.floor(fm);
    const i1 = (i0 + 1) % n;
    const t = fm - i0;
    const a = this.pos[i0];
    // 从最后一站回到登机牌时，飞机停在终点
    const b = i1 === 0 ? a : this.pos[i1];
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    const ang = a === b ? this._ang || 0 : (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI + 90;
    this._ang = ang;
    this.plane.setAttribute("transform", `translate(${x},${y - 12}) rotate(${ang})`);

    const current = mod(Math.round(f), n);
    if (current !== this.active) {
      this.active = current;
      for (const p of this.pins) p.g.classList.toggle("active", p.index === current);
      const pin = this.pins.find((p) => p.index === current);
      if (pin) {
        const pos = this.pos[current];
        this.label.textContent = this.items[current].place;
        this.label.setAttribute("x", Math.min(VW - 40, Math.max(40, pos.x)));
        this.label.setAttribute("y", pos.y + (pos.y > VH / 2 ? -20 : 26));
      } else this.label.textContent = "";
    }
  }
}
