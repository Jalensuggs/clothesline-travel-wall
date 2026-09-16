import exifr from "exifr";

/**
 * 拖入 / 选择照片：读取 EXIF 里的拍摄时间和 GPS，压缩到合适尺寸后交给回调。
 */
export function setupUploader({ dropzone, input, onPhotos, toast }) {
  let depth = 0;
  const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes("Files");

  window.addEventListener("dragenter", (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth++;
    dropzone.hidden = false;
  });
  window.addEventListener("dragover", (e) => {
    if (hasFiles(e)) e.preventDefault();
  });
  window.addEventListener("dragleave", (e) => {
    if (!hasFiles(e)) return;
    depth = Math.max(0, depth - 1);
    if (!depth) dropzone.hidden = true;
  });
  window.addEventListener("drop", (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth = 0;
    dropzone.hidden = true;
    handle(e.dataTransfer.files);
  });
  input.addEventListener("change", () => {
    handle(input.files);
    input.value = "";
  });

  async function handle(fileList) {
    const files = [...fileList].filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    if (!files.length) return toast("没有找到图片文件");
    toast(`正在冲洗 ${files.length} 张照片……`);
    const photos = [];
    for (const file of files) {
      try {
        photos.push(await readPhoto(file));
      } catch {
        toast(`「${file.name}」读取失败，浏览器可能不支持这种格式`);
      }
    }
    if (photos.length) onPhotos(photos);
  }
}

async function readPhoto(file) {
  let meta = null;
  try {
    meta = await exifr.parse(file, { gps: true, pick: ["DateTimeOriginal", "CreateDate", "latitude", "longitude"] });
  } catch {}
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const max = 1600;
  const s = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const cv = document.createElement("canvas");
  cv.width = Math.round(bitmap.width * s);
  cv.height = Math.round(bitmap.height * s);
  cv.getContext("2d").drawImage(bitmap, 0, 0, cv.width, cv.height);
  bitmap.close?.();
  const blob = await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.88));

  const d = meta?.DateTimeOriginal || meta?.CreateDate || (file.lastModified ? new Date(file.lastModified) : new Date());
  const date = d instanceof Date && !isNaN(d) ? toLocalISO(d) : toLocalISO(new Date());
  const base = file.name.replace(/\.[^.]+$/, "");
  const place = /^(img|dsc|dscf|pxl|p\d|photo|image|wechat|mmexport|\d{6,})/i.test(base) ? "未命名的一站" : base.slice(0, 14);

  return {
    id: `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    kind: "photo",
    place,
    en: "",
    country: "",
    lat: Number.isFinite(meta?.latitude) ? meta.latitude : null,
    lon: Number.isFinite(meta?.longitude) ? meta.longitude : null,
    date,
    tags: ["我的"],
    note: "",
    blob,
    added: Date.now(),
  };
}

function toLocalISO(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
