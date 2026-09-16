import * as THREE from "three";
import { CARD_RATIO } from "../art/cardArt.js";
import { clamp, lerp } from "../lib/util.js";

export const CFG = {
  fov: 30,
  camZ: 16,
  clipTop: 0.07, // 夹子露出绳子上方的长度（按卡片宽度计）
  clipGrip: 0.12, // 绳子到卡片上沿的距离（按卡片宽度计）
  spacing: 1.3, // 卡片间距（按卡片宽度计）
};

/**
 * 负责渲染器、相机、灯光和「像素 → 世界坐标」的布局换算。
 */
export class Stage {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.renderer.setPixelRatio(this.dpr);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(CFG.fov, 1, 0.1, 100);
    this.camera.position.set(0, 0, CFG.camZ);
    this.world = new THREE.Group();
    this.scene.add(this.world);

    this.hemi = new THREE.HemisphereLight("#fffaf0", "#cbbba0", 2.1);
    this.sun = new THREE.DirectionalLight("#fff3dd", 1.5);
    this.sun.position.set(-4, 7, 10);
    this.scene.add(this.hemi, this.sun);

    this.warm = [];
    for (let i = 0; i < 5; i++) {
      const l = new THREE.PointLight("#ffae57", 0, 0, 1.4);
      this.warm.push(l);
      this.scene.add(l);
    }

    this.night = 0;
    this.nightTarget = 0;
    this.L = {};
    this.parallax = { x: 0, y: 0, tx: 0, ty: 0 };
  }

  layout() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const L = this.L;
    L.W = W;
    L.H = H;
    L.mobile = W < 640;

    let cardWpx = W < 640 ? W * 0.46 : W < 1024 ? W * 0.25 : clamp(W * 0.15, 200, 260);
    cardWpx = Math.min(cardWpx, H * 0.34);
    L.cardWpx = cardWpx;

    this.camera.aspect = W / H;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(W, H, false);

    L.worldH = 2 * CFG.camZ * Math.tan(THREE.MathUtils.degToRad(CFG.fov / 2));
    L.ppu = H / L.worldH;
    L.halfW = W / 2 / L.ppu;
    L.cardW = cardWpx / L.ppu;
    L.cardH = L.cardW * CARD_RATIO;
    L.spacing = L.cardW * CFG.spacing;
    L.anchorY = (H / 2 - H * (L.mobile ? 0.3 : 0.33)) / L.ppu;
    L.rise = H * 0.075 / L.ppu;
    L.depth = L.cardW * 0.25;
    L.ropeR = 1.5 / L.ppu;
    L.slots = Math.max(6, Math.ceil((2.6 * L.halfW) / L.spacing));
    L.halfSpan = (L.slots * L.spacing) / 2;
    L.span = L.halfSpan * 2;
    L.pendulum = L.cardW * (CFG.clipGrip + CARD_RATIO / 2);
    return L;
  }

  pxToWorldY(px) {
    return (this.L.H / 2 - px) / this.L.ppu;
  }

  setNight(on) {
    this.nightTarget = on ? 1 : 0;
  }

  setPointer(nx, ny) {
    this.parallax.tx = nx;
    this.parallax.ty = ny;
  }

  update(dt, rope, reduced) {
    this.night = lerp(this.night, this.nightTarget, 1 - Math.exp(-dt * 2.2));
    const n = this.night;
    this.hemi.intensity = lerp(2.1, 0.32, n);
    this.hemi.color.set(n > 0.5 ? "#9fb1d6" : "#fffaf0");
    this.sun.intensity = lerp(1.5, 0.08, n);

    const L = this.L;
    this.warm.forEach((l, i) => {
      const x = (i - 2) * L.halfW * 0.5;
      const p = rope.point(x, _v);
      l.position.set(p.x, p.y - L.cardH * 0.25, p.z + L.cardW * 0.9);
      l.intensity = n * 6.5 * (0.92 + Math.sin(performance.now() * 0.003 + i * 2) * 0.08);
      l.distance = L.cardW * 4.5;
    });

    if (!reduced) {
      const p = this.parallax;
      const k = 1 - Math.exp(-dt * 3);
      p.x += (p.tx - p.x) * k;
      p.y += (p.ty - p.y) * k;
      this.camera.position.x = p.x * 0.35;
      this.camera.position.y = -p.y * 0.2;
      this.camera.lookAt(p.x * 0.2, -p.y * 0.1, 0);
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  project(v) {
    _p.copy(v).project(this.camera);
    return { x: (_p.x * 0.5 + 0.5) * this.L.W, y: (-_p.y * 0.5 + 0.5) * this.L.H };
  }
}

const _v = new THREE.Vector3();
const _p = new THREE.Vector3();
