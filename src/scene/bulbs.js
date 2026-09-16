import * as THREE from "three";
import { makeGlow } from "../art/cardArt.js";

/** 夜晚模式：绳子变成一串暖色小灯泡 */
export class Bulbs {
  constructor(world) {
    this.group = new THREE.Group();
    world.add(this.group);
    this.glowTex = new THREE.CanvasTexture(makeGlow());
    this.glowTex.colorSpace = THREE.SRGBColorSpace;
    this.bulbGeo = new THREE.SphereGeometry(1, 14, 10);
    this.capGeo = new THREE.CylinderGeometry(0.6, 0.6, 1.2, 10);
    this.bulbMat = new THREE.MeshStandardMaterial({
      color: "#fff1d0",
      emissive: "#ffb347",
      emissiveIntensity: 0,
      roughness: 0.3,
    });
    this.capMat = new THREE.MeshStandardMaterial({ color: "#3a3430", roughness: 0.6 });
    this.items = [];
  }

  resize(L) {
    for (const b of this.items) this.group.remove(b.root);
    for (const b of this.items) b.sprite.material.dispose();
    this.items = [];
    const gap = L.spacing / 2;
    const n = Math.ceil(L.span / gap);
    const r = L.cardW * 0.028;
    for (let i = 0; i < n; i++) {
      const root = new THREE.Group();
      const cap = new THREE.Mesh(this.capGeo, this.capMat);
      cap.scale.setScalar(r);
      cap.position.y = -r * 0.9;
      const bulb = new THREE.Mesh(this.bulbGeo, this.bulbMat);
      bulb.scale.set(r, r * 1.25, r);
      bulb.position.y = -r * 2.4;
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.glowTex,
          // 只叠加颜色、不写入透明度：画布是透明的，这样光晕会直接加亮后面的 CSS 墙面
          blending: THREE.CustomBlending,
          blendEquation: THREE.AddEquation,
          blendSrc: THREE.SrcAlphaFactor,
          blendDst: THREE.OneFactor,
          blendSrcAlpha: THREE.ZeroFactor,
          blendDstAlpha: THREE.OneFactor,
          depthWrite: false,
          transparent: true,
          opacity: 0,
        }),
      );
      sprite.scale.setScalar(L.cardW * 0.7);
      sprite.position.y = -r * 2.4;
      root.add(cap, bulb, sprite);
      this.group.add(root);
      this.items.push({ root, sprite, x: -L.halfSpan + gap * (i + 0.25), phase: Math.random() * 10 });
    }
  }

  update(rope, night, time) {
    this.group.visible = night > 0.02;
    if (!this.group.visible) return;
    this.bulbMat.emissiveIntensity = night * 2.2;
    for (const b of this.items) {
      rope.point(b.x, b.root.position);
      const flicker = 0.85 + 0.15 * Math.sin(time * 2.1 + b.phase) * Math.sin(time * 5.3 + b.phase * 2);
      b.sprite.material.opacity = night * flicker;
    }
  }
}
