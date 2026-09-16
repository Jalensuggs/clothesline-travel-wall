import * as THREE from "three";
import { makeEmptyCard, makeHomeCard, makePolaroid, makeTicket } from "../art/cardArt.js";

const TEX_W = 640;

/**
 * 贴图仓库：按卡片 id 缓存 CanvasTexture，负责异步加载真实照片、
 * 以及新照片「显影」的动画。
 */
export class TextureBank {
  constructor(renderer) {
    this.maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    this.entries = new Map();
    this.images = new Map();
    this.developing = new Set();
  }

  _draw(item, develop = 1) {
    if (item.kind === "ticket") return item.trip.home ? makeHomeCard(item.trip, TEX_W, item.stats) : makeTicket(item.trip, TEX_W, item.stats);
    if (item.kind === "empty") return makeEmptyCard(TEX_W);
    const img = this.images.get(item.id) || null;
    // 用户照片还没读出来时，显示成未显影的暗色底片
    return makePolaroid(item, TEX_W, img, item.blob && !img ? 0 : develop);
  }

  get(item) {
    let e = this.entries.get(item.id);
    if (e) return e.tex;
    const tex = new THREE.CanvasTexture(this._draw(item));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = this.maxAniso;
    e = { tex, item };
    this.entries.set(item.id, e);
    this._loadImage(item);
    return tex;
  }

  _loadImage(item) {
    const src = item.photo || (item.blob ? URL.createObjectURL(item.blob) : null);
    if (!src || this.images.has(item.id)) return;
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      this.images.set(item.id, img);
      if (item.fresh) this.develop(item);
      else this.refresh(item);
    };
    // 找不到图片时保持插画占位，不报错
    img.onerror = () => {};
    img.src = src;
  }

  image(item) {
    return this.images.get(item.id) || null;
  }

  refresh(item) {
    const e = this.entries.get(item.id);
    if (!e) return;
    e.item = item;
    e.tex.image = this._draw(item);
    e.tex.needsUpdate = true;
  }

  /** 拍立得显影：从一片暗色慢慢浮现 */
  develop(item, duration = 3.2) {
    const e = this.entries.get(item.id);
    if (!e) return;
    delete item.fresh;
    this.developing.add({ item, e, t: 0, duration, last: -1 });
  }

  update(dt) {
    for (const d of this.developing) {
      d.t += dt;
      const k = Math.min(1, d.t / d.duration);
      if (k === 1 || d.t - d.last > 0.1) {
        d.last = d.t;
        d.e.tex.image = this._draw(d.item, k * k * (3 - 2 * k));
        d.e.tex.needsUpdate = true;
      }
      if (k === 1) this.developing.delete(d);
    }
  }

  /** 灯箱里用的高清版本 */
  hiRes(item, width = 1100) {
    if (item.kind === "ticket") return item.trip.home ? makeHomeCard(item.trip, width, item.stats) : makeTicket(item.trip, width, item.stats);
    return makePolaroid(item, width, this.images.get(item.id) || null);
  }

  forget(id) {
    const e = this.entries.get(id);
    if (e) e.tex.dispose();
    this.entries.delete(id);
    this.images.delete(id);
  }
}
