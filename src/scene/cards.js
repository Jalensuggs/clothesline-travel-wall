import * as THREE from "three";
import { CARD_RATIO, makeCardBack, makeShadow } from "../art/cardArt.js";
import { CFG } from "./stage.js";
import { clamp, lerp, mod } from "../lib/util.js";

/**
 * 挂在绳子上的卡片。
 *
 * 用固定数量的「槽位」无限循环：每个槽位沿绳子滑动，滑出一端就从另一端回来。
 * 槽位的虚拟序号 g 随着绕圈次数变化，卡片内容 = items[g mod items.length]，
 * 所以不管有多少张照片，绳子上的顺序始终是连续的。
 */
export class Cards {
  constructor(stage, rope, bank) {
    this.stage = stage;
    this.rope = rope;
    this.bank = bank;
    this.items = [];
    this.slots = [];

    // 滚动状态（世界坐标）
    this.offset = 0;
    this.vel = 0;
    this.target = 0;
    this.speed = 0;
    this.accel = 0;
    this.mode = "snap"; // drag | free | wheel | snap
    this.wheelTarget = 0;
    this.wheelIdle = 0;

    this.hiddenG = null;
    this.swap = null;
    this.onClipOn = null;

    this.frontGeo = new THREE.PlaneGeometry(1, CARD_RATIO);
    this.shadowGeo = new THREE.PlaneGeometry(1.3, CARD_RATIO * 1.25);
    const backTex = new THREE.CanvasTexture(makeCardBack(512));
    backTex.colorSpace = THREE.SRGBColorSpace;
    this.backMat = new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.9, alphaTest: 0.5 });
    const shTex = new THREE.CanvasTexture(makeShadow());
    this.shadowMat = new THREE.MeshBasicMaterial({
      map: shTex,
      color: "#3b2a17",
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    });

    // 木夹子
    this.pinGeo = new THREE.BoxGeometry(0.036, 0.25, 0.04);
    this.springGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.11, 10);
    this.woodMat = new THREE.MeshStandardMaterial({ color: "#c79a68", roughness: 0.75 });
    this.woodDark = new THREE.MeshStandardMaterial({ color: "#b0845a", roughness: 0.8 });
    this.metalMat = new THREE.MeshStandardMaterial({ color: "#b9bec4", roughness: 0.35, metalness: 0.4 });
  }

  /* ---------------------------------------------------------- 槽位构建 */

  resize(L) {
    const center = this.centerFloat(this._prevSpacing);
    if (this.slots.length !== L.slots) this._build(L.slots);
    this.offset = this.target = this.wheelTarget = -center * L.spacing;
    this._prevSpacing = L.spacing;
    for (const s of this.slots) s.prevX = null;
  }

  _build(S) {
    for (const s of this.slots) {
      this.stage.world.remove(s.pivot);
      s.front.material.dispose();
    }
    this.slots = [];
    const top = CFG.clipGrip + CARD_RATIO / 2;
    for (let i = 0; i < S; i++) {
      const pivot = new THREE.Group();
      const hang = new THREE.Group();
      const body = new THREE.Group();

      const mat = new THREE.MeshStandardMaterial({
        roughness: 0.85,
        alphaTest: 0.5,
        emissive: "#ffffff",
        emissiveIntensity: 0,
      });
      const front = new THREE.Mesh(this.frontGeo, mat);
      front.position.y = -top;
      front.userData.slot = i;
      const back = new THREE.Mesh(this.frontGeo, this.backMat);
      back.rotation.y = Math.PI;
      back.position.set(0, -top, -0.002);
      const shadow = new THREE.Mesh(this.shadowGeo, this.shadowMat);
      shadow.position.set(0.07, -top - 0.08, -0.4);
      shadow.renderOrder = -1;
      body.add(shadow, front, back);

      const clip = new THREE.Group();
      const left = new THREE.Mesh(this.pinGeo, i % 3 ? this.woodMat : this.woodDark);
      const right = new THREE.Mesh(this.pinGeo, i % 3 ? this.woodMat : this.woodDark);
      left.position.set(-0.02, -0.045, 0.03);
      right.position.set(0.02, -0.045, 0.03);
      const spring = new THREE.Mesh(this.springGeo, this.metalMat);
      spring.rotation.z = Math.PI / 2;
      spring.position.set(0, -0.01, 0.03);
      clip.add(left, right, spring);

      hang.add(body, clip);
      pivot.add(hang);
      this.stage.world.add(pivot);

      this.slots.push({
        index: i,
        pivot,
        hang,
        body,
        front,
        back,
        shadow,
        g: null,
        itemIndex: -1,
        x: 0,
        lag: 0,
        lagV: 0,
        theta: 0,
        thetaV: 0,
        twist: 0,
        twistV: 0,
        tilt: 0,
        tiltV: 0,
        prevX: null,
        vx: 0,
        ax: 0,
        mass: 0.9 + ((i * 0.618) % 1) * 0.25,
        phase: i * 1.37,
        drop: { y: 0, vy: 0, rot: 0, rotV: 0, delay: 0 },
        enter: { s: 1, v: 0, delay: 0, fired: true },
      });
    }
  }

  /* ---------------------------------------------------------- 内容 */

  /** @param focus 挂好之后滑动到的 item 序号（可选） */
  setItems(items, animate = true, focus = null) {
    if (animate && this.items.length) {
      const L = this.stage.L;
      this.swap = { t: 0, next: items, focus };
      for (const s of this.slots) {
        s.drop = {
          y: 0,
          vy: 0.8 + Math.random() * 0.8,
          rot: 0,
          rotV: (Math.random() - 0.5) * 5,
          delay: 0.02 + (Math.abs(s.x) / L.halfW) * 0.16 + Math.random() * 0.05,
        };
      }
      return;
    }
    this._apply(items, animate, focus);
  }

  _apply(items, animate = true, focus = null) {
    const L = this.stage.L;
    this.items = items;
    this.offset = this.target = this.wheelTarget = this.vel = 0;
    this.mode = "snap";
    this.hiddenG = null;
    this.focusTimer = null;
    this.slots.forEach((s, i) => {
      s.itemIndex = -1;
      s.g = null;
      s.lag = s.lagV = s.theta = s.twist = s.twistV = 0;
      s.thetaV = animate ? (Math.random() - 0.5) * 3 : 0;
      s.drop = { y: 0, vy: 0, rot: 0, rotV: 0, delay: 0 };
      let x = i * L.spacing;
      if (x > L.halfSpan) x -= L.span;
      s.enter = animate
        ? { s: 0, v: 0, delay: 0.08 + (Math.abs(x) / L.halfW) * 0.28, fired: false }
        : { s: 1, v: 0, delay: 0, fired: true };
    });
    if (focus) this.focusTimer = { t: animate ? 0.9 : 0, g: focus };
  }

  refreshItem(item) {
    for (const s of this.slots) {
      if (this.items[s.itemIndex]?.id === item.id) s.itemIndex = -1;
    }
  }

  /* ---------------------------------------------------------- 滚动 */

  centerFloat(spacing = this.stage.L.spacing) {
    return spacing ? -this.offset / spacing : 0;
  }

  centerItemIndex() {
    const n = this.items.length;
    return n ? mod(Math.round(this.centerFloat()), n) : -1;
  }

  _snapTarget(from) {
    const sp = this.stage.L.spacing;
    return Math.round(from / sp) * sp;
  }

  scrollToG(g) {
    this.mode = "snap";
    this.target = -g * this.stage.L.spacing;
  }

  scrollBy(n) {
    const base = this.mode === "snap" ? -this.target : -this.offset;
    const gc = Math.round(base / this.stage.L.spacing);
    this.scrollToG(gc + n);
    return gc + n;
  }

  nearestG(itemIndex) {
    const n = this.items.length;
    const gc = Math.round(this.centerFloat());
    const base = gc - mod(gc, n) + itemIndex;
    return [base - n, base, base + n].reduce((a, b) => (Math.abs(b - gc) < Math.abs(a - gc) ? b : a));
  }

  dragStart() {
    this.mode = "drag";
    this.vel = 0;
  }
  dragMove(dxPx, dt) {
    const dx = dxPx / this.stage.L.ppu;
    this.offset += dx;
    this.vel = lerp(this.vel, dx / Math.max(dt, 1 / 240), 0.5);
  }
  dragEnd() {
    this.mode = "free";
  }
  wheel(deltaPx) {
    if (this.mode !== "wheel") this.wheelTarget = this.offset;
    this.mode = "wheel";
    this.wheelTarget -= (deltaPx / this.stage.L.ppu) * 0.9;
    this.wheelIdle = 0;
  }

  /** 鼠标划过时把卡片碰得晃一下 */
  poke(slot, vxPx) {
    const k = clamp(vxPx * 0.006, -4, 4);
    slot.thetaV -= k;
    slot.twistV += k * 0.6;
    this.rope.impulse(slot.x, -Math.abs(k) * 0.05);
  }

  /* ---------------------------------------------------------- 每帧 */

  step(dt, time, env) {
    const L = this.stage.L;
    const rope = this.rope;
    const S = this.slots.length;
    const prevOffset = this.offset;

    // 滚动积分
    if (this.mode === "free") {
      this.offset += this.vel * dt;
      this.vel *= Math.exp(-3.2 * dt);
      if (Math.abs(this.vel) < L.spacing * 1.2) {
        this.mode = "snap";
        this.target = this._snapTarget(this.offset + this.vel * 0.25);
      }
    } else if (this.mode === "wheel") {
      this.offset += (this.wheelTarget - this.offset) * (1 - Math.exp(-12 * dt));
      this.wheelIdle += dt;
      if (this.wheelIdle > 0.16) {
        this.mode = "snap";
        this.target = this._snapTarget(this.wheelTarget);
        this.vel = (this.offset - prevOffset) / dt;
      }
    } else if (this.mode === "snap") {
      const k = env.reduced ? 90 : 30;
      this.vel += (k * (this.target - this.offset) - 2 * Math.sqrt(k) * this.vel) * dt;
      this.offset += this.vel * dt;
    }
    const speed = this.mode === "drag" ? this.vel : (this.offset - prevOffset) / dt;
    this.accel = lerp(this.accel, (speed - this.speed) / dt, 0.25);
    this.speed = speed;

    // 切换旅程：旧卡片掉落
    if (this.swap) {
      this.swap.t += dt;
      for (const s of this.slots) {
        const d = s.drop;
        if (this.swap.t < d.delay) continue;
        d.vy -= 26 * dt;
        d.y += d.vy * dt;
        d.rot += d.rotV * dt;
      }
      if (this.swap.t > 1.05) {
        const { next, focus } = this.swap;
        this.swap = null;
        this._apply(next, true, focus);
      }
    }
    if (this.focusTimer && (this.focusTimer.t -= dt) <= 0) {
      this.scrollToG(this.focusTimer.g);
      this.focusTimer = null;
    }

    // 注意：换旅程时 items 会在上面被替换，所以长度要在这里再取
    const n = this.items.length;
    rope.clearForces();
    const night = this.stage.night;
    const wind = env.wind;

    for (let i = 0; i < S; i++) {
      const s = this.slots[i];

      // 沿绳子的位置：带一点滞后，像是夹子在绳子上有摩擦
      const la = (-70 * s.lag - 11 * s.lagV - 0.9 * this.speed) / s.mass;
      s.lagV += la * dt;
      s.lag = clamp(s.lag + s.lagV * dt, -L.spacing * 0.16, L.spacing * 0.16);
      const raw = i * L.spacing + this.offset + s.lag;
      const wraps = Math.floor((raw + L.halfSpan) / L.span);
      const x = raw - wraps * L.span;
      const g = i - wraps * S;
      s.x = x;

      if (n && (g !== s.g || s.itemIndex < 0)) {
        s.g = g;
        s.itemIndex = mod(g, n);
        const tex = this.bank.get(this.items[s.itemIndex]);
        const m = s.front.material;
        const first = !m.map;
        m.map = tex;
        m.emissiveMap = tex;
        if (first) m.needsUpdate = true;
      }

      rope.point(x, s.pivot.position);
      if (s.prevX === null || Math.abs(x - s.prevX) > L.span / 2) {
        s.prevX = x;
        s.vx = s.ax = 0;
      }
      const vx = (x - s.prevX) / dt;
      s.ax = lerp(s.ax, (vx - s.vx) / dt, 0.3);
      s.vx = lerp(s.vx, vx, 0.6);
      s.prevX = x;

      // 单摆：重力回正 + 挂点加速度带动 + 阻尼 + 风 + 呼吸般的轻微晃动
      const gust = wind * (0.7 + 0.3 * Math.sin(time * 1.3 + s.phase)) * (0.6 + 0.4 * Math.sin(time * 0.37 + x * 0.3));
      let acc =
        -34 * Math.sin(s.theta) -
        clamp((s.ax / L.pendulum) * 0.25, -35, 35) * Math.cos(s.theta) -
        2.6 * s.thetaV +
        gust * 5.5;
      if (!env.reduced) acc += Math.sin(time * 0.8 + s.phase) * 0.25;
      s.thetaV += (acc * dt) / s.mass;
      s.theta = clamp(s.theta + s.thetaV * dt, -1.2, 1.2);

      const twistAcc = -22 * s.twist - 2.2 * s.twistV + gust * Math.sin(time * 2.1 + s.phase) * 9;
      s.twistV += twistAcc * dt;
      s.twist = clamp(s.twist + s.twistV * dt, -1, 1);

      const tiltTarget = -Math.min(0.16, (Math.abs(s.vx) / L.cardW) * 0.018) - wind * 0.12;
      s.tiltV += ((tiltTarget - s.tilt) * 120 - s.tiltV * 14) * dt;
      s.tilt += s.tiltV * dt;

      // 入场：夹上去时弹一下
      const e = s.enter;
      if (e.s < 1 || Math.abs(e.v) > 0.001) {
        e.delay -= dt;
        if (e.delay <= 0) {
          if (!e.fired) {
            e.fired = true;
            if (Math.abs(x) < L.halfW * 1.1) this.onClipOn?.(s);
          }
          e.v += (150 * (1 - e.s) - 12 * e.v) * dt;
          e.s += e.v * dt;
          if (Math.abs(1 - e.s) < 0.001 && Math.abs(e.v) < 0.01) {
            e.s = 1;
            e.v = 0;
          }
        }
      }

      const hidden = this.hiddenG !== null && g === this.hiddenG;
      s.front.visible = s.back.visible = s.shadow.visible = !hidden;
      s.hang.scale.setScalar(L.cardW * Math.max(0.0001, e.s));
      s.hang.rotation.set(s.tilt, s.twist, s.theta + rope.slope(x) * 0.4);
      s.body.position.y = s.drop.y;
      s.body.rotation.z = s.drop.rot;
      s.shadow.position.x = 0.07 - s.theta * 0.08;

      const attached = !hidden && s.drop.y > -0.05 && e.s > 0.3;
      if (attached) rope.addForce(rope.fy, x, -L.cardH * 12 * s.mass);
      rope.addForce(rope.fz, x, -speed * 0.5 - gust * 1.5);

      s.front.material.emissiveIntensity = night * 0.1;
    }

    this.shadowMat.opacity = lerp(0.3, 0.12, night);
    rope.balance();
  }

  /* ---------------------------------------------------------- 拾取 & 屏幕坐标 */

  pick(raycaster) {
    const meshes = this.slots.filter((s) => s.front.visible && s.enter.s > 0.5 && !this.swap).map((s) => s.front);
    const hit = raycaster.intersectObjects(meshes, false)[0];
    return hit ? this.slots[hit.object.userData.slot] : null;
  }

  slotForG(g) {
    return this.slots.find((s) => s.g === g) || null;
  }

  screenInfo(slot) {
    const f = slot.front;
    f.updateWorldMatrix(true, false);
    const c = this.stage.project(_v.set(0, 0, 0).applyMatrix4(f.matrixWorld));
    const tl = this.stage.project(_v.set(-0.5, CARD_RATIO / 2, 0).applyMatrix4(f.matrixWorld));
    const tr = this.stage.project(_v.set(0.5, CARD_RATIO / 2, 0).applyMatrix4(f.matrixWorld));
    return {
      cx: c.x,
      cy: c.y,
      w: Math.hypot(tr.x - tl.x, tr.y - tl.y),
      angle: Math.atan2(tr.y - tl.y, tr.x - tl.x),
    };
  }
}

const _v = new THREE.Vector3();
