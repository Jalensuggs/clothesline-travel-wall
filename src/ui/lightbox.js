import { drawPostmark, makePostcardExport, makeStamp } from "../art/cardArt.js";
import { formatCoord, formatDate, prefersReducedMotion } from "../lib/util.js";
import { sound } from "../lib/sound.js";

/**
 * 灯箱：照片从绳子上「摘下来」飞到屏幕中央（FLIP 动画），
 * 可以翻到背面看明信片、写游记、左右切换，关闭时再飞回绳子上的夹子。
 */
export class Lightbox {
  constructor(root, deps) {
    this.root = root;
    this.deps = deps;
    this.card = root.querySelector("#lbCard");
    this.front = root.querySelector(".lb-front");
    this.back = root.querySelector(".lb-back");
    this.backdrop = root.querySelector(".lb-backdrop");
    this.bar = root.querySelector(".lb-bar");
    this.navs = root.querySelectorAll(".lb-nav");
    this.flipBtn = root.querySelector('[data-lb="flip"]');
    this.deleteBtn = root.querySelector('[data-lb="delete"]');
    this.isOpen = false;
    this.busy = false;

    root.addEventListener("click", (e) => {
      if (e.target.closest("[data-close]")) return this.close();
      const nav = e.target.closest("[data-nav]");
      if (nav) return this.nav(+nav.dataset.nav);
      const act = e.target.closest("[data-lb]")?.dataset.lb;
      if (act === "flip") this.flip();
      if (act === "export") this.export();
      if (act === "close") this.close();
      if (act === "delete") this.remove();
    });
    this.card.addEventListener("click", (e) => {
      if (!e.target.closest("[contenteditable]")) this.flip();
    });
  }

  get item() {
    return this.deps.getItem(this.g);
  }

  /* ------------------------------------------------------------ 内容 */

  render() {
    const item = this.item;
    this.front.innerHTML = "";
    const hi = this.deps.bank.hiRes(item, 1000);
    this.front.appendChild(hi);

    const { index, total } = this.deps.position(this.g);
    this.root.querySelector("#lbCount").textContent = `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
    this.root.querySelector("#lbTitle").textContent = item.place || "";
    this.deleteBtn.hidden = !item.blob;
    this.navs.forEach((n) => (n.hidden = total < 2));

    this.back.innerHTML = "";
    this.back.classList.remove("home");
    const head = document.createElement("div");
    head.className = "pc-head";
    const label = document.createElement("div");
    label.className = "pc-label";
    const home = item.kind === "ticket" && item.trip.home;
    label.innerHTML = home ? "HOMETOWN<small>故乡</small>" : item.kind === "ticket" ? "ITINERARY<small>行程单</small>" : "POST CARD<small></small>";
    if (item.kind !== "ticket") label.querySelector("small").textContent = item.area || item.country || "";
    const stamp = document.createElement("div");
    stamp.className = "pc-stamp";
    stamp.appendChild(makeStamp(item, 200, this.deps.bank.image(item)));
    const pm = document.createElement("canvas");
    pm.className = "pc-postmark";
    pm.width = 600;
    pm.height = 300;
    drawPostmark(
      pm.getContext("2d"),
      150,
      150,
      105,
      {
        top: item.en || item.place || "TRAVEL",
        mid: home ? item.trip.codes[0] : formatDate(item.date) || "—",
        bottom: home ? "羊城" : item.country || item.trip?.codes?.join(" → ") || "",
      },
      "rgba(40,60,120,.62)",
    );
    head.append(label, stamp, pm);

    const title = document.createElement("div");
    title.className = "pc-title";
    title.textContent = item.place || "";
    this.back.append(head, title);

    if (home) return this._renderHome(item);

    if (item.kind === "ticket") {
      const ul = document.createElement("ul");
      ul.className = "itinerary";
      item.trip.stops.forEach((s, i) => {
        const li = document.createElement("li");
        const a = document.createElement("span");
        a.textContent = `${i + 1}. ${s.place}`;
        const b = document.createElement("span");
        b.textContent = formatDate(s.date).slice(5);
        li.append(a, b);
        ul.appendChild(li);
      });
      const foot = document.createElement("div");
      foot.className = "pc-foot";
      foot.innerHTML = `<span></span><span></span>`;
      foot.children[0].textContent = `${item.stats.stops} stops · ${item.stats.km.toLocaleString()} km`;
      foot.children[1].textContent = item.stats.days ? `${item.stats.days} days` : item.stats.range;
      ul.style.flex = "1";
      this.back.append(ul, foot);
      return;
    }

    if (item.blob) {
      title.contentEditable = "true";
      title.spellcheck = false;
      title.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          title.blur();
        }
      });
      title.addEventListener("blur", () => {
        const text = title.textContent.trim() || "未命名的一站";
        if (text !== item.place) this.deps.onRename(item, text);
        this.root.querySelector("#lbTitle").textContent = text;
      });
    }

    const note = this._editableNote(item, item.prompt || "写点什么吧，会自动保存在这台设备上……");

    const foot = document.createElement("div");
    foot.className = "pc-foot";
    foot.innerHTML = "<span></span><span></span>";
    foot.children[0].textContent = formatCoord(item.lat, item.lon) || "坐标未知";
    foot.children[1].textContent = formatDate(item.date, " / ");
    this.back.append(note, foot);

    if (item.credit) {
      const credit = document.createElement("a");
      credit.className = "pc-credit";
      credit.href = item.credit.url;
      credit.target = "_blank";
      credit.rel = "noopener";
      credit.textContent = `Photo: ${item.credit.artist} · ${item.credit.license} · Wikimedia Commons`;
      this.back.append(credit);
    }
  }

  /** 故乡卡背面：一段可编辑的家乡介绍 + 求学路线 */
  _renderHome(item) {
    this.back.classList.add("home");
    const note = this._editableNote(item, "写写你眼中的广州……");
    const ul = document.createElement("ul");
    ul.className = "itinerary";
    item.trip.stops.forEach((s) => {
      const li = document.createElement("li");
      const a = document.createElement("span");
      a.textContent = `${s.stage ? s.stage + " · " : ""}${s.place}`;
      const b = document.createElement("span");
      b.textContent = s.area || s.country || "";
      li.append(a, b);
      ul.appendChild(li);
    });
    const foot = document.createElement("div");
    foot.className = "pc-foot";
    foot.innerHTML = "<span></span><span></span>";
    foot.children[0].textContent = formatCoord(item.trip.lat, item.trip.lon);
    foot.children[1].textContent = `${item.stats.km.toLocaleString()} km`;
    this.back.append(note, ul, foot);
  }

  _editableNote(item, placeholder) {
    const note = document.createElement("div");
    note.className = "pc-note";
    note.contentEditable = "true";
    note.spellcheck = false;
    note.dataset.placeholder = placeholder;
    note.textContent = this.deps.getNote(item);
    let timer = 0;
    note.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => this.deps.setNote(item, note.innerText.trim()), 350);
    });
    note.addEventListener("blur", () => this.deps.setNote(item, note.innerText.trim()));
    return note;
  }

  /* ------------------------------------------------------------ 动画 */

  _transformFrom(info) {
    const w = this.card.offsetWidth;
    const cx = this.card.offsetLeft + w / 2;
    const cy = this.card.offsetTop + this.card.offsetHeight / 2;
    return `translate(${info.cx - cx}px, ${info.cy - cy}px) rotate(${info.angle}rad) scale(${info.w / w})`;
  }

  open(g, info) {
    if (this.isOpen) return;
    this.isOpen = true;
    this.g = g;
    this.root.hidden = false;
    this._setFlipped(false, true);
    this.render();
    const quick = prefersReducedMotion();
    this.card.animate(
      [
        { transform: this._transformFrom(info) },
        { transform: `translate(0, -24px) rotate(${-info.angle * 0.4 - 0.03}rad) scale(1.02)`, offset: 0.65 },
        { transform: "none" },
      ],
      { duration: quick ? 1 : 760, easing: "cubic-bezier(.3,.8,.3,1)" },
    );
    this.backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 450 });
    for (const el of [this.bar, ...this.navs])
      el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 250, fill: "backwards" });
    sound.play("whoosh");
  }

  close() {
    if (!this.isOpen || this.busy) return;
    this.busy = true;
    document.activeElement?.blur?.();
    const info = this.deps.returnInfo(this.g);
    this._setFlipped(false);
    const to = info ? this._transformFrom(info) : "translate(0, -70vh) scale(.3)";
    const quick = prefersReducedMotion();
    const a = this.card.animate([{ transform: "none" }, { transform: to }], {
      duration: quick ? 1 : 560,
      easing: "cubic-bezier(.55,0,.25,1)",
      fill: "forwards",
    });
    this.backdrop.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 480, fill: "forwards" });
    for (const el of [this.bar, ...this.navs]) el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" });
    a.finished.then(() => {
      this.root.hidden = true;
      this.card.getAnimations().forEach((x) => x.cancel());
      this.backdrop.getAnimations().forEach((x) => x.cancel());
      [this.bar, ...this.navs].forEach((el) => el.getAnimations().forEach((x) => x.cancel()));
      this.isOpen = false;
      this.busy = false;
      this.deps.onClose(this.g);
    });
  }

  nav(dir) {
    if (!this.isOpen || this.busy) return;
    if (this.deps.position(this.g).total < 2) return;
    this.busy = true;
    document.activeElement?.blur?.();
    this.g += dir;
    if (this.item.kind === "empty") this.g += dir;
    this.deps.onNavigate(this.g);
    const out = this.card.animate(
      [{ transform: "none", opacity: 1 }, { transform: `translateX(${-dir * 90}px) rotate(${-dir * 5}deg)`, opacity: 0 }],
      { duration: 200, easing: "ease-in", fill: "forwards" },
    );
    out.finished.then(() => {
      this._setFlipped(false, true);
      this.render();
      out.cancel();
      this.card.animate(
        [{ transform: `translateX(${dir * 90}px) rotate(${dir * 5}deg)`, opacity: 0 }, { transform: "none", opacity: 1 }],
        { duration: 420, easing: "cubic-bezier(.2,.9,.3,1.15)" },
      );
      this.busy = false;
    });
    sound.play("flip");
  }

  _setFlipped(v, instant = false) {
    this.flipped = v;
    const f = this.card.querySelector(".lb-flipper");
    if (instant) f.style.transition = "none";
    this.card.classList.toggle("flipped", v);
    if (instant) {
      f.offsetWidth;
      f.style.transition = "";
    }
    this.flipBtn.innerHTML = `<kbd>F</kbd> ${v ? "翻到正面" : "翻到背面"}`;
  }

  flip() {
    if (!this.isOpen) return;
    this._setFlipped(!this.flipped);
    sound.play("flip");
  }

  async export() {
    const item = this.item;
    const note =
      item.kind === "ticket" && !item.trip.home
        ? item.trip.stops.map((s, i) => `${i + 1}. ${s.place}  ${formatDate(s.date).slice(5)}`).join("\n")
        : this.deps.getNote(item);
    try {
      await document.fonts.load('64px "Long Cang"', note + item.place);
    } catch {}
    const cv = makePostcardExport(item, this.deps.bank.hiRes(item, 900), note, this.deps.bank.image(item));
    cv.toBlob((blob) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${item.place || "travel"}-明信片.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 3000);
      this.deps.toast("明信片已导出 ✉️");
    }, "image/png");
  }

  async remove() {
    const item = this.item;
    if (!item.blob) return;
    if (!confirm(`把「${item.place}」从绳子上取下来？照片会从这台设备删除。`)) return;
    this.root.hidden = true;
    this.isOpen = false;
    this.busy = false;
    this.card.getAnimations().forEach((x) => x.cancel());
    await this.deps.onDelete(item);
  }

  handleKey(e) {
    if (!this.isOpen) return false;
    const editing = e.target.isContentEditable;
    if (e.key === "Escape") {
      if (editing) e.target.blur();
      else this.close();
      return true;
    }
    if (editing) return true;
    if (e.key === "ArrowLeft") this.nav(-1);
    else if (e.key === "ArrowRight") this.nav(1);
    else if (e.key === "f" || e.key === "F" || e.key === " ") {
      e.preventDefault();
      this.flip();
    }
    return true;
  }
}
