import * as THREE from "three";
import { clamp } from "../lib/util.js";

/**
 * 绳子：一条固定形状的弧线（两端高、中间低、两端微微朝向镜头），
 * 叠加一维波动方程产生的 y/z 位移，卡片的重量、风和手指拨动都作为外力作用在上面。
 */
export class Rope {
  constructor(world, nodes = 110) {
    this.N = nodes;
    this.dy = new Float32Array(nodes);
    this.vy = new Float32Array(nodes);
    this.fy = new Float32Array(nodes);
    this.dz = new Float32Array(nodes);
    this.vz = new Float32Array(nodes);
    this.fz = new Float32Array(nodes);

    this.M = 180; // 渲染采样点
    this.R = 6; // 管道截面边数
    this.geo = new THREE.BufferGeometry();
    const count = this.M * this.R;
    this.geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    this.geo.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const idx = [];
    for (let i = 0; i < this.M - 1; i++)
      for (let j = 0; j < this.R; j++) {
        const a = i * this.R + j;
        const b = i * this.R + ((j + 1) % this.R);
        idx.push(a, a + this.R, b, b, a + this.R, b + this.R);
      }
    this.geo.setIndex(idx);
    this.material = new THREE.MeshStandardMaterial({ color: "#8c7457", roughness: 0.9 });
    this.mesh = new THREE.Mesh(this.geo, this.material);
    this.mesh.frustumCulled = false;
    world.add(this.mesh);
  }

  resize(L) {
    this.L = L;
    const dx = L.span / (this.N - 1);
    this.tension = (9 / dx) ** 2;
    this.maxDisp = L.cardH * 0.3;
  }

  _f(x) {
    return clamp(((x / this.L.halfSpan + 1) / 2) * (this.N - 1), 0, this.N - 1.0001);
  }
  sample(arr, x) {
    const f = this._f(x);
    const i = f | 0;
    const a = f - i;
    return arr[i] * (1 - a) + arr[i + 1] * a;
  }
  addForce(arr, x, v) {
    const f = this._f(x);
    const i = f | 0;
    const a = f - i;
    arr[i] += v * (1 - a);
    arr[i + 1] += v * a;
  }
  /** 直接给速度一个冲量（拨动绳子） */
  impulse(x, vy, vz = 0, width = 3) {
    const f = this._f(x);
    for (let k = -width; k <= width; k++) {
      const i = Math.round(f) + k;
      if (i <= 0 || i >= this.N - 1) continue;
      const w = Math.exp(-(k * k) / (width * 0.8));
      this.vy[i] += vy * w;
      this.vz[i] += vz * w;
    }
  }

  point(x, out) {
    const L = this.L;
    const u = x / L.halfW;
    return out.set(
      x,
      L.anchorY + L.rise * u * u + this.sample(this.dy, x),
      L.depth * u * u + this.sample(this.dz, x),
    );
  }

  slope(x) {
    const e = this.L.spacing * 0.25;
    this.point(x - e, _a);
    this.point(x + e, _b);
    return Math.atan2(_b.y - _a.y, _b.x - _a.x);
  }

  clearForces() {
    this.fy.fill(0);
    this.fz.fill(0);
  }

  /** 去掉平均载荷：卡片只让绳子局部下沉，不会把整条设计好的弧线往下拽 */
  balance() {
    let m = 0;
    for (let i = 0; i < this.N; i++) m += this.fy[i];
    m /= this.N;
    for (let i = 0; i < this.N; i++) this.fy[i] -= m;
  }

  step(dt) {
    const N = this.N;
    const T = this.tension;
    const sub = clamp(Math.ceil(dt * Math.sqrt(T) * 2), 2, 8);
    const h = dt / sub;
    const lim = this.maxDisp;
    const { dy, vy, fy, dz, vz, fz } = this;
    for (let s = 0; s < sub; s++) {
      for (let i = 1; i < N - 1; i++) {
        vy[i] += (T * (dy[i - 1] + dy[i + 1] - 2 * dy[i]) - 6 * dy[i] - 2.6 * vy[i] + fy[i]) * h;
        vz[i] += (T * (dz[i - 1] + dz[i + 1] - 2 * dz[i]) - 6 * dz[i] - 2.6 * vz[i] + fz[i]) * h;
      }
      for (let i = 1; i < N - 1; i++) {
        dy[i] = clamp(dy[i] + vy[i] * h, -lim, lim);
        dz[i] = clamp(dz[i] + vz[i] * h, -lim, lim);
      }
    }
  }

  updateMesh() {
    const { M, R, L } = this;
    const pos = this.geo.attributes.position.array;
    const nor = this.geo.attributes.normal.array;
    const x0 = -L.halfSpan;
    const step = L.span / (M - 1);
    for (let i = 0; i < M; i++) {
      const x = x0 + i * step;
      this.point(x, _c);
      this.point(Math.max(x0, x - step), _a);
      this.point(Math.min(-x0, x + step), _b);
      _t.subVectors(_b, _a).normalize();
      _n.crossVectors(_t, _z).normalize();
      _bn.crossVectors(_t, _n).normalize();
      for (let j = 0; j < R; j++) {
        const ang = (j / R) * Math.PI * 2;
        const ca = Math.cos(ang);
        const sa = Math.sin(ang);
        const nx = _n.x * ca + _bn.x * sa;
        const ny = _n.y * ca + _bn.y * sa;
        const nz = _n.z * ca + _bn.z * sa;
        const o = (i * R + j) * 3;
        pos[o] = _c.x + nx * L.ropeR;
        pos[o + 1] = _c.y + ny * L.ropeR;
        pos[o + 2] = _c.z + nz * L.ropeR;
        nor[o] = nx;
        nor[o + 1] = ny;
        nor[o + 2] = nz;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.normal.needsUpdate = true;
  }

  setNight(n) {
    this.material.color.setRGB(0.55 - n * 0.3, 0.45 - n * 0.25, 0.34 - n * 0.18);
  }
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _t = new THREE.Vector3();
const _n = new THREE.Vector3();
const _bn = new THREE.Vector3();
const _z = new THREE.Vector3(0, 0, 1);
