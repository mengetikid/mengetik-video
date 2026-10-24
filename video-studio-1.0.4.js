/*! Video Studio by Mengetik.id v1.0.4 | https://www.mengetik.id/p/video-studio.html */
(function(){
"use strict";
if (window.__VS_LOADED) return; window.__VS_LOADED = 1;
/* ---- b-core.js ---- */
/* ================= VIDEO STUDIO MENGETIK.ID - INTI ================= */
const VS_VER = '1.0.4';
const LIB = {
  mp4box: 'https://cdn.jsdelivr.net/npm/mp4box@0.5.2/dist/mp4box.all.min.js',
  muxer: 'https://cdn.jsdelivr.net/npm/mp4-muxer@5.2.1/build/mp4-muxer.js'
};
const A = document.getElementById('vs-app');
const $ = (s, r) => (r || A).querySelector(s);
const $$ = (s, r) => Array.from((r || A).querySelectorAll(s));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const raf = () => new Promise(r => requestAnimationFrame(r));
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
const deep = o => JSON.parse(JSON.stringify(o));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const COARSE = () => matchMedia('(pointer:coarse)').matches;
const NARROW = () => A.clientWidth < 860;
function h(tag, attrs, html) {
  const e = document.createElement(tag);
  if (attrs) for (const k in attrs) { if (k === 'class') e.className = attrs[k]; else if (k === 'style') e.style.cssText = attrs[k]; else e.setAttribute(k, attrs[k]); }
  if (html != null) e.innerHTML = html;
  return e;
}
function fmtTime(t, fps) {
  t = Math.max(0, t || 0);
  const m = Math.floor(t / 60), s = Math.floor(t % 60), f = Math.floor((t % 1) * (fps || 30) + 1e-6);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + (fps ? ':' + String(f).padStart(2, '0') : '');
}
function fmtDur(t) { t = Math.max(0, t || 0); return t < 60 ? (Math.round(t * 10) / 10).toString().replace('.', ',') + ' dtk' : fmtTime(t); }
function fmtSize(n) { return n >= 1073741824 ? (n / 1073741824).toFixed(2).replace('.', ',') + ' GB' : n >= 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
function fmtNum(v, d) { return (Math.round(v * Math.pow(10, d || 0)) / Math.pow(10, d || 0)).toString().replace('.', ','); }
let toastT = 0;
function toast(msg, bad) {
  const t = $('#vs-toast'); if (!t) return;
  t.textContent = msg; t.classList.toggle('bad', !!bad); t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), bad ? 5200 : 2800);
}
const libP = {};
function loadScript(url, globalName) {
  if (globalName && window[globalName]) return Promise.resolve(window[globalName]);
  if (libP[url]) return libP[url];
  return (libP[url] = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = url; s.async = true; s.crossOrigin = 'anonymous';
    s.onload = () => res(globalName ? window[globalName] : true);
    s.onerror = () => { delete libP[url]; rej(new Error('Gagal memuat pustaka. Periksa koneksi internet.')); };
    document.head.appendChild(s);
  }));
}
/* ---------- penyimpanan IndexedDB ---------- */
const DB = (() => {
  let p = null;
  const open = () => p || (p = new Promise((res, rej) => {
    if (!window.indexedDB) return rej(new Error('IndexedDB tidak tersedia'));
    const r = indexedDB.open('mengetik-video-studio', 1);
    r.onupgradeneeded = () => { const d = r.result; ['kv', 'media', 'fonts', 'luts'].forEach(n => { if (!d.objectStoreNames.contains(n)) d.createObjectStore(n); }); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const run = (store, mode, fn) => open().then(d => new Promise((res, rej) => {
    const t = d.transaction(store, mode), q = fn(t.objectStore(store));
    t.oncomplete = () => res(q && q.result); t.onerror = t.onabort = () => rej(t.error || new Error('db'));
  }));
  return {
    get: (s, k) => run(s, 'readonly', o => o.get(k)),
    set: (s, k, v) => run(s, 'readwrite', o => o.put(v, k)),
    del: (s, k) => run(s, 'readwrite', o => o.delete(k)),
    keys: s => run(s, 'readonly', o => o.getAllKeys()),
    all: s => run(s, 'readonly', o => o.getAll())
  };
})();
const withTimeout = (p, ms, msg) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(msg || 'Waktu habis')), ms))]);
/* ---------- event kecil ---------- */
const BUS = { m: {}, on(n, f) { (this.m[n] = this.m[n] || []).push(f); }, emit(n, a) { (this.m[n] || []).forEach(f => { try { f(a); } catch (e) { console.error(e); } }); } };
/* ---------- slider sentuh: geser horizontal di mana saja pada jalur slider (tidak meloncat), geser vertikal = gulir ---------- */
function fillRange(r) {
  const mn = +r.min, mx = +r.max, v = +r.value, f = (v - mn) / ((mx - mn) || 1), z = mn < 0 && mx > 0 ? -mn / (mx - mn) : 0;
  r.style.setProperty('--f0', (Math.min(f, z) * 100).toFixed(2) + '%'); r.style.setProperty('--f1', (Math.max(f, z) * 100).toFixed(2) + '%');
}
function bindTouchSliders(root) {
  let T = null;
  root.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse') return;
    const row = e.target.closest && e.target.closest('.vs-sl'); if (!row) return;
    if (e.target.closest('input[type=number],button,select,textarea,.vs-jog,canvas')) return;
    const r = row.querySelector('input[type=range]'); if (!r || r.disabled) return;
    const rc = r.getBoundingClientRect();
    if (e.clientX < rc.left - 24 || e.clientX > rc.right + 24) return;
    T = { r, row, id: e.pointerId, x: e.clientX, y: e.clientY, v0: +r.value, min: +r.min, max: +r.max, step: +r.step || 0.01, w: Math.max(60, rc.width), on: false, dead: false };
  }, true);
  root.addEventListener('pointermove', e => {
    if (!T || e.pointerId !== T.id || T.dead) return;
    const dx = e.clientX - T.x, dy = e.clientY - T.y;
    if (!T.on) {
      if (Math.abs(dy) > 7 && Math.abs(dy) > Math.abs(dx)) { T.dead = true; return; }
      if (Math.abs(dx) < 5) return;
      T.on = true; T.x = e.clientX; T.r.classList.add('vs-touch'); try { T.row.setPointerCapture(e.pointerId); } catch (er) {}
      return;
    }
    e.preventDefault();
    /* gerakan pelan = lebih presisi */
    const sp = Math.abs(e.movementX || 0), k = sp < 2 ? 0.45 : sp < 6 ? 0.75 : 1;
    T.acc = (T.acc || 0) + (e.clientX - (T.lx == null ? T.x : T.lx)) * k; T.lx = e.clientX;
    let v = T.v0 + T.acc / T.w * (T.max - T.min); v = Math.round((v - T.min) / T.step) * T.step + T.min; v = clamp(v, T.min, T.max);
    const z = T.min < 0 && T.max > 0 ? 0 : null; if (z != null && Math.abs(v - z) < (T.max - T.min) * 0.008) v = z;
    if (+T.r.value !== v) { T.r.value = v; fillRange(T.r); T.r.dispatchEvent(new Event('input', { bubbles: true })); }
  }, { passive: false, capture: true });
  const end = e => {
    if (!T || e.pointerId !== T.id) return; const t = T; T = null; if (t.dead) return; t.r.classList.remove('vs-touch');
    if (t.on && +t.r.value !== t.v0) t.r.dispatchEvent(new Event('change', { bubbles: true }));
  };
  root.addEventListener('pointerup', end, true); root.addEventListener('pointercancel', end, true);
  root.addEventListener('input', e => { if (e.target.type === 'range') fillRange(e.target); }, true);
}
/* ---------- ikon ---------- */
const IC = {
  play: '<path d="M5 3l9 5-9 5z" fill="currentColor"/>', pause: '<path d="M5 3v10M11 3v10" stroke-width="2.4"/>',
  undo: '<path d="M4 6h6a3.5 3.5 0 0 1 0 7H6"/><path d="M6.5 3.5L4 6l2.5 2.5"/>', redo: '<path d="M12 6H6a3.5 3.5 0 0 0 0 7h4"/><path d="M9.5 3.5L12 6 9.5 8.5"/>',
  split: '<path d="M8 1.5v13"/><path d="M5 4L2.5 8 5 12M11 4l2.5 4L11 12"/>', del: '<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 9h5.6l.7-9"/>',
  dup: '<rect x="5" y="5" width="8.5" height="8.5" rx="1.5"/><path d="M3 10.5V3.5A1 1 0 0 1 4 2.5h7"/>', key: '<path d="M8 2.5l5.5 5.5L8 13.5 2.5 8z"/>',
  media: '<rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M6.5 6v4l3.5-2z" fill="currentColor"/>', text: '<path d="M3 4V3h10v1M8 3v10M6 13h4"/>',
  fx: '<path d="M8 1.8l1.6 3.4 3.7.5-2.7 2.6.7 3.7L8 10.2 4.7 12l.7-3.7L2.7 5.7l3.7-.5z"/>', tr: '<rect x="1.5" y="4" width="6" height="8" rx="1"/><rect x="8.5" y="4" width="6" height="8" rx="1" stroke-dasharray="2 1.5"/>',
  audio: '<path d="M6 12.5V4l7-1.5v8.5"/><circle cx="4.5" cy="12.5" r="1.6"/><circle cx="11.5" cy="11" r="1.6"/>', color: '<circle cx="8" cy="8" r="6"/><path d="M8 2v12M2.8 5l10.4 6M2.8 11L13.2 5" stroke-width="1.1"/>',
  canvas: '<rect x="2" y="2.5" width="12" height="11" rx="1.5"/><path d="M5 2.5v11M2 6h3"/>', speed: '<path d="M2.5 11a5.5 5.5 0 1 1 11 0"/><path d="M8 11l3-4"/>',
  freeze: '<path d="M8 1.5v13M2.5 4.8l11 6.4M2.5 11.2l11-6.4"/>', detach: '<path d="M2 5h5M2 11h5M10 4l4 4-4 4"/>', export: '<path d="M8 10V2.5M5 5.5L8 2.5l3 3M3 10.5v3h10v-3"/>',
  folder: '<path d="M2 4.5V12a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1H8L6.5 3.5H3a1 1 0 0 0-1 1z"/>', plus: '<path d="M8 3v10M3 8h10"/>', x: '<path d="M4 4l8 8M12 4l-8 8"/>',
  full: '<path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10"/>', mute: '<path d="M3 6h2.5L9 3v10L5.5 10H3z"/><path d="M11.5 6l3 4M14.5 6l-3 4"/>', vol: '<path d="M3 6h2.5L9 3v10L5.5 10H3z"/><path d="M11.5 5.5a3.5 3.5 0 0 1 0 5"/>',
  eye: '<path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/>', eyeoff: '<path d="M2 2l12 12M6.5 4a6.5 6.5 0 0 1 8 4 8 8 0 0 1-1.8 2.3M9.4 12.3A6.5 6.5 0 0 1 1.5 8 8 8 0 0 1 4 5"/>',
  lock: '<rect x="3.5" y="7" width="9" height="6.5" rx="1"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/>', unlock: '<rect x="3.5" y="7" width="9" height="6.5" rx="1"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5-.5"/>',
  magnet: '<path d="M3.5 2.5v6a4.5 4.5 0 0 0 9 0v-6h-3v6a1.5 1.5 0 0 1-3 0v-6z"/>', zin: '<circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14M5 7h4M7 5v4"/>', zout: '<circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14M5 7h4"/>', insp: '<path d="M2.5 5.5v-3h3M10.5 2.5h3v3M13.5 10.5v3h-3M5.5 13.5h-3v-3"/><circle cx="7.5" cy="7.5" r="2.6"/><path d="M9.4 9.4l2 2"/>', drop2: '<path d="M8 2.5s4 4.2 4 7a4 4 0 0 1-8 0c0-2.8 4-7 4-7z"/>', save: '<path d="M8 2.5v8M4.5 7L8 10.5 11.5 7M3 13.5h10"/>',
  back: '<path d="M10 3L5 8l5 5"/>', next: '<path d="M6 3l5 5-5 5"/>', start: '<path d="M4 3v10M12 3L6 8l6 5z"/>', end: '<path d="M12 3v10M4 3l6 5-6 5z"/>',
  drop: '<path d="M8 2s4.5 4.6 4.5 7.5a4.5 4.5 0 0 1-9 0C3.5 6.6 8 2 8 2z"/>', copy: '<rect x="5" y="5" width="8.5" height="8.5" rx="1.5"/><path d="M3 10.5V3.5A1 1 0 0 1 4 2.5h7"/>', paste: '<rect x="3" y="3" width="10" height="11" rx="1.5"/><path d="M6 2h4v2.5H6z"/>',
  reset: '<path d="M3 8a5 5 0 1 0 1.5-3.6"/><path d="M3 2.5v3h3"/>', check: '<path d="M3 8.5l3 3 7-7"/>', menu: '<path d="M2.5 4h11M2.5 8h11M2.5 12h11"/>', crop: '<path d="M4 1.5V12h10.5M1.5 4H12v10.5"/>',
  font: '<path d="M2.5 13L6.5 3h1l4 10M4 9.5h6"/><path d="M12 9.5v3.5"/>', lut: '<rect x="2" y="2" width="5" height="5"/><rect x="9" y="2" width="5" height="5"/><rect x="2" y="9" width="5" height="5"/><rect x="9" y="9" width="5" height="5"/>',
  pick: '<path d="M11 2l3 3-6.5 6.5-3 .5.5-3z"/><path d="M2 14l2.5-2.5"/>', node: '<circle cx="4" cy="8" r="2"/><circle cx="12" cy="4" r="2"/><circle cx="12" cy="12" r="2"/><path d="M6 8l4-3.5M6 8l4 3.5"/>'
};
const ico = (k, cls) => '<svg viewBox="0 0 16 16"' + (cls ? ' class="' + cls + '"' : '') + '>' + (IC[k] || '') + '</svg>';

/* ---- c-media.js ---- */
/* ================= MEDIA: impor ukuran berapa pun, baca MP4/MOV bertahap ================= */
const FILES = {};   /* id -> File/Blob */
const URLS = {};    /* id -> objectURL */
const MP4 = {};     /* id -> hasil parse (tabel sampel) */
const IMGS = {};    /* id -> ImageBitmap/canvas untuk gambar */
const STORE_MAX = 300 * 1048576;
function mediaKind(f) {
  const t = (f.type || '').toLowerCase(), n = (f.name || '').toLowerCase();
  if (/^video\//.test(t) || /\.(mp4|mov|m4v|webm|mkv|avi|3gp|mts|m2ts)$/.test(n)) return 'video';
  if (/^audio\//.test(t) || /\.(mp3|wav|m4a|aac|ogg|oga|opus|flac|wma|aiff?)$/.test(n)) return 'audio';
  if (/^image\//.test(t) || /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif|dpx)$/.test(n)) return 'image';
  return '';
}
function urlOf(id) { if (Array.isArray(FILES[id])) return ''; if (!URLS[id] && FILES[id]) URLS[id] = URL.createObjectURL(FILES[id]); return URLS[id]; }
function mediaById(id) { return P && P.media.find(m => m.id === id); }
/* ---------- baca kotak atas MP4/MOV tanpa memuat seluruh file ---------- */
async function readBoxes(file) {
  const out = []; let off = 0, guard = 0; const N = file.size;
  while (off + 8 <= N && guard++ < 100000) {
    const dv = new DataView(await file.slice(off, Math.min(N, off + 16)).arrayBuffer());
    let size = dv.getUint32(0), hdr = 8;
    const type = String.fromCharCode(dv.getUint8(4), dv.getUint8(5), dv.getUint8(6), dv.getUint8(7));
    if (size === 1) { if (dv.byteLength < 16) break; size = Number(dv.getBigUint64(8)); hdr = 16; } else if (size === 0) size = N - off;
    if (size < 8 || !/^[\x20-\x7e]{4}$/.test(type)) break;
    out.push({ type, off, size, hdr });
    off += size;
  }
  return out;
}
async function parseMP4(file) {
  const boxes = await readBoxes(file);
  if (!boxes.length || !boxes.find(b => b.type === 'ftyp' || b.type === 'moov' || b.type === 'wide' || b.type === 'mdat')) return null;
  const moov = boxes.find(b => b.type === 'moov');
  if (!moov) return null;
  if (boxes.find(b => b.type === 'moof')) return null; /* MP4 terfragmentasi: pakai jalur cadangan */
  if (moov.size > 400 * 1048576) return null;
  await loadScript(LIB.mp4box, 'MP4Box');
  const mp = MP4Box.createFile(false);
  let info = null, err = null;
  mp.onReady = i => { info = i; }; mp.onError = e => { err = e; };
  const add = async b => { const buf = await file.slice(b.off, b.off + b.size).arrayBuffer(); buf.fileStart = b.off; mp.appendBuffer(buf); };
  for (const b of boxes) {
    if (b.type === 'ftyp' || b.type === 'moov' || (b.type !== 'mdat' && b.size <= 1048576)) await add(b);
    else { const buf = await file.slice(b.off, b.off + Math.min(b.size, 16)).arrayBuffer(); buf.fileStart = b.off; mp.appendBuffer(buf); }
    if (b.type === 'moov') break;
  }
  mp.flush();
  if (!info || err) return null;
  const res = { v: null, a: null, dur: info.duration / info.timescale || 0 };
  const vt = info.videoTracks && info.videoTracks[0], at = info.audioTracks && info.audioTracks[0];
  const pack = (tinfo) => {
    const trak = mp.getTrackById(tinfo.id), S = trak.samples || [], n = S.length, ts = tinfo.timescale;
    if (!n) return null;
    const o = { id: tinfo.id, codec: tinfo.codec, ts, n, off: new Float64Array(n), size: new Uint32Array(n), cts: new Float64Array(n), dts: new Float64Array(n), dur: new Float64Array(n), sync: new Uint8Array(n), trak };
    let shift = 0;
    try { const el = trak.edts && trak.edts.elst && trak.edts.elst.entries; if (el && el.length) { const e = el.find(x => x.media_time >= 0); if (e) shift = e.media_time / ts; } } catch (e) {}
    let minC = Infinity;
    for (let i = 0; i < n; i++) { const s = S[i]; o.off[i] = s.offset; o.size[i] = s.size; o.cts[i] = s.cts / ts; o.dts[i] = s.dts / ts; o.dur[i] = s.duration / ts; o.sync[i] = s.is_sync ? 1 : 0; if (o.cts[i] < minC) minC = o.cts[i]; }
    if (!shift) shift = minC > 0 && minC < 1 ? minC : 0;
    for (let i = 0; i < n; i++) { o.cts[i] -= shift; o.dts[i] -= shift; }
    /* urutan tampilan untuk pencarian */
    const ord = Array.from({ length: n }, (_, i) => i).sort((a, b) => o.cts[a] - o.cts[b]);
    o.ord = Uint32Array.from(ord);
    return o;
  };
  if (vt) {
    const v = pack(vt); if (v) {
      const entry = v.trak.mdia.minf.stbl.stsd.entries[0];
      v.w = vt.video ? vt.video.width : vt.track_width; v.h = vt.video ? vt.video.height : vt.track_height;
      const box = entry.avcC || entry.hvcC || entry.av1C;
      if (box && /^(avc|hvc|hev|av01)/.test(v.codec)) { try { const s = new DataStream(undefined, 0, DataStream.BIG_ENDIAN); box.write(s); v.desc = new Uint8Array(s.buffer, 8); } catch (e) {} }
      let rot = 0; try { const m = vt.matrix; if (m) { const a = m[0] / 65536, b = m[1] / 65536; rot = Math.round(Math.atan2(b, a) * 180 / Math.PI); rot = ((rot % 360) + 360) % 360; } } catch (e) {}
      v.rot = rot;
      v.fps = v.n > 1 ? Math.round(v.n / Math.max(0.001, (v.cts[v.ord[v.n - 1]] - v.cts[v.ord[0]] + v.dur[v.n - 1])) * 1000) / 1000 : 30;
      res.v = v;
    }
  }
  if (at) {
    const a = pack(at); if (a) {
      const entry = a.trak.mdia.minf.stbl.stsd.entries[0];
      a.sr = at.audio ? at.audio.sample_rate : (entry.getSampleRate ? entry.getSampleRate() : 48000);
      a.ch = at.audio ? at.audio.channel_count : (entry.getChannelCount ? entry.getChannelCount() : 2);
      try {
        if (entry.esds && entry.esds.esd) { const d = entry.esds.esd.descs[0].descs[0]; if (d && d.data) a.desc = new Uint8Array(d.data); }
        else if (entry.dOps) { const o = entry.dOps, b = new Uint8Array(19), dv = new DataView(b.buffer); b.set([79, 112, 117, 115, 72, 101, 97, 100]); b[8] = 1; b[9] = o.OutputChannelCount || a.ch; dv.setUint16(10, o.PreSkip || 0, true); dv.setUint32(12, o.InputSampleRate || a.sr, true); dv.setInt16(16, o.OutputGain || 0, true); b[18] = 0; a.desc = b; a.sr = 48000; }
      } catch (e) {}
      if (/^opus|^Opus/.test(a.codec)) a.codec = 'opus';
      res.a = a;
    }
  }
  return res;
}
/* ---------- pembaca blok file (untuk sampel) ---------- */
class BlockReader {
  constructor(file) { this.f = file; this.bs = 4 * 1048576; this.cache = new Map(); }
  async block(i) {
    if (this.cache.has(i)) { const b = this.cache.get(i); this.cache.delete(i); this.cache.set(i, b); return b; }
    const b = new Uint8Array(await this.f.slice(i * this.bs, Math.min(this.f.size, (i + 1) * this.bs)).arrayBuffer());
    this.cache.set(i, b); if (this.cache.size > 6) this.cache.delete(this.cache.keys().next().value);
    return b;
  }
  async read(off, size) {
    const i0 = Math.floor(off / this.bs), i1 = Math.floor((off + size - 1) / this.bs);
    if (size > this.bs) return new Uint8Array(await this.f.slice(off, off + size).arrayBuffer());
    if (i0 === i1) { const b = await this.block(i0), s = off - i0 * this.bs; return b.subarray(s, s + size); }
    const out = new Uint8Array(size), a = await this.block(i0), b = await this.block(i1), s = off - i0 * this.bs, na = a.length - s;
    out.set(a.subarray(s), 0); out.set(b.subarray(0, size - na), na); return out;
  }
}
/* ---------- muat elemen video/audio untuk metadata ---------- */
function probeEl(kind, url) {
  return new Promise((res, rej) => {
    const el = document.createElement(kind === 'audio' ? 'audio' : 'video');
    el.preload = 'metadata'; el.muted = true; el.playsInline = true; el.setAttribute('playsinline', '');
    const t = setTimeout(() => { done(); rej(new Error('Waktu habis membaca file')); }, 45000);
    const done = () => { clearTimeout(t); el.onloadedmetadata = el.onerror = null; };
    el.onloadedmetadata = () => {
      const fin = () => { done(); res({ dur: el.duration, w: el.videoWidth || 0, h: el.videoHeight || 0, el }); };
      if (!isFinite(el.duration)) { el.ondurationchange = () => { if (isFinite(el.duration)) { el.ondurationchange = null; fin(); } }; el.currentTime = 1e9; setTimeout(fin, 4000); } else fin();
    };
    el.onerror = () => { done(); rej(new Error('fmt')); };
    el.src = url;
  });
}
/* ---------- gambar: perkecil aman (iOS) ---------- */
async function loadImageSrc(file) {
  const u = URL.createObjectURL(file);
  try {
    const im = await new Promise((res, rej) => { const i = new Image(); const t = setTimeout(() => rej(new Error('Waktu habis')), 60000); i.onload = () => { clearTimeout(t); res(i); }; i.onerror = () => { clearTimeout(t); rej(new Error('Format gambar tidak didukung')); }; i.decoding = 'async'; i.src = u; });
    let w = im.naturalWidth, h = im.naturalHeight; const k = Math.min(1, 4096 / Math.max(w, h), Math.sqrt(16e6 / (w * h)));
    let src = im, cw = w, ch = h; const tw = Math.max(1, Math.round(w * k)), th = Math.max(1, Math.round(h * k));
    while (cw > tw * 2 || ch > th * 2) {
      const nw = Math.max(tw, Math.round(cw / 2)), nh = Math.max(th, Math.round(ch / 2)); const c = document.createElement('canvas'); c.width = nw; c.height = nh;
      const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, nw, nh); src = c; cw = nw; ch = nh;
    }
    const c = document.createElement('canvas'); c.width = tw; c.height = th; const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, tw, th);
    return { canvas: c, w: tw, h: th };
  } finally { URL.revokeObjectURL(u); }
}
/* ---------- impor ---------- */
async function importFiles(list, opts) {
  list = Array.from(list || []);
  const dr = list.filter(f => isDRX(f)); if (dr.length) { importDavinci(dr.length && list.some(isDPX) ? dr.concat(list.filter(f => isDPX(f) && dr.some(x => x.name.replace(/\.drx$/i, '').toLowerCase() === f.name.replace(/\.dpx$/i, '').toLowerCase()))) : dr, 'exact'); if (0) importDavinci(dr.concat(list.filter(f => isDPX(f) && dr.some(x => x.name.replace(/\.drx$/i, '').toLowerCase() === f.name.replace(/\.dpx$/i, '').toLowerCase())))); list = list.filter(f => !isDRX(f)); if (!list.length) return []; }
  const seqAdded = [];
  { const dp = list.filter(f => isDPX(f)); if (dp.length > 1) { const gr = groupDPX(dp); if (gr.seqs.length) { list = list.filter(f => !isDPX(f)).concat(gr.singles); for (const g of gr.seqs) { setBusy('Membaca sekuens DPX ' + g.name + ' (' + g.files.length + ' bingkai)'); try { seqAdded.push(await addDPXSequence(g)); } catch (e) { console.error(e); toast('Sekuens DPX ' + g.name + ': ' + e.message, true); } } setBusy(null); if (!list.length) { if (seqAdded.length) { renderMedia(); commit('Impor sekuens DPX'); toast(seqAdded.length + ' sekuens DPX diimpor sebagai klip video (10-bit penuh)'); if (opts && opts.toTimeline) seqAdded.forEach(m => addMediaToTimeline(m)); } return seqAdded; } } } }
  list = list.filter(f => mediaKind(f));
  if (!list.length) { if (seqAdded.length) { renderMedia(); commit('Impor sekuens DPX'); return seqAdded; } toast('Format file tidak dikenali. Gunakan video, audio, atau gambar.', true); return []; }
  const added = seqAdded.slice();
  for (let i = 0; i < list.length; i++) {
    const f = list[i];
    setBusy('Membaca ' + (list.length > 1 ? (i + 1) + '/' + list.length + ': ' : '') + f.name + ' (' + fmtSize(f.size) + ')');
    try { const m = await addMedia(f); if (m) { added.push(m); if (m.noPreview) toast(f.name + ': codec ' + (m.vcodec || '?') + ' belum bisa diputar di browser ini. Buka di Chrome, Edge, atau Safari versi terbaru.', true); } }
    catch (e) { console.error(e); toast(f.name + ': ' + (e.message === 'fmt' ? 'format/codec belum didukung browser ini. Coba ubah ke MP4 (H.264).' : e.message), true); }
  }
  setBusy(null);
  if (added.length) { renderMedia(); commit('Impor media'); added.forEach(m => { if (m.demux !== 'dpxseq') genThumbs(m); }); if (opts && opts.toTimeline) added.forEach(m => addMediaToTimeline(m)); }
  return added;
}
async function addMedia(f, relinkId) {
  const kind = mediaKind(f), id = relinkId || uid();
  const m = { id, name: f.name || 'media', size: f.size, kind, mime: f.type || '', w: 0, h: 0, dur: 0, fps: 0, rot: 0, hasAudio: false, vcodec: '', acodec: '', demux: 'none', stored: false, lm: f.lastModified || 0 };
  FILES[id] = f;
  if (kind === 'image') {
    if (isDPX(f)) { const h = await loadDPXHalf(f); IMGS[id] = h; m.w = h.w; m.h = h.h; m.vcodec = 'DPX ' + h.bits + '-bit'; } else { const r = await loadImageSrc(f); IMGS[id] = r.canvas; m.w = r.w; m.h = r.h; } m.dur = 5;
  } else {
    let mp = null;
    try { mp = await parseMP4(f); } catch (e) { console.warn('parse mp4', e); }
    if (mp) { MP4[id] = mp; m.demux = 'mp4'; if (mp.v) { m.vcodec = mp.v.codec; m.fps = mp.v.fps; m.rot = mp.v.rot || 0; } if (mp.a) { m.acodec = mp.a.codec; m.hasAudio = true; } }
    let pr = null;
    try { pr = await probeEl(kind, urlOf(id)); } catch (e) { if (!mp) throw e; }
    if (kind === 'video') {
      if (pr && pr.w) { m.w = pr.w; m.h = pr.h; } else if (mp && mp.v) { const sw = (mp.v.rot === 90 || mp.v.rot === 270); m.w = sw ? mp.v.h : mp.v.w; m.h = sw ? mp.v.w : mp.v.h; }
      if (!pr || !pr.w) m.noPreview = 1;
      if (!mp && pr) m.hasAudio = true; /* tidak diketahui pasti: anggap ada */
      if (!m.fps) m.fps = 30;
      if (!m.w || !m.h) throw new Error('fmt');
      if (mp && mp.v && !mp.a) m.hasAudio = false;
    }
    m.dur = (pr && isFinite(pr.dur) && pr.dur > 0) ? pr.dur : (mp ? mp.dur : 0);
    if (pr && pr.el) { pr.el.removeAttribute('src'); try { pr.el.load(); } catch (e) {} }
    if (!(m.dur > 0)) throw new Error('Durasi file tidak terbaca');
  }
  if (f.size <= STORE_MAX) { try { await withTimeout(DB.set('media', id, f), 30000); m.stored = true; } catch (e) { console.warn('simpan media', e); } }
  if (!relinkId) P.media.push(m); else { const i = P.media.findIndex(x => x.id === id); if (i >= 0) { m.thumbs = P.media[i].thumbs; P.media[i] = m; } }
  return m;
}
/* ---------- thumbnail (filmstrip) ---------- */
const THUMBS = {}; /* id -> [{t, url}] */
const thumbQ = []; let thumbBusy = false;
function genThumbs(m) { if (!m || THUMBS[m.id]) return; thumbQ.push(m); runThumbs(); }
async function runThumbs() {
  if (thumbBusy) return; thumbBusy = true;
  while (thumbQ.length) {
    const m = thumbQ.shift(); if (!FILES[m.id]) continue;
    try {
      if (m.kind === 'image' && IMGS[m.id] && IMGS[m.id].half) { const I = IMGS[m.id]; THUMBS[m.id] = [{ t: 0, url: halfPreview(I, Math.max(8, Math.round(90 * I.w / I.h)), 90).toDataURL('image/jpeg', 0.7) }]; }
      else if (m.kind === 'image') { const c = document.createElement('canvas'), k = 90 / IMGS[m.id].height; c.width = Math.max(1, Math.round(IMGS[m.id].width * k)); c.height = 90; c.getContext('2d').drawImage(IMGS[m.id], 0, 0, c.width, c.height); THUMBS[m.id] = [{ t: 0, url: c.toDataURL('image/jpeg', 0.7) }]; }
      else if (m.kind === 'video' && m.demux === 'dpxseq') { if (!THUMBS[m.id]) { const r = await dpxDecode(FILES[m.id][0], m.ctf, 8); THUMBS[m.id] = [{ t: 0, url: halfPreview(r, Math.max(8, Math.round(72 * r.w / r.h)), 72).toDataURL('image/jpeg', 0.7) }]; } }
      else if (m.kind === 'video' && !m.noPreview) await videoThumbs(m);
      else if (m.kind === 'audio' || m.hasAudio) THUMBS[m.id] = [];
      if (m.kind === 'audio' || m.hasAudio) await genPeaks(m);
    } catch (e) { console.warn('thumb', e); }
    BUS.emit('thumbs', m.id);
  }
  thumbBusy = false;
}
async function videoThumbs(m) {
  const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = urlOf(m.id);
  await new Promise(r => { v.onloadeddata = r; v.onerror = r; setTimeout(r, 15000); });
  const n = clamp(Math.ceil(m.dur / 2), 1, 30), c = document.createElement('canvas'), ar = m.w / m.h;
  c.height = 72; c.width = Math.max(8, Math.round(72 * ar)); const x = c.getContext('2d'); const out = [];
  for (let i = 0; i < n; i++) {
    const t = Math.min(m.dur - 0.05, (i + 0.5) * m.dur / n);
    await new Promise(r => { const to = setTimeout(r, 4000); v.onseeked = () => { clearTimeout(to); r(); }; v.currentTime = t; });
    try { x.drawImage(v, 0, 0, c.width, c.height); out.push({ t, url: c.toDataURL('image/jpeg', 0.6) }); } catch (e) {}
    if (i === 0) { THUMBS[m.id] = out; BUS.emit('thumbs', m.id); }
  }
  THUMBS[m.id] = out; v.removeAttribute('src'); try { v.load(); } catch (e) {}
}
function thumbAt(id, t) { const a = THUMBS[id]; if (!a || !a.length) return null; let best = a[0]; for (const x of a) if (Math.abs(x.t - t) < Math.abs(best.t - t)) best = x; return best.url; }
/* ---------- puncak gelombang audio ---------- */
const PEAKS = {}; /* id -> Float32Array (50 per detik) */
async function genPeaks(m) {
  if (PEAKS[m.id]) return;
  const rate = 50, n = Math.max(1, Math.ceil(m.dur * rate)), pk = new Float32Array(n);
  const src = makePCMSource(m); if (!src) return;
  try {
    const step = 20; let t = 0;
    while (t < m.dur) {
      const r = await src.read(t, Math.min(m.dur, t + step)); if (!r) break;
      const len = r.ch[0].length, per = r.sr / rate;
      for (let i = 0; i < len; i++) { let v = 0; for (const c of r.ch) { const a = Math.abs(c[i]); if (a > v) v = a; } const j = Math.floor(t * rate + i / per); if (j < n && v > pk[j]) pk[j] = v; }
      t += step; if (t / step % 6 === 0) { PEAKS[m.id] = pk; BUS.emit('thumbs', m.id); await sleep(0); }
    }
  } catch (e) { console.warn('peaks', e); }
  finally { src.close(); }
  PEAKS[m.id] = pk;
}
/* ---------- sumber PCM (audio) ---------- */
const ABUF = new Map(); /* id -> AudioBuffer terdekode penuh (file audio non-MP4) */
function makePCMSource(m) {
  if (!FILES[m.id] || m.demux === 'dpxseq') return null;
  const mp = MP4[m.id];
  if (mp && mp.a && window.AudioDecoder) return new MP4AudioSource(m, mp.a);
  return new BufferAudioSource(m);
}
class BufferAudioSource {
  constructor(m) { this.m = m; this.buf = null; }
  async load() {
    if (this.buf) return this.buf;
    if (ABUF.has(this.m.id)) return (this.buf = ABUF.get(this.m.id));
    if (this.m.size > 700 * 1048576) throw new Error('Audio file terlalu besar');
    const data = await FILES[this.m.id].arrayBuffer();
    const ac = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(2, 4800, 48000);
    this.buf = await new Promise((res, rej) => { const p = ac.decodeAudioData(data, res, rej); if (p && p.then) p.then(res, rej); });
    ABUF.set(this.m.id, this.buf); if (ABUF.size > 4) ABUF.delete(ABUF.keys().next().value);
    return this.buf;
  }
  async read(t0, t1) {
    let b; try { b = await this.load(); } catch (e) { return null; }
    const sr = b.sampleRate, i0 = clamp(Math.floor(t0 * sr), 0, b.length), i1 = clamp(Math.ceil(t1 * sr), i0, b.length), ch = [];
    for (let c = 0; c < b.numberOfChannels; c++) ch.push(b.getChannelData(c).subarray(i0, i1));
    return { sr, ch, t0: i0 / sr };
  }
  close() {}
}
class MP4AudioSource {
  constructor(m, a) { this.m = m; this.a = a; this.rd = new BlockReader(FILES[m.id]); this.dec = null; this.q = []; this.next = 0; this.end = -1; this.err = null; }
  mk() {
    if (this.dec) { try { this.dec.close(); } catch (e) {} }
    this.q = []; this.err = null;
    this.dec = new AudioDecoder({ output: d => { try { const n = d.numberOfFrames, nc = d.numberOfChannels, ch = []; for (let c = 0; c < nc; c++) { const f = new Float32Array(n); d.copyTo(f, { planeIndex: c, format: 'f32-planar' }); ch.push(f); } this.q.push({ t: d.timestamp / 1e6, sr: d.sampleRate, ch }); } catch (e) { this.err = e; } d.close(); }, error: e => { this.err = e; } });
    const cfg = { codec: this.a.codec, sampleRate: this.a.sr, numberOfChannels: this.a.ch }; if (this.a.desc) cfg.description = this.a.desc;
    this.dec.configure(cfg);
  }
  idxAt(t) { const a = this.a; let lo = 0, hi = a.n - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (a.cts[mid] <= t) lo = mid; else hi = mid - 1; } return lo; }
  async read(t0, t1) {
    const a = this.a;
    if (!this.dec || Math.abs(t0 - this.end) > 0.05 || this.err) { this.mk(); this.next = Math.max(0, this.idxAt(t0) - 3); this.end = t0; }
    /* umpan sampel sampai menutupi t1 */
    while (this.next < a.n && a.cts[this.next] < t1 + 0.1) {
      const i = this.next++; const data = await this.rd.read(a.off[i], a.size[i]);
      if (!this.dec) return null;
      this.dec.decode(new EncodedAudioChunk({ type: 'key', timestamp: Math.round(a.cts[i] * 1e6), duration: Math.round(a.dur[i] * 1e6), data }));
      if (this.dec.decodeQueueSize > 64) await sleep(0);
      if (!this.dec) return null;
    }
    if (!this.dec) return null;
    if (this.next >= a.n) await this.dec.flush().catch(() => {});
    else { let w = 0; while (this.dec && this.dec.decodeQueueSize > 0 && w++ < 400) await sleep(2); await sleep(0); }
    if (!this.dec) return null;
    if (this.err) { console.warn(this.err); }
    /* gabungkan keluaran ke rentang [t0,t1) */
    if (!this.q.length) { this.end = t1; return null; }
    const sr = this.q[0].sr, nc = Math.max(...this.q.map(x => x.ch.length)), len = Math.max(0, Math.round((t1 - t0) * sr)), ch = [];
    for (let c = 0; c < nc; c++) ch.push(new Float32Array(len));
    const keep = [];
    for (const blk of this.q) {
      const s0 = Math.round((blk.t - t0) * sr), bl = blk.ch[0].length;
      for (let c = 0; c < nc; c++) { const src = blk.ch[Math.min(c, blk.ch.length - 1)], dst = ch[c]; const a0 = Math.max(0, -s0), a1 = Math.min(bl, len - s0); if (a1 > a0) dst.set(src.subarray(a0, a1), s0 + a0); }
      if (blk.t + bl / sr > t1) keep.push(blk);
    }
    this.q = keep; this.end = t1;
    return { sr, ch, t0 };
  }
  close() { if (this.dec) { try { this.dec.close(); } catch (e) {} this.dec = null; } }
}
/* ---------- sumber bingkai video untuk ekspor (WebCodecs, presisi per frame) ---------- */
class MP4FrameSource {
  constructor(m, v) { this.m = m; this.v = v; this.rd = new BlockReader(FILES[m.id]); this.dec = null; this.frames = []; this.next = 0; this.eof = false; this.err = null; this.last = -1; this.wait = null; }
  async mk() {
    if (this.dec) { try { this.dec.close(); } catch (e) {} }
    this.frames.forEach(f => f.close()); this.frames = []; this.eof = false; this.err = null;
    this.dec = new VideoDecoder({ output: f => { this.frames.push(f); this.frames.sort((a, b) => a.timestamp - b.timestamp); if (this.wait) { const w = this.wait; this.wait = null; w(); } }, error: e => { this.err = e; if (this.wait) { const w = this.wait; this.wait = null; w(); } } });
    const v = this.v, cfg = { codec: v.codec, codedWidth: v.w, codedHeight: v.h, hardwareAcceleration: 'no-preference', optimizeForLatency: false };
    if (v.desc) cfg.description = v.desc;
    let sup = null; try { sup = await VideoDecoder.isConfigSupported(cfg); } catch (e) {}
    if (!sup || !sup.supported) { delete cfg.hardwareAcceleration; try { sup = await VideoDecoder.isConfigSupported(cfg); } catch (e) {} if (!sup || !sup.supported) throw new Error('Codec video ' + v.codec + ' tidak didukung perangkat ini untuk ekspor'); }
    this.dec.configure(cfg);
  }
  keyBefore(t) {
    const v = this.v; let best = 0;
    for (let i = 0; i < v.n; i++) if (v.sync[i] && v.cts[i] <= t + 1e-4) best = i; else if (v.sync[i] && v.cts[i] > t + 2) break;
    return best;
  }
  async seek(t) { await this.mk(); this.next = this.keyBefore(t); }
  async feed(k) {
    const v = this.v; let c = 0;
    while (c < k && this.next < v.n) {
      const i = this.next++; const data = await this.rd.read(v.off[i], v.size[i]);
      this.dec.decode(new EncodedVideoChunk({ type: v.sync[i] ? 'key' : 'delta', timestamp: Math.round(v.cts[i] * 1e6), duration: Math.round(v.dur[i] * 1e6), data })); c++;
    }
    if (this.next >= v.n && !this.eof) { this.eof = true; await this.dec.flush().catch(e => { this.err = this.err || e; }); }
  }
  async frameAt(t) {
    const fd = 1 / (this.m.fps || 30), eps = fd * 0.5;
    if (!this.dec || t < this.last - 1e-6 || (this.frames.length && t > this.frames[this.frames.length - 1].timestamp / 1e6 + 4) || (!this.frames.length && t > this.last + 4)) await this.seek(t);
    this.last = t;
    let guard = 0;
    while (guard++ < 5000) {
      if (this.err) throw this.err;
      const F = this.frames; let bi = -1;
      for (let i = 0; i < F.length; i++) if (F[i].timestamp / 1e6 <= t + eps) bi = i; else break;
      const haveAfter = bi >= 0 ? bi < F.length - 1 : F.length > 0;
      if (bi >= 0 && (haveAfter || this.eof)) { for (let i = 0; i < bi; i++) F[i].close(); F.splice(0, bi); return F[0]; }
      if (bi < 0 && haveAfter) return F[0]; /* sebelum bingkai pertama */
      if (this.eof) { if (F.length) return F[F.length - 1]; throw new Error('Bingkai video tidak tersedia'); }
      /* buang bingkai lama agar memori dekoder tidak penuh */
      if (bi > 0) { for (let i = 0; i < bi; i++) F[i].close(); F.splice(0, bi); }
      if (this.dec.decodeQueueSize < 10) await this.feed(8);
      if (!this.eof) await new Promise(r => { this.wait = r; this.dec.ondequeue = () => { if (this.wait === r && this.dec.decodeQueueSize < 4) { this.wait = null; r(); } }; setTimeout(() => { if (this.wait === r) { this.wait = null; r(); } }, 40); });
    }
    throw new Error('Dekoder macet');
  }
  close() { this.frames.forEach(f => f.close()); this.frames = []; if (this.dec) { try { this.dec.close(); } catch (e) {} this.dec = null; } }
}
/* cadangan: elemen <video> dengan seek per bingkai (lebih lambat) */
class ElFrameSource {
  constructor(m) { this.m = m; this.v = null; }
  async init() {
    if (this.v) return; const v = this.v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = urlOf(this.m.id);
    await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = () => rej(new Error('Video tidak bisa dibaca')); setTimeout(res, 20000); });
  }
  async frameAt(t) {
    await this.init(); const v = this.v; t = clamp(t, 0, Math.max(0, this.m.dur - 0.001));
    if (Math.abs(v.currentTime - t) > 1e-3) {
      await new Promise(r => { const to = setTimeout(r, 5000); const ok = () => { clearTimeout(to); r(); }; if (v.requestVideoFrameCallback) { v.requestVideoFrameCallback(ok); v.onseeked = () => setTimeout(ok, 30); } else v.onseeked = ok; v.currentTime = t; });
    }
    return v;
  }
  close() { if (this.v) { this.v.removeAttribute('src'); try { this.v.load(); } catch (e) {} this.v = null; } }
}
function imageSrc(m) { const I = IMGS[m.id]; if (!I) return null; if (I.half) return { img: I, w: m.w, h: m.h, iw: I.w, ih: I.h, key: 'i:' + m.id, live: I.ver }; return { img: I, w: m.w, h: m.h, key: 'i:' + m.id }; }
function makeFrameSource(m) {
  if (m.demux === 'dpxseq') return new DPXSeqSource(m);
  const mp = MP4[m.id];
  if (mp && mp.v && window.VideoDecoder) return new MP4FrameSource(m, mp.v);
  return new ElFrameSource(m);
}
/* ---------- pulihkan file media dari perangkat ---------- */
async function restoreMediaFiles() {
  const miss = [];
  for (const m of P.media) {
    if (FILES[m.id]) continue;
    let f = null; if (m.stored) { try { f = await DB.get('media', m.id); } catch (e) {} }
    if (f) {
      FILES[m.id] = f;
      try {
        if (m.kind === 'image') { if (/\.dpx$/i.test(m.name)) IMGS[m.id] = await loadDPXHalf(f); else IMGS[m.id] = (await loadImageSrc(f)).canvas; }
        else if (m.demux === 'dpxseq') { if (!Array.isArray(f)) throw new Error('sekuens'); }
        else { const mp = await parseMP4(f).catch(() => null); if (mp) MP4[m.id] = mp; }
        genThumbs(m);
      } catch (e) { console.warn(e); }
    } else miss.push(m);
  }
  P.media.forEach(m => m.offline = !FILES[m.id]);
  return miss;
}

/* ---- d-project.js ---- */
/* ================= PROYEK: model, keyframe, kecepatan, riwayat ================= */
let P = null;          /* proyek aktif */
let SEL = null;        /* id klip terpilih */
let PH = 0;            /* posisi playhead (detik) */
const CANVAS_PRESETS = [
  { k: '9:16', n: 'TikTok / Reels / Shorts', w: 1080, h: 1920 },
  { k: '4:5', n: 'Instagram Feed', w: 1080, h: 1350 },
  { k: '1:1', n: 'Persegi', w: 1080, h: 1080 },
  { k: '16:9', n: 'YouTube / TV', w: 1920, h: 1080 },
  { k: '16:9 4K', n: 'YouTube 4K / Layar Lebar', w: 3840, h: 2160 },
  { k: '9:16 4K', n: 'Vertikal 4K', w: 2160, h: 3840 },
  { k: '21:9', n: 'Sinematik', w: 2560, h: 1080 },
  { k: '4:3', n: 'Klasik', w: 1440, h: 1080 },
  { k: '3:4', n: 'Potret', w: 1080, h: 1440 },
  { k: '2:1', n: 'Banner / Billboard', w: 2160, h: 1080 }
];
const FPS_LIST = [23.976, 24, 25, 29.97, 30, 50, 59.94, 60];
function newProject(name, w, h, fps) {
  return { v: 1, id: uid(), name: name || 'Proyek Baru', w: w || 1080, h: h || 1920, fps: fps || 30, bg: '#000000',
    tracks: [{ id: uid(), kind: 'video', name: 'Video 1' }, { id: uid(), kind: 'audio', name: 'Audio 1' }],
    clips: [], media: [], master: { vol: 0, loud: -14, lim: 1 }, created: Date.now(), updated: Date.now() };
}
const defP = () => ({ x: 0, y: 0, scale: 100, rot: 0, flipH: 0, flipV: 0, opacity: 100, blend: 'normal', fit: 'fit', cl: 0, cr: 0, ct: 0, cb: 0, lens: 0, lensZ: 0,
  dz: 0, dzS0: 100, dzS1: 125, dzX0: 0, dzY0: 0, dzX1: 0, dzY1: 0, dzE: 1,
  key: 0, keyC: '#00ff00', keyTol: 30, keySoft: 12, keySpill: 50, nrL: 0, nrC: 0, nrT: 0, stab: 0, stabStr: 50, stabMode: 'smooth', stabZoom: 0, aIn: 'none', aInD: 0.5, aOut: 'none', aOutD: 0.5, interp: 'blend', sharp: 0 });
const defG = () => ({ on: 1, exp: 0, temp: 0, tint: 0, con: 1, piv: 0.435, sat: 1, hue: 0, vib: 0, hl: 0, sh: 0, wh: 0, bk: 0,
  lift: [0, 0, 0, 0], gam: [0, 0, 0, 0], gain: [0, 0, 0, 0], off: [0, 0, 0, 0],
  cv: { y: null, r: null, g: null, b: null }, hvh: null, hvs: null, lvs: null, lut: null, lutMix: 1, nodes: [], hdr: null });
const defNode = () => ({ id: uid(), on: 1, win: 'none', cx: 0.5, cy: 0.5, ww: 0.35, wh: 0.35, wr: 0, ws: 0.25, winv: 0,
  ql: 0, qh: 0.08, qhw: 0.08, qs0: 0.15, qs1: 1, ql0: 0.05, ql1: 0.95, qsoft: 0.08, qinv: 0, qblur: 0, qclean: 0,
  exp: 0, con: 1, sat: 1, hue: 0, temp: 0, tint: 0, blur: 0 });
const defAU = () => ({ dn: 0, vol: 0, mute: 0, fin: 0, fout: 0, pan: 0, eq: 0, eqL: 0, eqM: 0, eqH: 0, hpf: 0, comp: 0, cThr: -18, cRat: 3, cGain: 0 });
const defTX = () => ({ t: 'Ketik teks di sini', font: 'Montserrat', wt: 700, it: 0, up: 0, size: 6, color: '#ffffff', align: 'center', ls: 0, lh: 1.15, maxW: 86,
  stroke: 0, strokeC: '#000000', shadow: 0, shadowC: '#000000', bg: 0, bgC: '#000000', bgA: 70, bgR: 18, glow: 0, glowC: '#ff2d95', grad: 0, gradC: '#ffd400' });
/* ---------- akses jalur properti ---------- */
function getPath(o, path) { const a = path.split('.'); for (const k of a) { if (o == null) return undefined; o = o[k]; } return o; }
function setPath(o, path, v) { const a = path.split('.'); for (let i = 0; i < a.length - 1; i++) { if (o[a[i]] == null) o[a[i]] = {}; o = o[a[i]]; } o[a[a.length - 1]] = v; }
/* ---------- keyframe ---------- */
const EASE = [t => t, t => t * t * (3 - 2 * t), t => t * t, t => 1 - (1 - t) * (1 - t)]; /* linear, halus, masuk, keluar */
function hasKF(c, path) { return !!(c.kf && c.kf[path] && c.kf[path].length); }
function valAt(c, path, lt) {
  const k = c.kf && c.kf[path];
  if (!k || !k.length) return getPath(c, path);
  if (lt <= k[0][0]) return k[0][1];
  if (lt >= k[k.length - 1][0]) return k[k.length - 1][1];
  for (let i = 0; i < k.length - 1; i++) {
    const a = k[i], b = k[i + 1];
    if (lt >= a[0] && lt <= b[0]) { const u = (lt - a[0]) / Math.max(1e-6, b[0] - a[0]); return lerp(a[1], b[1], (EASE[a[2] || 0] || EASE[0])(u)); }
  }
  return k[k.length - 1][1];
}
function kfIndex(c, path, lt) { const k = c.kf && c.kf[path]; if (!k) return -1; const tol = 0.5 / P.fps; return k.findIndex(x => Math.abs(x[0] - lt) <= tol); }
function setVal(c, path, v, lt) {
  if (hasKF(c, path)) {
    const k = c.kf[path], i = kfIndex(c, path, lt);
    if (i >= 0) k[i][1] = v; else { k.push([lt, v, 1]); k.sort((a, b) => a[0] - b[0]); }
  } else setPath(c, path, v);
}
function toggleKF(c, path, lt) {
  c.kf = c.kf || {};
  const i = kfIndex(c, path, lt);
  if (i >= 0) { c.kf[path].splice(i, 1); if (!c.kf[path].length) { delete c.kf[path]; } return false; }
  const v = valAt(c, path, lt);
  if (!c.kf[path]) { c.kf[path] = []; setPath(c, path, v); }
  c.kf[path].push([lt, v, 1]); c.kf[path].sort((a, b) => a[0] - b[0]); return true;
}
function kfTimes(c) { const s = new Set(); for (const k in (c.kf || {})) c.kf[k].forEach(x => s.add(Math.round(x[0] * 1000) / 1000)); return Array.from(s).sort((a, b) => a - b); }
/* ---------- kecepatan & speed ramp ---------- */
const RAMPS = {
  montage: [[0, 1], [0.2, 1], [0.35, 4], [0.5, 0.35], [0.65, 4], [0.8, 1], [1, 1]],
  hero: [[0, 1], [0.3, 1], [0.42, 0.2], [0.58, 0.2], [0.7, 1], [1, 1]],
  bullet: [[0, 4], [0.35, 4], [0.45, 0.15], [0.6, 0.15], [0.7, 4], [1, 4]],
  jump: [[0, 1], [0.4, 1], [0.48, 6], [0.56, 1], [1, 1]],
  flashin: [[0, 6], [0.35, 3], [0.65, 1], [1, 1]],
  flashout: [[0, 1], [0.35, 1], [0.65, 3], [1, 6]],
  fpv: [[0, 1.4], [0.25, 3], [0.45, 0.4], [0.55, 0.4], [0.75, 3], [1, 1.4]],
  car: [[0, 0.5], [0.3, 0.5], [0.45, 5], [0.7, 5], [0.85, 0.5], [1, 0.5]]
};
const RAMP_NAMES = { montage: 'Montase', hero: 'Hero', bullet: 'Bullet Time', jump: 'Jump Cut', flashin: 'Flash Masuk', flashout: 'Flash Keluar', fpv: 'Drone FPV', car: 'Mobil Ngebut' };
function rampAt(r, u) { if (!r || !r.length) return 1; if (u <= r[0][0]) return r[0][1]; for (let i = 0; i < r.length - 1; i++) { const a = r[i], b = r[i + 1]; if (u <= b[0]) { const k = (u - a[0]) / Math.max(1e-6, b[0] - a[0]); return Math.exp(lerp(Math.log(a[1]), Math.log(b[1]), EASE[1](k))); } } return r[r.length - 1][1]; }
const rampCache = new Map();
function rampTable(r) { /* integral kumulatif m(u) du pada 512 titik */
  const key = JSON.stringify(r); if (rampCache.has(key)) return rampCache.get(key);
  const N = 512, T = new Float64Array(N + 1); let acc = 0, prev = rampAt(r, 0);
  for (let i = 1; i <= N; i++) { const m = rampAt(r, i / N); acc += (prev + m) / 2 / N; prev = m; T[i] = acc; }
  if (rampCache.size > 200) rampCache.clear(); rampCache.set(key, T); return T;
}
function isTimed(c) { return c.kind === 'video' || c.kind === 'audio'; }
function clipDur(c) {
  if (!isTimed(c) || c.freeze != null) return c.dur;
  const len = Math.max(0.01, c.out - c.in), sp = Math.max(0.01, c.speed || 1);
  if (c.ramp && c.ramp.length) { const T = rampTable(c.ramp); return len / (sp * T[T.length - 1]); }
  return len / sp;
}
function clipEnd(c) { return c.start + clipDur(c); }
function srcTime(c, lt) { /* waktu sumber (detik dalam file) pada waktu lokal klip */
  if (c.freeze != null) return c.freeze;
  const D = clipDur(c), sp = c.speed || 1; lt = clamp(lt, 0, D);
  if (c.ramp && c.ramp.length) { const T = rampTable(c.ramp), u = lt / D * 512, i = Math.floor(u), f = u - i; const I = i >= 512 ? T[512] : lerp(T[i], T[i + 1], f); return c.in + D * sp * I; }
  return c.in + lt * sp;
}
function speedAt(c, lt) { if (c.freeze != null) return 0; const D = clipDur(c); return (c.speed || 1) * (c.ramp ? rampAt(c.ramp, clamp(lt / D, 0, 1)) : 1); }
function projDur() { let d = 0; for (const c of P.clips) d = Math.max(d, clipEnd(c)); return d; }
/* ---------- klip & track ---------- */
function trackById(id) { return P.tracks.find(t => t.id === id); }
function clipById(id) { return P.clips.find(c => c.id === id); }
function selClip() { return SEL ? clipById(SEL) : null; }
function clipsOn(tid) { return P.clips.filter(c => c.track === tid).sort((a, b) => a.start - b.start); }
function overlaps(tid, s, e, ignore) { const eps = 1e-4; return P.clips.some(c => c.track === tid && c.id !== ignore && c.start < e - eps && clipEnd(c) > s + eps); }
function addTrack(kind, at) {
  const n = P.tracks.filter(t => t.kind === kind).length + 1, t = { id: uid(), kind, name: (kind === 'audio' ? 'Audio ' : 'Video ') + n };
  if (at != null) P.tracks.splice(at, 0, t);
  else if (kind === 'video') { P.tracks.unshift(t); } else P.tracks.push(t);
  return t;
}
function freeTrack(kind, s, e, prefer, ignore) {
  if (prefer) { const t = trackById(prefer); if (t && t.kind === kind && !t.lock && !overlaps(t.id, s, e, ignore)) return t; }
  const list = kind === 'video' ? P.tracks.filter(t => t.kind === 'video').reverse() : P.tracks.filter(t => t.kind === 'audio');
  for (const t of list) if (!t.lock && !overlaps(t.id, s, e, ignore)) return t;
  return addTrack(kind);
}
function makeClip(kind, extra) {
  const c = Object.assign({ id: uid(), kind, track: null, start: 0, in: 0, out: 0, dur: 3, speed: 1, ramp: null, freeze: null, kf: {} }, extra || {});
  if (kind === 'video' || kind === 'image' || kind === 'text') { c.p = defP(); }
  if (kind === 'video' || kind === 'image') c.g = defG();
  if (kind === 'video' || kind === 'audio') c.au = defAU();
  if (kind === 'text') { c.tx = defTX(); c.p.y = 0.55; c.p.fit = 'none'; }
  return c;
}
function addMediaToTimeline(m, at) {
  const t0 = at != null ? at : PH;
  let c;
  if (m.kind === 'audio') c = makeClip('audio', { media: m.id, in: 0, out: m.dur, name: m.name });
  else if (m.kind === 'image') c = makeClip('image', { media: m.id, dur: 5, name: m.name });
  else { c = makeClip('video', { media: m.id, in: 0, out: m.dur, name: m.name }); if (!m.hasAudio) c.au.mute = 1; }
  c.start = Math.max(0, t0);
  /* trek utama kosong di awal: tempel di akhir trek utama */
  const kind = m.kind === 'audio' ? 'audio' : 'video';
  const tr = freeTrack(kind, c.start, c.start + clipDur(c), null);
  c.track = tr.id; P.clips.push(c); SEL = c.id;
  if (P.clips.length === 1 && m.kind !== 'audio' && m.w && m.h) autoCanvasFrom(m);
  commit('Tambah ' + (m.kind === 'audio' ? 'audio' : 'klip'));
  return c;
}
function autoCanvasFrom(m) { /* klip pertama: samakan rasio kanvas bila proyek masih baru */
  if (P._canvasSet) return;
  const r = m.w / m.h; let best = CANVAS_PRESETS[3], bd = 9;
  for (const c of CANVAS_PRESETS) { if (/4K/.test(c.k)) continue; const d = Math.abs(Math.log(c.w / c.h) - Math.log(r)); if (d < bd) { bd = d; best = c; } }
  if (bd < 0.05) { const big = Math.max(m.w, m.h) >= 3000; const pr = big ? (CANVAS_PRESETS.find(c => c.k === best.k + ' 4K') || best) : best; P.w = pr.w; P.h = pr.h; }
  if (m.fps) { const f = FPS_LIST.reduce((a, b) => Math.abs(b - m.fps) < Math.abs(a - m.fps) ? b : a, 30); P.fps = f; }
  P._canvasSet = 1; BUS.emit('canvas');
}
function splitClip(c, t) {
  const lt = t - c.start, D = clipDur(c);
  if (lt <= 1 / P.fps || lt >= D - 1 / P.fps) return null;
  const b = deep(c); b.id = uid();
  if (isTimed(c) && c.freeze == null) {
    const st = srcTime(c, lt);
    if (c.ramp) { /* bagi kurva ramp */
      const u = lt / D, r = c.ramp, mid = rampAt(r, u);
      const A1 = r.filter(p => p[0] < u).map(p => [p[0] / u, p[1]]).concat([[1, mid]]), B1 = [[0, mid]].concat(r.filter(p => p[0] > u).map(p => [(p[0] - u) / (1 - u), p[1]]));
      c.ramp = A1; b.ramp = B1;
    }
    c.out = st; b.in = st; b.start = t;
  } else { c.dur = lt; b.dur = D - lt; b.start = t; }
  /* keyframe: geser untuk bagian kedua */
  for (const k in (b.kf || {})) { b.kf[k] = b.kf[k].map(x => [x[0] - lt, x[1], x[2]]); }
  for (const k in (c.kf || {})) c.kf[k] = c.kf[k].filter(x => x[0] <= lt + 1e-6);
  for (const k in (b.kf || {})) { b.kf[k] = b.kf[k].filter(x => x[0] >= -1e-6); if (!b.kf[k].length) delete b.kf[k]; }
  if (c.p) { b.p.aIn = 'none'; c.p.aOut = 'none'; }
  b.tr = null; if (c.au) { c.au.fout = 0; b.au.fin = 0; }
  P.clips.push(b); return b;
}
/* ---------- riwayat (undo/redo) & simpan ---------- */
let HIST = [], HI = -1, saveT = 0;
function snap() { const o = Object.assign({}, P); return JSON.stringify(o); }
function commit(label) {
  if (!P) return;
  P.updated = Date.now();
  const s = snap();
  if (HIST[HI] === s) { BUS.emit('change'); return; }
  HIST = HIST.slice(0, HI + 1); HIST.push(s); if (HIST.length > 80) HIST.shift(); HI = HIST.length - 1;
  BUS.emit('change', label); saveSoon();
}
function undo() { if (HI <= 0) return; HI--; P = JSON.parse(HIST[HI]); afterHist(); }
function redo() { if (HI >= HIST.length - 1) return; HI++; P = JSON.parse(HIST[HI]); afterHist(); }
function afterHist() { if (SEL && !clipById(SEL)) SEL = null; BUS.emit('change', 'hist'); BUS.emit('canvas'); saveSoon(); }
function resetHist() { HIST = [snap()]; HI = 0; }
function saveSoon() { clearTimeout(saveT); saveT = setTimeout(saveProject, 700); }
async function saveProject() {
  clearTimeout(saveT); if (!P) return;
  try {
    await DB.set('kv', 'p:' + P.id, snap());
    const idx = (await DB.get('kv', 'projects')) || [];
    const i = idx.findIndex(x => x.id === P.id), meta = { id: P.id, name: P.name, updated: P.updated, w: P.w, h: P.h, dur: projDur(), n: P.clips.length };
    if (i >= 0) idx[i] = meta; else idx.unshift(meta);
    await DB.set('kv', 'projects', idx); await DB.set('kv', 'last', P.id);
    const s = $('#vs-saved'); if (s) s.textContent = 'Tersimpan';
  } catch (e) { const s = $('#vs-saved'); if (s) s.textContent = 'Gagal menyimpan'; console.warn(e); }
}
async function listProjects() { try { return (await DB.get('kv', 'projects')) || []; } catch (e) { return []; } }
async function loadProject(id) {
  const s = await DB.get('kv', 'p:' + id); if (!s) throw new Error('Proyek tidak ditemukan');
  P = typeof s === 'string' ? JSON.parse(s) : s; SEL = null; PH = 0;
  P.media.forEach(m => { delete m.offline; });
  resetHist();
  const miss = await restoreMediaFiles();
  BUS.emit('canvas'); BUS.emit('change', 'load');
  return miss;
}
async function deleteProject(id) {
  const s = await DB.get('kv', 'p:' + id).catch(() => null);
  if (s) { try { const p = JSON.parse(s); const others = []; const idx = (await DB.get('kv', 'projects')) || [];
    for (const x of idx) if (x.id !== id) { const q = await DB.get('kv', 'p:' + x.id).catch(() => null); if (q) JSON.parse(q).media.forEach(m => others.push(m.id)); }
    for (const m of p.media) if (!others.includes(m.id)) await DB.del('media', m.id).catch(() => {}); } catch (e) {} }
  await DB.del('kv', 'p:' + id).catch(() => {});
  const idx = ((await DB.get('kv', 'projects')) || []).filter(x => x.id !== id); await DB.set('kv', 'projects', idx);
}

/* ---- e-gl.js ---- */
/* ================= RENDER GPU (WebGL2, presisi float 16-bit per kanal) ================= */
const GLR = { gl: null, cv: null, ok: false, w: 0, h: 0, fb: {}, tex: new Map(), prog: {}, half: true };
const VS_SRC = `#version 300 es
out vec2 v; void main(){ vec2 p = vec2((gl_VertexID==1)?3.:-1., (gl_VertexID==2)?3.:-1.); v = p*.5+.5; gl_Position = vec4(p,0.,1.); }`;
const GLSL_COMMON = `#version 300 es
precision highp float; precision highp sampler3D;
in vec2 v; out vec4 o;
float luma(vec3 c){ return dot(c, vec3(.2126,.7152,.0722)); }
float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float noise1(float x){ float i = floor(x), f = fract(x); float a = hash(vec2(i, 7.1)), b = hash(vec2(i+1., 7.1)); return mix(a, b, f*f*(3.-2.*f)); }
vec3 rgb2hsv(vec3 c){ vec4 K = vec4(0., -1./3., 2./3., -1.); vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g)); vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r)); float d = q.x - min(q.w, q.y); float e = 1.0e-10; return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x); }
vec3 hsv2rgb(vec3 c){ vec3 p = abs(fract(c.xxx + vec3(1., 2./3., 1./3.)) * 6. - 3.); return c.z * mix(vec3(1.), clamp(p - 1., 0., 1.), c.y); }
vec3 hueRot(vec3 c, float a){ float l = luma(c); vec3 d = c - l; float cs = cos(a), sn = sin(a); vec3 k = vec3(.57735); d = d*cs + cross(k, d)*sn + k*dot(k, d)*(1.-cs); return l + d; }
`;
/* ---------- shader lapisan: transform + crop + lensa + chroma key + grading + node sekunder ---------- */
const FS_LAYER = GLSL_COMMON + `
uniform sampler2D uSrc; uniform vec2 uSrcPx; uniform mat3 uM; uniform vec2 uOut; uniform int uRot;
uniform vec4 uCrop; uniform vec2 uLens; uniform float uAsp; uniform float uSharp; uniform float uOpacity;
uniform vec4 uKey; uniform vec2 uKeyX; uniform vec3 uKeyRGB;
uniform int uG; uniform vec4 uA; uniform vec4 uB; uniform vec4 uC; uniform vec4 uLift; uniform vec4 uGam; uniform vec4 uGain; uniform vec4 uOff;
uniform sampler2D uCurve; uniform int uCv; uniform sampler3D uLut; uniform float uLutMix; uniform float uLutN; uniform sampler3D uFlt; uniform float uFltMix; uniform float uFltN;
uniform int uNN; uniform vec4 uN6[4]; uniform vec4 uStab; uniform float uStabZ; uniform int uStabOn; uniform vec4 uN0[4]; uniform vec4 uN1[4]; uniform vec4 uN2[4]; uniform vec4 uN3[4]; uniform vec4 uN4[4]; uniform vec4 uN5[4];
uniform int uShowMask; uniform int uHDR; uniform vec4 uHZ[5]; uniform float uHS[5];
vec2 rawUV(vec2 uv){ if (uRot==1) return vec2(uv.y, 1.-uv.x); if (uRot==2) return vec2(1.-uv.x, 1.-uv.y); if (uRot==3) return vec2(1.-uv.y, uv.x); return uv; }
vec4 samp(vec2 uv){ return texture(uSrc, rawUV(uv)); }
float cv(float x, float row){ return texture(uCurve, vec2(clamp(x,0.,1.)*(1023./1024.)+.5/1024., (row+.5)/8.)).r; }
vec3 wb(vec3 c, float temp, float tint){ vec3 lin = pow(max(c, 0.), vec3(2.2)); lin *= vec3(1.+temp*.30, 1.-tint*.22, 1.-temp*.30) / max(.5, 1.+abs(temp)*.05); return pow(max(lin, 0.), vec3(1./2.2)); }
float winMask(int i, vec2 uv){
  float tp = uN0[i].x; if (tp < .5) return 1.;
  vec2 c = vec2(uN0[i].y, uN0[i].z); float sf = max(.001, uN0[i].w); vec2 sz = max(vec2(.001), uN1[i].xy); float r = uN1[i].z;
  vec2 d = uv - c; d.x *= uAsp; float cs = cos(-r), sn = sin(-r); d = vec2(d.x*cs - d.y*sn, d.x*sn + d.y*cs); d.x /= uAsp;
  float m;
  if (tp < 1.5){ float q = length(d / sz); m = 1. - smoothstep(1. - sf, 1. + sf, q); }
  else if (tp < 2.5){ vec2 q = abs(d) / sz; float e = max(q.x, q.y); m = 1. - smoothstep(1. - sf, 1. + sf, e); }
  else { m = smoothstep(-sf, sf, -d.y / max(.001, sz.y)); }
  return uN1[i].w > .5 ? 1. - m : m;
}
float qualMask(int i, vec3 c){
  if (uN2[i].x < .5) return 1.;
  vec3 h = rgb2hsv(clamp(c, 0., 1.)); float sf = max(.001, uN2[i].w);
  float dh = abs(fract(h.x - uN2[i].y + .5) - .5);
  float mh = 1. - smoothstep(uN2[i].z, uN2[i].z + sf, dh);
  float ms = smoothstep(uN3[i].x - sf, uN3[i].x, h.y) * (1. - smoothstep(uN3[i].y, uN3[i].y + sf, h.y));
  float l = luma(clamp(c, 0., 1.)); float ml = smoothstep(uN3[i].z - sf, uN3[i].z, l) * (1. - smoothstep(uN3[i].w, uN3[i].w + sf, l));
  float m = mh * ms * ml; return uN5[i].z > .5 ? 1. - m : m;
}
vec3 primary(vec3 c){
  /* eksposur & white balance (linear) */
  vec3 lin = pow(max(c, 0.), vec3(2.2)) * exp2(uA.x);
  /* HDR color wheels: zona Dark, Shadow, Light, Highlight + Global (dalam stop, linear) */
  if (uHDR == 1){
    float Y = max(1e-5, dot(lin, vec3(.2126,.7152,.0722))), st = log2(Y / .18);
    float w0 = 1. - smoothstep(-4.6, -2.4, st), w1 = exp(-pow((st + 1.6) / 1.25, 2.)), w2 = exp(-pow((st - .9) / 1.25, 2.)), w3 = smoothstep(1.4, 3.6, st);
    vec3 gb = uHZ[4].rgb + uHZ[0].rgb * w0 + uHZ[1].rgb * w1 + uHZ[2].rgb * w2 + uHZ[3].rgb * w3;
    float ev = uHZ[4].a + uHZ[0].a * w0 + uHZ[1].a * w1 + uHZ[2].a * w2 + uHZ[3].a * w3;
    float sat = uHS[4] * mix(1., uHS[0], w0) * mix(1., uHS[1], w1) * mix(1., uHS[2], w2) * mix(1., uHS[3], w3);
    lin *= exp2(ev + gb * .8);
    float Y2 = dot(lin, vec3(.2126,.7152,.0722)); lin = max(vec3(0.), mix(vec3(Y2), lin, sat));
  }
  c = pow(max(lin, 0.), vec3(1./2.2));
  c = wb(c, uA.y, uA.z);
  /* roda warna: offset, lift, gain, gamma */
  c += uOff.rgb + uOff.a;
  c = c + (uLift.rgb + uLift.a) * (1. - clamp(c, 0., 1.));
  c *= max(vec3(0.), 1. + uGain.rgb + uGain.a);
  vec3 g = max(vec3(-.9), uGam.rgb + uGam.a); c = pow(max(c, 0.), 1. / (1. + g));
  /* kontras + pivot */
  c = (c - uB.x) * uA.w + uB.x;
  /* nada: highlight, shadow, putih, hitam */
  float l = luma(c);
  float hm = smoothstep(.35, 1., l), sm = 1. - smoothstep(0., .6, l), wm = smoothstep(.7, 1.1, l), bm = 1. - smoothstep(0., .3, l);
  c += c * (uC.x * .45 * hm) + (1. - c) * max(0., uC.y) * .5 * sm + c * min(0., uC.y) * .6 * sm;
  c += uC.z * .25 * wm + uC.w * .18 * bm;
  /* saturasi, vibrance, hue */
  l = luma(c);
  float s0 = length(c - l);
  c = mix(vec3(l), c, uB.y * (1. + uB.w * (1. - smoothstep(0., .35, s0))));
  if (abs(uB.z) > .0001) c = hueRot(c, uB.z);
  /* kurva */
  if (uCv > 0){
    vec3 q = clamp(c, 0., 1.);
    if ((uCv & 2) != 0) q.r = cv(q.r, 1.); if ((uCv & 4) != 0) q.g = cv(q.g, 2.); if ((uCv & 8) != 0) q.b = cv(q.b, 3.);
    if ((uCv & 1) != 0){ float y0 = luma(q), y1 = cv(y0, 0.); q = q + (y1 - y0); }
    if ((uCv & 112) != 0){
      vec3 hv = rgb2hsv(clamp(q, 0., 1.));
      if ((uCv & 16) != 0) hv.x = fract(hv.x + (cv(hv.x, 4.) - .5) * .5);
      if ((uCv & 32) != 0) hv.y = clamp(hv.y * exp2((cv(hv.x, 5.) - .5) * 4.), 0., 1.);
      if ((uCv & 64) != 0) hv.y = clamp(hv.y * exp2((cv(luma(q), 6.) - .5) * 4.), 0., 1.);
      q = hsv2rgb(hv);
    }
    c = q + (c - clamp(c, 0., 1.));
  }
  /* LUT 3D */
  if (uLutMix > 0.){ vec3 q = clamp(c, 0., 1.); vec3 t = q * (uLutN - 1.) / uLutN + .5 / uLutN; c = mix(c, texture(uLut, t).rgb, uLutMix); }
  /* filter cepat */
  if (uFltMix > 0.){ vec3 q = clamp(c, 0., 1.); vec3 t = q * (uFltN - 1.) / uFltN + .5 / uFltN; c = mix(c, texture(uFlt, t).rgb, uFltMix); }
  return c;
}
float qualMaskB(int i, vec3 c, vec2 uv){
  float m = qualMask(i, c);
  if (uN2[i].x > .5 && uN6[i].x > .001){
    /* bersihkan mask: rata-rata qualifier di sekitar piksel (mengurangi mask berkedip/berbintik) */
    vec2 r = uSrcPx * (1. + uN6[i].x * 8.); float s = m * 2.; float n = 2.;
    for (int k = 0; k < 8; k++){ float a = float(k) * .785398; vec2 off = vec2(cos(a), sin(a)) * r; s += qualMask(i, primary(samp(uv + off).rgb)); n += 1.; }
    m = s / n;
  }
  if (uN6[i].y > .001) m = smoothstep(uN6[i].y * .45, 1. - uN6[i].y * .45, m);
  return m;
}
vec3 grade(vec3 c, vec2 uv, out float mshow){
  mshow = 0.;
  c = primary(c);
  /* node sekunder (power window + qualifier) */
  for (int i = 0; i < 4; i++){
    if (i >= uNN) break;
    if (uN5[i].w < .5) continue;
    float m = winMask(i, uv) * qualMaskB(i, c, uv);
    if (uShowMask == i + 1) mshow = m;
    if (m <= .0001) continue;
    vec3 d = c;
    d = pow(max(d, 0.), vec3(2.2)); d *= exp2(uN4[i].x); d = pow(max(d, 0.), vec3(1./2.2));
    d = wb(d, uN5[i].x, uN5[i].y);
    d = (d - .435) * uN4[i].y + .435;
    float dl = luma(d); d = mix(vec3(dl), d, uN4[i].z);
    if (abs(uN4[i].w) > .0001) d = hueRot(d, uN4[i].w);
    c = mix(c, d, m);
  }
  return c;
}
void main(){
  vec2 q = vec2(gl_FragCoord.x, uOut.y - gl_FragCoord.y);
  vec3 u3 = uM * vec3(q, 1.); vec2 uv = u3.xy;
  /* lensa (distorsi barrel / pincushion) */
  if (abs(uLens.x) > .0001 || abs(uLens.y) > .0001){ vec2 d = uv - .5; d.x *= uAsp; float r2 = dot(d, d); d *= (1. + uLens.x * r2 * 1.6) / (1. + uLens.y); d.x /= uAsp; uv = d + .5; }
  if (uv.x < uCrop.x || uv.y < uCrop.y || uv.x > 1. - uCrop.z || uv.y > 1. - uCrop.w){ o = vec4(0.); return; }
  /* stabilizer: geser/putar/skala sumber berlawanan arah guncangan */
  if (uStabOn == 1){ vec2 d = (uv - .5) / uStabZ - uStab.xy; d.x *= uAsp; float ca = cos(-uStab.z), sa = sin(-uStab.z); d = vec2(d.x * ca - d.y * sa, d.x * sa + d.y * ca) / exp(uStab.w); d.x /= uAsp; uv = d + .5; if (uv.x < 0. || uv.y < 0. || uv.x > 1. || uv.y > 1.){ o = vec4(0.); return; } }
  vec4 s = samp(uv);
  if (uSharp > .001){ vec4 b = (samp(uv + vec2(uSrcPx.x, 0.)) + samp(uv - vec2(uSrcPx.x, 0.)) + samp(uv + vec2(0., uSrcPx.y)) + samp(uv - vec2(0., uSrcPx.y))) * .25; s.rgb += (s.rgb - b.rgb) * uSharp * 2.5; }
  vec3 c = s.rgb; float a = s.a;
  /* chroma key (green screen) */
  if (uKeyX.x > .5){
    float y = dot(c, vec3(.299, .587, .114)); vec2 cc = vec2((c.b - y) * .565, (c.r - y) * .713);
    float d = distance(cc, uKey.xy) * 2.6; float k = smoothstep(uKey.z, uKey.z + uKey.w + .001, d); a *= k;
    if (uKeyX.y > 0.){ vec3 kc = uKeyRGB; float sp = (1. - k) * uKeyX.y; if (kc.g >= kc.r && kc.g >= kc.b) c.g = mix(c.g, min(c.g, max(c.r, c.b)), clamp(sp + uKeyX.y * .5, 0., 1.)); else if (kc.b >= kc.r) c.b = mix(c.b, min(c.b, max(c.r, c.g)), clamp(sp + uKeyX.y * .5, 0., 1.)); }
  }
  float ms = 0.;
  if (uG == 1) c = grade(c, uv, ms);
  if (uShowMask > 0) c = mix(vec3(luma(clamp(c,0.,1.))) * .25, vec3(1., .2, .55) * (.4 + .6 * luma(clamp(c,0.,1.))), ms) + c * ms * .6;
  a *= uOpacity;
  o = vec4(c * a, a);
}`;
/* ---------- campur lapisan ---------- */
const FS_BLEND = GLSL_COMMON + `
uniform sampler2D uBase; uniform sampler2D uLay; uniform int uMode;
vec3 bl(vec3 b, vec3 s){
  if (uMode == 1) return b * s;
  if (uMode == 2) return b + s - b * s;
  if (uMode == 3) return mix(2. * b * s, 1. - 2. * (1. - b) * (1. - s), step(.5, b));
  if (uMode == 4) return mix(b - (1. - 2. * s) * b * (1. - b), b + (2. * s - 1.) * (sqrt(max(b, 0.)) - b), step(.5, s));
  if (uMode == 5) return b + s;
  if (uMode == 6) return min(b, s);
  if (uMode == 7) return max(b, s);
  if (uMode == 8) return abs(b - s);
  if (uMode == 9) return mix(b, b / max(1. - s, .001), step(0., s));
  return s;
}
void main(){
  vec4 B = texture(uBase, v), L = texture(uLay, v);
  if (uMode == 0){ o = L + B * (1. - L.a); return; }
  vec3 bc = B.a > 0. ? B.rgb / B.a : vec3(0.), sc = L.a > 0. ? L.rgb / L.a : vec3(0.);
  vec3 cs = (1. - B.a) * sc + B.a * bl(bc, sc);
  o = vec4(L.a * cs + (1. - L.a) * B.rgb, L.a + B.a * (1. - L.a));
}`;
/* ---------- transisi ---------- */
const FS_TRANS = GLSL_COMMON + `
uniform sampler2D uTA; uniform sampler2D uTB; uniform float uP; uniform int uType; uniform vec2 uRes;
vec4 dblur(sampler2D t, vec2 uv, vec2 dir){ vec4 s = vec4(0.); for (int i = 0; i < 16; i++){ float k = float(i) / 15. - .5; s += texture(t, uv + dir * k); } return s / 16.; }
vec4 zblur(sampler2D t, vec2 uv, float amt){ vec4 s = vec4(0.); for (int i = 0; i < 16; i++){ float k = 1. - amt * float(i) / 15.; s += texture(t, (uv - .5) * k + .5); } return s / 16.; }
void main(){
  float p = clamp(uP, 0., 1.); vec2 uv = v; float e = p * p * (3. - 2. * p);
  if (uType == 1){ o = mix(texture(uTA, uv), texture(uTB, uv), e); return; }
  if (uType == 2){ vec4 k = p < .5 ? texture(uTA, uv) * (1. - p * 2.) : texture(uTB, uv) * (p * 2. - 1.); o = vec4(k.rgb, max(k.a, 1.)); return; }
  if (uType == 3){ vec4 w = vec4(1.); o = p < .5 ? mix(texture(uTA, uv), w, p * 2.) : mix(w, texture(uTB, uv), p * 2. - 1.); return; }
  if (uType == 4){ float x = e; vec2 d = vec2(.35 * sin(p * 3.14159), 0.); o = (uv.x + x <= 1.) ? dblur(uTA, uv + vec2(x, 0.), d) : dblur(uTB, uv - vec2(1. - x, 0.), d); return; }
  if (uType == 5){ float z = sin(p * 3.14159) * .55; vec4 a = zblur(uTA, (uv - .5) / (1. + e * 1.5) + .5, z), b = zblur(uTB, (uv - .5) / (1. + (1. - e) * 1.5) + .5, z); o = mix(a, b, smoothstep(.35, .65, p)); return; }
  if (uType == 6){ float x = e; o = uv.x < 1. - x ? texture(uTA, uv + vec2(x, 0.)) : texture(uTB, uv - vec2(1. - x, 0.)); return; }
  if (uType == 7){ float d = (uv.x + (1. - uv.y) * .3) / 1.3; float m = smoothstep(e - .06, e + .06, d * 1.12 - .06); o = mix(texture(uTB, uv), texture(uTA, uv), m); return; }
  if (uType == 8){ float k = sin(p * 3.14159); float row = floor(uv.y * 24.); float off = (hash(vec2(row, floor(p * 18.))) - .5) * .25 * k; vec2 u2 = uv + vec2(off, 0.); vec4 src = p < .5 ? vec4(texture(uTA, u2 + vec2(.02 * k, 0.)).r, texture(uTA, u2).g, texture(uTA, u2 - vec2(.02 * k, 0.)).b, 1.) : vec4(texture(uTB, u2 + vec2(.02 * k, 0.)).r, texture(uTB, u2).g, texture(uTB, u2 - vec2(.02 * k, 0.)).b, 1.); o = src; return; }
  if (uType == 9){ vec2 d = uv - .5; d.x *= uRes.x / uRes.y; float r = length(d) / length(vec2(uRes.x / uRes.y, 1.) * .5); float m = smoothstep(e * 1.05 - .03, e * 1.05, r); o = mix(texture(uTB, uv), texture(uTA, uv), m); return; }
  o = mix(texture(uTA, uv), texture(uTB, uv), e);
}`;
/* ---------- efek (lapisan penyesuaian) ---------- */
const FS_FX = GLSL_COMMON + `
uniform sampler2D uT; uniform sampler2D uT2; uniform int uType; uniform float uAmt; uniform vec4 uQ; uniform vec3 uC1; uniform vec3 uC2; uniform float uTime; uniform float uProg; uniform vec2 uRes;
vec4 tx(vec2 uv){ return texture(uT, clamp(uv, vec2(0.), vec2(1.))); }
void main(){
  vec2 uv = v; float a = uAmt; float t = uTime; vec2 asp = vec2(uRes.x / uRes.y, 1.);
  if (uType == 1 || uType == 2){
    float env = uType == 2 ? exp(-uProg * 7.) : 1.; float f = uType == 2 ? 28. : 6. + uQ.x * 20.;
    vec2 off = vec2(noise1(t * f) - .5, noise1(t * f + 31.7) - .5) * a * (uType == 2 ? .12 : .045) * env;
    float z = 1. + a * (uType == 2 ? .12 * env : .05); float r = (noise1(t * f + 9.) - .5) * a * .03 * env;
    vec2 d = (uv - .5) / z; d *= asp; d = vec2(d.x * cos(r) - d.y * sin(r), d.x * sin(r) + d.y * cos(r)); d /= asp;
    o = tx(d + .5 + off); return;
  }
  if (uType == 3){
    float tt = floor(t * (8. + uQ.x * 16.)); float on = step(1. - a * .8, hash(vec2(tt, 3.)));
    float row = floor(uv.y * (8. + 30. * hash(vec2(tt, 1.)))); float off = (hash(vec2(row, tt)) - .5) * .18 * a * on * step(.55, hash(vec2(row * 1.7, tt)));
    vec2 u2 = uv + vec2(off, 0.); float sp = .012 * a * (on + .3);
    o = vec4(tx(u2 + vec2(sp, 0.)).r, tx(u2).g, tx(u2 - vec2(sp, 0.)).b, tx(u2).a);
    if (on > .5 && hash(vec2(row, tt * 3.)) > .93) o.rgb = vec3(hash(uv * 99. + tt));
    return;
  }
  if (uType == 4){ vec2 d = (uv - .5) * a * .035; o = vec4(tx(uv + d).r, tx(uv).g, tx(uv - d).b, tx(uv).a); return; }
  if (uType == 5){ vec4 c = tx(uv); float n = hash(uv * uRes + fract(t * 24.) * 97.) - .5; float lw = 1. - abs(luma(c.rgb) - .5) * 1.2; c.rgb += n * a * .22 * lw; o = c; return; }
  if (uType == 6){
    float j = (noise1(t * 3.) - .5) * .004 * a; vec2 u2 = uv + vec2(j + (hash(vec2(floor(uv.y * 240.), floor(t * 30.))) - .5) * .002 * a, 0.);
    float band = smoothstep(.0, .02, abs(fract(uv.y - t * .12) - .5) - .45); u2.x += (1. - band) * .02 * a;
    vec3 c = vec3(tx(u2 + vec2(.004 * a, 0.)).r, tx(u2).g, tx(u2 - vec2(.006 * a, 0.)).b);
    c = mix(c, vec3(luma(c)), .25 * a); c *= 1. - .18 * a * step(.5, fract(uv.y * uRes.y * .5));
    c += (hash(uv * uRes + t) - .5) * .12 * a; c = mix(c, c * vec3(1.05, .98, 1.08), a);
    o = vec4(c, 1.); return;
  }
  if (uType == 7){
    vec4 c = tx(uv); vec2 p1 = vec2(.15 + .3 * sin(t * .4), .2 + .2 * cos(t * .3)), p2 = vec2(.85 + .2 * cos(t * .35), .8 + .2 * sin(t * .5));
    float l1 = exp(-length((uv - p1) * asp) * 2.4), l2 = exp(-length((uv - p2) * asp) * 2.);
    vec3 leak = uC1 * l1 + uC2 * l2 * .8; c.rgb = 1. - (1. - c.rgb) * (1. - leak * a * 1.1); o = c; return;
  }
  if (uType == 8){
    vec4 c = tx(uv); vec2 lp = uQ.xy; vec2 d = (uv - lp) * asp; float r = length(d);
    vec3 fl = uC1 * (exp(-r * 9.) * 1.3 + exp(-abs(d.y) * 160.) * exp(-abs(d.x) * 2.2) * .7);
    vec2 g = (vec2(.5) - lp); for (int i = 1; i < 5; i++){ vec2 gp = lp + g * (float(i) * .55); float gr = length((uv - gp) * asp); fl += uC1 * vec3(.6, .8, 1.) * smoothstep(.06 + float(i) * .015, .0, gr) * .18; }
    c.rgb += fl * a; o = c; return;
  }
  if (uType == 10){ vec2 dir = vec2(cos(uQ.x), sin(uQ.x)) * a * .08 / asp; vec4 s = vec4(0.); for (int i = 0; i < 24; i++){ s += tx(uv + dir * (float(i) / 23. - .5)); } o = s / 24.; return; }
  if (uType == 11){ vec4 s = vec4(0.); vec2 c0 = uQ.xy; for (int i = 0; i < 24; i++){ float k = 1. - a * .22 * float(i) / 23.; s += tx((uv - c0) * k + c0); } o = s / 24.; return; }
  if (uType == 12){ vec4 c = tx(uv); vec2 d = (uv - .5) * asp / asp.x * 1.4; float vg = smoothstep(.3 + (1. - a) * .5, 1.1, length(d) * (1. + uQ.x)); c.rgb *= 1. - vg * a; o = c; return; }
  if (uType == 15){ vec4 c = tx(uv); float l = luma(c.rgb); l = (l - .5) * (1. + uQ.x) + .5; o = vec4(mix(c.rgb, vec3(l), a), c.a); return; }
  if (uType == 16){ vec4 c = tx(uv); vec3 s = vec3(dot(c.rgb, vec3(.393, .769, .189)), dot(c.rgb, vec3(.349, .686, .168)), dot(c.rgb, vec3(.272, .534, .131))); s = mix(vec3(.08, .06, .05), vec3(.96, .9, .8), s * .92); vec2 d = (uv - .5) * 1.3; s *= 1. - dot(d, d) * .5; o = vec4(mix(c.rgb, s, a), c.a); return; }
  if (uType == 17){ vec4 c = tx(uv); float l = smoothstep(0., 1., luma(c.rgb)); o = vec4(mix(c.rgb, mix(uC1, uC2, l), a), c.a); return; }
  if (uType == 18){ vec4 c = tx(uv); float tr = uRes.x / uRes.y, ar = mix(tr, max(tr, uQ.x), a); float hh = tr / ar; float bar = (1. - hh) * .5; if (uv.y < bar || uv.y > 1. - bar) c = vec4(0., 0., 0., 1.); o = c; return; }
  if (uType == 19){ vec4 c = tx(uv); float env = sin(clamp(uProg, 0., 1.) * 3.14159); env = pow(env, 1.5 + uQ.x * 3.); c.rgb = mix(c.rgb, uC1, env * a); o = c; return; }
  if (uType == 20){ vec4 c = tx(uv); float f = 2. + uQ.x * 18.; float on = step(.5, fract(t * f)); c.rgb = mix(c.rgb, uQ.y > .5 ? vec3(1.) - c.rgb : vec3(1.), on * a * (uQ.y > .5 ? 1. : .85)); o = c; return; }
  if (uType == 21){ vec2 u2 = uv; if (uQ.x < .5) u2.x = u2.x > .5 ? 1. - u2.x : u2.x; else if (uQ.x < 1.5) u2.y = u2.y > .5 ? 1. - u2.y : u2.y; else { vec2 d = (uv - .5) * asp; float ang = atan(d.y, d.x), r = length(d); float seg = 6.2831853 / (4. + floor(a * 8.)); ang = abs(mod(ang, seg) - seg * .5); u2 = vec2(cos(ang), sin(ang)) * r / asp + .5; } o = tx(u2); return; }
  if (uType == 22){ vec2 c0 = uQ.xy, hs = uQ.zw * .5; vec2 d = abs(uv - c0); float inside = (uQ.z >= .999 || (d.x < hs.x && d.y < hs.y)) ? 1. : 0.; float bs = mix(4., 90., a) / uRes.y; vec2 cell = vec2(bs * uRes.y / uRes.x, bs); vec2 u2 = (floor(uv / cell) + .5) * cell; o = inside > .5 ? tx(u2) : tx(uv); return; }
  if (uType == 23){ vec2 px = 1. / uRes * (1. + uQ.x * 2.); vec4 c = tx(uv); vec4 b = (tx(uv + vec2(px.x, 0.)) + tx(uv - vec2(px.x, 0.)) + tx(uv + vec2(0., px.y)) + tx(uv - vec2(0., px.y))) * .25; c.rgb += (c.rgb - b.rgb) * a * 3.; o = c; return; }
  if (uType == 24){
    vec2 c0 = vec2(.5); vec2 d = (uv - c0) * asp; float ang = atan(d.y, d.x), r = length(d);
    float ln = hash(vec2(floor(ang * 60.), floor(t * 12.))); float streak = step(.62, ln) * smoothstep(.18, .75, r) * (.6 + .4 * hash(vec2(floor(ang * 60.), 1.)));
    vec4 s = vec4(0.); for (int i = 0; i < 12; i++){ float k = 1. - a * .08 * float(i) / 11. * smoothstep(.1, .7, r); s += tx((uv - c0) * k + c0); } s /= 12.;
    s.rgb = mix(s.rgb, uC1, streak * a * .75); o = s; return;
  }
  if (uType == 30){ vec4 c = tx(uv), b = texture(uT2, uv); o = vec4(c.rgb + b.rgb * a * 1.6 * uC1, c.a); return; } /* glow / halation: tambah hasil blur */
  if (uType == 31){ vec4 c = tx(uv); float l = luma(c.rgb); float k = smoothstep(uQ.x, uQ.x + .15, l); o = vec4(c.rgb * k, k); return; } /* ambang highlight */
  o = tx(uv);
}`;
const FS_BLUR = GLSL_COMMON + `
uniform sampler2D uT; uniform vec2 uDir;
void main(){ vec4 s = texture(uT, v) * .1964825501511404; vec2 o1 = uDir * 1.411764705882353, o2 = uDir * 3.2941176470588234, o3 = uDir * 5.176470588235294;
  s += (texture(uT, v + o1) + texture(uT, v - o1)) * .2969069646728344; s += (texture(uT, v + o2) + texture(uT, v - o2)) * .09447039785044732; s += (texture(uT, v + o3) + texture(uT, v - o3)) * .010381362401148057; o = s; }`;
const FS_OUT = GLSL_COMMON + `
uniform sampler2D uT; uniform sampler2D uT2; uniform float uSplit; uniform vec3 uBg; uniform vec2 uOutSz; uniform float uDith;
void main(){
  vec4 c = texture(uT, v);
  if (uSplit > 0. && v.x < uSplit) c = texture(uT2, v);
  vec3 r = c.rgb + uBg * (1. - c.a);
  r += (hash(gl_FragCoord.xy + fract(uDith) * 61.) + hash(gl_FragCoord.yx * 1.31 + 7.) - 1.) / 255. * step(.5, uDith + .5);
  if (uSplit > 0. && abs(v.x - uSplit) * uOutSz.x < 1.) r = vec3(1.);
  o = vec4(clamp(r, 0., 1.), 1.);
}`;
const FS_NR = GLSL_COMMON + `
uniform sampler2D uT; uniform sampler2D uH; uniform vec2 uPx; uniform vec4 uP;
vec3 toY(vec3 c){ float y = dot(c, vec3(.299, .587, .114)); return vec3(y, (c.b - y) * .565, (c.r - y) * .713); }
vec3 toR(vec3 q){ return vec3(q.x + 1.403 * q.z, q.x - .344 * q.y - .714 * q.z, q.x + 1.773 * q.y); }
void main(){
  vec4 s0 = texture(uT, v); vec3 yc = toY(s0.rgb);
  if (uP.x > .001 || uP.y > .001){
    float sl = .015 + uP.x * .2, sc = .02 + uP.y * .32; vec2 st = uPx * (1. + max(uP.x, uP.y) * 1.2);
    float ay = 0., wy = 0.; vec2 ac = vec2(0.); float wc = 0.;
    for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++){
      vec2 o2 = vec2(float(i), float(j)); vec3 q = toY(texture(uT, v + o2 * st).rgb);
      float sp = exp(-dot(o2, o2) / 4.5);
      float dl = (q.x - yc.x) / sl; float w1 = sp * exp(-dl * dl);
      vec2 dc = (q.yz - yc.yz) / sc; float w2 = sp * exp(-dot(dc, dc));
      ay += q.x * w1; wy += w1; ac += q.yz * w2; wc += w2;
    }
    if (uP.x > .001) yc.x = mix(yc.x, ay / wy, min(1., uP.x * 1.2));
    if (uP.y > .001) yc.yz = mix(yc.yz, ac / wc, min(1., uP.y * 1.2));
  }
  vec3 c = toR(yc);
  if (uP.z > .001 && uP.w > .5){
    vec3 h = texture(uH, v).rgb; vec3 d = toY(c) - toY(h);
    float diff = abs(d.x) + length(d.yz) * .5;
    float k = uP.z * .82 * (1. - smoothstep(.015 + uP.z * .03, .05 + uP.z * .07, diff));
    c = mix(c, h, k);
  }
  o = vec4(clamp(c, 0., 1.), s0.a);
}`;
const FS_COPY = GLSL_COMMON + `uniform sampler2D uT; void main(){ o = texture(uT, v); }`;
/* ---------- utilitas GL ---------- */
function glCompile(gl, vs, fs) {
  const mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error('Shader: ' + gl.getShaderInfoLog(sh)); return sh; };
  const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Link: ' + gl.getProgramInfoLog(p));
  const U = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const inf = gl.getActiveUniform(p, i); const nm = inf.name.replace(/\[0\]$/, ''); U[nm] = gl.getUniformLocation(p, inf.name); }
  return { p, U };
}
function glInit(cv) {
  const gl = cv.getContext('webgl2', { alpha: false, premultipliedAlpha: false, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  if (!gl) throw new Error('Browser tidak mendukung WebGL2. Gunakan Chrome, Edge, Safari, atau Firefox terbaru.');
  GLR.gl = gl; GLR.cv = cv;
  GLR.half = !!gl.getExtension('EXT_color_buffer_float') || !!gl.getExtension('EXT_color_buffer_half_float');
  gl.getExtension('OES_texture_float_linear');
  GLR.prog.layer = glCompile(gl, VS_SRC, FS_LAYER);
  GLR.prog.blend = glCompile(gl, VS_SRC, FS_BLEND);
  GLR.prog.trans = glCompile(gl, VS_SRC, FS_TRANS);
  GLR.prog.fx = glCompile(gl, VS_SRC, FS_FX);
  GLR.prog.blur = glCompile(gl, VS_SRC, FS_BLUR);
  GLR.prog.out = glCompile(gl, VS_SRC, FS_OUT);
  GLR.prog.copy = glCompile(gl, VS_SRC, FS_COPY);
  GLR.prog.nr = glCompile(gl, VS_SRC, FS_NR);
  GLR.vao = gl.createVertexArray();
  /* tekstur default */
  GLR.white = mkTex2D(1, 1, new Uint8Array([255, 255, 255, 255]));
  GLR.curveId = mkCurveTex(null);
  const lid = gl.createTexture(); gl.bindTexture(gl.TEXTURE_3D, lid); gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, 1, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  GLR.lut0 = lid;
  cv.addEventListener('webglcontextlost', e => { e.preventDefault(); GLR.ok = false; toast('GPU sibuk/terputus. Muat ulang halaman bila pratinjau hitam.', true); });
  GLR.ok = true;
}
function mkTex2D(w, h, data) {
  const gl = GLR.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  if (data) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  return t;
}
function mkFB(w, h) {
  const gl = GLR.gl, t = mkTex2D(w, h, null);
  if (GLR.half) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE && GLR.half) { GLR.half = false; gl.deleteFramebuffer(f); gl.deleteTexture(t); return mkFB(w, h); }
  return { f, t, w, h };
}
function ensureFB(w, h) {
  if (GLR.w === w && GLR.h === h && GLR.fb.A) return;
  const gl = GLR.gl; for (const k in GLR.fb) { gl.deleteFramebuffer(GLR.fb[k].f); gl.deleteTexture(GLR.fb[k].t); }
  GLR.fb = {}; ['A', 'B', 'L1', 'L2', 'L3', 'T1', 'T2', 'U'].forEach(k => GLR.fb[k] = mkFB(w, h));
  const hw = Math.max(1, w >> 1), hh = Math.max(1, h >> 1); GLR.fb.H1 = mkFB(hw, hh); GLR.fb.H2 = mkFB(hw, hh);
  GLR.w = w; GLR.h = h;
}
function drawTo(fb, prog, setU) {
  const gl = GLR.gl; gl.bindFramebuffer(gl.FRAMEBUFFER, fb ? fb.f : null);
  gl.viewport(0, 0, fb ? fb.w : GLR.cv.width, fb ? fb.h : GLR.cv.height);
  gl.useProgram(prog.p); gl.bindVertexArray(GLR.vao); let unit = 0;
  const S = {
    t: (n, tex, kind) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(kind === 3 ? gl.TEXTURE_3D : gl.TEXTURE_2D, tex); if (prog.U[n] != null) gl.uniform1i(prog.U[n], unit); unit++; },
    f: (n, a, b, c, d) => { const u = prog.U[n]; if (u == null) return; if (d != null) gl.uniform4f(u, a, b, c, d); else if (c != null) gl.uniform3f(u, a, b, c); else if (b != null) gl.uniform2f(u, a, b); else gl.uniform1f(u, a); },
    i: (n, a) => { const u = prog.U[n]; if (u != null) gl.uniform1i(u, a); },
    v4: (n, arr) => { const u = prog.U[n]; if (u != null) gl.uniform4fv(u, arr); },
    v1: (n, arr) => { const u = prog.U[n]; if (u != null) gl.uniform1fv(u, arr); },
    m3: (n, m) => { const u = prog.U[n]; if (u != null) gl.uniformMatrix3fv(u, false, m); }
  };
  setU(S);
  gl.disable(gl.BLEND); gl.drawArrays(gl.TRIANGLES, 0, 3);
}
function clearFB(fb, r, g, b, a) { const gl = GLR.gl; gl.bindFramebuffer(gl.FRAMEBUFFER, fb.f); gl.viewport(0, 0, fb.w, fb.h); gl.clearColor(r, g, b, a); gl.clear(gl.COLOR_BUFFER_BIT); }
/* ---------- tekstur sumber ---------- */
function upload(key, src, w, h, always) {
  const gl = GLR.gl; let e = GLR.tex.get(key);
  if (!e) { e = { t: mkTex2D(1, 1, null), w: 0, h: 0, src: null, stamp: -1 }; GLR.tex.set(key, e); }
  e.used = performance.now();
  if (always !== true && e.src === src && e.w === w && e.h === h && (always == null || always === e.stamp)) return e;
  e.stamp = always;
  gl.bindTexture(gl.TEXTURE_2D, e.t);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  try {
    if (src && src.half) { gl.pixelStorei(gl.UNPACK_ALIGNMENT, 2); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB16F, src.w, src.h, 0, gl.RGB, gl.HALF_FLOAT, src.half); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4); }
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    e.w = w; e.h = h; e.src = src;
  }
  catch (er) { console.warn('upload', er); }
  return e;
}
function dropTex(key) { const e = GLR.tex.get(key); if (e) { GLR.gl.deleteTexture(e.t); GLR.tex.delete(key); } }
function gcTex() { const now = performance.now(); for (const [k, e] of GLR.tex) if (now - e.used > 20000 && !/^lut:/.test(k)) dropTex(k); }
/* ---------- tekstur kurva (1024 x 8) ---------- */
function monotone(pts) { /* interpolasi kubik monoton (Fritsch-Carlson) */
  const p = pts.slice().sort((a, b) => a[0] - b[0]); const n = p.length; if (n < 2) return x => x;
  const dx = [], dy = [], m = [];
  for (let i = 0; i < n - 1; i++) { dx.push(p[i + 1][0] - p[i][0] || 1e-6); dy.push(p[i + 1][1] - p[i][1]); m.push(dy[i] / dx[i]); }
  const t = [m[0]]; for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2); t.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) { if (m[i] === 0) { t[i] = t[i + 1] = 0; continue; } const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b; if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; } }
  return x => { if (x <= p[0][0]) return p[0][1]; if (x >= p[n - 1][0]) return p[n - 1][1]; let i = 0; while (i < n - 2 && x > p[i + 1][0]) i++; const h = dx[i], u = (x - p[i][0]) / h, u2 = u * u, u3 = u2 * u; return (2 * u3 - 3 * u2 + 1) * p[i][1] + (u3 - 2 * u2 + u) * h * t[i] + (-2 * u3 + 3 * u2) * p[i + 1][1] + (u3 - u2) * h * t[i + 1]; };
}
function periodic(pts) { /* kurva hue melingkar: titik [x 0..1, y 0..1, netral .5] */
  const p = pts.slice().sort((a, b) => a[0] - b[0]); if (!p.length) return () => .5;
  const ext = [[p[p.length - 1][0] - 1, p[p.length - 1][1]]].concat(p, [[p[0][0] + 1, p[0][1]]]);
  const f = monotone(ext); return x => f(x);
}
function curveData(g) {
  const W = 1024, d = new Float32Array(W * 8); let mask = 0;
  const rows = [['y', 0, 1], ['r', 1, 2], ['g', 2, 4], ['b', 3, 8]];
  for (const [k, r, bit] of rows) { const pts = g && g.cv && g.cv[k]; const f = pts && pts.length >= 2 ? monotone(pts) : null; if (f) mask |= bit; for (let i = 0; i < W; i++) { const x = i / (W - 1); d[r * W + i] = f ? f(x) : x; } }
  [['hvh', 4, 16], ['hvs', 5, 32], ['lvs', 6, 64]].forEach(([k, r, bit]) => { const pts = g && g[k]; const f = pts && pts.length ? (k === 'lvs' ? monotone([[0, .5]].concat(pts, [[1, .5]]).filter((x, i, a) => i === 0 || x[0] > a[i - 1][0] || i === a.length - 1)) : periodic(pts)) : null; if (f) mask |= bit; for (let i = 0; i < W; i++) d[r * W + i] = f ? f(i / (W - 1)) : .5; });
  return { d, mask };
}
function mkCurveTex(g) {
  const gl = GLR.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const { d } = curveData(g); gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, 1024, 8, 0, gl.RED, gl.FLOAT, d);
  return t;
}
const CURVE_CACHE = new Map();
function curveTexFor(g) {
  const key = JSON.stringify([g.cv, g.hvh, g.hvs, g.lvs]);
  let e = CURVE_CACHE.get(key);
  if (!e) { const { mask } = curveData(g); e = { t: mask ? mkCurveTex(g) : GLR.curveId, mask }; CURVE_CACHE.set(key, e); if (CURVE_CACHE.size > 60) { const k0 = CURVE_CACHE.keys().next().value, e0 = CURVE_CACHE.get(k0); if (e0.t !== GLR.curveId) GLR.gl.deleteTexture(e0.t); CURVE_CACHE.delete(k0); } }
  return e;
}
/* ---------- LUT 3D (.cube) ---------- */
const LUTS = {}; /* id -> {name, n, data} */
function parseCube(text, name) {
  let n = 0; const vals = []; let dmin = [0, 0, 0], dmax = [1, 1, 1];
  for (const raw of text.split(/\r?\n/)) {
    const l = raw.trim(); if (!l || l[0] === '#') continue;
    const up = l.toUpperCase();
    if (up.startsWith('LUT_3D_SIZE')) { n = parseInt(l.split(/\s+/)[1]); continue; }
    if (up.startsWith('LUT_1D_SIZE')) throw new Error('LUT 1D belum didukung, gunakan LUT 3D (.cube)');
    if (up.startsWith('DOMAIN_MIN')) { dmin = l.split(/\s+/).slice(1).map(Number); continue; }
    if (up.startsWith('DOMAIN_MAX')) { dmax = l.split(/\s+/).slice(1).map(Number); continue; }
    if (/^[A-Z_]/.test(up)) continue;
    const p = l.split(/\s+/); if (p.length >= 3) vals.push(+p[0], +p[1], +p[2]);
  }
  if (!n || vals.length < n * n * n * 3) throw new Error('File LUT tidak valid');
  if (n > 129) throw new Error('Ukuran LUT terlalu besar');
  return { name, n, data: new Float32Array(vals.slice(0, n * n * n * 3)), dmin, dmax };
}
function lutTex(id) {
  const L = LUTS[id]; if (!L) return null;
  let e = GLR.tex.get('lut:' + id); if (e) return e;
  const gl = GLR.gl, t = gl.createTexture(), n = L.n, rgba = new Float32Array(n * n * n * 4);
  for (let i = 0; i < n * n * n; i++) { rgba[i * 4] = L.data[i * 3]; rgba[i * 4 + 1] = L.data[i * 3 + 1]; rgba[i * 4 + 2] = L.data[i * 3 + 2]; rgba[i * 4 + 3] = 1; }
  gl.bindTexture(gl.TEXTURE_3D, t);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  ['TEXTURE_WRAP_S', 'TEXTURE_WRAP_T', 'TEXTURE_WRAP_R'].forEach(k => gl.texParameteri(gl.TEXTURE_3D, gl[k], gl.CLAMP_TO_EDGE));
  gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA16F, n, n, n, 0, gl.RGBA, gl.FLOAT, rgba);
  e = { t, n, used: Infinity }; GLR.tex.set('lut:' + id, e); return e;
}
/* ---------- transform lapisan ---------- */
const BLEND_MODES = ['normal', 'multiply', 'screen', 'overlay', 'softlight', 'add', 'darken', 'lighten', 'difference', 'dodge'];
function layerMatrix(W, H, sw, sh, T) {
  /* sw,sh: ukuran logis sumber; T: {x,y,scale,rot,flipH,flipV,fit,rs} -> matriks q(px) -> uv */
  let bw, bh;
  if (T.fit === 'fill') { const s = Math.max(W / sw, H / sh); bw = sw * s; bh = sh * s; }
  else if (T.fit === 'stretch') { bw = W; bh = H; }
  else if (T.fit === 'none') { bw = sw * T.rs; bh = sh * T.rs; }
  else { const s = Math.min(W / sw, H / sh); bw = sw * s; bh = sh * s; }
  const sc = Math.max(0.0001, T.scale / 100); bw *= sc; bh *= sc;
  const cx = W / 2 + T.x * W / 2, cy = H / 2 + T.y * H / 2, a = -T.rot * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a);
  /* uv = R(a)*(q - c) / (bw,bh) + .5 ; flip */
  let m00 = cs / bw, m01 = -sn / bw, m10 = sn / bh, m11 = cs / bh;
  let tx = -(m00 * cx + m01 * cy) + 0.5, ty = -(m10 * cx + m11 * cy) + 0.5;
  if (T.flipH) { m00 = -m00; m01 = -m01; tx = 1 - tx; }
  if (T.flipV) { m10 = -m10; m11 = -m11; ty = 1 - ty; }
  return { m: new Float32Array([m00, m10, 0, m01, m11, 0, tx, ty, 1]), bw, bh, cx, cy };
}
function hexRGB(h) { h = (h || '#000000').replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16) || 0; return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }
/* nilai animasi masuk/keluar */
function animState(c, lt, D) {
  const r = { op: 1, sc: 1, dx: 0, dy: 0, rot: 0 }; const p = c.p; if (!p) return r;
  const apply = (type, k, out) => { /* k: 0..1 progres menuju tampil penuh */
    const e = 1 - Math.pow(1 - k, 3);
    if (type === 'fade') r.op *= k;
    else if (type === 'zoomin') { r.sc *= lerp(out ? 1.25 : 0.6, 1, e); r.op *= Math.min(1, k * 2); }
    else if (type === 'zoomout') { r.sc *= lerp(out ? 0.6 : 1.4, 1, e); r.op *= Math.min(1, k * 2); }
    else if (type === 'left') { r.dx += (1 - e) * (out ? 2 : -2); }
    else if (type === 'right') { r.dx += (1 - e) * (out ? -2 : 2); }
    else if (type === 'up') { r.dy += (1 - e) * (out ? -2 : 2); }
    else if (type === 'down') { r.dy += (1 - e) * (out ? 2 : -2); }
    else if (type === 'spin') { r.rot += (1 - e) * (out ? 180 : -180); r.sc *= lerp(0.3, 1, e); r.op *= k; }
    else if (type === 'pop') { const b = k < 1 ? 1 + Math.sin(k * Math.PI) * 0.18 * (1 - k) * 2 : 1; r.sc *= lerp(0.2, 1, e) * b; r.op *= Math.min(1, k * 3); }
    else if (type === 'blur') { r.op *= k; r.sc *= lerp(1.08, 1, e); }
    else if (type === 'rise') { r.dy += (1 - e) * (out ? -0.15 : 0.15); r.op *= k; }
  };
  if (p.aIn && p.aIn !== 'none' && p.aIn !== 'type') { const d = Math.min(p.aInD || 0.5, D); if (lt < d) apply(p.aIn, clamp(lt / d, 0, 1), false); }
  if (p.aOut && p.aOut !== 'none' && p.aOut !== 'type') { const d = Math.min(p.aOutD || 0.5, D); if (lt > D - d) apply(p.aOut, clamp((D - lt) / d, 0, 1), true); }
  return r;
}
const DEFG_STR = JSON.stringify(defG());
const gdCache = new WeakMap();
function gradeIsDefault(c) { const g = c.g; if (!g) return true; if (c.flt && c.flt.id) return false; for (const k in (c.kf || {})) if (k.startsWith('g.')) return false; const o = Object.assign(defG(), g, { on: 1 }); if (!hdrActive(g)) o.hdr = null; return JSON.stringify(o) === DEFG_STR; }
/* ---------- pengurang noise video (spasial + temporal) per klip ---------- */
const NRS = new Map();
function mkFB8(w, h) { const gl = GLR.gl, t = mkTex2D(w, h, null); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); return { f, t, w, h }; }
function dropNR(id) { const s = NRS.get(id); if (!s) return; const gl = GLR.gl; [s.A, s.B].forEach(b => { gl.deleteFramebuffer(b.f); gl.deleteTexture(b.t); }); NRS.delete(id); }
function nrPass(c, tex, iw, ih, st) {
  const L = c.p.nrL / 100, C = c.p.nrC / 100, T = c.kind === 'video' ? c.p.nrT / 100 : 0;
  const k = Math.min(1, 3840 / Math.max(iw, ih)), w = Math.max(2, Math.round(iw * k)), h = Math.max(2, Math.round(ih * k));
  let s = NRS.get(c.id); if (!s || s.w !== w || s.h !== h) { if (s) dropNR(c.id); s = { A: mkFB8(w, h), B: mkFB8(w, h), w, h, outSt: null, histSt: null }; NRS.set(c.id, s); }
  const m = mediaById(c.media), fd = 1 / ((m && m.fps) || P.fps || 30);
  let useHist = false;
  if (s.outSt != null && st - s.outSt > 1e-6 && st - s.outSt < fd * 1.6) { const x = s.A; s.A = s.B; s.B = x; s.histSt = s.outSt; useHist = true; } /* bingkai berikutnya: hasil lama jadi riwayat */
  else if (s.outSt != null && Math.abs(st - s.outSt) < 1e-6 && s.histSt != null && st - s.histSt < fd * 1.6) useHist = true; /* bingkai sama, hitung ulang */
  else s.histSt = null;
  drawTo(s.A, GLR.prog.nr, S => { S.t('uT', tex.t); S.t('uH', s.B.t); S.f('uPx', 1 / w, 1 / h); S.f('uP', L, C, T, useHist ? 1 : 0); });
  s.outSt = st;
  return s.A;
}
/* transformasi efektif klip (nilai + zoom dinamis + animasi masuk/keluar): dipakai render & kotak overlay */
function clipXf(c, lt, D) {
  const V = k => valAt(c, 'p.' + k, lt), an = animState(c, lt, D);
  let sc = V('scale'), x = V('x'), y = V('y'), rot = V('rot');
  if (c.p.dz) { const k = clamp(lt / Math.max(0.001, D), 0, 1), e = c.p.dzE ? EASE[1](k) : k; sc *= lerp(c.p.dzS0, c.p.dzS1, e) / 100; x += lerp(c.p.dzX0, c.p.dzX1, e); y += lerp(c.p.dzY0, c.p.dzY1, e); }
  return { sc: sc * an.sc, x: x + an.dx, y: y + an.dy, rot: rot + an.rot, an };
}
/* ---------- render satu klip ke FBO lapisan ---------- */
function renderLayer(fb, c, t, src, opt) {
  /* src: {img, w, h, rot, key} */
  const W = fb.w, H = fb.h, D = clipDur(c), lt = clamp(t - c.start, 0, D), V = k => valAt(c, 'p.' + k, lt);
  const { sc, x, y, rot, an } = clipXf(c, lt, D);
  const rs = W / P.w;
  const L = layerMatrix(W, H, src.w, src.h, { x, y, scale: sc, rot, flipH: c.p.flipH, flipV: c.p.flipV, fit: c.p.fit || 'fit', rs });
  const tex = upload(src.key, src.img, src.iw || src.w, src.ih || src.h, src.live);
  let stex = tex;
  if (c.p && (c.p.nrL > 0 || c.p.nrC > 0 || c.p.nrT > 0)) stex = nrPass(c, tex, src.iw || src.w, src.ih || src.h, c.kind === 'video' ? srcTime(c, lt) : 0);
  const stb = c.kind === 'video' && c.p.stab && c.stab ? stabAt(c, srcTime(c, lt)) : null;
  const g = c.g, gOn = g && g.on && !(opt && opt.noGrade) && !gradeIsDefault(c);
  const cvx = gOn ? curveTexFor(g) : { t: GLR.curveId, mask: 0 };
  const lut = gOn && g.lut ? lutTex(g.lut) : null;
  const G = k => valAt(c, 'g.' + k, lt);
  drawTo(fb, GLR.prog.layer, S => {
    S.t('uSrc', stex.t); S.f('uSrcPx', 1 / Math.max(1, src.iw || src.w), 1 / Math.max(1, src.ih || src.h)); S.m3('uM', L.m); S.f('uOut', W, H);
    S.i('uRot', ({ 90: 1, 180: 2, 270: 3 })[src.rot || 0] || 0);
    S.f('uCrop', V('cl') / 100, V('ct') / 100, V('cr') / 100, V('cb') / 100); S.f('uLens', V('lens') / 100, V('lensZ') / 100); S.f('uAsp', src.w / src.h); S.f('uSharp', (V('sharp') || 0) / 100);
    S.f('uOpacity', clamp(V('opacity') / 100 * an.op, 0, 1) * (opt && opt.op != null ? opt.op : 1));
    if (c.p.key) { const k = hexRGB(c.p.keyC), yy = .299 * k[0] + .587 * k[1] + .114 * k[2]; S.f('uKey', (k[2] - yy) * .565, (k[0] - yy) * .713, V('keyTol') / 100, V('keySoft') / 100); S.f('uKeyX', 1, V('keySpill') / 100); S.f('uKeyRGB', k[0], k[1], k[2]); } else S.f('uKeyX', 0, 0);
    S.i('uG', gOn ? 1 : 0); S.i('uShowMask', opt && opt.showMask || 0);
    if (stb) { S.i('uStabOn', 1); S.f('uStab', stb[0], stb[1], stb[2], stb[3]); S.f('uStabZ', stb[4]); } else S.i('uStabOn', 0);
    if (gOn) {
      S.f('uA', G('exp'), G('temp') / 100, G('tint') / 100, G('con')); S.f('uB', G('piv'), G('sat'), G('hue') * Math.PI / 180, G('vib') / 100); S.f('uC', G('hl') / 100, G('sh') / 100, G('wh') / 100, G('bk') / 100);
      const w4 = k => { const a = g[k]; return [a[0], a[1], a[2], a[3]]; };
      S.f('uLift', ...w4('lift')); S.f('uGam', ...w4('gam')); S.f('uGain', ...w4('gain')); S.f('uOff', ...w4('off'));
      S.t('uCurve', cvx.t); S.i('uCv', cvx.mask);
      if (hdrActive(g)) { const hz = [], hs = []; HDR_KEYS.forEach(k => { const v = g.hdr[k] || [0, 0, 0, 0, 1]; hz.push(v[0], v[1], v[2], v[3]); hs.push(v[4]); }); S.i('uHDR', 1); S.v4('uHZ', hz); S.v1('uHS', hs); } else S.i('uHDR', 0);
      if (lut) { S.t('uLut', lut.t, 3); S.f('uLutMix', clamp(G('lutMix'), 0, 1)); S.f('uLutN', lut.n); } else { S.t('uLut', GLR.lut0, 3); S.f('uLutMix', 0); S.f('uLutN', 1); }
      const ft = c.flt && c.flt.id ? fltTex(c.flt.id) : null; if (ft) { S.t('uFlt', ft.t, 3); S.f('uFltMix', clamp(valAt(c, 'flt.amt', lt) / 100, 0, 1)); S.f('uFltN', ft.n); } else { S.t('uFlt', GLR.lut0, 3); S.f('uFltMix', 0); S.f('uFltN', 1); }
      const N = (g.nodes || []).slice(0, 4), a0 = [], a1 = [], a2 = [], a3 = [], a4 = [], a5 = [], a6 = [];
      N.forEach((n, i) => { const NV = k => valAt(c, 'g.nodes.' + i + '.' + k, lt); const wt = { none: 0, circle: 1, rect: 2, linear: 3 }[n.win] || 0;
        a0.push(wt, NV('cx'), NV('cy'), NV('ws')); a1.push(NV('ww'), NV('wh'), NV('wr') * Math.PI / 180, n.winv ? 1 : 0); a2.push(n.ql ? 1 : 0, n.qh, n.qhw, n.qsoft);
        a3.push(n.qs0, n.qs1, n.ql0, n.ql1); a4.push(NV('exp'), NV('con'), NV('sat'), NV('hue') * Math.PI / 180); a5.push(NV('temp') / 100, NV('tint') / 100, n.qinv ? 1 : 0, n.on ? 1 : 0); a6.push(n.qblur || 0, n.qclean || 0, 0, 0); });
      while (a0.length < 16) { a0.push(0, 0, 0, 0); a1.push(0, 0, 0, 0); a2.push(0, 0, 0, 0); a3.push(0, 0, 0, 0); a4.push(0, 1, 1, 0); a5.push(0, 0, 0, 0); a6.push(0, 0, 0, 0); }
      S.i('uNN', N.length); S.v4('uN0', a0); S.v4('uN1', a1); S.v4('uN2', a2); S.v4('uN3', a3); S.v4('uN4', a4); S.v4('uN5', a5); S.v4('uN6', a6);
    } else { S.t('uCurve', GLR.curveId); S.t('uLut', GLR.lut0, 3); S.f('uLutMix', 0); S.t('uFlt', GLR.lut0, 3); S.f('uFltMix', 0); S.i('uNN', 0); S.i('uHDR', 0); }
  });
  return L;
}
/* ---------- blur gaussian (2 lintasan, setengah resolusi untuk radius besar) ---------- */
function blurTo(srcTex, dst, tmp, radius) {
  const passes = Math.max(1, Math.min(6, Math.round(radius / 6)));
  let cur = srcTex;
  for (let i = 0; i < passes; i++) {
    const r = radius / passes / 4;
    drawTo(tmp, GLR.prog.blur, S => { S.t('uT', cur); S.f('uDir', r / tmp.w, 0); });
    drawTo(dst, GLR.prog.blur, S => { S.t('uT', tmp.t); S.f('uDir', 0, r / dst.h); });
    cur = dst.t;
  }
}

/* ---- f-render.js ---- */
/* ================= KOMPOSISI FRAME: track, transisi, efek ================= */
const D2R = Math.PI / 180;
const FX = [
  { id: 'shake', n: 'Getar Kamera', ty: 1, ps: [['amt', 'Intensitas', 50], ['q1', 'Kecepatan', 40]] },
  { id: 'impact', n: 'Hentakan (Impact)', ty: 2, ps: [['amt', 'Intensitas', 70]] },
  { id: 'glitch', n: 'Glitch', ty: 3, ps: [['amt', 'Intensitas', 60], ['q1', 'Kecepatan', 50]] },
  { id: 'rgb', n: 'RGB Split', ty: 4, ps: [['amt', 'Jarak', 50]] },
  { id: 'grain', n: 'Film Grain', ty: 5, ps: [['amt', 'Butiran', 35]] },
  { id: 'vhs', n: 'VHS Retro', ty: 6, ps: [['amt', 'Intensitas', 70]] },
  { id: 'leak', n: 'Light Leak', ty: 7, ps: [['amt', 'Intensitas', 60]], c1: '#ff7a20', c2: '#ff2d95' },
  { id: 'flare', n: 'Lens Flare', ty: 8, ps: [['amt', 'Kecerahan', 70], ['q1', 'Posisi X', 25], ['q2', 'Posisi Y', 25]], c1: '#ffd9a0' },
  { id: 'blur', n: 'Blur', ty: 9, ps: [['amt', 'Kekuatan', 40]] },
  { id: 'dblur', n: 'Motion Blur', ty: 10, ps: [['amt', 'Panjang', 50], ['q1', 'Sudut', 0, 0, 360]] },
  { id: 'zblur', n: 'Zoom Blur', ty: 11, ps: [['amt', 'Kekuatan', 50], ['q1', 'Pusat X', 50], ['q2', 'Pusat Y', 50]] },
  { id: 'vignette', n: 'Vignette', ty: 12, ps: [['amt', 'Kegelapan', 50], ['q1', 'Bentuk', 0]] },
  { id: 'glow', n: 'Glow / Bloom', ty: 13, ps: [['amt', 'Intensitas', 50], ['q1', 'Ambang', 60], ['q2', 'Radius', 40]], c1: '#ffffff' },
  { id: 'halation', n: 'Halation Sinematik', ty: 14, ps: [['amt', 'Intensitas', 45], ['q1', 'Ambang', 70], ['q2', 'Radius', 30]], c1: '#ff4a1c' },
  { id: 'bw', n: 'Hitam Putih', ty: 15, ps: [['amt', 'Campuran', 100], ['q1', 'Kontras', 20]] },
  { id: 'vintage', n: 'Vintage', ty: 16, ps: [['amt', 'Intensitas', 70]] },
  { id: 'duotone', n: 'Duotone', ty: 17, ps: [['amt', 'Campuran', 100]], c1: '#1b1464', c2: '#ff7a20' },
  { id: 'letterbox', n: 'Letterbox Sinematik', ty: 18, ps: [['amt', 'Tampil', 100], ['q1', 'Rasio x100', 239, 185, 276]] },
  { id: 'flash', n: 'Flash', ty: 19, ps: [['amt', 'Kekuatan', 100], ['q1', 'Ketajaman', 30]], c1: '#ffffff' },
  { id: 'strobe', n: 'Strobo', ty: 20, ps: [['amt', 'Kekuatan', 70], ['q1', 'Frekuensi', 30], ['q2', 'Negatif', 0, 0, 1]] },
  { id: 'mirror', n: 'Cermin / Kaleidoskop', ty: 21, ps: [['q1', 'Mode (0 kiri-kanan, 1 atas-bawah, 2 kaleido)', 0, 0, 2], ['amt', 'Segmen kaleido', 30]] },
  { id: 'pixel', n: 'Pixelate / Sensor', ty: 22, ps: [['amt', 'Ukuran kotak', 40], ['q1', 'Pusat X', 50], ['q2', 'Pusat Y', 50], ['q3', 'Lebar area', 100], ['q4', 'Tinggi area', 100]] },
  { id: 'sharpen', n: 'Pertajam Detail', ty: 23, ps: [['amt', 'Kekuatan', 40], ['q1', 'Radius', 0]] },
  { id: 'speed', n: 'Speed Lines', ty: 24, ps: [['amt', 'Intensitas', 70]], c1: '#ffffff' }
];
const TRANS = [
  { id: 'dissolve', n: 'Larut (Dissolve)', ty: 1 }, { id: 'black', n: 'Celup Hitam', ty: 2 }, { id: 'white', n: 'Celup Putih (Flash)', ty: 3 },
  { id: 'whip', n: 'Whip Pan', ty: 4 }, { id: 'zoom', n: 'Zoom Blur', ty: 5 }, { id: 'slide', n: 'Dorong', ty: 6 }, { id: 'wipe', n: 'Sapuan', ty: 7 },
  { id: 'glitch', n: 'Glitch', ty: 8 }, { id: 'iris', n: 'Lingkaran', ty: 9 }
];
const ANIMS = [['none', 'Tanpa'], ['fade', 'Pudar'], ['zoomin', 'Zoom masuk'], ['zoomout', 'Zoom keluar'], ['left', 'Geser kiri'], ['right', 'Geser kanan'], ['up', 'Geser atas'], ['down', 'Geser bawah'], ['rise', 'Naik halus'], ['pop', 'Pop / Mantul'], ['spin', 'Putar'], ['type', 'Mesin ketik (teks)']];
const fxDef = id => FX.find(f => f.id === id);
function makeFxClip(id) {
  const d = fxDef(id), c = makeClip('fx', { dur: 3, name: d.n });
  c.fx = { id, c1: d.c1 || '#ffffff', c2: d.c2 || '#000000' };
  d.ps.forEach(p => c.fx[p[0]] = p[2]);
  return c;
}
/* parameter -> uniform per efek */
function fxUniforms(c, lt) {
  const d = fxDef(c.fx.id), F = k => { const v = valAt(c, 'fx.' + k, lt); return v == null ? 0 : v; };
  const amt = F('amt') / 100; let q = [F('q1') / 100, F('q2') / 100, F('q3') / 100, F('q4') / 100];
  if (d.id === 'dblur') q[0] = F('q1') * D2R;
  if (d.id === 'letterbox') q[0] = F('q1') / 100;
  if (d.id === 'mirror') q[0] = F('q1');
  if (d.id === 'strobe') q[1] = F('q2');
  return { ty: d.ty, amt, q, c1: hexRGB(c.fx.c1), c2: hexRGB(c.fx.c2) };
}
function applyFx(c, t, cur, alt) {
  const fb = GLR.fb, D = clipDur(c), lt = clamp(t - c.start, 0, D), U = fxUniforms(c, lt);
  const base = (S) => { S.f('uAmt', U.amt); S.f('uQ', U.q[0], U.q[1], U.q[2], U.q[3]); S.f('uC1', ...U.c1); S.f('uC2', ...U.c2); S.f('uTime', t); S.f('uProg', lt / Math.max(0.001, D)); S.f('uRes', cur.w, cur.h); };
  if (U.ty === 9) { blurTo(cur.t, alt, fb.T1, U.amt * cur.h * 0.06 + 0.5); return true; }
  if (U.ty === 13 || U.ty === 14) {
    drawTo(fb.L3, GLR.prog.fx, S => { S.t('uT', cur.t); S.i('uType', 31); base(S); S.f('uQ', U.q[0], 0, 0, 0); });
    blurTo(fb.L3.t, fb.T1, fb.T2, (U.q[1] || 0.3) * cur.h * 0.05 + 1);
    drawTo(alt, GLR.prog.fx, S => { S.t('uT', cur.t); S.t('uT2', fb.T1.t); S.i('uType', 30); base(S); });
    return true;
  }
  drawTo(alt, GLR.prog.fx, S => { S.t('uT', cur.t); S.t('uT2', cur.t); S.i('uType', U.ty); base(S); });
  return true;
}
/* ---------- daftar yang tampil pada waktu t ---------- */
function visualStack(t) {
  const out = [], vt = P.tracks.filter(tr => tr.kind === 'video');
  for (let i = vt.length - 1; i >= 0; i--) {
    const tr = vt[i]; if (tr.hide) continue;
    const cs = clipsOn(tr.id); let item = null;
    for (let j = 0; j < cs.length; j++) {
      const b = cs[j], a = cs[j - 1];
      if (b.tr && b.tr.type && a && a.kind !== 'fx' && b.kind !== 'fx' && Math.abs(clipEnd(a) - b.start) < 0.6 / P.fps) {
        const d = Math.min(b.tr.dur || 0.6, clipDur(a), clipDur(b)), s = b.start - d / 2;
        if (t >= s && t < s + d) { item = { a, b, p: (t - s) / d, ty: (TRANS.find(x => x.id === b.tr.type) || TRANS[0]).ty }; break; }
      }
      if (t >= b.start && t < clipEnd(b)) item = { c: b };
    }
    if (item) out.push(item);
  }
  return out;
}
function audioActive(t) { return P.clips.filter(c => (c.kind === 'audio' || c.kind === 'video') && t >= c.start && t < clipEnd(c)); }
/* ---------- render seluruh frame ---------- */
function composeFrame(t, W, H, getSrc, opt) {
  opt = opt || {};
  ensureFB(W, H);
  const fb = GLR.fb; let cur = fb.A, alt = fb.B;
  const bg = hexRGB(P.bg); clearFB(cur, bg[0], bg[1], bg[2], 1);
  const stack = visualStack(t); let missing = 0;
  const blend = (layer, mode) => { drawTo(alt, GLR.prog.blend, S => { S.t('uBase', cur.t); S.t('uLay', layer.t); S.i('uMode', Math.max(0, BLEND_MODES.indexOf(mode || 'normal'))); }); const x = cur; cur = alt; alt = x; };
  for (const it of stack) {
    if (it.c && it.c.kind === 'fx') { if (applyFx(it.c, t, cur, alt)) { const x = cur; cur = alt; alt = x; } continue; }
    const lay = (fbx, c) => { const s = getSrc(c, t); if (!s) { missing++; clearFB(fbx, 0, 0, 0, 0); return false; } renderLayer(fbx, c, t, s, { noGrade: opt.noGrade, showMask: opt.showMask && c.id === SEL ? opt.showMask : 0 }); return true; };
    if (it.c) { if (lay(fb.L1, it.c)) blend(fb.L1, it.c.p && it.c.p.blend); }
    else {
      lay(fb.L1, it.a); lay(fb.L2, it.b);
      drawTo(fb.L3, GLR.prog.trans, S => { S.t('uTA', fb.L1.t); S.t('uTB', fb.L2.t); S.f('uP', it.p); S.i('uType', it.ty); S.f('uRes', W, H); });
      blend(fb.L3, it.b.p && it.b.p.blend);
    }
  }
  return { tex: cur, missing };
}
function outputFrame(comp, W, H, opt) {
  const cv = GLR.cv; if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const bg = hexRGB(P.bg);
  drawTo(null, GLR.prog.out, S => { S.t('uT', comp.t); S.t('uT2', (opt && opt.before) ? opt.before.t : comp.t); S.f('uSplit', opt && opt.split || 0); S.f('uBg', bg[0], bg[1], bg[2]); S.f('uOutSz', W, H); S.f('uDith', opt && opt.export ? (opt.frame || 0) * 0.618 : 0.5); });
}

/* ---- f2-filters.js ---- */
/* ================= FILTER WARNA CEPAT (ala CapCut) ================= */
/* parameter: exp, temp, tint, con, sat, vib, fade (angkat hitam), mat (turunkan putih), sh/hl = warna split-tone [r,g,b,kekuatan], bw, scurve, hue */
const FILTERS = [
  ['Populer', [
    ['clean', 'Bersih', { con: 1.06, vib: 0.15, sat: 1.04 }], ['bright', 'Cerah', { exp: 0.25, con: 1.02, vib: 0.12, fade: 0.02 }], ['warm', 'Hangat', { temp: 0.35, sat: 1.05, con: 1.04 }],
    ['cool', 'Dingin', { temp: -0.35, tint: -0.05, con: 1.05 }], ['vivid', 'Vivid', { sat: 1.3, vib: 0.3, con: 1.12, scurve: 0.25 }], ['soft', 'Lembut', { con: 0.88, fade: 0.06, mat: 0.03, sat: 0.92, exp: 0.08 }]]],
  ['Sinematik', [
    ['teal', 'Teal Orange', { sh: [0, 0.45, 0.55, 0.2], hl: [1, 0.6, 0.3, 0.16], sat: 1.08, con: 1.1, scurve: 0.2 }], ['blockbuster', 'Blockbuster', { sh: [0, 0.35, 0.5, 0.22], hl: [1, 0.75, 0.45, 0.12], con: 1.2, sat: 0.95, scurve: 0.35, exp: -0.05 }],
    ['moody', 'Moody', { exp: -0.2, con: 1.12, sat: 0.72, sh: [0.15, 0.25, 0.3, 0.18], fade: 0.04 }], ['noir', 'Noir Warna', { sat: 0.35, con: 1.3, scurve: 0.4, sh: [0, 0.1, 0.25, 0.15] }],
    ['bleach', 'Bleach Bypass', { sat: 0.45, con: 1.35, scurve: 0.3 }], ['dune', 'Gurun', { temp: 0.45, tint: 0.08, sat: 0.85, con: 1.1, hl: [1, 0.78, 0.5, 0.15], fade: 0.03 }],
    ['tokyo', 'Neo Tokyo', { sh: [0.35, 0, 0.6, 0.22], hl: [0, 0.9, 1, 0.12], sat: 1.15, con: 1.1 }], ['matrix', 'Matrix', { tint: -0.4, sat: 0.75, con: 1.15, sh: [0, 0.35, 0.1, 0.15] }]]],
  ['Kulit & Potret', [
    ['skin', 'Kulit Cerah', { exp: 0.15, temp: 0.08, con: 0.96, sat: 0.95, hl: [1, 0.85, 0.75, 0.08] }], ['peach', 'Peach', { temp: 0.18, tint: 0.12, fade: 0.03, sat: 0.95, hl: [1, 0.75, 0.65, 0.12] }],
    ['rosy', 'Rosy', { tint: 0.22, temp: 0.05, sat: 1.02, fade: 0.02 }], ['warmskin', 'Hangat Alami', { temp: 0.2, con: 1.03, vib: 0.1 }], ['porcelain', 'Porselen', { exp: 0.2, sat: 0.8, con: 0.95, temp: -0.05, fade: 0.04 }]]],
  ['Alam & Travel', [
    ['green', 'Hijau Segar', { tint: -0.15, vib: 0.3, con: 1.06, hue: -0.01 }], ['sky', 'Langit Biru', { temp: -0.18, vib: 0.35, con: 1.08, sh: [0, 0.2, 0.5, 0.1] }],
    ['sunset', 'Sunset', { temp: 0.5, tint: 0.15, sat: 1.15, con: 1.08, hl: [1, 0.55, 0.3, 0.18] }], ['golden', 'Golden Hour', { temp: 0.42, sat: 1.08, fade: 0.02, hl: [1, 0.8, 0.4, 0.2] }],
    ['beach', 'Pantai', { exp: 0.15, temp: -0.05, vib: 0.35, con: 1.05, sh: [0, 0.4, 0.45, 0.12] }], ['autumn', 'Musim Gugur', { temp: 0.3, hue: 0.02, sat: 1.05, con: 1.06, hl: [1, 0.6, 0.25, 0.12] }]]],
  ['Vintage & Film', [
    ['kodak', 'Kodak 200', { temp: 0.2, con: 1.05, fade: 0.05, sat: 0.9, sh: [0.2, 0.15, 0.05, 0.1], hl: [1, 0.85, 0.6, 0.1] }], ['fuji', 'Fuji 400', { tint: -0.12, con: 1.04, fade: 0.04, sat: 0.92, sh: [0, 0.25, 0.25, 0.12] }],
    ['polaroid', 'Polaroid', { fade: 0.1, mat: 0.06, temp: 0.12, sat: 0.85, con: 0.92, hl: [1, 0.9, 0.7, 0.1] }], ['retro90', 'Retro 90an', { tint: 0.1, sat: 1.1, fade: 0.07, con: 0.95, sh: [0.3, 0.1, 0.4, 0.14] }],
    ['faded', 'Pudar', { fade: 0.14, mat: 0.08, sat: 0.75, con: 0.9 }], ['sepia', 'Sepia', { bw: 1, sh: [0.5, 0.3, 0.1, 0.3], hl: [1, 0.85, 0.6, 0.25], fade: 0.04 }]]],
  ['Makanan', [
    ['tasty', 'Lezat', { temp: 0.2, sat: 1.2, vib: 0.2, con: 1.08, exp: 0.08 }], ['cafe', 'Kafe', { temp: 0.25, fade: 0.05, sat: 0.9, con: 1.04, sh: [0.25, 0.15, 0.05, 0.12] }], ['fresh', 'Segar', { exp: 0.12, tint: -0.05, vib: 0.3, con: 1.05 }]]],
  ['Malam', [
    ['city', 'Kota Malam', { temp: -0.25, con: 1.15, sat: 1.1, sh: [0, 0.2, 0.5, 0.2], hl: [1, 0.7, 0.35, 0.1] }], ['neon', 'Neon', { tint: 0.25, sat: 1.35, vib: 0.3, con: 1.12, sh: [0.4, 0, 0.6, 0.18] }], ['bluehour', 'Blue Hour', { temp: -0.45, exp: 0.05, sat: 1.05, con: 1.04 }]]],
  ['Hitam Putih', [
    ['bwclassic', 'BW Klasik', { bw: 1, con: 1.1 }], ['bwhard', 'BW Kontras', { bw: 1, con: 1.4, scurve: 0.4 }], ['bwsoft', 'BW Lembut', { bw: 1, con: 0.9, fade: 0.08 }]]]
];
const FLT = {}; FILTERS.forEach(([cat, list]) => list.forEach(([id, n, p]) => FLT[id] = { id, n, cat, p }));
function filterRGB(r, g, b, p) {
  if (p.exp) { const k = Math.pow(2, p.exp); r *= k; g *= k; b *= k; }
  if (p.temp || p.tint) { r *= 1 + (p.temp || 0) * 0.12; b *= 1 - (p.temp || 0) * 0.12; g *= 1 - (p.tint || 0) * 0.1; }
  let l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  if (p.bw) { r = g = b = l; }
  if (p.hue) { const a = p.hue * 2 * Math.PI, cs = Math.cos(a), sn = Math.sin(a), k = 0.57735, d0 = r - l, d1 = g - l, d2 = b - l, dt = k * (d0 + d1 + d2); r = l + d0 * cs + k * (d2 - d1) * sn + k * dt * (1 - cs); g = l + d1 * cs + k * (d0 - d2) * sn + k * dt * (1 - cs); b = l + d2 * cs + k * (d1 - d0) * sn + k * dt * (1 - cs); }
  if (p.scurve) { const s = x => { x = clamp(x, 0, 1); const y = x * x * (3 - 2 * x); return x + (y - x) * p.scurve; }; r = s(r); g = s(g); b = s(b); }
  if (p.con) { r = (r - 0.45) * p.con + 0.45; g = (g - 0.45) * p.con + 0.45; b = (b - 0.45) * p.con + 0.45; }
  l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  if (p.sat != null || p.vib) { const s0 = Math.max(r, g, b) - Math.min(r, g, b); let k = p.sat != null ? p.sat : 1; if (p.vib) k *= 1 + p.vib * (1 - clamp(s0 * 2.5, 0, 1)); r = l + (r - l) * k; g = l + (g - l) * k; b = l + (b - l) * k; }
  l = clamp(0.2126 * r + 0.7152 * g + 0.0722 * b, 0, 1);
  if (p.sh) { const w = Math.pow(1 - l, 2) * p.sh[3]; r += (p.sh[0] - 0.5) * w; g += (p.sh[1] - 0.5) * w; b += (p.sh[2] - 0.5) * w; }
  if (p.hl) { const w = l * l * p.hl[3]; r += (p.hl[0] - 0.5) * w; g += (p.hl[1] - 0.5) * w; b += (p.hl[2] - 0.5) * w; }
  if (p.fade) { r = p.fade + r * (1 - p.fade); g = p.fade + g * (1 - p.fade); b = p.fade + b * (1 - p.fade); }
  if (p.mat) { r *= 1 - p.mat; g *= 1 - p.mat; b *= 1 - p.mat; }
  return [clamp(r, 0, 1), clamp(g, 0, 1), clamp(b, 0, 1)];
}
function fltTex(id) {
  const f = FLT[id]; if (!f) return null;
  let e = GLR.tex.get('flt:' + id); if (e) return e;
  const gl = GLR.gl, n = 33, d = new Float32Array(n * n * n * 4);
  for (let bi = 0; bi < n; bi++) for (let gi = 0; gi < n; gi++) for (let ri = 0; ri < n; ri++) { const o = ((bi * n + gi) * n + ri) * 4, v = filterRGB(ri / (n - 1), gi / (n - 1), bi / (n - 1), f.p); d[o] = v[0]; d[o + 1] = v[1]; d[o + 2] = v[2]; d[o + 3] = 1; }
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_3D, t);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  ['TEXTURE_WRAP_S', 'TEXTURE_WRAP_T', 'TEXTURE_WRAP_R'].forEach(k => gl.texParameteri(gl.TEXTURE_3D, gl[k], gl.CLAMP_TO_EDGE));
  gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA16F, n, n, n, 0, gl.RGBA, gl.FLOAT, d);
  e = { t, n, used: Infinity }; GLR.tex.set('flt:' + id, e); return e;
}
/* thumbnail: bingkai saat ini diproses di CPU */
let FLT_THUMB = { key: '', px: null, w: 0, h: 0 }, FLT_URLS = {};
function filterThumbBase() {
  const c = selClip() && selClip().g ? selClip() : P.clips.find(x => x.g && PH >= x.start && PH < clipEnd(x));
  const W = 132, H = Math.max(40, Math.round(132 * Math.min(1.6, P.h / P.w)));
  const key = (c ? c.id : '') + '|' + Math.round(PH * 4) + '|' + W + 'x' + H;
  if (FLT_THUMB.key === key && FLT_THUMB.px) return FLT_THUMB;
  try { const r = composeFrame(PH, W, H, previewSrc, { noGrade: true }); outputFrame(r.tex, W, H, {}); const px = new Uint8Array(W * H * 4); GLR.gl.readPixels(0, 0, W, H, GLR.gl.RGBA, GLR.gl.UNSIGNED_BYTE, px); FLT_THUMB = { key, px, w: W, h: H }; FLT_URLS = {}; layoutCanvas(); requestRender(); }
  catch (e) { FLT_THUMB = { key, px: null, w: W, h: H }; }
  return FLT_THUMB;
}
function filterThumb(id) {
  if (FLT_URLS[id]) return FLT_URLS[id];
  const b = FLT_THUMB; if (!b.px) return '';
  const cv = document.createElement('canvas'); cv.width = b.w; cv.height = b.h; const x = cv.getContext('2d'), im = x.createImageData(b.w, b.h), p = id ? FLT[id].p : null;
  for (let y = 0; y < b.h; y++) for (let i = 0; i < b.w; i++) { const s = ((b.h - 1 - y) * b.w + i) * 4, o = (y * b.w + i) * 4; let r = b.px[s] / 255, g = b.px[s + 1] / 255, bb = b.px[s + 2] / 255; if (p) [r, g, bb] = filterRGB(r, g, bb, p); im.data[o] = r * 255; im.data[o + 1] = g * 255; im.data[o + 2] = bb * 255; im.data[o + 3] = 255; }
  x.putImageData(im, 0, 0); return (FLT_URLS[id] = cv.toDataURL('image/jpeg', 0.75));
}
function filterTarget() { const c = selClip(); if (c && c.g) return c; return P.clips.find(x => x.g && PH >= x.start && PH < clipEnd(x)) || null; }
function renderFilterLib(B) {
  const c = filterTarget(); filterThumbBase();
  const cur = c && c.flt ? c.flt.id : '';
  B.innerHTML = `<div class="vs-fltamt">${c ? (cur ? sliderHTML({ path: 'flt.amt', label: 'Intensitas filter', min: 0, max: 100, step: 1, dec: 0 }) : '<div class="vs-note" style="margin:4px 0">Ketuk filter untuk dipasang pada klip <b>' + esc(c.name || '') + '</b></div>') : '<div class="vs-note" style="margin:4px 0">Pilih klip video/foto dulu.</div>'}</div>
  <div class="vs-pgrid"><button class="vs-pc${!cur ? ' on' : ''}" data-flt=""><img alt="" src="${filterThumb('')}"><span>Tanpa filter</span></button></div>
  ${FILTERS.map(([cat, list]) => `<div class="vs-sec"><h4>${esc(cat)}</h4><div class="vs-pgrid">${list.map(([id, n]) => `<button class="vs-pc${cur === id ? ' on' : ''}" data-flt="${id}"><img alt="" src="${filterThumb(id)}"><span>${esc(n)}</span></button>`).join('')}</div></div>`).join('')}
  <div class="vs-row" style="margin-top:10px"><button data-a="fltAll" style="flex:1"${cur ? '' : ' disabled'}>Terapkan filter ini ke semua klip</button></div>
  <div class="vs-note">Filter bekerja di atas pengaturan warna Anda (roda warna, kurva, LUT), jadi tetap bisa disempurnakan di halaman Warna.</div>`;
  if (c) syncSliders(B, c);
}

/* ---- g-text.js ---- */
/* ================= TEKS: 55+ font + impor font sendiri + template ================= */
const FONTS = [
  /* fashion, majalah, mewah */
  ['Playfair Display', 'Mewah', '400;700;900'], ['Bodoni Moda', 'Mewah', '400;700;900'], ['Libre Bodoni', 'Mewah', '400;700'], ['GFS Didot', 'Mewah', '400'],
  ['Cormorant Garamond', 'Mewah', '400;700'], ['Cinzel', 'Mewah', '400;700;900'], ['DM Serif Display', 'Mewah', '400'], ['Abril Fatface', 'Mewah', '400'],
  ['Prata', 'Mewah', '400'], ['Italiana', 'Mewah', '400'], ['Marcellus', 'Mewah', '400'], ['Bebas Neue', 'Mewah', '400'], ['Anton', 'Mewah', '400'],
  ['Oswald', 'Mewah', '400;700'], ['Archivo Black', 'Mewah', '400'],
  /* modern, iklan, media sosial */
  ['Montserrat', 'Modern', '400;700;900'], ['Poppins', 'Modern', '400;700;900'], ['Inter', 'Modern', '400;700;900'], ['Plus Jakarta Sans', 'Modern', '400;700'],
  ['Manrope', 'Modern', '400;700'], ['DM Sans', 'Modern', '400;700'], ['Outfit', 'Modern', '400;700;900'], ['Urbanist', 'Modern', '400;700;900'], ['Sora', 'Modern', '400;700'],
  ['Work Sans', 'Modern', '400;700;900'], ['Raleway', 'Modern', '400;700;900'], ['Lato', 'Modern', '400;700;900'], ['Open Sans', 'Modern', '400;700'], ['Roboto', 'Modern', '400;700;900'],
  ['Nunito', 'Modern', '400;700;900'], ['League Spartan', 'Modern', '400;700;900'], ['Josefin Sans', 'Modern', '400;700'], ['Syne', 'Modern', '400;700'], ['Space Grotesk', 'Modern', '400;700'],
  ['Unbounded', 'Modern', '400;700;900'],
  /* script, elegan */
  ['Great Vibes', 'Script', '400'], ['Pinyon Script', 'Script', '400'], ['Allura', 'Script', '400'], ['Parisienne', 'Script', '400'], ['Dancing Script', 'Script', '400;700'],
  ['Pacifico', 'Script', '400'], ['Sacramento', 'Script', '400'], ['Caveat', 'Script', '400;700'], ['Satisfy', 'Script', '400'], ['Permanent Marker', 'Script', '400'],
  /* koleksi pilihan (lisensi SIL OFL, bebas dipakai komersial) */
  ['Fraunces', 'Koleksi', '400;700;900'], ['Shrikhand', 'Koleksi', '400'], ['Teko', 'Koleksi', '400;700'], ['Bungee', 'Koleksi', '400'], ['Lobster', 'Koleksi', '400'],
  /* Arab, Jepang, Mandarin */
  ['Amiri', 'Bahasa', '400;700'], ['Cairo', 'Bahasa', '400;700;900'], ['Noto Naskh Arabic', 'Bahasa', '400;700'], ['Noto Sans JP', 'Bahasa', '400;700;900'], ['Noto Sans SC', 'Bahasa', '400;700;900']
];
const UFONTS = []; /* {name, family} font impor pengguna */
/* koleksi font tambahan: Junicode (lisensi OFL) dimuat otomatis; lainnya dimuat dari folder fonts/ di GitHub Mengetik bila sudah diunggah */
const FONT_BASE = 'https://cdn.jsdelivr.net/gh/mengetikid/mengetik-video@main/fonts/';
const PACK = [
  { name: 'Obrazec', file: 'obrazec' },
  { name: 'Junicode Bold Condensed', url: 'https://cdn.jsdelivr.net/gh/psb1558/Junicode-font@6978714c2bb053861a68489c052b1c88e7596bfb/webfiles/JunicodeVF-Roman.woff2', wt: 700, stretch: 'condensed', range: '300 700', srange: '75% 125%' }
];
PACK.forEach(p => { p.family = 'VSP ' + p.name; p.state = 0; });
/* font lama berlisensi pribadi diganti padanan OFL; proyek lama otomatis memakai penggantinya */
const FONT_ALIAS = { 'Thunder': 'Anton', 'Elanor': 'Fraunces', 'Nighty': 'Pinyon Script', 'Creme Espana': 'Shrikhand', 'Harmony Serif': 'Fraunces', 'Resist Sans': 'Teko', 'Shrimp': 'Bungee', 'Tropikal': 'Lobster' };
const fontName = n => FONT_ALIAS[n] || n;
const packOf = name => PACK.find(p => p.name === fontName(name));
function loadPack(p) {
  if (p.state) return p.prom || Promise.resolve();
  p.state = 1;
  const src = p.url ? `url(${p.url}) format('woff2')` : ['woff2', 'woff', 'ttf', 'otf'].map(e => `url(${FONT_BASE}${p.file}.${e}) format('${{ woff2: 'woff2', woff: 'woff', ttf: 'truetype', otf: 'opentype' }[e]}')`).join(', ');
  const desc = {}; if (p.range) desc.weight = p.range; if (p.srange) desc.stretch = p.srange;
  const ff = new FontFace(p.family, src, desc);
  return (p.prom = ff.load().then(f => { document.fonts.add(f); p.state = 2; BUS.emit('font', p.name); }).catch(() => { p.state = 3; toast('Font "' + p.name + '" belum tersedia. File font perlu diunggah ke folder fonts di GitHub, atau impor sendiri lewat "Impor font".', true); }));
}
const fontReq = {};
function fontFamily(name) { name = fontName(name); const u = UFONTS.find(f => f.name === name); if (u) return u.family; const p = packOf(name); return p ? p.family : name; }
function nearestWeight(name, w) { name = fontName(name); const p = packOf(name); if (p) return p.wt || 400; const f = FONTS.find(x => x[0] === name); if (!f) return w; const ws = f[2].split(';').map(Number); return ws.reduce((a, b) => Math.abs(b - w) < Math.abs(a - w) ? b : a, ws[0]); }
function loadFont(name, w) {
  name = fontName(name);
  if (UFONTS.find(f => f.name === name)) return Promise.resolve();
  const pk = packOf(name); if (pk) return loadPack(pk);
  const f = FONTS.find(x => x[0] === name); if (!f) return Promise.resolve();
  const key = name; if (!fontReq[key]) {
    fontReq[key] = new Promise(res => {
      const l = document.createElement('link'); l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=' + name.replace(/ /g, '+') + ':wght@' + f[2] + '&display=swap';
      l.onload = () => res(); l.onerror = () => res(); document.head.appendChild(l); setTimeout(res, 8000);
    });
  }
  const wt = nearestWeight(name, w || 400);
  return fontReq[key].then(() => document.fonts && document.fonts.load ? withTimeout(document.fonts.load(wt + ' 40px "' + name + '"'), 8000).catch(() => {}) : null).then(() => BUS.emit('font', name));
}
async function importFont(file) {
  const name = (file.name || 'Font').replace(/\.(ttf|otf|woff2?)$/i, '').replace(/[^\w\- ]/g, '').slice(0, 40) || 'Font Saya';
  const family = 'VSU ' + name;
  const buf = await file.arrayBuffer();
  const ff = new FontFace(family, buf); await ff.load(); document.fonts.add(ff);
  if (!UFONTS.find(f => f.name === name)) UFONTS.push({ name, family });
  try { await DB.set('fonts', name, { name, family, buf }); } catch (e) {}
  BUS.emit('font', name); return name;
}
async function restoreFonts() {
  try { const all = await DB.all('fonts'); for (const f of all || []) { try { const ff = new FontFace(f.family, f.buf); await ff.load(); document.fonts.add(ff); if (!UFONTS.find(x => x.name === f.name)) UFONTS.push({ name: f.name, family: f.family }); } catch (e) {} } } catch (e) {}
}
/* ---------- template teks & subtitle ---------- */
const TEXT_TPL = [
  { n: 'Judul Bersih', tx: { font: 'Montserrat', wt: 900, size: 7, up: 1, ls: 2 }, aIn: 'rise' },
  { n: 'Subtitle Klasik', tx: { font: 'Inter', wt: 700, size: 4.2, stroke: 3, strokeC: '#000000' }, y: 0.72 },
  { n: 'TikTok Kuning', tx: { font: 'Poppins', wt: 900, size: 5.2, color: '#ffe500', stroke: 6, strokeC: '#000000', shadow: 30 }, y: 0.55, aIn: 'pop' },
  { n: 'Kotak Hitam', tx: { font: 'Plus Jakarta Sans', wt: 700, size: 4, bg: 1, bgC: '#000000', bgA: 75, bgR: 14 }, y: 0.7 },
  { n: 'Neon Malam', tx: { font: 'Unbounded', wt: 700, size: 6, color: '#ffffff', glow: 70, glowC: '#ff2d95' }, aIn: 'fade' },
  { n: 'Majalah Fashion', tx: { font: 'Bodoni Moda', wt: 400, size: 11, ls: 6, up: 1 }, y: -0.55, aIn: 'fade' },
  { n: 'Elegan Didot', tx: { font: 'GFS Didot', wt: 400, size: 7, ls: 3, it: 1 }, aIn: 'zoomout' },
  { n: 'Tanda Tangan', tx: { font: 'Great Vibes', wt: 400, size: 10, color: '#f5e6c8', shadow: 25 }, aIn: 'type' },
  { n: 'Poster Tebal', tx: { font: 'Anton', wt: 400, size: 12, up: 1, grad: 1, color: '#ffffff', gradC: '#ff7a20', ls: 1 }, aIn: 'zoomin' },
  { n: 'Lower Third', tx: { font: 'DM Sans', wt: 700, size: 3.6, align: 'left', bg: 1, bgC: '#c2185b', bgA: 92, bgR: 6, maxW: 60 }, x: -0.5, y: 0.72, aIn: 'left' },
  { n: 'Retro VHS', tx: { font: 'Permanent Marker', wt: 400, size: 7, color: '#00f0ff', shadow: 60, shadowC: '#ff00a8' }, aIn: 'pop' },
  { n: 'Arab Elegan', tx: { t: '\u0628\u0650\u0633\u0652\u0645\u0650 \u0627\u0644\u0644\u0651\u0670\u0647\u0650', font: 'Amiri', wt: 700, size: 7, color: '#f5e6c8', shadow: 30 }, aIn: 'fade' }
];
/* ---------- render teks ke kanvas ---------- */
const TXT_CACHE = new Map(); let TXT_VER = 0;
function wrapLines(ctx, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    const words = para.split(/(\s+)/); let line = '';
    for (const w of words) {
      const test = line + w;
      if (ctx.measureText(test).width > maxW && line.trim()) { out.push(line.trimEnd()); line = w.trimStart(); }
      else line = test;
    }
    out.push(line);
  }
  return out;
}
function renderTextCanvas(c, lt, W, H) {
  const tx = c.tx, D = clipDur(c);
  let txt = tx.up ? String(tx.t).toUpperCase() : String(tx.t);
  if (c.p.aIn === 'type') { const d = Math.min(Math.max(0.3, (c.p.aInD || 0.5) * 3), D); const k = clamp(lt / d, 0, 1); txt = Array.from(txt).slice(0, Math.ceil(Array.from(txt).length * k)).join(''); }
  if (c.p.aOut === 'type') { const d = Math.min(Math.max(0.3, (c.p.aOutD || 0.5) * 3), D); if (lt > D - d) { const k = clamp((D - lt) / d, 0, 1); txt = Array.from(txt).slice(0, Math.ceil(Array.from(txt).length * k)).join(''); } }
  const key = JSON.stringify(tx) + '|' + txt + '|' + W + 'x' + H + '|' + (document.fonts && document.fonts.check ? document.fonts.check('400 20px "' + fontFamily(tx.font) + '"') : 1);
  const hit = TXT_CACHE.get(c.id);
  if (hit && hit.key === key) return hit.r;
  const fam = fontFamily(tx.font), wt = UFONTS.find(f => f.name === tx.font) ? 400 : nearestWeight(tx.font, tx.wt || 400);
  const pk = packOf(tx.font), stretch = pk && pk.stretch ? pk.stretch + ' ' : '';
  const fs = Math.max(4, tx.size / 100 * H), pad = Math.ceil(fs * 0.25 + (tx.stroke || 0) / 100 * fs * 2 + (tx.shadow ? fs * 0.35 : 0) + (tx.glow ? fs * 0.6 : 0) + (tx.bg ? fs * 0.5 : 0));
  const mc = document.createElement('canvas').getContext('2d');
  const font = (tx.it ? 'italic ' : '') + (UFONTS.find(f => f.name === tx.font) ? 400 : wt) + ' ' + stretch + fs + 'px "' + fam + '", "Noto Naskh Arabic", system-ui, sans-serif';
  mc.font = font; if (pk && pk.stretch && 'fontStretch' in mc) mc.fontStretch = pk.stretch; if ('letterSpacing' in mc) mc.letterSpacing = (tx.ls || 0) / 100 * fs * 1 + 'px';
  const maxW = Math.max(fs, (tx.maxW || 86) / 100 * W);
  const lines = txt.length ? wrapLines(mc, txt, maxW) : [''];
  const lh = fs * (tx.lh || 1.15), widths = lines.map(l => mc.measureText(l).width), tw = Math.max(1, ...widths);
  const cw = Math.ceil(tw + pad * 2), ch = Math.ceil(lh * lines.length + pad * 2 - (lh - fs) * 0.3);
  const cv = (hit && hit.cv) || document.createElement('canvas'); cv.width = Math.min(8192, Math.max(2, cw)); cv.height = Math.min(8192, Math.max(2, ch));
  const x = cv.getContext('2d'); x.clearRect(0, 0, cv.width, cv.height);
  x.font = font; if (pk && pk.stretch && 'fontStretch' in x) x.fontStretch = pk.stretch; if ('letterSpacing' in x) x.letterSpacing = mc.letterSpacing; x.textBaseline = 'alphabetic'; x.lineJoin = 'round'; x.miterLimit = 2;
  const al = tx.align || 'center'; x.textAlign = al === 'left' ? 'left' : al === 'right' ? 'right' : 'center';
  const ax = al === 'left' ? pad : al === 'right' ? cv.width - pad : cv.width / 2;
  const base0 = pad + fs * 0.92;
  if (tx.bg) {
    const [r, g, b] = hexRGB(tx.bgC); x.fillStyle = 'rgba(' + Math.round(r * 255) + ',' + Math.round(g * 255) + ',' + Math.round(b * 255) + ',' + (tx.bgA / 100) + ')';
    lines.forEach((l, i) => { if (!l.trim()) return; const w = widths[i], px = fs * 0.35, py = fs * 0.16; const lx = al === 'left' ? ax - px : al === 'right' ? ax - w - px : ax - w / 2 - px; const ly = base0 + i * lh - fs * 0.92 - py; const rr = Math.min(fs * (tx.bgR || 0) / 100 * 2, (fs * 1.1 + py * 2) / 2);
      x.beginPath(); if (x.roundRect) x.roundRect(lx, ly, w + px * 2, fs * 1.18 + py * 2, rr); else x.rect(lx, ly, w + px * 2, fs * 1.18 + py * 2); x.fill(); });
  }
  const fill = () => { if (tx.grad) { const g = x.createLinearGradient(0, pad, 0, cv.height - pad); g.addColorStop(0, tx.color); g.addColorStop(1, tx.gradC || tx.color); return g; } return tx.color; };
  const drawAll = (mode) => lines.forEach((l, i) => { const y = base0 + i * lh; if (mode === 's') x.strokeText(l, ax, y); else x.fillText(l, ax, y); });
  if (tx.glow) { x.save(); x.shadowColor = tx.glowC; x.shadowBlur = fs * 0.5 * tx.glow / 100; x.fillStyle = tx.glowC; drawAll('f'); x.shadowBlur = fs * 0.25 * tx.glow / 100; drawAll('f'); x.restore(); }
  if (tx.shadow) { x.save(); x.shadowColor = tx.shadowC || '#000'; x.shadowBlur = fs * 0.18 * tx.shadow / 50; x.shadowOffsetX = fs * 0.04 * tx.shadow / 50; x.shadowOffsetY = fs * 0.06 * tx.shadow / 50; x.fillStyle = tx.shadowC || '#000'; drawAll('f'); x.restore(); }
  if (tx.stroke) { x.save(); x.strokeStyle = tx.strokeC; x.lineWidth = tx.stroke / 100 * fs * 2; drawAll('s'); x.restore(); }
  x.fillStyle = fill(); drawAll('f');
  const r = { img: cv, w: cv.width / (W / P.w), h: cv.height / (W / P.w), iw: cv.width, ih: cv.height, key: 'txt:' + c.id, live: ++TXT_VER };
  TXT_CACHE.set(c.id, { key, r, cv });
  if (pk) { if (!pk.state) loadPack(pk); } else if (!document.fonts || !document.fonts.check('400 20px "' + fam + '"')) loadFont(tx.font, tx.wt);
  return r;
}
BUS.on('font', () => { TXT_CACHE.forEach(v => v.key = ''); if (typeof requestRender === 'function') requestRender(); });

/* ---- h-preview.js ---- */
/* ================= PRATINJAU & PEMUTARAN ================= */
const PB = { on: false, t0: 0, w0: 0, loop: false, raf: 0, need: true, quality: 'auto', split: 0, showMask: 0, lastDraw: 0, fpsN: 0 };
const ELS = new Map(); /* clipId -> {el, kind, media, src, gain, nodes, seekT, ready} */
let AC = null, MASTER = null;
function ensureAC() {
  if (AC) { if (AC.state === 'suspended') AC.resume().catch(() => {}); return AC; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'playback' });
    MASTER = { g: AC.createGain(), lim: AC.createDynamicsCompressor() };
    MASTER.lim.threshold.value = -1.5; MASTER.lim.knee.value = 0; MASTER.lim.ratio.value = 20; MASTER.lim.attack.value = 0.002; MASTER.lim.release.value = 0.08;
    MASTER.g.connect(MASTER.lim); MASTER.lim.connect(AC.destination);
  } catch (e) { AC = null; }
  return AC;
}
function elFor(c) {
  let e = ELS.get(c.id); const m = mediaById(c.media);
  if (e && e.media !== c.media) { dropEl(c.id); e = null; }
  if (e) return e;
  if (!m || !FILES[m.id] || m.demux === 'dpxseq' || (m.kind === 'video' && m.noPreview)) return null;
  const el = document.createElement(m.kind === 'audio' ? 'audio' : 'video');
  el.preload = 'auto'; el.playsInline = true; el.setAttribute('playsinline', ''); el.crossOrigin = 'anonymous'; el.muted = true;
  if ('preservesPitch' in el) el.preservesPitch = false; if ('webkitPreservesPitch' in el) el.webkitPreservesPitch = false;
  el.src = urlOf(m.id);
  e = { el, media: m.id, kind: m.kind, hasAudio: m.kind === 'audio' || m.hasAudio, seekT: -1, src: null, nodes: null };
  el.addEventListener('seeked', () => { e.seekT = -1; requestRender(); });
  el.addEventListener('loadeddata', () => requestRender());
  ELS.set(c.id, e);
  return e;
}
function dropEl(id) { const e = ELS.get(id); if (!e) return; try { e.el.pause(); e.el.removeAttribute('src'); e.el.load(); if (e.src) e.src.disconnect(); } catch (er) {} ELS.delete(id); dropTex('v:' + id); }
function requestRender() { PB.need = true; }
function dbToLin(db) { return Math.pow(10, db / 20); }
function clipGainAt(c, lt) {
  const au = c.au; if (!au) return 1; const tr = trackById(c.track);
  if (au.mute || (tr && tr.mute)) return 0;
  const D = clipDur(c); let g = dbToLin(valAt(c, 'au.vol', lt));
  if (au.fin > 0 && lt < au.fin) g *= lt / au.fin;
  if (au.fout > 0 && lt > D - au.fout) g *= Math.max(0, (D - lt) / au.fout);
  return g;
}
function syncMedia(t, playing) {
  const fd = 1 / P.fps, want = new Set();
  for (const c of P.clips) {
    if (c.kind !== 'video') continue;
    const s0 = c.start, e0 = clipEnd(c), near = t >= s0 - 1.2 && t < e0 + 0.3;
    if (!near) continue; want.add(c.id);
    const e = elFor(c); if (!e) continue;
    const el = e.el, lt = t - c.start, act = t >= s0 && t < e0, st = srcTime(c, lt);
    el.muted = true;
    if (playing && act) {
      const rate = clamp(speedAt(c, lt), 0.0625, 16);
      if (c.freeze != null || rate < 0.07) { if (!el.paused) el.pause(); if (Math.abs(el.currentTime - st) > fd && e.seekT < 0) { e.seekT = st; el.currentTime = st; } continue; }
      if (Math.abs(el.playbackRate - rate) > 0.01) el.playbackRate = rate;
      const drift = el.currentTime - st;
      if (Math.abs(drift) > 0.3 || (el.paused && Math.abs(drift) > 0.05)) { el.currentTime = st; }
      if (el.paused) el.play().catch(() => {});
    } else if (playing && !act) {
      /* siapkan klip berikutnya */
      if (!el.paused) el.pause();
      const pre = srcTime(c, 0); if (t < s0 && Math.abs(el.currentTime - pre) > 0.05 && e.seekT < 0) { e.seekT = pre; el.currentTime = pre; }
    } else {
      if (!el.paused) el.pause();
      const target = act ? st : srcTime(c, clamp(lt, 0, clipDur(c)));
      if (Math.abs(el.currentTime - target) > fd * 0.45) { if (e.seekT < 0 || Math.abs(e.seekT - target) > fd * 0.45) { e.seekT = target; try { el.currentTime = target; } catch (er) {} } }
    }
  }
  ELS.forEach((e, id) => { if (!want.has(id)) { if (!clipById(id)) dropEl(id); else if (!e.el.paused) e.el.pause(); } });
  if (ELS.size > 14) { for (const [id] of ELS) { if (!want.has(id)) dropEl(id); if (ELS.size <= 10) break; } }
}
function previewSrc(c, t) {
  const m = c.media ? mediaById(c.media) : null;
  if (c.kind === 'text') return renderTextCanvas(c, t - c.start, GLR.w, GLR.h);
  if (c.kind === 'image') { if (!m) return null; return imageSrc(m); }
  if (c.kind === 'video') {
    if (!m) return null; if (m.demux === 'dpxseq') return dpxPreviewSrc(c, t); const e = ELS.get(c.id); const has = GLR.tex.has('v:' + c.id);
    if (!e || e.el.readyState < 2) return has ? { img: GLR.tex.get('v:' + c.id).src, w: m.w, h: m.h, iw: GLR.tex.get('v:' + c.id).w, ih: GLR.tex.get('v:' + c.id).h, key: 'v:' + c.id } : null;
    return { img: e.el, w: m.w, h: m.h, iw: e.el.videoWidth, ih: e.el.videoHeight, key: 'v:' + c.id, live: true };
  }
  return null;
}
/* ---------- audio pratinjau: mixer yang sama dengan ekspor (EQ, kompresor, fade), dijadwalkan di AudioContext ---------- */
const PA = { mixer: null, base: 0, at: 0, next: 0, nodes: [], run: 0, on: false };
function stopAudio() { PA.run++; PA.on = false; PA.nodes.forEach(n => { try { n.stop(); } catch (e) {} }); PA.nodes = []; if (PA.mixer) { PA.mixer.close(); PA.mixer = null; } }
function startAudio(t) {
  stopAudio(); if (!AC) return;
  const mx = new AudioMixer(); if (!mx.active) { mx.close(); return; }
  PA.mixer = mx; PA.base = t; PA.at = AC.currentTime + 0.15; PA.next = t; PA.on = true; MASTER.g.gain.value = dbToLin(P.master.vol || 0);
  const run = PA.run; pumpAudio(run);
}
async function pumpAudio(run) {
  const BL = 0.25, D = projDur();
  while (PA.run === run && PB.on) {
    const now = PA.base + (AC.currentTime - PA.at);
    while (PA.run === run && PA.next < now + 0.9 && PA.next < D) {
      const n = Math.round(BL * ASR); let L, R;
      try { [L, R] = await PA.mixer.block(PA.next, n); } catch (e) { console.warn(e); return; }
      if (PA.run !== run) return;
      const when = PA.at + (PA.next - PA.base);
      if (when > AC.currentTime + 0.005) {
        const buf = AC.createBuffer(2, n, ASR); buf.copyToChannel(L, 0); buf.copyToChannel(R, 1);
        const src = AC.createBufferSource(); src.buffer = buf; src.connect(MASTER.g); src.start(when);
        PA.nodes.push(src); src.onended = () => { const i = PA.nodes.indexOf(src); if (i >= 0) PA.nodes.splice(i, 1); };
      }
      PA.next += BL;
    }
    await sleep(40);
  }
}
/* ---------- ukuran render pratinjau ---------- */
function previewSize() {
  const box = $('#vs-stage'), pad = NARROW() ? 8 : 16; const bw = Math.max(50, box.clientWidth - pad), bh = Math.max(50, box.clientHeight - pad);
  const ar = P.w / P.h; let dw = bw, dh = bw / ar; if (dh > bh) { dh = bh; dw = bh * ar; }
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let k = PB.quality === 'full' ? 1 : PB.quality === 'half' ? 0.5 : Math.min(1, dw * dpr / P.w);
  if (PB.quality === 'auto' && PB.on) k = Math.min(k, 1920 / Math.max(P.w, P.h) * 1.0);
  if (IX.on && PB.on) k = Math.min(1, 2160 / Math.max(P.w, P.h)); /* layar periksa: putar dengan resolusi tinggi */
  const rw = Math.max(16, Math.round(P.w * k / 2) * 2), rh = Math.max(16, Math.round(P.h * k / 2) * 2);
  return { dw: Math.round(dw), dh: Math.round(dh), rw, rh };
}
/* HP/tablet: tinggi pratinjau mengikuti rasio proyek & sisa ruang timeline (bisa diatur dengan tarik pegangan) */
let SH_USER = null; try { const v = +localStorage.getItem('vs-sh'); if (v > 0) SH_USER = v; } catch (e) {}
function fitStage() {
  const st = $('#vs-stage'), tl = $('#vs-tl'); if (!st || !P) return;
  if (!NARROW()) { if (st.style.height) st.style.height = ''; return; }
  const tlv = MODE === 'color' ? $('#vs-colorp') : tl; if (!tlv) return;
  const other = A.clientHeight - st.offsetHeight - tlv.offsetHeight; /* bilah atas, kontrol putar, navigasi bawah */
  const room = A.clientHeight - other;
  const rows = $('#vs-rows'), bar = tl.querySelector('.vs-tlbar');
  const tlNeed = MODE === 'color' ? 210 : clamp((bar ? bar.offsetHeight : 40) + 24 + (rows ? rows.offsetHeight : 120) + 46 + 16, 170, 380);
  const ar = P.w / P.h, ideal = (st.clientWidth - 12) / ar + 12;
  let h = SH_USER ? SH_USER : Math.min(ideal, room - tlNeed);
  h = Math.round(clamp(h, 170, Math.max(170, room - 150)));
  if (Math.abs(st.offsetHeight - h) > 1) st.style.height = h + 'px';
}
function layoutCanvas() {
  fitStage();
  const s = previewSize(), cv = GLR.cv; cv.style.width = s.dw + 'px'; cv.style.height = s.dh + 'px';
  const ov = $('#vs-ov'); ov.style.width = s.dw + 'px'; ov.style.height = s.dh + 'px';
  requestRender();
}
/* ---------- loop render ---------- */
let lastScope = 0;
function frame(now) {
  PB.raf = requestAnimationFrame(frame);
  if (!P || !GLR.ok || EXPORTING) return;
  if (PB.on) {
    let t = PA.on && AC ? PA.base + Math.max(0, AC.currentTime - PA.at) : PB.t0 + (now - PB.w0) / 1000; const D = projDur();
    if (t >= D) { if (PB.loop && D > 0) { PB.t0 = 0; PB.w0 = now; t = 0; startAudio(0); } else { t = D; pause(); } }
    PH = t; BUS.emit('time', t); PB.need = true;
  }
  syncMedia(PH, PB.on);
  if (!PB.need) return;
  PB.need = false;
  try {
    const s = previewSize();
    let before = null;
    if (PB.split > 0 && MODE === 'color') { const r0 = composeFrame(PH, s.rw, s.rh, previewSrc, { noGrade: true }); drawTo(GLR.fb.U, GLR.prog.copy, S => S.t('uT', r0.tex.t)); before = GLR.fb.U; }
    const r = composeFrame(PH, s.rw, s.rh, previewSrc, { showMask: MODE === 'color' ? PB.showMask : 0 });
    outputFrame(r.tex, s.rw, s.rh, { split: before ? PB.split : 0, before });
    if (r.missing && !PB.on) setTimeout(requestRender, 60);
    if (MODE === 'color' && now - lastScope > 120) { lastScope = now; drawScopes(); }
    if (IX.on) ixBlit(); else drawOverlay();
  } catch (e) { console.error(e); }
  if (Math.random() < 0.01) gcTex();
}
function play() {
  if (!P) return; ensureAC();
  const D = projDur(); if (D <= 0) return;
  if (PH >= D - 0.02) PH = 0;
  PB.on = true; PB.t0 = PH; PB.w0 = performance.now();
  /* mulai elemen video yang aktif langsung di dalam gestur pengguna (iOS) */
  syncMedia(PH, true);
  startAudio(PH); BUS.emit('play', true);
}
function pause() { PB.on = false; stopAudio(); ELS.forEach(e => { try { e.el.pause(); } catch (er) {} }); BUS.emit('play', false); requestRender(); }
function togglePlay() { PB.on ? pause() : play(); }
function seek(t, keepPlay) {
  t = clamp(t, 0, Math.max(0, projDur())); PH = t;
  if (PB.on) { PB.t0 = t; PB.w0 = performance.now(); startAudio(t); }
  BUS.emit('time', t); requestRender();
}
function stepFrame(n) { pause(); seek(Math.round(PH * P.fps + n) / P.fps); }

/* ---- i-ui.js ---- */
/* ================= UI: kerangka, pustaka (media, teks, efek, transisi, audio, kanvas) ================= */
let MODE = 'edit', LIBTAB = 'media';
function buildShell() {
  A.removeAttribute('style');
  A.innerHTML = `
<div class="vs-top">
  <div class="vs-logo" title="Video Studio Mengetik.id">M</div>
  <div class="vs-ttl"><input id="vs-name" type="text" maxlength="80" aria-label="Nama proyek"><span id="vs-saved">Video Studio by Mengetik.id</span></div>
  <div class="vs-modes" role="tablist"><button data-mode="edit" class="on">${ico('media')}<span>Edit</span></button><button data-mode="color">${ico('color')}<span>Warna</span></button></div>
  <div class="vs-acts">
    <button class="vs-ib" data-a="undo" title="Urungkan (Ctrl+Z)">${ico('undo')}</button>
    <button class="vs-ib" data-a="redo" title="Ulangi (Ctrl+Shift+Z)">${ico('redo')}</button>
    <button data-a="projects" title="Proyek Saya">${ico('folder')}<span class="vs-hide-n">Proyek</span></button>
    <button class="vs-ib" data-a="full" title="Layar penuh">${ico('full')}</button>
    <button class="vs-go" data-a="export">${ico('export')}<span>Ekspor</span></button>
  </div>
</div>
<div class="vs-main">
  <aside class="vs-lib" id="vs-lib">
    <div class="vs-sheethd"><b id="vs-libttl">Media</b><button class="vs-ib" data-a="closeSheet" aria-label="Tutup">${ico('x')}</button></div>
    <div class="vs-tabs" id="vs-libtabs">
      <button data-lib="media" class="on">${ico('media')}Media</button><button data-lib="text">${ico('text')}Teks</button><button data-lib="flt">${ico('drop')}Filter</button><button data-lib="fx">${ico('fx')}Efek</button>
      <button data-lib="trans">${ico('tr')}Transisi</button><button data-lib="audio">${ico('audio')}Audio</button><button data-lib="canvas">${ico('canvas')}Kanvas</button>
    </div>
    <div class="vs-body" id="vs-libbody"></div>
  </aside>
  <section class="vs-center">
    <div id="vs-stage"><canvas id="vs-cv"></canvas><div id="vs-ov"></div>
      <div class="vs-stagemsg" id="vs-stagemsg"><b>Mulai dengan menambahkan video</b><span>Video, foto & audio ukuran berapa pun. File tetap di perangkat Anda.</span><button class="vs-go" data-a="import">${ico('plus')} Impor Media</button></div>
    </div>
    <div class="vs-pbar">
      <div class="vs-time" id="vs-time">00:00:00 <span>/ 00:00:00</span></div>
      <div class="sp"></div>
      <button class="vs-ib vs-hide-n" data-a="toStart" title="Ke awal (Home)">${ico('start')}</button>
      <button class="vs-ib" data-a="prevFrame" title="Mundur 1 bingkai (Kiri)">${ico('back')}</button>
      <button class="vs-play" data-a="play" title="Putar / Jeda (Spasi)" id="vs-playbtn">${ico('play')}</button>
      <button class="vs-ib" data-a="nextFrame" title="Maju 1 bingkai (Kanan)">${ico('next')}</button>
      <button class="vs-ib vs-hide-n" data-a="toEnd" title="Ke akhir (End)">${ico('end')}</button>
      <div class="sp"></div>
      <button class="vs-ixbtn" data-a="inspect" title="Periksa detail layar penuh: resolusi asli, zoom piksel, warna &amp; noise (F)">${ico('insp')}<span class="vs-hide-n">Periksa</span></button>
      <button class="vs-ib" data-a="split2" id="vs-splitbtn" title="Bandingkan sebelum / sesudah" hidden>${ico('tr')}</button>
      <select id="vs-quality" title="Kualitas pratinjau"><option value="auto">Pratinjau: Otomatis</option><option value="full">Penuh</option><option value="half">1/2</option></select>
    </div>
  </section>
  <aside class="vs-insp" id="vs-insp">
    <div class="vs-sheethd"><b id="vs-inspttl">Properti</b><button class="vs-ib" data-a="closeSheet" aria-label="Tutup">${ico('x')}</button></div>
    <div class="vs-tabs" id="vs-insptabs"></div>
    <div class="vs-body" id="vs-inspbody"></div>
  </aside>
</div>
<div class="vs-tl" id="vs-tl"></div>
<div class="vs-colorp" id="vs-colorp" hidden></div>
<nav class="vs-mnav" id="vs-mnav"></nav>
<div id="vs-busy" hidden><i></i><div id="vs-busymsg"></div></div>
<div id="vs-toast" role="status" aria-live="polite"></div>
<input type="file" id="vs-file" multiple accept="video/*,audio/*,image/*,.mov,.mkv,.m4v,.heic,.heif,.mp3,.wav,.m4a,.dpx,.drx" hidden>
<input type="file" id="vs-afile" multiple accept="audio/*,video/*,.mp3,.wav,.m4a,.aac,.ogg,.flac" hidden>
<input type="file" id="vs-ffile" multiple accept=".ttf,.otf,.woff,.woff2,font/*" hidden>
<input type="file" id="vs-lfile" multiple accept=".cube,.CUBE" hidden>
<input type="file" id="vs-dvfile" multiple accept=".dpx,.drx,.DPX,.DRX,image/*" hidden>
<input type="file" id="vs-relink" hidden>`;
}
function setBusy(msg) { const b = $('#vs-busy'); if (!b) return; if (msg) { $('#vs-busymsg').textContent = msg; b.hidden = false; } else b.hidden = true; }
function modal(title, body, foot, opts) {
  const m = h('div', { class: 'vs-modal' }, `<div class="vs-dlg" role="dialog" aria-label="${esc(title)}"><header><b>${esc(title)}</b><button class="vs-ib" data-x>${ico('x')}</button></header><div class="bd">${body}</div>${foot ? '<footer>' + foot + '</footer>' : ''}</div>`);
  const close = () => { m.remove(); if (opts && opts.onClose) opts.onClose(); };
  m.addEventListener('click', e => { if (e.target === m && !(opts && opts.sticky)) close(); if (e.target.closest('[data-x]')) close(); });
  A.appendChild(m); return { el: m, close, $: s => m.querySelector(s) };
}
function confirmDlg(msg, okTxt) {
  return new Promise(res => { const d = modal('Konfirmasi', '<p style="margin:0">' + esc(msg) + '</p>', `<button data-n>Batal</button><button class="vs-go" data-y>${esc(okTxt || 'Ya')}</button>`, { onClose: () => res(false) });
    d.$('[data-y]').onclick = () => { d.el.remove(); res(true); }; d.$('[data-n]').onclick = () => { d.el.remove(); res(false); }; });
}
/* ---------- mode Edit / Warna ---------- */
function setMode(m) {
  MODE = m; A.classList.toggle('vs-mode-color', m === 'color'); $$('.vs-modes button').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
  $('#vs-tl').hidden = m === 'color'; $('#vs-colorp').hidden = m !== 'color';
  $('#vs-lib').hidden = m === 'color' && !NARROW();
  $('#vs-splitbtn').hidden = m !== 'color';
  if (m === 'color') { const c = selClip(); if (!c || !c.g) { const v = P.clips.filter(x => x.g).sort((a, b) => Math.abs(a.start - PH) - Math.abs(b.start - PH))[0]; const at = P.clips.find(x => x.g && PH >= x.start && PH < clipEnd(x)); SEL = (at || v || {}).id || null; } }
  closeSheets(); renderAll(); setTimeout(layoutCanvas, 30);
}
/* ---------- sheet HP ---------- */
function closeSheets() { $('#vs-lib').classList.remove('open'); $('#vs-insp').classList.remove('open'); }
function openLib(tab) { if (tab) libTab(tab); if (NARROW()) { $('#vs-insp').classList.remove('open'); $('#vs-lib').classList.add('open'); } }
function openInsp(tab) { if (tab) INSPTAB = tab; renderInspector(); if (NARROW()) { $('#vs-lib').classList.remove('open'); $('#vs-insp').classList.add('open'); } }
/* ---------- pustaka ---------- */
const LIBN = { flt: 'Filter Warna', media: 'Media', text: 'Teks & Font', fx: 'Efek', trans: 'Transisi', audio: 'Audio', canvas: 'Kanvas & Ukuran' };
function libTab(t) { LIBTAB = t; $$('#vs-libtabs button').forEach(b => b.classList.toggle('on', b.dataset.lib === t)); $('#vs-libttl').textContent = LIBN[t] || ''; renderLib(); }
function renderLib() { renderLib0(); const B = $('#vs-libbody'); if (B) { applySections(B); B.querySelectorAll('input[type=range]').forEach(fillRange); } }
function renderLib0() {
  const B = $('#vs-libbody'); if (!B || !P) return;
  if (LIBTAB === 'media') return renderMedia();
  if (LIBTAB === 'flt') return renderFilterLib(B);
  if (LIBTAB === 'text') {
    B.innerHTML = `<div class="vs-sec"><button class="vs-go" style="width:100%" data-a="addText">${ico('text')} Tambah Teks</button></div>
    <div class="vs-sec"><h4>Template teks & subtitle</h4><div class="vs-grid" id="vs-ttpl">${TEXT_TPL.map((t, i) => `<button class="vs-card" data-tpl="${i}"><div class="th" style="background:#111;font-family:'${esc(t.tx.font)}';font-weight:${t.tx.wt || 700};color:${t.tx.color || '#fff'};font-size:15px;text-transform:${t.tx.up ? 'uppercase' : 'none'};${t.tx.stroke ? '-webkit-text-stroke:1px ' + t.tx.strokeC + ';' : ''}${t.tx.glow ? 'text-shadow:0 0 8px ' + t.tx.glowC + ';' : ''}">Aa</div><b>${esc(t.n)}</b></button>`).join('')}</div></div>
    <div class="vs-sec"><h4>Font saya</h4><button style="width:100%" data-a="importFont">${ico('font')} Impor font (.ttf, .otf, .woff)</button>
    <div class="vs-note">${UFONTS.length ? UFONTS.map(f => esc(f.name)).join(', ') : 'Belum ada font impor. Font tersimpan di perangkat dan bisa dipakai di semua proyek.'}</div>
    <div class="vs-note">Tersedia 55+ font pilihan (mewah/fashion, modern, script, koleksi display, Arab, Jepang, Mandarin), semuanya bebas dipakai untuk konten komersial, di panel Teks setelah menambahkan teks.</div></div>`;
    TEXT_TPL.forEach(t => loadFont(t.tx.font, t.tx.wt));
    return;
  }
  if (LIBTAB === 'fx') {
    B.innerHTML = `<div class="vs-note">Ketuk efek untuk menaruhnya di playhead. Efek berlaku untuk semua lapisan di bawahnya, atur durasinya di timeline.</div>
    <div class="vs-grid">${FX.map(f => `<button class="vs-card vs-fxc" data-fx="${f.id}"><div class="th"><i>${esc(f.n.split(' ')[0].slice(0, 7))}</i></div><b>${esc(f.n)}</b></button>`).join('')}</div>
    <div class="vs-sec" style="margin-top:14px"><h4>Efek pada klip</h4><div class="vs-note">Green screen (chroma key), koreksi lensa, pertajam, crop, dynamic zoom & bekukan bingkai ada di panel properti klip.</div></div>`;
    return;
  }
  if (LIBTAB === 'trans') {
    const c = selClip();
    B.innerHTML = `<div class="vs-note">${c ? 'Ketuk transisi untuk memasangnya di <b>awal klip terpilih</b>.' : 'Pilih klip di timeline dulu (klip kedua dari sambungan), lalu ketuk transisi.'}</div>
    <div class="vs-row"><label>Durasi</label><select id="vs-trdur">${[0.3, 0.5, 0.8, 1, 1.5, 2].map(d => `<option value="${d}"${d === 0.8 ? ' selected' : ''}>${fmtNum(d, 1)} dtk</option>`).join('')}</select></div>
    <div class="vs-grid">${TRANS.map(t => `<button class="vs-card vs-fxc" data-tr="${t.id}"><div class="th"><i>${ico('tr')}</i></div><b>${esc(t.n)}</b></button>`).join('')}</div>
    <div class="vs-row" style="margin-top:12px"><button data-a="trAll" style="flex:1">Pasang di semua sambungan</button><button data-a="trNone">Hapus semua</button></div>`;
    return;
  }
  if (LIBTAB === 'audio') {
    const au = P.media.filter(m => m.kind === 'audio');
    B.innerHTML = `<button class="vs-drop" data-a="importAudio"><b>${ico('audio')} Impor musik / suara</b>MP3, WAV, M4A, AAC, OGG, FLAC</button>
    <div class="vs-grid">${au.map(mediaCard).join('') || ''}</div>
    <div class="vs-sec" style="margin-top:12px"><h4>Audio master (hasil akhir)</h4>
      <div class="vs-row"><label>Kenyaringan</label><select data-master="loud"><option value="-14">-14 LUFS (YouTube, TikTok, IG)</option><option value="-16">-16 LUFS (Podcast, Spotify)</option><option value="-23">-23 LUFS (Siaran TV)</option><option value="0">Tanpa normalisasi</option></select></div>
      <label class="vs-sw">Limiter anti pecah (-1 dBTP)<input type="checkbox" data-master="lim"></label>
      ${sliderHTML({ path: 'master.vol', label: 'Volume master', min: -24, max: 12, step: 0.1, unit: 'dB', noKf: 1, src: 'master' })}
      <div class="vs-note">Normalisasi kenyaringan dihitung otomatis saat ekspor (standar EBU R128 / ITU-R BS.1770) agar suara rata di semua platform.</div>
    </div>`;
    B.querySelector('[data-master=loud]').value = String(P.master.loud || 0); B.querySelector('[data-master=lim]').checked = !!P.master.lim;
    syncSliders(B, null); return;
  }
  if (LIBTAB === 'canvas') {
    B.innerHTML = `<div class="vs-sec"><h4>Ukuran kanvas</h4><div class="vs-presets">${CANVAS_PRESETS.map(c => { const s = 34 / Math.max(c.w, c.h); return `<button data-cv="${c.w}x${c.h}" class="${P.w === c.w && P.h === c.h ? 'on' : ''}"><i style="width:${Math.round(c.w * s)}px;height:${Math.round(c.h * s)}px"></i><b>${c.k}</b><small>${c.n}<br>${c.w}\u00d7${c.h}</small></button>`; }).join('')}</div></div>
    <div class="vs-sec"><h4>Ukuran kustom</h4><div class="vs-row"><input type="number" id="vs-cw" min="16" max="8192" value="${P.w}" style="flex:1"><span>\u00d7</span><input type="number" id="vs-ch" min="16" max="8192" value="${P.h}" style="flex:1"><button data-a="customCanvas">Pakai</button></div><div class="vs-note">Maksimum 8192 px. Untuk ekspor, 4K (3840\u00d72160) didukung sebagian besar perangkat.</div></div>
    <div class="vs-sec"><h4>Frame rate</h4><div class="vs-chips">${FPS_LIST.map(f => `<button data-fps="${f}" class="${P.fps === f ? 'on' : ''}">${String(f).replace('.', ',')}</button>`).join('')}</div></div>
    <div class="vs-sec"><h4>Latar</h4><div class="vs-row"><label>Warna latar</label><input type="color" id="vs-bg" value="${P.bg}"></div>
    <div class="vs-row"><button data-a="fitAll" style="flex:1">Semua klip: Pas (Fit)</button><button data-a="fillAll" style="flex:1">Semua klip: Penuh (Fill)</button></div></div>`;
    return;
  }
}
function mediaCard(m) {
  const th = THUMBS[m.id] && THUMBS[m.id][0] ? `style="background-image:url(${THUMBS[m.id][0].url})"` : '';
  const ico2 = m.kind === 'audio' ? ico('audio') : m.kind === 'image' ? '' : '';
  const info = (m.kind === 'image' ? m.w + '\u00d7' + m.h : fmtDur(m.dur) + (m.kind === 'video' ? ' \u00b7 ' + m.w + '\u00d7' + m.h : '')) + ' \u00b7 ' + fmtSize(m.size);
  return `<div class="vs-card" data-media="${m.id}" draggable="${m.offline ? 'false' : 'true'}" role="button" tabindex="0"><div class="th" ${th}>${th ? '' : ico2 || ico('media')}</div><b title="${esc(m.name)}">${esc(m.name)}</b><small>${m.offline ? '<span class="bad">Perlu dihubungkan ulang</span>' : esc(info)}</small><button class="x" data-delmedia="${m.id}" title="Hapus dari proyek">${ico('x')}</button></div>`;
}
function renderMedia() {
  if (LIBTAB !== 'media') return; const B = $('#vs-libbody'); if (!B) return;
  const list = P.media.filter(m => m.kind !== 'audio' || true);
  B.innerHTML = `<button class="vs-drop" data-a="import" id="vs-dropz"><b>${ico('plus')} Impor video, foto & audio</b>Ukuran berapa pun, sampai 4K/8K. Bisa pilih banyak sekaligus atau tarik file ke sini.</button>
  ${list.length ? `<div class="vs-grid">${list.map(mediaCard).join('')}</div>` : '<div class="vs-empty">Belum ada media.</div>'}
  <div class="vs-note" style="margin-top:10px">File tidak diunggah ke server, semua diproses di perangkat Anda. File &le; 300 MB tersimpan otomatis untuk dibuka lagi; file lebih besar cukup dihubungkan ulang saat proyek dibuka kembali.</div>`;
}
/* ---------- aksi pustaka ---------- */
function addTextClip(tpl) {
  const c = makeClip('text', { dur: 4, name: 'Teks' });
  if (tpl) { Object.assign(c.tx, deep(tpl.tx)); if (tpl.y != null) c.p.y = tpl.y; if (tpl.x != null) c.p.x = tpl.x; if (tpl.aIn) { c.p.aIn = tpl.aIn; c.p.aOut = tpl.aIn === 'type' ? 'fade' : 'fade'; } c.name = tpl.n; }
  c.start = PH; const tr = freeTrack('video', c.start, c.start + c.dur, null); c.track = tr.id;
  P.clips.push(c); SEL = c.id; loadFont(c.tx.font, c.tx.wt); commit('Tambah teks'); INSPTAB = 'text'; renderAll(); openInsp(); requestRender();
}
function addFx(id) {
  const c = makeFxClip(id); c.start = PH;
  const vt = P.tracks.filter(t => t.kind === 'video'); let tr = vt.find(t => !t.lock && !overlaps(t.id, c.start, c.start + c.dur) && clipsOn(t.id).every(x => x.kind === 'fx'));
  if (!tr) tr = addTrack('video', 0);
  c.track = tr.id; P.clips.push(c); SEL = c.id; commit('Tambah efek ' + c.name); INSPTAB = 'fx'; closeSheets(); renderAll(); requestRender();
}
function prevOnTrack(c) { return clipsOn(c.track).filter(x => x.id !== c.id && Math.abs(clipEnd(x) - c.start) < 0.6 / P.fps)[0]; }
function applyTrans(id, c, dur) {
  if (!c || c.kind === 'fx' || c.kind === 'audio') { toast('Pilih klip video/foto/teks yang punya klip sebelumnya di trek yang sama', true); return false; }
  if (!prevOnTrack(c)) { toast('Klip ini tidak menyambung dengan klip sebelumnya. Rapatkan dulu kedua klip.', true); return false; }
  c.tr = { type: id, dur: dur || 0.8 }; return true;
}

/* ---- k-inspector.js ---- */
/* ================= PANEL PROPERTI KLIP (inspector) ================= */
let INSPTAB = 'basic';
const lt0 = c => clamp(PH - c.start, 0, clipDur(c));
/* nilai bawaan sebuah parameter (untuk reset & penanda berubah) */
const DEF_BASE = { p: defP(), g: defG(), au: defAU(), tx: defTX() };
function defaultOf(path, c) {
  const seg = path.split('.'); let def = null;
  if (DEF_BASE[seg[0]]) def = getPath(DEF_BASE[seg[0]], seg.slice(1).join('.'));
  if (/^g\.nodes\./.test(path)) def = defNode()[seg[seg.length - 1]];
  if (/^fx\./.test(path) && c && c.fx) { const d = fxDef(c.fx.id).ps.find(p => p[0] === seg[1]); if (d) def = d[2]; }
  if (path === 'master.vol') def = 0;
  if (path === 'flt.amt') def = 80;
  return typeof def === 'number' ? def : null;
}
/* bagian (section) bisa dilipat seperti Raw Edit */
const CLOSED = new Set();
function applySections(root) { (root || A).querySelectorAll('.vs-sec>h4').forEach(h => { const k = h.textContent.trim(); h.parentNode.classList.toggle('closed', CLOSED.has(k)); }); }
document.addEventListener('click', e => {
  const h = e.target.closest && e.target.closest('#vs-app .vs-sec>h4'); if (!h || e.target.closest('input,button,select,label')) return;
  const k = h.textContent.trim(); if (CLOSED.has(k)) CLOSED.delete(k); else CLOSED.add(k); h.parentNode.classList.toggle('closed', CLOSED.has(k));
});
/* slider umum: {path,label,min,max,step,mul,unit,dec,noKf,src} */
function sliderHTML(d) {
  const mul = d.mul || 1;
  return `<div class="vs-ctl vs-sl" data-path="${d.path}" data-src="${d.src || 'clip'}" data-mul="${mul}" data-dec="${d.dec != null ? d.dec : 1}"${d.re ? ' data-re="1"' : ''}>
  <label title="${esc(d.label)}">${esc(d.label)}</label><input type="range" min="${d.min}" max="${d.max}" step="${d.step || 0.01}" aria-label="${esc(d.label)}">
  <input type="number" step="${(d.step || 0.01) * mul}" aria-label="${esc(d.label)} angka">${d.noKf || d.src === 'master' ? '<span></span>' : `<button class="vs-kf" data-kf="${d.path}" title="Keyframe">${ico('key')}</button>`}</div>`;
}
function sliderVal(row, c) {
  const path = row.dataset.path, src = row.dataset.src;
  if (src === 'master') return getPath(P, path);
  if (!c) return 0; const v = valAt(c, path, lt0(c)); return v == null ? 0 : v;
}
function syncSliders(root, c) {
  if (!root) return;
  root.querySelectorAll('.vs-ctl[data-path]').forEach(row => {
    const v = sliderVal(row, c), mul = +row.dataset.mul || 1, dec = +row.dataset.dec;
    const r = row.querySelector('input[type=range]'), n = row.querySelector('input[type=number]');
    if (r && document.activeElement !== r) { r.value = v; fillRange(r); }
    if (n && document.activeElement !== n) n.value = (Math.round(v * mul * Math.pow(10, dec)) / Math.pow(10, dec));
    const k = row.querySelector('.vs-kf'); if (k && c) { const p = row.dataset.path; k.classList.toggle('has', hasKF(c, p)); k.classList.toggle('at', kfIndex(c, p, lt0(c)) >= 0); }
    const dv = defaultOf(row.dataset.path, c); row.classList.toggle('chg', dv != null && Math.abs(v - dv) > 1e-6);
  });
}
function applyVal(path, src, v) {
  if (src === 'master') { setPath(P, path, v); return; }
  const c = selClip(); if (!c) return;
  setVal(c, path, v, lt0(c));
  if (/^(speed)$/.test(path)) renderTimeline();
  requestRender();
}
function bindControls(root, after) {
  root.addEventListener('input', e => {
    const row = e.target.closest('.vs-ctl'); if (!row || !row.dataset.path) return;
    const mul = +row.dataset.mul || 1; let v = +e.target.value; if (e.target.type === 'number') v = v / mul;
    if (!isFinite(v)) return;
    applyVal(row.dataset.path, row.dataset.src, v);
    if (e.target.type === 'range') { const n = row.querySelector('input[type=number]'); n.value = Math.round(v * mul * Math.pow(10, +row.dataset.dec)) / Math.pow(10, +row.dataset.dec); }
    if (after) after(row.dataset.path, true);
  });
  root.addEventListener('change', e => {
    const row = e.target.closest('.vs-ctl');
    if (row && row.dataset.path) { if (e.target.type === 'number') { const r = row.querySelector('input[type=range]'); r.value = +e.target.value / (+row.dataset.mul || 1); } commit('Ubah ' + row.querySelector('label').textContent); if (after) after(row.dataset.path, false); if (row.dataset.re) renderInspector(); return; }
  });
  root.addEventListener('click', e => {
    const k = e.target.closest('.vs-kf'); if (!k) return; const c = selClip(); if (!c) return;
    const on = toggleKF(c, k.dataset.kf, lt0(c)); commit(on ? 'Tambah keyframe' : 'Hapus keyframe'); syncSliders(root, c); renderTimeline(); requestRender();
  });
  root.addEventListener('dblclick', e => {
    const row = e.target.closest('.vs-ctl'); if (!row || !row.dataset.path || e.target.tagName === 'INPUT' && e.target.type === 'number') return;
    const c = selClip(); const path = row.dataset.path; const def = defaultOf(path, c);
    if (def == null || typeof def !== 'number') return;
    applyVal(path, row.dataset.src, def); syncSliders(root, c); commit('Reset');
  });
}
/* ---------- render inspector ---------- */
const TABN = { fix: 'Stabil & Noise', basic: 'Transformasi', speed: 'Kecepatan', anim: 'Animasi', lens: 'Lensa & Key', audio: 'Audio', text: 'Teks', fx: 'Efek' };
function inspTabsFor(c) {
  if (!c) return [];
  if (c.kind === 'video') return ['basic', 'fix', 'speed', 'anim', 'lens', 'audio'];
  if (c.kind === 'image') return ['basic', 'fix', 'anim', 'lens'];
  if (c.kind === 'text') return ['text', 'basic', 'anim'];
  if (c.kind === 'audio') return ['audio', 'speed'];
  if (c.kind === 'fx') return ['fx'];
  return [];
}
function renderInspector() {
  const T = $('#vs-insptabs'), B = $('#vs-inspbody'); if (!B || !P) return;
  if (MODE === 'color') { renderColorSide(); return; }
  const c = selClip();
  if (!c) { T.innerHTML = ''; $('#vs-inspttl').textContent = 'Properti'; B.innerHTML = `<div class="vs-empty">${ico('media')}Pilih klip di timeline untuk mengatur transformasi, kecepatan, animasi, audio & efek.<br><br>Tip: ketuk klip sekali untuk memilih, lalu geser untuk memindahkan.</div>`; return; }
  const tabs = inspTabsFor(c); if (!tabs.includes(INSPTAB)) INSPTAB = tabs[0];
  T.innerHTML = tabs.map(t => `<button data-it="${t}" class="${t === INSPTAB ? 'on' : ''}">${esc(TABN[t])}</button>`).join('');
  $('#vs-inspttl').textContent = c.name || TABN[INSPTAB];
  const m = c.media ? mediaById(c.media) : null;
  let h = `<div class="vs-note" style="margin-top:0">${esc(c.name || '')} \u00b7 ${fmtDur(clipDur(c))}${m && m.kind === 'video' ? ' \u00b7 ' + m.w + '\u00d7' + m.h + (m.fps ? ' \u00b7 ' + fmtNum(m.fps, 2) + ' fps' : '') : ''}</div>`;
  const S = d => sliderHTML(d);
  if (INSPTAB === 'basic' && m && m.demux === 'dpxseq') {
    h += `<div class="vs-sec"><h4>Sekuens DPX (${esc(m.vcodec)}, ${m.nframes} bingkai)</h4>
    <div class="vs-row"><label>Transformasi input</label><select data-dpxctf="1">${[['auto', 'Otomatis (dari header)'], ['video', 'Rec.709 / video'], ['log', 'Log Cineon / DaVinci Log'], ['linear', 'Linear']].map(([k, n]) => `<option value="${k}"${m.ctf === k ? ' selected' : ''}>${n}</option>`).join('')}</select></div>
    <div class="vs-chips">${[23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60].map(f => `<button data-dpxfps="${f}" class="${Math.abs(m.fps - f) < 0.01 ? 'on' : ''}">${String(f).replace('.', ',')} fps</button>`).join('')}</div>
    <div class="vs-note">Bingkai DPX dibaca penuh 10/12/16-bit ke tekstur half-float, jadi gradasi tetap halus saat di-grade (tanpa banding seperti JPG 8-bit).</div></div>`;
  }
  if (INSPTAB === 'basic') {
    h += `<div class="vs-sec"><h4>Penempatan</h4>
    ${c.kind !== 'text' ? `<div class="vs-chips">${[['fit', 'Pas'], ['fill', 'Penuh'], ['stretch', 'Regangkan']].map(([k, n]) => `<button data-set="p.fit" data-v="${k}" class="${c.p.fit === k ? 'on' : ''}">${n}</button>`).join('')}</div>` : ''}
    ${S({ path: 'p.x', label: 'Posisi X', min: -2, max: 2, step: 0.001, mul: 100, dec: 1 })}${S({ path: 'p.y', label: 'Posisi Y', min: -2, max: 2, step: 0.001, mul: 100, dec: 1 })}
    ${S({ path: 'p.scale', label: 'Skala %', min: 1, max: 500, step: 0.1, dec: 1 })}${S({ path: 'p.rot', label: 'Rotasi \u00b0', min: -360, max: 360, step: 0.1, dec: 1 })}
    ${S({ path: 'p.opacity', label: 'Opasitas %', min: 0, max: 100, step: 0.1, dec: 0 })}
    <div class="vs-row"><button data-flip="flipH" class="${c.p.flipH ? 'on' : ''}">Balik horizontal</button><button data-flip="flipV" class="${c.p.flipV ? 'on' : ''}">Balik vertikal</button><button data-a="resetTf">${ico('reset')}Reset</button></div>
    <div class="vs-row"><button data-a="kfAll" style="flex:1">${ico('key')} Keyframe posisi, skala, rotasi, opasitas</button></div></div>
    <div class="vs-sec"><h4>Komposit</h4><div class="vs-row"><label>Mode campur</label><select data-sel="p.blend">${BLEND_MODES.map(b => `<option value="${b}"${c.p.blend === b ? ' selected' : ''}>${{ normal: 'Normal', multiply: 'Multiply', screen: 'Screen', overlay: 'Overlay', softlight: 'Soft Light', add: 'Add / Linear Dodge', darken: 'Darken', lighten: 'Lighten', difference: 'Difference', dodge: 'Color Dodge' }[b]}</option>`).join('')}</select></div></div>
    ${c.kind !== 'text' ? `<div class="vs-sec"><h4>Crop</h4>${S({ path: 'p.cl', label: 'Kiri %', min: 0, max: 48, step: 0.1 })}${S({ path: 'p.cr', label: 'Kanan %', min: 0, max: 48, step: 0.1 })}${S({ path: 'p.ct', label: 'Atas %', min: 0, max: 48, step: 0.1 })}${S({ path: 'p.cb', label: 'Bawah %', min: 0, max: 48, step: 0.1 })}</div>` : ''}`;
  }
  if (INSPTAB === 'speed') {
    const ramp = !!c.ramp;
    h += `<div class="vs-sec"><h4>Kecepatan</h4><div class="vs-chips"><button data-a="spNormal" class="${!ramp ? 'on' : ''}">Konstan</button><button data-a="spCurve" class="${ramp ? 'on' : ''}">Kurva (Speed Ramp)</button></div>
    <div class="vs-ctl vs-sl" data-sp="1"><label>Kecepatan</label><input type="range" min="-3.32" max="3.32" step="0.01" id="vs-spr" value="${Math.log2(c.speed || 1)}"><input type="number" min="0.1" max="10" step="0.05" id="vs-spn" value="${fmtNum(c.speed || 1, 2).replace(',', '.')}"><span>x</span></div>
    <div class="vs-chips">${[0.25, 0.5, 1, 1.5, 2, 3, 5, 10].map(s => `<button data-speed="${s}">${String(s).replace('.', ',')}x</button>`).join('')}</div>
    <div class="vs-note">Durasi: <b>${fmtDur(clipDur(c))}</b>. Suara ikut berubah nada saat kecepatan diubah.</div></div>
    <div class="vs-sec"${ramp ? '' : ' hidden'} id="vs-rampsec"><h4>Kurva kecepatan</h4><div class="vs-chips">${Object.keys(RAMPS).map(k => `<button data-ramp="${k}">${RAMP_NAMES[k]}</button>`).join('')}</div>
    <canvas id="vs-rampcv" width="560" height="220" style="width:100%;height:150px;background:#0b0c0e;border:1px solid var(--ln);border-radius:8px;touch-action:none"></canvas>
    <div class="vs-note">Tarik titik naik/turun. Klik dua kali di area kosong untuk menambah titik, klik dua kali titik untuk menghapus. Cocok untuk video drone FPV & mobil ngebut.</div></div>
    ${c.kind === 'video' ? `<div class="vs-sec"><h4>Retime</h4><div class="vs-row"><button data-a="freeze" style="flex:1">${ico('freeze')} Bekukan bingkai di playhead (2 dtk)</button></div></div>` : ''}`;
  }
  if (INSPTAB === 'anim') {
    const opt = sel => ANIMS.filter(a => a[0] !== 'type' || c.kind === 'text').map(a => `<option value="${a[0]}"${sel === a[0] ? ' selected' : ''}>${a[1]}</option>`).join('');
    h += `<div class="vs-sec"><h4>Animasi masuk</h4><div class="vs-row"><select data-sel="p.aIn">${opt(c.p.aIn)}</select></div>${S({ path: 'p.aInD', label: 'Durasi (dtk)', min: 0.1, max: 5, step: 0.05, noKf: 1, dec: 2 })}</div>
    <div class="vs-sec"><h4>Animasi keluar</h4><div class="vs-row"><select data-sel="p.aOut">${opt(c.p.aOut)}</select></div>${S({ path: 'p.aOutD', label: 'Durasi (dtk)', min: 0.1, max: 5, step: 0.05, noKf: 1, dec: 2 })}</div>`;
    if (c.kind !== 'text') h += `<div class="vs-sec"><h4>Dynamic Zoom (Ken Burns)<span class="sp"></span></h4><label class="vs-sw">Aktifkan<input type="checkbox" data-ck="p.dz"${c.p.dz ? ' checked' : ''}></label>
    <div class="vs-chips">${[['in', 'Zoom masuk'], ['out', 'Zoom keluar'], ['lr', 'Geser kiri \u2192 kanan'], ['rl', 'Geser kanan \u2192 kiri'], ['up', 'Naik pelan'], ['kb', 'Ken Burns']].map(([k, n]) => `<button data-dz="${k}">${n}</button>`).join('')}</div>
    ${S({ path: 'p.dzS0', label: 'Skala awal %', min: 50, max: 300, step: 0.5, noKf: 1 })}${S({ path: 'p.dzS1', label: 'Skala akhir %', min: 50, max: 300, step: 0.5, noKf: 1 })}
    ${S({ path: 'p.dzX0', label: 'Geser X awal', min: -1, max: 1, step: 0.005, mul: 100, noKf: 1 })}${S({ path: 'p.dzX1', label: 'Geser X akhir', min: -1, max: 1, step: 0.005, mul: 100, noKf: 1 })}
    ${S({ path: 'p.dzY0', label: 'Geser Y awal', min: -1, max: 1, step: 0.005, mul: 100, noKf: 1 })}${S({ path: 'p.dzY1', label: 'Geser Y akhir', min: -1, max: 1, step: 0.005, mul: 100, noKf: 1 })}
    <label class="vs-sw">Gerak halus (ease)<input type="checkbox" data-ck="p.dzE"${c.p.dzE ? ' checked' : ''}></label></div>`;
    const pv = prevOnTrack(c);
    h += `<div class="vs-sec"><h4>Transisi masuk</h4>${pv ? `<div class="vs-row"><select data-tr2="1"><option value="">Tanpa transisi</option>${TRANS.map(t => `<option value="${t.id}"${c.tr && c.tr.type === t.id ? ' selected' : ''}>${t.n}</option>`).join('')}</select></div>
    <div class="vs-ctl vs-sl" data-trd="1"><label>Durasi</label><input type="range" min="0.1" max="3" step="0.05" value="${c.tr ? c.tr.dur : 0.8}"><input type="number" min="0.1" max="3" step="0.05" value="${c.tr ? c.tr.dur : 0.8}"><span></span></div>` : '<div class="vs-note">Klip ini tidak tersambung dengan klip sebelumnya di trek yang sama.</div>'}</div>`;
  }
  if (INSPTAB === 'fix') {
    if (c.kind === 'video') {
      const s = c.stab, ok = s && s.n > 1, r = ok ? stabCorr(c) : null;
      h += `<div class="vs-sec"><h4>Stabilizer</h4>
      <label class="vs-sw">Aktifkan stabilizer<input type="checkbox" data-ck="p.stab"${c.p.stab ? ' checked' : ''}${ok ? '' : ' disabled'}></label>
      <div class="vs-row"><button class="${ok ? '' : 'vs-go'}" data-a="stabAnalyze" style="flex:1">${ico('reset')} ${ok ? 'Analisis ulang' : 'Analisis guncangan'}</button></div>
      <div class="vs-note">${ok ? `Data gerak: ${s.n} bingkai. Zoom otomatis ${Math.round(r.auto * 100)}%.` : 'Analisis membaca setiap bingkai klip (sekitar 5\u201320 detik per menit video) lalu meredam guncangan seperti stabilizer DaVinci/CapCut.'}</div>
      <div class="vs-chips">${[['smooth', 'Halus (kamera bergerak)'], ['tripod', 'Kamera diam (tripod)']].map(([v, n]) => `<button data-set="p.stabMode" data-v="${v}" class="${c.p.stabMode === v ? 'on' : ''}">${n}</button>`).join('')}</div>
      ${S({ path: 'p.stabStr', label: 'Kehalusan', min: 0, max: 100, step: 1, noKf: 1, dec: 0 })}
      ${S({ path: 'p.stabZoom', label: 'Zoom crop % (0 = otomatis)', min: 0, max: 60, step: 0.5, noKf: 1, dec: 1 })}</div>`;
    }
    h += `<div class="vs-sec"><h4>Pengurang noise video</h4>
    ${S({ path: 'p.nrL', label: 'Noise terang (luma)', min: 0, max: 100, step: 1, noKf: 1, dec: 0 })}
    ${S({ path: 'p.nrC', label: 'Noise warna (chroma)', min: 0, max: 100, step: 1, noKf: 1, dec: 0 })}
    ${c.kind === 'video' ? S({ path: 'p.nrT', label: 'Temporal (antar-bingkai)', min: 0, max: 100, step: 1, noKf: 1, dec: 0 }) : ''}
    <div class="vs-chips"><button data-nrp="light">Ringan</button><button data-nrp="mid">Sedang</button><button data-nrp="night">Malam / ISO tinggi</button><button data-nrp="off">Matikan</button></div>
    <div class="vs-note">Seperti Spatial & Temporal NR di DaVinci: bintik warna dan butiran di area gelap dibersihkan, tepi objek tetap tajam. Temporal paling efektif untuk kamera yang diam/stabil.</div></div>`;
  }
  if (INSPTAB === 'lens') {
    h += `<div class="vs-sec"><h4>Koreksi lensa</h4>${S({ path: 'p.lens', label: 'Distorsi', min: -100, max: 100, step: 0.5 })}${S({ path: 'p.lensZ', label: 'Kompensasi zoom', min: -30, max: 60, step: 0.5 })}
    <div class="vs-note">Geser ke kiri untuk meluruskan efek "fisheye" GoPro/drone, ke kanan untuk efek tong (barrel).</div>${S({ path: 'p.sharp', label: 'Pertajam', min: 0, max: 100, step: 0.5 })}</div>
    <div class="vs-sec"><h4>Green screen (chroma key)</h4><label class="vs-sw">Aktifkan<input type="checkbox" data-ck="p.key"${c.p.key ? ' checked' : ''}></label>
    <div class="vs-row"><label>Warna kunci</label><input type="color" data-col="p.keyC" value="${c.p.keyC}"><button data-a="pickKey">${ico('pick')} Ambil dari layar</button></div>
    ${S({ path: 'p.keyTol', label: 'Toleransi', min: 0, max: 100, step: 0.5 })}${S({ path: 'p.keySoft', label: 'Kehalusan tepi', min: 0, max: 100, step: 0.5 })}${S({ path: 'p.keySpill', label: 'Hilangkan pantulan', min: 0, max: 100, step: 0.5 })}</div>`;
  }
  if (INSPTAB === 'audio') {
    const au = c.au;
    h += `<div class="vs-sec"><h4>Volume</h4>${S({ path: 'au.vol', label: 'Volume dB', min: -60, max: 12, step: 0.1 })}
    <label class="vs-sw">Bisukan klip<input type="checkbox" data-ck="au.mute"${au.mute ? ' checked' : ''}></label>
    ${S({ path: 'au.fin', label: 'Fade in (dtk)', min: 0, max: 10, step: 0.05, noKf: 1, dec: 2 })}${S({ path: 'au.fout', label: 'Fade out (dtk)', min: 0, max: 10, step: 0.05, noKf: 1, dec: 2 })}
    ${S({ path: 'au.pan', label: 'Pan Kiri/Kanan', min: -100, max: 100, step: 1, noKf: 1, dec: 0 })}
    ${c.kind === 'video' && !au.mute ? `<div class="vs-row"><button data-a="detach" style="flex:1">${ico('detach')} Pisahkan audio ke trek audio</button></div>` : ''}</div>
    <div class="vs-sec"><h4>Pengurang noise suara</h4>${S({ path: 'au.dn', label: 'Kekuatan', min: 0, max: 100, step: 1, noKf: 1, dec: 0 })}
    <div class="vs-note">Menghilangkan desis, dengung AC/kipas & angin ringan. Mulai dari 40\u201360.</div></div>
    <div class="vs-sec"><h4>Preset suara</h4><div class="vs-chips"><button data-aup="voice">Vokal jernih</button><button data-aup="podcast">Podcast</button><button data-aup="music">Musik latar</button><button data-aup="cinema">Sinematik</button><button data-aup="reset">Reset</button></div></div>
    <div class="vs-sec"><h4>Equalizer</h4><label class="vs-sw">Aktifkan EQ<input type="checkbox" data-ck="au.eq"${au.eq ? ' checked' : ''}></label>
    ${S({ path: 'au.eqL', label: 'Bass (120 Hz)', min: -12, max: 12, step: 0.1, noKf: 1 })}${S({ path: 'au.eqM', label: 'Mid (1,5 kHz)', min: -12, max: 12, step: 0.1, noKf: 1 })}${S({ path: 'au.eqH', label: 'Treble (8 kHz)', min: -12, max: 12, step: 0.1, noKf: 1 })}
    <label class="vs-sw">Potong dengung rendah (low cut 80 Hz)<input type="checkbox" data-ck="au.hpf"${au.hpf ? ' checked' : ''}></label></div>
    <div class="vs-sec"><h4>Kompresor</h4><label class="vs-sw">Aktifkan<input type="checkbox" data-ck="au.comp"${au.comp ? ' checked' : ''}></label>
    ${S({ path: 'au.cThr', label: 'Threshold dB', min: -50, max: 0, step: 0.5, noKf: 1 })}${S({ path: 'au.cRat', label: 'Rasio', min: 1, max: 20, step: 0.1, noKf: 1 })}${S({ path: 'au.cGain', label: 'Makeup dB', min: 0, max: 24, step: 0.1, noKf: 1 })}</div>`;
  }
  if (INSPTAB === 'text') {
    const tx = c.tx, cats = ['Mewah', 'Modern', 'Script', 'Bahasa'], catN = { Mewah: 'Mewah / Fashion / Majalah', Modern: 'Modern / Iklan / Sosmed', Script: 'Script / Elegan', Bahasa: 'Arab, Jepang, Mandarin' };
    h += `<div class="vs-sec"><h4>Isi teks</h4><textarea id="vs-txt" rows="3">${esc(tx.t)}</textarea></div>
    <div class="vs-sec"><h4>Font</h4><div class="vs-row"><select data-sel="tx.font" data-re="1">${UFONTS.length ? '<optgroup label="Font saya">' + UFONTS.map(f => `<option${tx.font === f.name ? ' selected' : ''}>${esc(f.name)}</option>`).join('') + '</optgroup>' : ''}<optgroup label="Koleksi pilihan">${PACK.map(p => `<option${fontName(tx.font) === p.name ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}${FONTS.filter(f => f[1] === 'Koleksi').map(f => `<option${fontName(tx.font) === f[0] ? ' selected' : ''}>${f[0]}</option>`).join('')}</optgroup>${cats.map(k => `<optgroup label="${catN[k]}">${FONTS.filter(f => f[1] === k).map(f => `<option${fontName(tx.font) === f[0] ? ' selected' : ''}>${f[0]}</option>`).join('')}</optgroup>`).join('')}</select></div>
    <div class="vs-row"><select data-sel="tx.wt" style="flex:1">${[400, 700, 900].map(w => `<option value="${w}"${tx.wt === w ? ' selected' : ''}>${w === 400 ? 'Reguler' : w === 700 ? 'Tebal' : 'Sangat tebal'}</option>`).join('')}</select><button data-tog="tx.it" class="${tx.it ? 'on' : ''}"><i>I</i></button><button data-tog="tx.up" class="${tx.up ? 'on' : ''}">AA</button><button data-a="importFont" title="Impor font">${ico('font')}</button></div>
    ${S({ path: 'tx.size', label: 'Ukuran', min: 1, max: 30, step: 0.05, noKf: 1, dec: 2 })}
    <div class="vs-row"><label>Warna</label><input type="color" data-col="tx.color" value="${tx.color}"><div class="vs-chips" style="margin:0">${['left', 'center', 'right'].map(a => `<button data-set="tx.align" data-v="${a}" class="${tx.align === a ? 'on' : ''}">${{ left: 'Kiri', center: 'Tengah', right: 'Kanan' }[a]}</button>`).join('')}</div></div>
    ${S({ path: 'tx.ls', label: 'Jarak huruf', min: -10, max: 60, step: 0.5, noKf: 1 })}${S({ path: 'tx.lh', label: 'Jarak baris', min: 0.7, max: 2.5, step: 0.01, noKf: 1, dec: 2 })}${S({ path: 'tx.maxW', label: 'Lebar maks %', min: 10, max: 100, step: 1, noKf: 1, dec: 0 })}</div>
    <div class="vs-sec"><h4>Gaya</h4>
    <div class="vs-row"><label>Garis tepi</label><input type="color" data-col="tx.strokeC" value="${tx.strokeC}"></div>${S({ path: 'tx.stroke', label: 'Tebal tepi', min: 0, max: 20, step: 0.1, noKf: 1 })}
    <div class="vs-row"><label>Bayangan</label><input type="color" data-col="tx.shadowC" value="${tx.shadowC}"></div>${S({ path: 'tx.shadow', label: 'Bayangan', min: 0, max: 100, step: 1, noKf: 1, dec: 0 })}
    <div class="vs-row"><label>Glow / Neon</label><input type="color" data-col="tx.glowC" value="${tx.glowC}"></div>${S({ path: 'tx.glow', label: 'Glow', min: 0, max: 100, step: 1, noKf: 1, dec: 0 })}
    <label class="vs-sw">Kotak latar<input type="checkbox" data-ck="tx.bg"${tx.bg ? ' checked' : ''}></label><div class="vs-row"><label>Warna kotak</label><input type="color" data-col="tx.bgC" value="${tx.bgC}"></div>${S({ path: 'tx.bgA', label: 'Opasitas kotak', min: 0, max: 100, step: 1, noKf: 1, dec: 0 })}${S({ path: 'tx.bgR', label: 'Sudut bulat', min: 0, max: 60, step: 1, noKf: 1, dec: 0 })}
    <label class="vs-sw">Gradasi warna<input type="checkbox" data-ck="tx.grad"${tx.grad ? ' checked' : ''}></label><div class="vs-row"><label>Warna bawah</label><input type="color" data-col="tx.gradC" value="${tx.gradC}"></div></div>
    <div class="vs-sec"><h4>Template cepat</h4><div class="vs-chips">${TEXT_TPL.map((t, i) => `<button data-tpl2="${i}">${esc(t.n)}</button>`).join('')}</div></div>`;
  }
  if (INSPTAB === 'fx') {
    const d = fxDef(c.fx.id);
    h += `<div class="vs-sec"><h4>Jenis efek</h4><div class="vs-row"><select data-fxsel="1">${FX.map(f => `<option value="${f.id}"${f.id === d.id ? ' selected' : ''}>${f.n}</option>`).join('')}</select></div></div>
    <div class="vs-sec"><h4>Pengaturan</h4>${d.ps.map(p => S({ path: 'fx.' + p[0], label: p[1], min: p[3] != null ? p[3] : 0, max: p[4] != null ? p[4] : 100, step: p[4] === 1 || p[4] === 2 ? 1 : 0.5, dec: 1 })).join('')}
    ${d.c1 ? `<div class="vs-row"><label>Warna 1</label><input type="color" data-col="fx.c1" value="${c.fx.c1}"></div>` : ''}${d.c2 ? `<div class="vs-row"><label>Warna 2</label><input type="color" data-col="fx.c2" value="${c.fx.c2}"></div>` : ''}
    <div class="vs-note">Efek berlaku untuk semua lapisan di bawah trek ini selama durasi klip efek. Pakai keyframe (\u25c6) agar intensitas berubah seiring waktu.</div></div>`;
  }
  B.innerHTML = h;
  syncSliders(B, c); B.querySelectorAll('input[type=range]').forEach(fillRange); applySections(B);
  if (INSPTAB === 'speed' && c.ramp) drawRamp();
}
function syncInspector() { const c = selClip(); if (MODE === 'color') { syncSliders($('#vs-colorp'), c); return; } syncSliders($('#vs-inspbody'), c); }
/* ---------- aksi inspector ---------- */
function bindInspector() {
  const B = $('#vs-inspbody');
  bindControls(B, (path, live) => { if (/^tx\./.test(path) || /^p\.(dz|aIn|aOut)/.test(path)) requestRender(); if (/^au\./.test(path)) requestRender(); if (!live) renderTimeline(); });
  $('#vs-insptabs').addEventListener('click', e => { const b = e.target.closest('[data-it]'); if (!b) return; INSPTAB = b.dataset.it; renderInspector(); });
  B.addEventListener('input', e => {
    const c = selClip(); if (!c) return;
    if (e.target.id === 'vs-txt') { c.tx.t = e.target.value; requestRender(); clearTimeout(e.target._t); e.target._t = setTimeout(() => commit('Ketik teks'), 600); return; }
    if (e.target.matches('[data-col]')) { setPath(c, e.target.dataset.col, e.target.value); requestRender(); return; }
    if (e.target.id === 'vs-spr' || e.target.id === 'vs-spn') {
      let s = e.target.id === 'vs-spr' ? Math.pow(2, +e.target.value) : +e.target.value; if (!isFinite(s) || s <= 0) return; s = clamp(Math.round(s * 100) / 100, 0.1, 10);
      setSpeed(c, s); if (e.target.id === 'vs-spr') $('#vs-spn').value = s; else $('#vs-spr').value = Math.log2(s); renderTimeline(); requestRender(); return;
    }
    if (e.target.closest('[data-trd]')) { const v = +e.target.value; if (c.tr && isFinite(v)) { c.tr.dur = clamp(v, 0.1, 3); e.target.closest('[data-trd]').querySelectorAll('input').forEach(i => { if (i !== e.target) i.value = c.tr.dur; }); requestRender(); renderTimeline(); } }
  });
  B.addEventListener('change', e => {
    const c = selClip(); if (!c) return;
    if (e.target.matches('[data-col]')) { commit('Warna'); return; }
    if (e.target.matches('[data-dpxctf]')) { const m = mediaById(c.media); if (m) { m.ctf = e.target.value; DPXP.delete(c.id); P.clips.forEach(x => { if (x.media === m.id) DPXP.delete(x.id); }); delete THUMBS[m.id]; genThumbs(m); commit('Input DPX'); requestRender(); } return; }
    if (e.target.matches('select[data-sel]')) { let v = e.target.value; if (/^\d+$/.test(v)) v = +v; setPath(c, e.target.dataset.sel, v); if (e.target.dataset.sel === 'tx.font') loadFont(v, c.tx.wt); commit('Ubah'); requestRender(); if (e.target.dataset.re) renderInspector(); return; }
    if (e.target.matches('input[data-ck]')) { setPath(c, e.target.dataset.ck, e.target.checked ? 1 : 0); commit('Ubah'); requestRender(); renderTimeline(); if (e.target.dataset.ck === 'au.mute' || e.target.dataset.ck === 'p.stab') renderInspector(); return; }
    if (e.target.id === 'vs-spr' || e.target.id === 'vs-spn') { commit('Ubah kecepatan'); renderInspector(); return; }
    if (e.target.matches('[data-tr2]')) { const v = e.target.value; if (v) applyTrans(v, c, c.tr ? c.tr.dur : 0.8); else c.tr = null; commit('Transisi'); renderTimeline(); renderInspector(); requestRender(); return; }
    if (e.target.closest('[data-trd]')) { commit('Durasi transisi'); return; }
    if (e.target.matches('[data-fxsel]')) { const d = fxDef(e.target.value); c.fx.id = d.id; c.name = d.n; d.ps.forEach(p => { if (c.fx[p[0]] == null) c.fx[p[0]] = p[2]; }); if (d.c1) c.fx.c1 = d.c1; if (d.c2) c.fx.c2 = d.c2; commit('Ganti efek'); renderInspector(); renderTimeline(); requestRender(); }
  });
  B.addEventListener('click', e => {
    const c = selClip(); if (!c) return; const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.set) { let v = b.dataset.v; setPath(c, b.dataset.set, v); commit('Ubah'); renderInspector(); requestRender(); return; }
    if (b.dataset.dpxfps) { const m = mediaById(c.media); if (m) { const f = +b.dataset.dpxfps, od = m.dur; m.fps = f; m.dur = m.nframes / f; P.clips.forEach(x => { if (x.media === m.id) { const full = x.out >= od - 1e-3; x.in = Math.min(x.in, Math.max(0, m.dur - 0.04)); x.out = full ? m.dur : clamp(x.out, x.in + 0.04, m.dur); } }); commit('FPS sekuens'); renderInspector(); renderTimeline(); requestRender(); } return; }
    if (b.dataset.flip) { c.p[b.dataset.flip] = c.p[b.dataset.flip] ? 0 : 1; commit('Balik'); renderInspector(); requestRender(); return; }
    if (b.dataset.tog) { setPath(c, b.dataset.tog, getPath(c, b.dataset.tog) ? 0 : 1); commit('Ubah'); renderInspector(); requestRender(); return; }
    if (b.dataset.speed) { setSpeed(c, +b.dataset.speed); c.ramp = null; commit('Kecepatan ' + b.dataset.speed + 'x'); renderInspector(); renderTimeline(); requestRender(); return; }
    if (b.dataset.ramp) { setRamp(c, deep(RAMPS[b.dataset.ramp])); commit('Speed ramp ' + RAMP_NAMES[b.dataset.ramp]); renderInspector(); renderTimeline(); requestRender(); return; }
    if (b.dataset.dz) { dzPreset(c, b.dataset.dz); commit('Dynamic zoom'); renderInspector(); requestRender(); return; }
    if (b.dataset.aup) { audioPreset(c, b.dataset.aup); commit('Preset audio'); renderInspector(); requestRender(); return; }
    if (b.dataset.nrp) { const v = { light: [15, 25, 20], mid: [30, 45, 40], night: [50, 70, 65], off: [0, 0, 0] }[b.dataset.nrp]; c.p.nrL = v[0]; c.p.nrC = v[1]; c.p.nrT = c.kind === 'video' ? v[2] : 0; commit('Noise reduction'); renderInspector(); requestRender(); return; }
    if (b.dataset.tpl2) { const t = TEXT_TPL[+b.dataset.tpl2]; const keep = c.tx.t; Object.assign(c.tx, defTX(), deep(t.tx)); if (!t.tx.t) c.tx.t = keep; if (t.aIn) c.p.aIn = t.aIn; loadFont(c.tx.font, c.tx.wt); commit('Template teks'); renderInspector(); requestRender(); return; }
  });
}
function setSpeed(c, s) {
  const end0 = clipEnd(c); c.speed = s;
  /* geser klip setelahnya di trek yang sama agar tidak bertumpuk */
  ripple(c, clipEnd(c) - end0, end0);
}
function setRamp(c, r) { const end0 = clipEnd(c); c.ramp = r; ripple(c, clipEnd(c) - end0, end0); }
function ripple(c, d, from) { if (Math.abs(d) < 1e-6) return; P.clips.forEach(x => { if (x.track === c.track && x.id !== c.id && x.start >= from - 1e-4) x.start = Math.max(0, x.start + d); }); }
function dzPreset(c, k) {
  const p = c.p; p.dz = 1; p.dzE = 1; p.dzX0 = p.dzX1 = p.dzY0 = p.dzY1 = 0;
  if (k === 'in') { p.dzS0 = 100; p.dzS1 = 125; } else if (k === 'out') { p.dzS0 = 125; p.dzS1 = 100; }
  else if (k === 'lr') { p.dzS0 = p.dzS1 = 120; p.dzX0 = 0.15; p.dzX1 = -0.15; } else if (k === 'rl') { p.dzS0 = p.dzS1 = 120; p.dzX0 = -0.15; p.dzX1 = 0.15; }
  else if (k === 'up') { p.dzS0 = p.dzS1 = 118; p.dzY0 = -0.12; p.dzY1 = 0.12; } else { p.dzS0 = 105; p.dzS1 = 135; p.dzX0 = -0.08; p.dzX1 = 0.1; p.dzY0 = 0.06; p.dzY1 = -0.08; }
}
function audioPreset(c, k) {
  const a = c.au; Object.assign(a, { eq: 0, eqL: 0, eqM: 0, eqH: 0, hpf: 0, comp: 0, cThr: -18, cRat: 3, cGain: 0 });
  if (k === 'voice') Object.assign(a, { eq: 1, eqL: -3, eqM: 2.5, eqH: 3, hpf: 1, comp: 1, cThr: -22, cRat: 3.5, cGain: 5 });
  if (k === 'podcast') Object.assign(a, { eq: 1, eqL: 1.5, eqM: 2, eqH: 2, hpf: 1, comp: 1, cThr: -26, cRat: 4, cGain: 7 });
  if (k === 'music') Object.assign(a, { vol: -10, eq: 1, eqL: 0, eqM: -2.5, eqH: 0 });
  if (k === 'cinema') Object.assign(a, { eq: 1, eqL: 3, eqM: -1, eqH: 1.5, comp: 1, cThr: -20, cRat: 2.5, cGain: 3 });
}
/* ---------- editor kurva speed ramp ---------- */
function drawRamp() {
  const cv = $('#vs-rampcv'), c = selClip(); if (!cv || !c || !c.ramp) return;
  const x = cv.getContext('2d'), W = cv.width, H = cv.height, Y = m => H / 2 - Math.log2(m) / Math.log2(10) * (H / 2 - 12);
  x.clearRect(0, 0, W, H); x.strokeStyle = '#2a2e35'; x.lineWidth = 1;
  [0.1, 0.25, 0.5, 1, 2, 4, 10].forEach(m => { x.beginPath(); x.moveTo(0, Y(m)); x.lineTo(W, Y(m)); x.stroke(); x.fillStyle = '#6b737d'; x.font = '18px system-ui'; x.fillText(String(m).replace('.', ',') + 'x', 6, Y(m) - 4); });
  x.strokeStyle = '#ff3d8b'; x.lineWidth = 3; x.beginPath();
  for (let i = 0; i <= 200; i++) { const u = i / 200, yy = Y(rampAt(c.ramp, u) * (c.speed || 1) / (c.speed || 1)); i ? x.lineTo(u * W, yy) : x.moveTo(0, yy); } x.stroke();
  c.ramp.forEach(p => { x.fillStyle = '#fff'; x.beginPath(); x.arc(p[0] * W, Y(p[1]), 9, 0, 7); x.fill(); });
  const lt = clamp((PH - c.start) / clipDur(c), 0, 1); x.strokeStyle = '#fff8'; x.beginPath(); x.moveTo(lt * W, 0); x.lineTo(lt * W, H); x.stroke();
}
function bindRampEditor() {
  let D = null;
  const pos = (cv, e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
  const toM = (cv, yy) => Math.pow(10, clamp((0.5 - yy) * cv.height / (cv.height / 2 - 12), -1, 1));
  A.addEventListener('pointerdown', e => {
    const cv = e.target.closest && e.target.closest('#vs-rampcv'); if (!cv) return; const c = selClip(); if (!c || !c.ramp) return;
    const [u, yy] = pos(cv, e); let best = -1, bd = 0.05;
    c.ramp.forEach((p, i) => { const d = Math.hypot(p[0] - u, (cv.height / 2 - Math.log2(p[1]) / Math.log2(10) * (cv.height / 2 - 12)) / cv.height - yy); if (d < bd) { bd = d; best = i; } });
    if (best < 0) return; e.preventDefault(); cv.setPointerCapture(e.pointerId); D = { cv, i: best, c, end0: clipEnd(c) };
  });
  A.addEventListener('pointermove', e => {
    if (!D) return; const [u, yy] = pos(D.cv, e), r = D.c.ramp, i = D.i;
    r[i][1] = Math.round(toM(D.cv, yy) * 100) / 100;
    if (i > 0 && i < r.length - 1) r[i][0] = clamp(u, r[i - 1][0] + 0.02, r[i + 1][0] - 0.02);
    drawRamp(); requestRender();
  });
  A.addEventListener('pointerup', () => { if (!D) return; const c = D.c; ripple(c, clipEnd(c) - D.end0, D.end0); D = null; commit('Ubah kurva kecepatan'); renderTimeline(); renderInspector(); });
  A.addEventListener('dblclick', e => {
    const cv = e.target.closest && e.target.closest('#vs-rampcv'); if (!cv) return; const c = selClip(); if (!c || !c.ramp) return;
    const [u, yy] = pos(cv, e); const end0 = clipEnd(c);
    const i = c.ramp.findIndex(p => Math.abs(p[0] - u) < 0.03);
    if (i > 0 && i < c.ramp.length - 1) c.ramp.splice(i, 1); else if (i < 0) { c.ramp.push([u, Math.round(toM(cv, yy) * 100) / 100]); c.ramp.sort((a, b) => a[0] - b[0]); }
    ripple(c, clipEnd(c) - end0, end0); commit('Titik kurva'); renderTimeline(); drawRamp(); requestRender();
  });
}

/* ---- j-timeline.js ---- */
/* ================= TIMELINE (multi-trek, ramah sentuh, playhead di tengah ala CapCut) ================= */
const TL = { pps: 60, snap: true, prog: false, drag: null, headW: 62, padL: 300 };
function buildTimeline() {
  $('#vs-tl').innerHTML = `<div class="vs-tlrs" id="vs-tlrs" title="Tarik untuk mengubah ukuran pratinjau / timeline (ketuk 2x: otomatis)"><i></i></div>
  <div class="vs-tlbar">
    <button data-a="split" title="Potong di playhead (S)">${ico('split')}<span>Potong</span></button>
    <button data-a="delete" title="Hapus (Delete)">${ico('del')}<span class="vs-hide-n">Hapus</span></button>
    <button data-a="dup" class="vs-hide-n" title="Duplikat (Ctrl+D)">${ico('dup')}<span>Duplikat</span></button>
    <button data-a="freeze" class="vs-hide-n" title="Bekukan bingkai">${ico('freeze')}<span>Bekukan</span></button>
    <button data-a="detach" class="vs-hide-n" title="Pisahkan audio">${ico('detach')}<span>Pisah audio</span></button>
    <button data-a="kfAll" title="Keyframe di playhead (K)">${ico('key')}<span class="vs-hide-n">Keyframe</span></button>
    <span class="sep vs-hide-n"></span>
    <button data-a="speedTab" class="vs-hide-n">${ico('speed')}<span>Kecepatan</span></button>
    <button data-a="closeGap" class="vs-hide-n" title="Rapatkan celah di trek klip terpilih">${ico('magnet')}<span>Rapatkan</span></button>
    <div class="sp"></div>
    <button class="vs-ib on" data-a="snap" id="vs-snapbtn" title="Magnet / snapping">${ico('magnet')}</button>
    <button class="vs-ib" data-a="zout" title="Perkecil (-)">${ico('zout')}</button>
    <button class="vs-ib" data-a="zin" title="Perbesar (+)">${ico('zin')}</button>
    <button data-a="zfit" class="vs-hide-n" title="Muat semua">Muat</button>
  </div>
  <div class="vs-tlview" id="vs-tlview"><div class="vs-sc" id="vs-sc"><div class="vs-ruler" id="vs-ruler"><canvas id="vs-rcv"></canvas></div><div class="vs-rows" id="vs-rows"></div>
  <div class="vs-addtr"><button data-a="addVTrack">${ico('plus')} Trek video</button><button data-a="addATrack">${ico('plus')} Trek audio</button></div></div>
  <div class="vs-ph" id="vs-ph"></div><div class="vs-snapl" id="vs-snapl" hidden></div></div>`;
  bindTimeline();
}
function tlGeom() { const sc = $('#vs-sc'); const head = $('.vs-th'); TL.headW = head ? head.offsetWidth : (NARROW() ? 46 : 62); TL.padL = Math.max(40, (sc.clientWidth - TL.headW) / 2); return sc; }
const t2x = t => TL.padL + t * TL.pps;
function renderTimeline() {
  if (!P || MODE === 'color') return;
  const sc = tlGeom(), rows = $('#vs-rows'); if (!rows) return;
  const dur = Math.max(projDur(), 10) + 30, laneW = Math.ceil(TL.padL * 2 + dur * TL.pps);
  $('#vs-ruler').style.width = (TL.headW + laneW) + 'px';
  let html = '';
  for (const tr of P.tracks) {
    const isA = tr.kind === 'audio', hgt = isA ? 46 : (P.clips.some(c => c.track === tr.id && c.kind === 'video') ? 62 : 48);
    const empty = !P.clips.some(c => c.track === tr.id);
    html += `<div class="vs-trk" data-tr="${tr.id}" style="height:${hgt}px"><div class="vs-th"><span>${esc(tr.name)}</span><div>
      ${isA ? `<button data-tm="${tr.id}" class="${tr.mute ? 'on' : ''}" title="Bisukan trek">${ico(tr.mute ? 'mute' : 'vol')}</button>` : `<button data-th="${tr.id}" class="${tr.hide ? 'on' : ''}" title="Sembunyikan trek">${ico(tr.hide ? 'eyeoff' : 'eye')}</button>`}
      <button data-tl="${tr.id}" class="${tr.lock ? 'on' : ''}" title="Kunci trek">${ico(tr.lock ? 'lock' : 'unlock')}</button>${empty && P.tracks.filter(x => x.kind === tr.kind).length > 1 ? `<button data-tdel="${tr.id}" title="Hapus trek kosong">${ico('x')}</button>` : ''}</div></div>
      <div class="vs-lane" style="width:${laneW}px">`;
    for (const c of clipsOn(tr.id)) html += clipHTML(c);
    html += '</div></div>';
  }
  rows.innerHTML = html;
  /* filmstrip & gelombang */
  rows.querySelectorAll('.vs-clip').forEach(el => decorateClip(el));
  drawRuler(); placePlayhead(true); phHeight();
  if (NARROW()) fitStage();
}
/* garis playhead hanya sepanjang trek (tidak menembus area kosong / tombol tambah trek) */
function phHeight() {
  const sc = $('#vs-sc'), rows = $('#vs-rows'), ph = $('#vs-ph'), sn = $('#vs-snapl'); if (!sc || !rows || !ph) return;
  const h = Math.max(24, Math.min(sc.clientHeight, 24 + rows.offsetHeight - sc.scrollTop));
  ph.style.bottom = 'auto'; ph.style.height = h + 'px'; if (sn) { sn.style.bottom = 'auto'; sn.style.height = Math.max(0, h - 24) + 'px'; }
}
function clipHTML(c) {
  const x = t2x(c.start), w = Math.max(4, clipDur(c) * TL.pps), sel = c.id === SEL;
  let bd = '';
  if (isTimed(c) && c.freeze == null && (c.speed !== 1 || c.ramp)) bd += `<span class="bd">${c.ramp ? 'Kurva' : String(Math.round(c.speed * 100) / 100).replace('.', ',') + 'x'}</span>`;
  if (c.freeze != null) bd += '<span class="bd">Beku</span>';
  if (c.g && (c.g.lut || JSON.stringify(c.g) !== JSON.stringify(Object.assign(defG(), { nodes: c.g.nodes.length ? c.g.nodes : [] })))) bd += '<span class="bd">Warna</span>';
  if (c.au && c.au.mute && c.kind === 'video') bd += `<span class="bd">${ico('mute')}</span>`;
  const label = c.kind === 'text' ? (c.tx.t || 'Teks') : c.name || '';
  const kfs = kfTimes(c).map(t => `<i class="kfm" style="left:${t * TL.pps}px"></i>`).join('');
  const trx = (c.kind !== 'audio' && c.kind !== 'fx' && prevOnTrack(c)) ? `<button class="vs-trx${c.tr ? ' has' : ''}" data-trx="${c.id}" style="left:${x}px" title="Transisi">${ico('tr')}</button>` : '';
  return `${trx}<div class="vs-clip k-${c.kind}${sel ? ' sel' : ''}" data-c="${c.id}" style="left:${x}px;width:${w}px"><div class="fs"></div><div class="lb">${bd}${esc(label)}</div>${kfs}<div class="hd l" data-hd="l"></div><div class="hd r" data-hd="r"></div></div>`;
}
function decorateClip(el) {
  const c = clipById(el.dataset.c); if (!c) return; const w = el.offsetWidth;
  if ((c.kind === 'video' || c.kind === 'image') && c.media) {
    const m = mediaById(c.media); const fs = el.querySelector('.fs'); if (!m || !THUMBS[m.id] || !THUMBS[m.id].length) return;
    const th = 62 * (m.w / m.h) || 80, n = Math.min(80, Math.ceil(w / th)); let s = '';
    for (let i = 0; i < n; i++) { const tt = c.kind === 'image' ? 0 : srcTime(c, (i + 0.5) * th / TL.pps); const u = thumbAt(m.id, tt); if (u) s += `<img src="${u}" alt="" style="width:${th}px">`; }
    fs.innerHTML = s;
  }
  if ((c.kind === 'audio' || (c.kind === 'video' && !c.au.mute)) && c.media && PEAKS[c.media]) {
    const pk = PEAKS[c.media], cv = document.createElement('canvas'); cv.className = 'wv'; const W = Math.min(4000, Math.max(2, Math.round(w))), H = 40; cv.width = W; cv.height = H;
    if (c.kind === 'video') cv.style.height = '40%';
    const x = cv.getContext('2d'); x.fillStyle = c.kind === 'audio' ? 'rgba(180,255,230,.75)' : 'rgba(150,220,255,.6)';
    const D = clipDur(c), g = c.au.mute ? 0.2 : Math.min(2, dbToLin(c.au.vol || 0));
    for (let i = 0; i < W; i++) { const st = srcTime(c, i / W * D), j = Math.floor(st * 50); const v = Math.min(1, (pk[j] || 0) * g); const hh = Math.max(1, v * H); x.fillRect(i, (H - hh) / 2, 1, hh); }
    el.appendChild(cv);
  }
}
function drawRuler() {
  const sc = $('#vs-sc'), cv = $('#vs-rcv'); if (!cv) return;
  const vw = sc.clientWidth, dpr = Math.min(2, devicePixelRatio || 1); cv.width = Math.round(vw * dpr); cv.height = Math.round(24 * dpr); cv.style.width = vw + 'px'; cv.style.left = sc.scrollLeft + 'px';
  const x = cv.getContext('2d'); x.scale(dpr, dpr); x.clearRect(0, 0, vw, 24); x.fillStyle = '#8c949e'; x.strokeStyle = '#4a515a'; x.font = '10px system-ui'; x.lineWidth = 1;
  const steps = [1 / P.fps, 0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600]; let st = steps.find(s => s * TL.pps >= 70) || 600;
  const t0 = Math.max(0, (sc.scrollLeft - TL.padL) / TL.pps - st), t1 = (sc.scrollLeft + vw) / TL.pps;
  for (let t = Math.floor(t0 / st) * st; t <= t1; t += st) {
    const px = TL.headW + TL.padL + t * TL.pps - sc.scrollLeft; if (px < TL.headW - 2) continue;
    x.beginPath(); x.moveTo(px + 0.5, 14); x.lineTo(px + 0.5, 24); x.stroke();
    x.fillText(st < 1 ? fmtTime(t, P.fps) : fmtTime(t), px + 3, 11);
    for (let k = 1; k < 4; k++) { const sx = px + k * st * TL.pps / 4; x.beginPath(); x.moveTo(sx + 0.5, 19); x.lineTo(sx + 0.5, 24); x.stroke(); }
  }
  x.fillStyle = '#16181c'; x.fillRect(0, 0, TL.headW, 24);
}
function placePlayhead(force) {
  const sc = $('#vs-sc'); if (!sc) return; const ph = $('#vs-ph'); ph.style.left = (TL.headW + TL.padL) + 'px';
  const want = PH * TL.pps;
  if (force || Math.abs(sc.scrollLeft - want) > 0.5) { TL.prog = true; sc.scrollLeft = want; TL.lastSet = sc.scrollLeft; requestAnimationFrame(() => { TL.prog = false; }); }
}
function zoomTL(f, abs) { TL.pps = clamp(abs ? f : TL.pps * f, 2, 1200); renderTimeline(); }
function zoomFit() { const sc = tlGeom(); const d = Math.max(1, projDur()); zoomTL(Math.max(2, (sc.clientWidth - TL.headW - 40) / d), true); }
/* ---------- interaksi ---------- */
function bindTimeline() {
  const sc = $('#vs-sc');
  sc.addEventListener('scroll', () => {
    drawRuler(); phHeight();
    if (TL.prog || TL.drag || (TL.lastSet != null && Math.abs(sc.scrollLeft - TL.lastSet) < 1.5)) return;
    TL.lastSet = null;
    const t = clamp(sc.scrollLeft / TL.pps, 0, Math.max(0, projDur()));
    if (PB.on) pause();
    PH = t; BUS.emit('time', t); requestRender();
  }, { passive: true });
  sc.addEventListener('wheel', e => {
    if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoomTL(e.deltaY < 0 ? 1.15 : 1 / 1.15); }
    else if (!e.shiftKey && Math.abs(e.deltaY) > Math.abs(e.deltaX) && sc.scrollHeight <= sc.clientHeight + 4) { e.preventDefault(); sc.scrollLeft += e.deltaY; }
  }, { passive: false });
  /* cubit untuk zoom (2 jari) */
  let pinch = null;
  sc.addEventListener('touchstart', e => { if (e.touches.length === 2) { const d = Math.abs(e.touches[0].clientX - e.touches[1].clientX); pinch = { d, pps: TL.pps }; } }, { passive: true });
  sc.addEventListener('touchmove', e => { if (pinch && e.touches.length === 2) { e.preventDefault(); const d = Math.abs(e.touches[0].clientX - e.touches[1].clientX); TL.pps = clamp(pinch.pps * Math.max(10, d) / Math.max(10, pinch.d), 2, 1200); renderTimeline(); } else if (TL.drag && TL.drag.on) e.preventDefault(); }, { passive: false });
  sc.addEventListener('touchend', e => { if (e.touches.length < 2) pinch = null; });
  /* penggaris: geser waktu */
  const ruler = $('#vs-ruler');
  const rulerSeek = e => { const r = sc.getBoundingClientRect(); const xx = e.clientX - r.left + sc.scrollLeft - TL.headW - TL.padL; seek(xx / TL.pps); placePlayhead(true); };
  ruler.addEventListener('pointerdown', e => { if (PB.on) pause(); ruler.setPointerCapture(e.pointerId); rulerSeek(e); const mv = ev => rulerSeek(ev); const up = () => { ruler.removeEventListener('pointermove', mv); ruler.removeEventListener('pointerup', up); }; ruler.addEventListener('pointermove', mv); ruler.addEventListener('pointerup', up); });
  /* klip */
  sc.addEventListener('pointerdown', e => {
    if (e.target.closest('.vs-ruler') || e.target.closest('.vs-th') || e.target.closest('.vs-addtr')) return;
    const trx = e.target.closest('[data-trx]'); if (trx) { SEL = trx.dataset.trx; INSPTAB = 'anim'; renderAll(); openInsp(); return; }
    const el = e.target.closest('.vs-clip'), hd = e.target.closest('[data-hd]');
    const touch = e.pointerType !== 'mouse';
    if (!el) { TL.drag = { kind: 'tap', x: e.clientX, y: e.clientY, id: e.pointerId }; return; }
    const c = clipById(el.dataset.c); if (!c) return;
    const tr = trackById(c.track); if (tr && tr.lock) { if (SEL !== c.id) { SEL = c.id; renderAll(); } return; }
    if (hd && c.id === SEL) { e.preventDefault(); startDrag(e, c, el, hd.dataset.hd === 'l' ? 'trimL' : 'trimR'); return; }
    if (touch) {
      /* HP/tablet: geser biasa = gulir timeline; tekan-tahan sebentar = angkat klip lalu pindahkan */
      const d = { kind: 'tap', x: e.clientX, y: e.clientY, id: e.pointerId, clip: c.id };
      d.lp = setTimeout(() => { if (TL.drag === d) liftClip(d, c); }, 280);
      TL.drag = d; return;
    }
    if (SEL !== c.id) { SEL = c.id; renderAll(); }
    startDrag(e, c, sc.querySelector('.vs-clip[data-c="' + c.id + '"]') || el, 'move');
  });
  sc.addEventListener('contextmenu', e => { if (e.target.closest('.vs-clip')) e.preventDefault(); });
  sc.addEventListener('pointermove', e => {
    const d = TL.drag; if (!d || d.id !== e.pointerId) return;
    if (d.kind === 'tap') { if (d.lp && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 9) { clearTimeout(d.lp); d.lp = 0; } return; }
    dragMove(e);
  });
  const end = e => {
    const d = TL.drag; if (!d || d.id !== e.pointerId) return; TL.drag = null; if (d.lp) clearTimeout(d.lp); stopAuto(); $('#vs-snapl').hidden = true; tip(null);
    if (d.kind === 'tap') {
      if (e.type === 'pointerup' && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8) { if (d.clip) { SEL = d.clip; if (NARROW()) INSPTAB = inspTabsFor(clipById(d.clip))[0]; } else SEL = null; renderAll(); }
      return;
    }
    if (d.on) dragEnd(d); else if (d.kind === 'move' && e.type === 'pointerup') { /* klik saja */ }
  };
  sc.addEventListener('pointerup', end); sc.addEventListener('pointercancel', end);
  sc.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; let tr;
    if (b.dataset.th && (tr = trackById(b.dataset.th))) { tr.hide = !tr.hide; commit('Sembunyikan trek'); renderTimeline(); requestRender(); }
    if (b.dataset.tm && (tr = trackById(b.dataset.tm))) { tr.mute = !tr.mute; commit('Bisukan trek'); renderTimeline(); }
    if (b.dataset.tl && (tr = trackById(b.dataset.tl))) { tr.lock = !tr.lock; commit('Kunci trek'); renderTimeline(); }
    if (b.dataset.tdel) { P.tracks = P.tracks.filter(t => t.id !== b.dataset.tdel); commit('Hapus trek'); renderTimeline(); }
  });
  /* tarik media dari pustaka ke timeline (desktop) */
  sc.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('text/vs-media') || e.dataTransfer.types.includes('Files')) { e.preventDefault(); const row = e.target.closest('.vs-trk'); $$('.vs-trk.drop').forEach(r => r !== row && r.classList.remove('drop')); if (row) row.classList.add('drop'); } });
  sc.addEventListener('dragleave', e => { if (!sc.contains(e.relatedTarget)) $$('.vs-trk.drop').forEach(r => r.classList.remove('drop')); });
  sc.addEventListener('drop', async e => {
    e.preventDefault(); $$('.vs-trk.drop').forEach(r => r.classList.remove('drop'));
    const r = sc.getBoundingClientRect(), t = Math.max(0, (e.clientX - r.left + sc.scrollLeft - TL.headW - TL.padL) / TL.pps);
    const id = e.dataTransfer.getData('text/vs-media');
    if (id) { const m = mediaById(id); if (m && !m.offline) { addMediaToTimeline(m, t); renderAll(); requestRender(); } return; }
    if (e.dataTransfer.files && e.dataTransfer.files.length) { const ms = await importFiles(e.dataTransfer.files); let tt = t; for (const m of ms) { const c = addMediaToTimeline(m, tt); tt = clipEnd(c); } renderAll(); requestRender(); }
  });
  /* ubah tinggi timeline */
  const rs = $('#vs-tlrs'); let rsTap = 0;
  rs.addEventListener('pointerdown', e => {
    e.preventDefault(); rs.setPointerCapture(e.pointerId); rs.classList.add('on'); const y0 = e.clientY, h0 = $('#vs-tl').offsetHeight, s0 = $('#vs-stage').offsetHeight, nar = NARROW();
    if (nar && Date.now() - rsTap < 320) { SH_USER = null; try { localStorage.removeItem('vs-sh'); } catch (er) {} layoutCanvas(); toast('Ukuran pratinjau otomatis'); }
    rsTap = Date.now();
    const mv = ev => {
      if (nar) { SH_USER = clamp(s0 + (ev.clientY - y0), 170, A.clientHeight * 0.75); try { localStorage.setItem('vs-sh', Math.round(SH_USER)); } catch (er) {} layoutCanvas(); }
      else { $('#vs-tl').style.height = clamp(h0 - (ev.clientY - y0), 150, A.clientHeight * 0.7) + 'px'; layoutCanvas(); }
    }; const up = () => { rs.classList.remove('on'); rs.removeEventListener('pointermove', mv); rs.removeEventListener('pointerup', up); renderTimeline(); }; rs.addEventListener('pointermove', mv); rs.addEventListener('pointerup', up); rs.addEventListener('pointercancel', up); });
}
function startDrag(e, c, el, kind) {
  TL.drag = { kind, id: e.pointerId, x0: e.clientX, y0: e.clientY, c, el, on: false, orig: deep(c), track0: c.track, sl0: $('#vs-sc').scrollLeft, touch: e.pointerType !== 'mouse', lx: e.clientX, ly: e.clientY };
  try { el.setPointerCapture(e.pointerId); } catch (er) {}
}
function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
/* angkat klip setelah tekan-tahan (sentuh) */
function liftClip(t, c) {
  const sc = $('#vs-sc'), el = sc.querySelector('.vs-clip[data-c="' + c.id + '"]'); if (!el) return;
  if (SEL !== c.id) { SEL = c.id; sc.querySelectorAll('.vs-clip.sel').forEach(x => x.classList.remove('sel')); el.classList.add('sel'); renderInspector(); renderMNav(); OVK = ''; requestRender(); }
  startDrag({ clientX: t.x, clientY: t.y, pointerId: t.id, pointerType: 'touch' }, c, el, 'move');
  const d = TL.drag; d.on = true; d.lifted = true; el.classList.add('drag'); if (PB.on) pause(); buzz(15);
  tip(fmtTime(c.start, P.fps), t.x, t.y);
}
/* label waktu kecil di atas jari saat menggeser / memangkas */
function tip(txt, x, y) {
  let el = $('#vs-dtip'); if (!txt) { if (el) el.hidden = true; return; }
  if (!el) { el = document.createElement('div'); el.id = 'vs-dtip'; el.className = 'vs-dtip'; $('#vs-tlview').appendChild(el); }
  const r = $('#vs-tlview').getBoundingClientRect(); el.hidden = false; el.textContent = txt;
  el.style.left = clamp(x - r.left, 40, r.width - 40) + 'px'; el.style.top = Math.max(2, y - r.top - 54) + 'px';
}
/* gulir otomatis saat klip dibawa ke tepi timeline */
let AUTO = 0;
function stopAuto() { if (AUTO) cancelAnimationFrame(AUTO); AUTO = 0; }
function autoScroll() {
  const d = TL.drag; if (!d || !d.on || d.kind === 'tap') { AUTO = 0; return; }
  const sc = $('#vs-sc'), r = sc.getBoundingClientRect(), L = r.left + TL.headW + 34, R = r.right - 34;
  let v = 0; if (d.lx < L) v = -Math.min(18, (L - d.lx) / 2.5 + 2); else if (d.lx > R) v = Math.min(18, (d.lx - R) / 2.5 + 2);
  if (v) {
    const before = sc.scrollLeft; sc.scrollLeft = Math.max(0, before + v);
    if (sc.scrollLeft !== before) { TL.lastSet = sc.scrollLeft; PH = clamp(sc.scrollLeft / TL.pps, 0, Math.max(0, projDur() + 30)); updTime(); dragMove({ clientX: d.lx, clientY: d.ly, pointerType: d.touch ? 'touch' : 'mouse', preventDefault() {}, synthetic: true }); }
    AUTO = requestAnimationFrame(autoScroll);
  } else AUTO = 0;
}
function snapT(t, ignoreId) {
  if (!TL.snap) return { t, s: null };
  const thr = 9 / TL.pps; let best = null, bd = thr;
  const cand = [PH, 0]; P.clips.forEach(x => { if (x.id !== ignoreId) { cand.push(x.start, clipEnd(x)); } });
  for (const v of cand) { const d = Math.abs(v - t); if (d < bd) { bd = d; best = v; } }
  return best != null ? { t: best, s: best } : { t, s: null };
}
function showSnap(s) { const l = $('#vs-snapl'); if (s == null) { l.hidden = true; return; } const sc = $('#vs-sc'); l.hidden = false; l.style.left = (TL.headW + TL.padL + s * TL.pps - sc.scrollLeft) + 'px'; }
function dragMove(e) {
  const d = TL.drag, c = d.c, o = d.orig, sc = $('#vs-sc'); const dy = e.clientY - d.y0;
  if (!e.synthetic) { d.lx = e.clientX; d.ly = e.clientY; }
  const dx = d.lx - d.x0 + (sc.scrollLeft - d.sl0);
  if (!d.on) { if (Math.hypot(e.clientX - d.x0, dy) < (e.pointerType === 'mouse' ? 4 : 8)) return; d.on = true; d.el.classList.add('drag'); if (PB.on) pause(); if (d.touch) buzz(10); }
  e.preventDefault();
  if (!AUTO) AUTO = requestAnimationFrame(autoScroll);
  const dt = dx / TL.pps, fd = 1 / P.fps;
  if (d.kind === 'move') {
    let s = Math.max(0, o.start + dt); const D = clipDur(c);
    const a = snapT(s, c.id), b = snapT(s + D, c.id);
    let sn = null; if (a.s != null && (b.s == null || Math.abs(a.t - s) <= Math.abs(b.t - s - D))) { s = a.t; sn = a.s; } else if (b.s != null) { s = b.t - D; sn = b.s; }
    showSnap(sn); if (sn != null && sn !== d.lastSnap && d.touch) buzz(6); d.lastSnap = sn;
    c.start = Math.max(0, s); tip(fmtTime(c.start, P.fps), d.lx, d.ly);
    /* pindah trek hanya bila jari/kursor jelas digeser naik/turun (klip tidak loncat trek tanpa sengaja) */
    if (Math.abs(dy) > (d.touch ? 26 : 12)) d.vfree = true;
    const under = d.vfree ? document.elementFromPoint(d.lx, d.ly) : null, row = under && under.closest && under.closest('.vs-trk');
    if (row) { const tr = trackById(row.dataset.tr), want = c.kind === 'audio' ? 'audio' : 'video'; if (tr && tr.kind === want && !tr.lock && tr.id !== c.track) { c.track = tr.id; const lane = row.querySelector('.vs-lane'); lane.appendChild(d.el); } }
    d.el.style.left = t2x(c.start) + 'px';
  } else if (d.kind === 'trimL') {
    const endT = clipEnd(o); let s = o.start + dt; const sn = snapT(s, c.id); s = sn.t; showSnap(sn.s);
    if (isTimed(c) && c.freeze == null) {
      const k = (c.speed || 1) * (c.ramp ? rampTable(c.ramp)[512] : 1); let ni = o.in + (s - o.start) * k;
      ni = clamp(ni, 0, o.out - fd * k); c.in = ni; c.start = endT - clipDur(c);
    } else { s = clamp(s, 0, endT - fd); c.start = s; c.dur = endT - s; }
    if (c.start < 0) { c.start = 0; }
    for (const k in (o.kf || {})) c.kf[k] = o.kf[k].map(x => [x[0] - (c.start - o.start), x[1], x[2]]);
    d.el.style.left = t2x(c.start) + 'px'; d.el.style.width = Math.max(4, clipDur(c) * TL.pps) + 'px'; tip(fmtTime(c.start, P.fps) + ' \u00b7 ' + fmtTime(clipDur(c), P.fps), d.lx, d.ly);
  } else if (d.kind === 'trimR') {
    let e2 = clipEnd(o) + dt; const sn = snapT(e2, c.id); e2 = sn.t; showSnap(sn.s);
    if (isTimed(c) && c.freeze == null) {
      const m = mediaById(c.media), k = (c.speed || 1) * (c.ramp ? rampTable(c.ramp)[512] : 1);
      c.out = clamp(o.out + (e2 - clipEnd(o)) * k, o.in + fd * k, m ? m.dur : o.out);
    } else c.dur = Math.max(fd, e2 - o.start);
    d.el.style.width = Math.max(4, clipDur(c) * TL.pps) + 'px'; tip(fmtTime(clipDur(c), P.fps), d.lx, d.ly);
  }
  requestRender(); BUS.emit('clipdrag', c);
}
function dragEnd(d) {
  const c = d.c; d.el.classList.remove('drag');
  if (c.start === d.orig.start && c.track === d.orig.track && clipDur(c) === clipDur(d.orig)) { renderAll(); return; }
  if (d.kind === 'move') {
    if (overlaps(c.track, c.start, clipEnd(c), c.id)) {
      const tr = freeTrack(c.kind === 'audio' ? 'audio' : 'video', c.start, clipEnd(c), null, c.id);
      c.track = tr.id; toast('Klip dipindah ke trek lain agar tidak menumpuk');
    }
    if (c.tr && !prevOnTrack(c)) c.tr = null;
  } else { if (overlaps(c.track, c.start, clipEnd(c), c.id)) { Object.assign(c, deep(d.orig)); toast('Tidak bisa menumpuk klip lain di trek yang sama', true); } }
  if (d.kind === 'move') pruneTracks();
  commit(d.kind === 'move' ? 'Pindah klip' : 'Pangkas klip'); renderAll(); requestRender();
}
/* ---------- aksi klip ---------- */
function actSplit() {
  const c = selClip(); let list = c && PH > c.start && PH < clipEnd(c) ? [c] : P.clips.filter(x => PH > x.start + 1e-3 && PH < clipEnd(x) - 1e-3 && !(trackById(x.track) || {}).lock);
  if (c && !(PH > c.start && PH < clipEnd(c))) list = list.filter(x => x.track === c.track);
  let n = 0; list.forEach(x => { if (splitClip(x, PH)) n++; });
  if (n) { commit('Potong'); renderAll(); requestRender(); } else toast('Letakkan playhead di tengah klip untuk memotong');
}
function actDelete() {
  const c = selClip(); if (!c) return;
  P.clips = P.clips.filter(x => x.id !== c.id); P.clips.forEach(x => { if (x.tr && !prevOnTrack(x)) x.tr = null; });
  SEL = null; dropEl(c.id); TXT_CACHE.delete(c.id); dropTex('txt:' + c.id); pruneTracks(); OVK = ''; commit('Hapus klip'); renderAll(); requestRender();
}
function pruneTracks() {
  /* buang trek kosong sisa klip yang dihapus/dipindah (minimal tetap 1 trek video & 1 trek audio) */
  ['video', 'audio'].forEach(kind => {
    let list = P.tracks.filter(t => t.kind === kind);
    for (const t of list) { if (P.tracks.filter(x => x.kind === kind).length <= 1) break; if (!P.clips.some(c => c.track === t.id)) P.tracks = P.tracks.filter(x => x.id !== t.id); }
  });
}
function actDup() {
  const c = selClip(); if (!c) return; const b = deep(c); b.id = uid(); b.start = clipEnd(c); b.tr = null;
  if (overlaps(b.track, b.start, clipEnd(b))) b.track = freeTrack(c.kind === 'audio' ? 'audio' : 'video', b.start, clipEnd(b), c.track).id;
  P.clips.push(b); SEL = b.id; commit('Duplikat'); renderAll(); requestRender();
}
function actFreeze() {
  const c = selClip(); if (!c || c.kind !== 'video') { toast('Pilih klip video untuk membekukan bingkai', true); return; }
  if (!(PH > c.start && PH < clipEnd(c))) { toast('Letakkan playhead di dalam klip', true); return; }
  const st = srcTime(c, PH - c.start), b = splitClip(c, PH); const hold = 2;
  const f = deep(c); f.id = uid(); f.freeze = st; f.dur = hold; f.start = PH; f.ramp = null; f.kf = {}; f.tr = null; f.au.mute = 1; f.name = 'Beku ' + fmtTime(st);
  if (b) { P.clips.forEach(x => { if (x.track === c.track && x.start >= PH - 1e-4 && x.id !== f.id) x.start += hold; }); }
  P.clips.push(f); SEL = f.id; commit('Bekukan bingkai'); renderAll(); requestRender();
}
function actDetach() {
  const c = selClip(); if (!c || c.kind !== 'video') { toast('Pilih klip video', true); return; }
  const m = mediaById(c.media); if (!m || !m.hasAudio) { toast('Video ini tidak punya suara', true); return; }
  if (c.au.mute) { toast('Audio klip ini sudah dibisukan/dipisah'); return; }
  const a = makeClip('audio', { media: c.media, in: c.in, out: c.out, start: c.start, speed: c.speed, ramp: deep(c.ramp), name: 'Audio ' + (c.name || '') });
  a.au = deep(c.au); a.kf = {}; for (const k in (c.kf || {})) if (/^au\./.test(k)) a.kf[k] = deep(c.kf[k]);
  a.track = freeTrack('audio', a.start, clipEnd(a), null).id; c.au.mute = 1; P.clips.push(a); commit('Pisahkan audio'); renderAll(); requestRender(); toast('Audio dipisah ke trek audio');
}
function actKfAll() {
  const c = selClip(); if (!c || !c.p) { toast('Pilih klip video/foto/teks', true); return; }
  if (!(PH >= c.start && PH <= clipEnd(c))) { toast('Letakkan playhead di dalam klip', true); return; }
  const lt = lt0(c); c.kf = c.kf || {};
  ['p.x', 'p.y', 'p.scale', 'p.rot', 'p.opacity'].forEach(p => { if (kfIndex(c, p, lt) < 0) { const v = valAt(c, p, lt); if (!c.kf[p]) { c.kf[p] = []; setPath(c, p, v); } c.kf[p].push([lt, v, 1]); c.kf[p].sort((a, b) => a[0] - b[0]); } });
  commit('Keyframe'); renderAll(); toast('Keyframe ditambahkan. Pindah playhead lalu geser/ubah ukuran klip di layar.');
}
function actCloseGap() {
  const c = selClip(); const tid = c ? c.track : (P.tracks.find(t => t.kind === 'video') || {}).id; if (!tid) return;
  let t = 0; clipsOn(tid).forEach(x => { x.start = t; t = clipEnd(x); });
  commit('Rapatkan celah'); renderAll(); requestRender();
}

/* ---- l-color.js ---- */
/* ================= HALAMAN WARNA (gaya DaVinci Resolve) ================= */
let CTAB = 'wheels', CNODE = -1, CCURVE = 'y', SCOPE = 'wave', GRADE_CLIP = null;
const LOOKS = {
  teal: { n: 'Teal & Orange', g: { con: 1.12, sat: 1.1, lift: [-0.02, 0.01, 0.04, 0], gain: [0.06, 0.01, -0.06, 0], hvs: null, temp: 4 } },
  warm: { n: 'Film Hangat', g: { temp: 18, tint: 4, con: 1.06, sat: 0.95, lift: [0.02, 0.01, 0, 0.02], gam: [0, 0, 0, 0.05] } },
  moody: { n: 'Dingin Moody', g: { temp: -14, con: 1.18, sat: 0.78, exp: -0.15, lift: [0, 0.01, 0.03, 0.02], sh: -15 } },
  bleach: { n: 'Bleach Bypass', g: { con: 1.35, sat: 0.45, hl: -10, gain: [0, 0, 0, 0.05] } },
  kodak: { n: 'Kodak Vintage', g: { temp: 12, tint: 6, con: 0.92, sat: 0.85, lift: [0.04, 0.03, 0.02, 0.03], gain: [0.02, 0, -0.04, -0.03], bk: 12 } },
  bw: { n: 'Hitam Putih Kontras', g: { sat: 0, con: 1.3, piv: 0.45 } },
  drone: { n: 'Drone Vivid', g: { sat: 1.25, vib: 30, con: 1.1, hl: -25, sh: 15, temp: 3 } },
  night: { n: 'Malam Sinematik', g: { temp: -22, tint: -4, exp: -0.2, con: 1.12, sat: 0.85, lift: [-0.01, 0.01, 0.04, 0], gain: [0.03, 0.01, -0.02, 0] } },
  pastel: { n: 'Pastel Lembut', g: { con: 0.82, sat: 0.8, bk: 18, hl: -15, lift: [0.02, 0.02, 0.03, 0.04], temp: 5 } },
  pop: { n: 'Natural Pop', g: { con: 1.08, vib: 35, sat: 1.05, sh: 10, hl: -10 } },
  wedding: { n: 'Wedding Lembut', g: { temp: 8, tint: 3, exp: 0.1, con: 0.94, sat: 0.92, hl: -20, sh: 12, lift: [0.01, 0.01, 0, 0.02] } },
  matrix: { n: 'Hijau Matrix', g: { tint: -18, con: 1.15, sat: 0.8, gain: [-0.05, 0.05, -0.04, 0] } }
};
let GRADE_CB = null;
function gradeClips() { return P.clips.filter(c => c.g).sort((a, b) => a.start - b.start || (a.track > b.track ? 1 : -1)); }
function stripHTML() {
  return gradeClips().map((x, i) => { const m = mediaById(x.media); const th = m && THUMBS[m.id] && THUMBS[m.id].length ? thumbAt(m.id, x.kind === 'image' ? 0 : srcTime(x, clipDur(x) / 2)) : ''; return `<button data-gc="${x.id}" class="${x.id === SEL ? 'on' : ''}" style="${th ? 'background-image:url(' + th + ')' : ''}"><i>${String(i + 1).padStart(2, '0')}</i><span>${esc(x.name || '')}</span></button>`; }).join('');
}
function renderColorStrip() { const s = $('#vs-colorp .vs-strip'); if (s && MODE === 'color') s.innerHTML = stripHTML() || '<span class="vs-note" style="padding:12px">Belum ada klip video/foto.</span>'; }
function renderColor() {
  const C = $('#vs-colorp'); if (!C || MODE !== 'color') return;
  const c = selClip(), list = gradeClips();
  const strip = stripHTML();
  let pane = '';
  if (!c || !c.g) pane = `<div class="vs-empty">${ico('color')}Tambahkan video atau foto, lalu pilih klip di atas untuk mulai color grading.</div>`;
  else {
    const g = c.g, S = d => sliderHTML(d);
    if (CTAB === 'wheels') pane = wheelsHTML('prim', g) + `<div class="vs-note" style="text-align:center">Geser titik putih di roda (tidak meloncat, bisa dari mana saja di dalam roda) untuk menggeser warna. Geser strip <b>Master</b> ke kiri/kanan untuk gelap-terang. Ketuk dua kali roda/strip untuk reset. Tahan Shift untuk gerakan halus.</div>`;
    if (CTAB === 'hdr') pane = wheelsHTML('hdr', g) + `<div class="vs-note" style="text-align:center">HDR Color Wheels bekerja per zona cahaya seperti DaVinci Resolve: <b>Dark</b> (paling gelap), <b>Shadow</b>, <b>Light</b>, <b>Highlight</b> (paling terang), dan <b>Global</b> (seluruh gambar). Tiap zona punya roda warna, eksposur (dalam stop) dan saturasi.</div>`;
    if (CTAB === 'adj') pane = `<div class="vs-cols"><div>${S({ path: 'g.exp', label: 'Eksposur (stop)', min: -4, max: 4, step: 0.01, dec: 2 })}${S({ path: 'g.temp', label: 'Suhu warna', min: -100, max: 100, step: 0.5 })}${S({ path: 'g.tint', label: 'Tint', min: -100, max: 100, step: 0.5 })}${S({ path: 'g.con', label: 'Kontras', min: 0, max: 2, step: 0.005, dec: 3 })}${S({ path: 'g.piv', label: 'Pivot', min: 0.1, max: 0.9, step: 0.005, dec: 3 })}${S({ path: 'g.sat', label: 'Saturasi', min: 0, max: 2.5, step: 0.005, dec: 3 })}</div>
      <div>${S({ path: 'g.vib', label: 'Color Boost', min: -100, max: 100, step: 0.5 })}${S({ path: 'g.hue', label: 'Rotasi hue \u00b0', min: -180, max: 180, step: 0.5 })}${S({ path: 'g.hl', label: 'Highlight', min: -100, max: 100, step: 0.5 })}${S({ path: 'g.sh', label: 'Shadow', min: -100, max: 100, step: 0.5 })}${S({ path: 'g.wh', label: 'Putih', min: -100, max: 100, step: 0.5 })}${S({ path: 'g.bk', label: 'Hitam', min: -100, max: 100, step: 0.5 })}</div></div>
      <div class="vs-row"><button data-a="autoColor">${ico('drop')} Koreksi otomatis (eksposur & white balance)</button></div>`;
    if (CTAB === 'curves') pane = `<div class="vs-chips">${[['y', 'Luma Y'], ['r', 'Merah'], ['g', 'Hijau'], ['b', 'Biru'], ['hvh', 'Hue vs Hue'], ['hvs', 'Hue vs Sat'], ['lvs', 'Lum vs Sat']].map(([k, n]) => `<button data-cvk="${k}" class="${CCURVE === k ? 'on' : ''}">${n}</button>`).join('')}<button data-a="cvReset">${ico('reset')} Reset kurva</button></div>
      <div class="vs-curve"><canvas id="vs-cvcv" width="520" height="520"></canvas><div class="vs-note" style="max-width:280px">Klik untuk menambah titik, tarik untuk mengubah, klik dua kali titik untuk menghapus.<br><br><b>Hue vs Hue</b>: ubah warna tertentu (mis. hijau daun jadi lebih kuning).<br><b>Hue vs Sat</b>: atur saturasi per warna.<br><b>Lum vs Sat</b>: kurangi saturasi di bayangan / highlight.</div></div>`;
    if (CTAB === 'nodes') {
      const N = g.nodes || [];
      pane = `<div class="vs-nodes"><button data-node="-1" class="${CNODE < 0 ? 'on' : ''}">${ico('node')} Primer</button>${N.map((n, i) => `<button data-node="${i}" class="${CNODE === i ? 'on' : ''}">${n.on ? '' : '\u2715 '}Node ${i + 1}</button>`).join('')}${N.length < 4 ? `<button data-a="addNode">${ico('plus')} Node sekunder</button>` : ''}</div>`;
      if (CNODE < 0 || !N[CNODE]) pane += `<div class="vs-note">Node <b>Primer</b> berisi roda warna, penyesuaian & kurva. Tambahkan <b>node sekunder</b> untuk mengoreksi area tertentu saja: pakai <b>Window</b> (lingkaran, kotak, gradasi) dan/atau <b>Qualifier</b> (pilih warna/kecerahan dengan klik di layar) seperti di DaVinci Resolve. Maksimal 4 node.</div>`;
      else {
        const n = N[CNODE], P0 = 'g.nodes.' + CNODE + '.';
        pane += `<div class="vs-cols"><div><div class="vs-sec"><h4>Window (area)<span class="sp"></span><label class="vs-sw" style="margin:0">Aktif<input type="checkbox" data-nck="on"${n.on ? ' checked' : ''}></label></h4>
        <div class="vs-chips">${[['none', 'Tanpa'], ['circle', 'Lingkaran'], ['rect', 'Kotak'], ['linear', 'Gradasi']].map(([k, nm]) => `<button data-nwin="${k}" class="${n.win === k ? 'on' : ''}">${nm}</button>`).join('')}<button data-nck2="winv" class="${n.winv ? 'on' : ''}">Balik</button></div>
        ${n.win !== 'none' ? S({ path: P0 + 'cx', label: 'Pusat X', min: -0.5, max: 1.5, step: 0.001, mul: 100 }) + S({ path: P0 + 'cy', label: 'Pusat Y', min: -0.5, max: 1.5, step: 0.001, mul: 100 }) + S({ path: P0 + 'ww', label: 'Lebar', min: 0.01, max: 1.5, step: 0.001, mul: 100 }) + S({ path: P0 + 'wh', label: 'Tinggi', min: 0.01, max: 1.5, step: 0.001, mul: 100 }) + S({ path: P0 + 'wr', label: 'Rotasi \u00b0', min: -180, max: 180, step: 0.5 }) + S({ path: P0 + 'ws', label: 'Kehalusan', min: 0.001, max: 1, step: 0.001, mul: 100 }) : ''}
        ${n.win !== 'none' ? `<div class="vs-row"><button data-a="trackBack">\u25c0 Lacak mundur</button><button class="vs-go" data-a="trackFwd">Lacak maju \u25b6</button><button data-a="trackClear">Hapus</button></div>` : ''}
        <div class="vs-note">Tarik window langsung di layar pratinjau. Tekan <b>Lacak maju</b> agar window otomatis mengikuti objek yang bergerak (seperti Tracker di DaVinci).</div></div>
        <div class="vs-sec"><h4>Qualifier (HSL)<span class="sp"></span><label class="vs-sw" style="margin:0">Aktif<input type="checkbox" data-nck="ql"${n.ql ? ' checked' : ''}></label></h4>
        <div class="vs-row"><button data-a="pickQual">${ico('pick')} Pilih warna di layar</button><button data-a="showMask" class="${PB.showMask ? 'on' : ''}">Lihat mask</button><button data-nck2="qinv" class="${n.qinv ? 'on' : ''}">Balik</button></div>
        ${['qh:Hue pusat:0:1', 'qhw:Lebar hue:0:0.5', 'qs0:Sat min:0:1', 'qs1:Sat maks:0:1', 'ql0:Luma min:0:1', 'ql1:Luma maks:0:1', 'qsoft:Kehalusan:0.001:0.5', 'qblur:Haluskan mask (anti bintik):0:1', 'qclean:Bersihkan hitam/putih:0:1'].map(s => { const [k, lb, mn, mx] = s.split(':'); return S({ path: P0 + k, label: lb, min: +mn, max: +mx, step: 0.001, mul: 100, noKf: 1 }); }).join('')}</div></div>
        <div><div class="vs-sec"><h4>Koreksi di area ini</h4>${S({ path: P0 + 'exp', label: 'Eksposur', min: -3, max: 3, step: 0.01, dec: 2 })}${S({ path: P0 + 'con', label: 'Kontras', min: 0, max: 2, step: 0.005, dec: 3 })}${S({ path: P0 + 'sat', label: 'Saturasi', min: 0, max: 2.5, step: 0.005, dec: 3 })}${S({ path: P0 + 'hue', label: 'Rotasi hue \u00b0', min: -180, max: 180, step: 0.5 })}${S({ path: P0 + 'temp', label: 'Suhu warna', min: -100, max: 100, step: 0.5 })}${S({ path: P0 + 'tint', label: 'Tint', min: -100, max: 100, step: 0.5 })}
        <div class="vs-row"><button data-a="delNode">${ico('del')} Hapus node</button></div></div></div></div>`;
      }
    }
    if (CTAB === 'lut') {
      const ids = Object.keys(LUTS);
      pane = `<div class="vs-row"><button class="vs-go" data-a="importLut">${ico('lut')} Impor LUT (.cube)</button><button data-a="dvExact">Tiru grade DaVinci (still)</button>${g.lut ? `<button data-a="noLut">${ico('x')} Lepas LUT</button>` : ''}</div>
      ${g.lut ? sliderHTML({ path: 'g.lutMix', label: 'Kekuatan LUT', min: 0, max: 1, step: 0.005, mul: 100 }) : ''}
      <div class="vs-chips">${ids.map(id => `<button data-lut="${id}" class="${g.lut === id ? 'on' : ''}">${esc(LUTS[id].name)} <small style="opacity:.6">${LUTS[id].n}\u00b3</small></button>`).join('') || '<span class="vs-note">Belum ada LUT. Impor LUT milik Anda (format .cube 3D, mis. dari DaVinci, Premiere, kamera Sony S-Log, Canon C-Log, DJI D-Log, atau paket LUT sinematik).</span>'}</div>
      <div class="vs-note">LUT diterapkan setelah koreksi primer, sebelum node sekunder. LUT tersimpan di perangkat dan bisa dipakai di semua proyek.</div>`;
    }
    if (CTAB === 'looks') pane = `<div class="vs-sec"><h4>Look siap pakai</h4><div class="vs-chips">${Object.keys(LOOKS).map(k => `<button data-look="${k}">${LOOKS[k].n}</button>`).join('')}</div></div>
      <div class="vs-sec"><h4>Dari DaVinci Resolve</h4>
      <div class="vs-row"><button class="vs-go" data-a="dvExact" style="flex:1">${ico('lut')} Tiru grade dari still DaVinci (.dpx / .drx)</button></div>
      <div class="vs-note"><b>Cara pakai:</b> di DaVinci, klik kanan viewer &rarr; <i>Grab Still</i> &rarr; <i>Export</i> (.dpx + .drx). Di sini letakkan playhead di <b>bingkai yang sama</b>, lalu pilih file still itu. Video Studio membandingkan piksel demi piksel dan membangun <b>LUT 3D 33 titik</b> yang meniru grade DaVinci (kurva, kontras, warna kulit, split-tone), bukan sekadar menebak warna.</div>
      <div class="vs-row"><button data-a="dvApprox" style="flex:1">Cocokkan warna dari gambar lain (perkiraan)</button></div>
      <div class="vs-note">Untuk gambar referensi yang <b>bukan</b> bingkai yang sama (foto inspirasi, still adegan lain): hanya menyesuaikan lift, gamma, gain & saturasi. Paling akurat 100%: di DaVinci klik kanan klip &rarr; <i>Generate LUT &rarr; 65 Point Cube</i>, lalu impor di tab LUT.</div></div>
      <div class="vs-sec"><h4>Salin & tempel grade</h4><div class="vs-row"><button data-a="copyGrade">${ico('copy')} Salin grade</button><button data-a="pasteGrade"${GRADE_CB ? '' : ' disabled'}>${ico('paste')} Tempel</button><button data-a="pasteAll"${GRADE_CB ? '' : ' disabled'}>Tempel ke semua klip</button><button data-a="resetGrade">${ico('reset')} Reset grade</button></div>
      <label class="vs-sw">Grade aktif (bypass)<input type="checkbox" id="vs-gon"${g.on ? ' checked' : ''}></label></div>`;
  }
  C.innerHTML = `<div class="vs-strip">${strip || '<span class="vs-note" style="padding:12px">Belum ada klip video/foto.</span>'}</div>
  <div class="vs-cbody"><div class="vs-ctabs">${[['wheels', 'Primaries'], ['hdr', 'HDR Wheels'], ['adj', 'Penyesuaian'], ['curves', 'Kurva'], ['nodes', 'Node & Mask'], ['lut', 'LUT'], ['looks', 'Look & Salin']].map(([k, n]) => `<button data-ct="${k}" class="${CTAB === k ? 'on' : ''}">${n}</button>`).join('')}</div><div class="vs-cpane">${pane}</div></div>`;
  syncSliders(C, c); C.querySelectorAll('input[type=range]').forEach(fillRange); applySections(C);
  if (c && c.g) { if (CTAB === 'wheels' || CTAB === 'hdr') requestAnimationFrame(drawWheelsAll); if (CTAB === 'curves') drawCurve(); }
}
/* ---------- sisi kanan: scope ---------- */
function renderColorSide() {
  $('#vs-insptabs').innerHTML = ''; $('#vs-inspttl').textContent = 'Scope';
  $('#vs-inspbody').innerHTML = `<div class="vs-scopes"><div class="vs-chips">${[['wave', 'Waveform'], ['parade', 'Parade RGB'], ['vector', 'Vectorscope'], ['hist', 'Histogram']].map(([k, n]) => `<button data-scope="${k}" class="${SCOPE === k ? 'on' : ''}">${n}</button>`).join('')}</div><canvas id="vs-scope" width="512" height="300"></canvas></div>
  <div class="vs-sec" style="margin-top:12px"><h4>Bandingkan</h4><div class="vs-ctl vs-sl" id="vs-splitrow"><label>Sebelum | Sesudah</label><input type="range" min="0" max="1" step="0.005" id="vs-splitv" value="${PB.split}"><span></span><span></span></div>
  <div class="vs-note">Geser ke kanan untuk melihat gambar asli di sisi kiri.</div></div>
  <div class="vs-note">Pipeline warna memakai presisi float 16-bit per kanal (lebih dari 1 miliar warna) dan dither saat ekspor agar gradasi langit & kulit tetap mulus tanpa banding.</div>`;
  $$('#vs-inspbody input[type=range]').forEach(fillRange);
  drawScopes();
}
function drawScopes() {
  const sc = $('#vs-scope'); if (!sc || !GLR.ok) return;
  const gl = GLR.gl, W = GLR.cv.width, H = GLR.cv.height; if (!W || !H) return;
  const px = new Uint8Array(W * H * 4); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const x = sc.getContext('2d'), SW = sc.width, SH = sc.height, img = x.createImageData(SW, SH), D = img.data;
  for (let i = 0; i < D.length; i += 4) { D[i] = 6; D[i + 1] = 6; D[i + 2] = 8; D[i + 3] = 255; }
  const step = Math.max(1, Math.round(Math.sqrt(W * H / 90000)));
  const samples = Math.ceil(W / step) * Math.ceil(H / step), boost = clamp(Math.round(SW * SH * 3 / samples), 1, 8);
  const add = (X, Y, r, g, b) => { r *= boost; g *= boost; b *= boost; if (X < 0 || Y < 0 || X >= SW || Y >= SH) return; const k = (Y * SW + X) * 4; D[k] = Math.min(255, D[k] + r); D[k + 1] = Math.min(255, D[k + 1] + g); D[k + 2] = Math.min(255, D[k + 2] + b); };
  if (SCOPE === 'wave' || SCOPE === 'parade') {
    for (let y = 0; y < H; y += step) for (let xx = 0; xx < W; xx += step) {
      const k = (y * W + xx) * 4, r = px[k], g = px[k + 1], b = px[k + 2];
      if (SCOPE === 'wave') { const l = 0.2126 * r + 0.7152 * g + 0.0722 * b; add(Math.floor(xx / W * SW), SH - 1 - Math.floor(l / 255 * (SH - 1)), 18, 30, 18); }
      else { const X = Math.floor(xx / W * SW / 3); add(X, SH - 1 - Math.floor(r / 255 * (SH - 1)), 40, 6, 6); add(X + Math.floor(SW / 3), SH - 1 - Math.floor(g / 255 * (SH - 1)), 6, 40, 6); add(X + Math.floor(SW * 2 / 3), SH - 1 - Math.floor(b / 255 * (SH - 1)), 8, 12, 48); }
    }
  } else if (SCOPE === 'vector') {
    const cx = SW / 2, cy = SH / 2, R = SH * 0.46;
    for (let y = 0; y < H; y += step) for (let xx = 0; xx < W; xx += step) {
      const k = (y * W + xx) * 4, r = px[k] / 255, g = px[k + 1] / 255, b = px[k + 2] / 255, Y = .2126 * r + .7152 * g + .0722 * b;
      const cb = (b - Y) / 1.8556, cr = (r - Y) / 1.5748; add(Math.round(cx + cb * R * 2), Math.round(cy - cr * R * 2), 20 + px[k] / 12, 20 + px[k + 1] / 12, 20 + px[k + 2] / 12);
    }
  } else {
    const hr = new Float32Array(256), hg = new Float32Array(256), hb = new Float32Array(256); let mx = 1;
    for (let y = 0; y < H; y += step) for (let xx = 0; xx < W; xx += step) { const k = (y * W + xx) * 4; hr[px[k]]++; hg[px[k + 1]]++; hb[px[k + 2]]++; }
    for (let i = 1; i < 255; i++) mx = Math.max(mx, hr[i], hg[i], hb[i]);
    for (let i = 0; i < 256; i++) { const X = Math.floor(i / 256 * SW); [[hr, 0], [hg, 1], [hb, 2]].forEach(([hh, ch]) => { const v = Math.min(SH, Math.round(hh[i] / mx * SH)); for (let y = SH - v; y < SH; y++) for (let dx = 0; dx < 2; dx++) { const kk = (y * SW + X + dx) * 4; D[kk + ch] = Math.min(255, D[kk + ch] + 110); } }); }
  }
  x.putImageData(img, 0, 0);
  x.strokeStyle = 'rgba(255,255,255,.18)'; x.fillStyle = 'rgba(255,255,255,.4)'; x.font = '11px system-ui'; x.lineWidth = 1;
  if (SCOPE === 'vector') { const cx = SW / 2, cy = SH / 2, R = SH * 0.46; x.beginPath(); x.arc(cx, cy, R, 0, 7); x.stroke(); x.beginPath(); x.arc(cx, cy, R * 0.75 * 0.5, 0, 7); x.stroke(); x.strokeStyle = 'rgba(255,170,120,.6)'; x.beginPath(); x.moveTo(cx, cy); const a = -123 * Math.PI / 180; x.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); x.stroke(); x.fillText('Garis kulit', cx + Math.cos(a) * R * 0.6 - 30, cy + Math.sin(a) * R * 0.6 - 4); }
  else if (SCOPE !== 'hist') { [0, 25, 50, 75, 100].forEach(p => { const y = SH - 1 - p / 100 * (SH - 1); x.beginPath(); x.moveTo(0, y + 0.5); x.lineTo(SW, y + 0.5); x.stroke(); x.fillText(p, 3, y - 2); }); }
}
/* ---------- roda warna ---------- */
const wheelDir = (r, g, b) => { const xx = r - (g + b) / 2, yy = (g - b) * Math.sqrt(3) / 2; return [xx, yy]; };
const dirRGB = (xx, yy) => { const r = xx / 1.5, d = 2 * yy / Math.sqrt(3); return [r, (-r + d) / 2, (-r - d) / 2]; };
function bindColor() {
  const C = $('#vs-colorp');
  bindControls(C, (path, live) => { if (!live) renderTimeline(); requestRender(); });
  bindWheels(C);
  C.addEventListener('change', e => {
    const c = selClip(); if (!c) return;
    if (e.target.id === 'vs-gon') { c.g.on = e.target.checked ? 1 : 0; commit('Bypass grade'); requestRender(); return; }
    if (e.target.dataset.nck) { c.g.nodes[CNODE][e.target.dataset.nck] = e.target.checked ? 1 : 0; commit('Node'); renderColor(); requestRender(); }
  });
  C.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; const c = selClip();
    if (b.dataset.gc) { SEL = b.dataset.gc; const x = clipById(SEL); if (x && !(PH >= x.start && PH < clipEnd(x))) seek(x.start + Math.min(0.5, clipDur(x) / 2)); CNODE = -1; renderColor(); requestRender(); return; }
    if (b.dataset.ct) { CTAB = b.dataset.ct; PB.showMask = 0; renderColor(); requestRender(); return; }
    if (!c || !c.g) return;
    if (b.dataset.wr) { c.g[b.dataset.wr] = [0, 0, 0, 0]; commit('Reset roda'); renderColor(); requestRender(); return; }
    if (b.dataset.cvk) { CCURVE = b.dataset.cvk; renderColor(); return; }
    if (b.dataset.node != null) { CNODE = +b.dataset.node; PB.showMask = 0; renderColor(); requestRender(); return; }
    if (b.dataset.nwin) { c.g.nodes[CNODE].win = b.dataset.nwin; commit('Window'); renderColor(); requestRender(); return; }
    if (b.dataset.nck2) { const n = c.g.nodes[CNODE]; n[b.dataset.nck2] = n[b.dataset.nck2] ? 0 : 1; commit('Balik'); renderColor(); requestRender(); return; }
    if (b.dataset.lut) { c.g.lut = b.dataset.lut; if (c.g.lutMix == null) c.g.lutMix = 1; commit('Pasang LUT'); renderColor(); requestRender(); return; }
    if (b.dataset.look) { const L = LOOKS[b.dataset.look].g; const keep = { nodes: c.g.nodes, lut: c.g.lut, lutMix: c.g.lutMix }; c.g = Object.assign(defG(), deep(L), keep); ['lift', 'gam', 'gain', 'off'].forEach(k => { if (!c.g[k] || c.g[k].length !== 4) c.g[k] = [0, 0, 0, 0]; }); commit('Look ' + LOOKS[b.dataset.look].n); renderColor(); requestRender(); return; }
  });
  /* kurva */
  let CD = null;
  const cpos = (cv, e) => { const r = cv.getBoundingClientRect(); return [clamp((e.clientX - r.left) / r.width, 0, 1), clamp(1 - (e.clientY - r.top) / r.height, 0, 1)]; };
  const ptsOf = c => { const g = c.g; if (/^(y|r|g|b)$/.test(CCURVE)) return g.cv[CCURVE] || (g.cv[CCURVE] = [[0, 0], [1, 1]]); return g[CCURVE] || (g[CCURVE] = []); };
  C.addEventListener('pointerdown', e => {
    const cv = e.target.closest('#vs-cvcv'); if (!cv) return; const c = selClip(); if (!c) return; e.preventDefault(); cv.setPointerCapture(e.pointerId);
    const [u, v] = cpos(cv, e), pts = ptsOf(c); let i = pts.findIndex(p => Math.hypot(p[0] - u, p[1] - v) < 0.04);
    if (i < 0) { pts.push([u, v]); pts.sort((a, b) => a[0] - b[0]); i = pts.findIndex(p => p[0] === u && p[1] === v); }
    CD = { cv, c, i, pts }; drawCurve(); requestRender();
  });
  C.addEventListener('pointermove', e => {
    if (!CD) return; const [u, v] = cpos(CD.cv, e), p = CD.pts, i = CD.i, ends = /^(y|r|g|b)$/.test(CCURVE) && (i === 0 || i === p.length - 1);
    p[i][1] = v; if (!ends) p[i][0] = clamp(u, i > 0 ? p[i - 1][0] + 0.005 : 0, i < p.length - 1 ? p[i + 1][0] - 0.005 : 1);
    drawCurve(); requestRender();
  });
  const cup = () => { if (CD) { CD = null; commit('Kurva'); } };
  C.addEventListener('pointerup', cup); C.addEventListener('pointercancel', cup);
  C.addEventListener('dblclick', e => {
    const cv = e.target.closest('#vs-cvcv'); if (!cv) return; const c = selClip(); const [u, v] = cpos(cv, e), pts = ptsOf(c);
    const i = pts.findIndex(p => Math.hypot(p[0] - u, p[1] - v) < 0.05);
    if (i >= 0 && (!/^(y|r|g|b)$/.test(CCURVE) || (i > 0 && i < pts.length - 1))) { pts.splice(i, 1); commit('Hapus titik'); drawCurve(); requestRender(); }
  });
}
function drawCurve() {
  const cv = $('#vs-cvcv'), c = selClip(); if (!cv || !c) return;
  const x = cv.getContext('2d'), W = cv.width, H = cv.height; x.clearRect(0, 0, W, H);
  const hueMode = !/^(y|r|g|b)$/.test(CCURVE);
  if (hueMode && CCURVE !== 'lvs') { for (let i = 0; i < W; i++) { const [r, g, b] = hsvToRgb(i / W, 0.85, 0.9); x.fillStyle = `rgba(${r},${g},${b},.22)`; x.fillRect(i, 0, 1, H); } }
  if (CCURVE === 'lvs') { const gr = x.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, 'rgba(0,0,0,.4)'); gr.addColorStop(1, 'rgba(255,255,255,.18)'); x.fillStyle = gr; x.fillRect(0, 0, W, H); }
  x.strokeStyle = '#2a2e35'; x.lineWidth = 1; for (let i = 1; i < 4; i++) { x.beginPath(); x.moveTo(i * W / 4, 0); x.lineTo(i * W / 4, H); x.moveTo(0, i * H / 4); x.lineTo(W, i * H / 4); x.stroke(); }
  const col = { y: '#ffffff', r: '#ff5a5a', g: '#5aff7a', b: '#5a9bff', hvh: '#ffd400', hvs: '#ffd400', lvs: '#ffd400' }[CCURVE];
  let pts = /^(y|r|g|b)$/.test(CCURVE) ? (c.g.cv[CCURVE] || [[0, 0], [1, 1]]) : (c.g[CCURVE] || []);
  const f = /^(y|r|g|b)$/.test(CCURVE) ? monotone(pts) : (pts.length ? (CCURVE === 'lvs' ? monotone([[0, .5]].concat(pts, [[1, .5]])) : periodic(pts)) : (() => 0.5));
  x.strokeStyle = col; x.lineWidth = 3; x.beginPath(); for (let i = 0; i <= W; i++) { const v = f(i / W); i ? x.lineTo(i, H - v * H) : x.moveTo(0, H - v * H); } x.stroke();
  pts.forEach(p => { x.fillStyle = '#fff'; x.strokeStyle = '#000'; x.lineWidth = 2; x.beginPath(); x.arc(p[0] * W, H - p[1] * H, 9, 0, 7); x.fill(); x.stroke(); });
}
function hsvToRgb(h, s, v) { const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s); const r = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6]; return r.map(x => Math.round(x * 255)); }
function rgbToHsv(r, g, b) { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h /= 6; if (h < 0) h += 1; } return [h, mx ? d / mx : 0, mx]; }
/* ---------- ambil warna dari layar ---------- */
let PICK = null;
function pickAt(cx, cy) {
  const cv = GLR.cv, r = cv.getBoundingClientRect(); const X = Math.floor((cx - r.left) / r.width * cv.width), Y = Math.floor((1 - (cy - r.top) / r.height) * cv.height);
  const gl = GLR.gl, px = new Uint8Array(4 * 9); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.readPixels(clamp(X - 1, 0, cv.width - 3), clamp(Y - 1, 0, cv.height - 3), 3, 3, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let s = [0, 0, 0]; for (let i = 0; i < 9; i++) { s[0] += px[i * 4]; s[1] += px[i * 4 + 1]; s[2] += px[i * 4 + 2]; }
  return s.map(v => v / 9 / 255);
}
async function autoColor() {
  const c = selClip(); if (!c || !c.g) return;
  const W = 256, H = Math.max(16, Math.round(256 * P.h / P.w));
  const r = composeFrame(PH, W, H, previewSrc, { noGrade: true }); outputFrame(r.tex, W, H, {});
  const gl = GLR.gl, px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const L = []; let sr = 0, sg = 0, sb = 0, n = 0;
  for (let i = 0; i < W * H; i++) { const R = px[i * 4] / 255, G = px[i * 4 + 1] / 255, B = px[i * 4 + 2] / 255, l = .2126 * R + .7152 * G + .0722 * B; L.push(l); if (l > 0.15 && l < 0.85) { sr += R; sg += G; sb += B; n++; } }
  L.sort((a, b) => a - b); const lo = L[Math.floor(L.length * 0.01)], hi = L[Math.floor(L.length * 0.99)], md = L[Math.floor(L.length * 0.5)];
  const g = c.g; g.exp = clamp(Math.log2(0.42 / Math.max(0.03, md)) * 0.6, -1.5, 1.5);
  if (n) { const ar = sr / n, ag = sg / n, ab = sb / n; g.temp = clamp((ab - ar) / Math.max(0.05, (ar + ab) / 2) * 60, -40, 40); g.tint = clamp(((ar + ab) / 2 - ag) / Math.max(0.05, ag) * -60, -30, 30); }
  g.bk = clamp(-lo * 120, -30, 0); g.wh = clamp((0.97 - hi) * 80, -20, 30); g.con = 1.04;
  commit('Koreksi otomatis'); renderColor(); requestRender(); toast('Koreksi otomatis diterapkan. Silakan sesuaikan lagi.');
}

/* ---- q-wheels.js ---- */
/* ================= RODA WARNA & JOG (Primaries + HDR) - nyaman disentuh ================= */
/* set roda: k = kunci data, rng = jangkauan warna, jog = [indeks, label, min, max, satuan] */
const WSETS = {
  prim: { src: g => g, list: [
    { k: 'lift', n: 'Lift', rng: 0.2, jogs: [[3, 'Master', -0.5, 0.5]] },
    { k: 'gam', n: 'Gamma', rng: 0.3, jogs: [[3, 'Master', -0.8, 0.8]] },
    { k: 'gain', n: 'Gain', rng: 0.4, jogs: [[3, 'Master', -1, 1]] },
    { k: 'off', n: 'Offset', rng: 0.15, jogs: [[3, 'Master', -0.3, 0.3]] }] },
  hdr: { src: g => ensureHdr(g), list: [
    { k: 'dark', n: 'Dark', rng: 1, jogs: [[3, 'Eksposur', -3, 3, ' st'], [4, 'Saturasi', 0, 2]] },
    { k: 'shadow', n: 'Shadow', rng: 1, jogs: [[3, 'Eksposur', -3, 3, ' st'], [4, 'Saturasi', 0, 2]] },
    { k: 'light', n: 'Light', rng: 1, jogs: [[3, 'Eksposur', -3, 3, ' st'], [4, 'Saturasi', 0, 2]] },
    { k: 'high', n: 'Highlight', rng: 1, jogs: [[3, 'Eksposur', -3, 3, ' st'], [4, 'Saturasi', 0, 2]] },
    { k: 'glob', n: 'Global', rng: 1, jogs: [[3, 'Eksposur', -4, 4, ' st'], [4, 'Saturasi', 0, 2]] }] }
};
const HDR_KEYS = ['dark', 'shadow', 'light', 'high', 'glob'];
function ensureHdr(g) { if (!g.hdr) g.hdr = {}; HDR_KEYS.forEach(k => { if (!g.hdr[k] || g.hdr[k].length !== 5) g.hdr[k] = [0, 0, 0, 0, 1]; }); return g.hdr; }
function hdrActive(g) { if (!g.hdr) return false; return HDR_KEYS.some(k => { const v = g.hdr[k]; return v && (v[0] || v[1] || v[2] || v[3] || v[4] !== 1); }); }
function wheelsHTML(set, g) {
  const S = WSETS[set], data = S.src(g);
  return `<div class="vs-wheels" data-wset="${set}">${S.list.map(w => `<div class="vs-wheel" data-wk="${w.k}">
    <div class="whd"><b>${w.n}</b><button class="rs" data-wreset="${w.k}" title="Reset ${w.n}" aria-label="Reset ${w.n}">${ico('reset')}</button></div>
    <canvas class="wcv" data-wheel="${w.k}" aria-label="Roda ${w.n}"></canvas>
    <div class="vals" data-wv="${w.k}"></div>
    ${w.jogs.map(j => `<div class="vs-jog" data-jog="${w.k}" data-ji="${j[0]}" data-min="${j[2]}" data-max="${j[3]}" data-unit="${j[4] || ''}" title="Geser kiri/kanan. Ketuk dua kali untuk reset."><span>${j[1]}</span><i></i><output></output></div>`).join('')}
  </div>`).join('')}</div>`;
}
/* gambar roda (resolusi layar, tajam di HP) */
const RING = new Map();
function ringImg(px) {
  if (RING.has(px)) return RING.get(px);
  const c = document.createElement('canvas'); c.width = c.height = px; const x = c.getContext('2d'), R = px / 2, im = x.createImageData(px, px);
  for (let j = 0; j < px; j++) for (let i = 0; i < px; i++) {
    const dx = (i + 0.5 - R) / R, dy = -(j + 0.5 - R) / R, d = Math.hypot(dx, dy), o = (j * px + i) * 4;
    if (d > 1) continue;
    const [r, g, b] = dirRGB(dx / (d || 1), dy / (d || 1)); const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const n = [(r - mn) / ((mx - mn) || 1), (g - mn) / ((mx - mn) || 1), (b - mn) / ((mx - mn) || 1)];
    let a;
    if (d > 0.86) { a = 1; for (let k = 0; k < 3; k++) im.data[o + k] = 40 + n[k] * 215; }
    else { const t = Math.pow(d / 0.86, 1.4) * 0.38; for (let k = 0; k < 3; k++) im.data[o + k] = 24 + n[k] * 255 * t; a = 1; }
    if (d > 0.985) a = (1 - d) / 0.015;
    im.data[o + 3] = Math.round(a * 255);
  }
  x.putImageData(im, 0, 0);
  x.strokeStyle = 'rgba(0,0,0,.55)'; x.lineWidth = Math.max(1, px / 200); x.beginPath(); x.arc(R, R, R * 0.86, 0, 7); x.stroke();
  x.strokeStyle = 'rgba(255,255,255,.12)'; x.beginPath(); x.moveTo(R, R * 0.2); x.lineTo(R, R * 1.8); x.moveTo(R * 0.2, R); x.lineTo(R * 1.8, R); x.stroke();
  x.beginPath(); x.arc(R, R, R * 0.43, 0, 7); x.stroke();
  RING.set(px, c); return c;
}
function wheelVals(set, k) { const c = selClip(); if (!c || !c.g) return null; return WSETS[set].src(c.g)[k]; }
function drawWheelsAll() {
  $$('.vs-wheels[data-wset]').forEach(box => {
    const set = box.dataset.wset;
    box.querySelectorAll('.vs-wheel').forEach(el => drawWheel(set, el));
  });
}
function drawWheel(set, el) {
  const k = el.dataset.wk, w = WSETS[set].list.find(x => x.k === k), v = wheelVals(set, k); if (!v) return;
  const cv = el.querySelector('canvas'), css = cv.clientWidth || 140, dpr = Math.min(3, devicePixelRatio || 1), px = Math.round(css * dpr);
  if (cv.width !== px) { cv.width = cv.height = px; }
  const x = cv.getContext('2d'), R = px / 2, Rin = R * 0.86;
  x.clearRect(0, 0, px, px); x.drawImage(ringImg(px), 0, 0);
  const [dx, dy] = wheelDir(v[0], v[1], v[2]); const mx = clamp(dx / w.rng, -1, 1), my = clamp(dy / w.rng, -1, 1), dl = Math.hypot(mx, my) > 1 ? Math.hypot(mx, my) : 1;
  const qx = R + mx / dl * Rin, qy = R - my / dl * Rin, active = el.classList.contains('drag');
  x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 2 * dpr; x.beginPath(); x.moveTo(R, R); x.lineTo(qx, qy); x.stroke();
  x.fillStyle = active ? '#ff3d8b' : '#ffffff'; x.strokeStyle = 'rgba(0,0,0,.8)'; x.lineWidth = 2.5 * dpr;
  x.beginPath(); x.arc(qx, qy, (active ? 11 : 9) * dpr, 0, 7); x.fill(); x.stroke();
  const vv = el.querySelector('.vals'); if (vv) vv.innerHTML = `<span class="r">${fmtNum(v[0], 2)}</span><span class="g">${fmtNum(v[1], 2)}</span><span class="b">${fmtNum(v[2], 2)}</span>`;
  el.querySelectorAll('.vs-jog').forEach(j => syncJog(j, v));
}
function syncJog(j, v) {
  const i = +j.dataset.ji, mn = +j.dataset.min, mx = +j.dataset.max, val = v[i];
  j.querySelector('output').textContent = (val > 0 && i === 3 ? '+' : '') + fmtNum(val, 2) + (j.dataset.unit || '');
  const def = i === 4 ? 1 : 0, f = (val - mn) / (mx - mn), z = (def - mn) / (mx - mn);
  const bar = j.querySelector('i'); bar.style.left = Math.min(f, z) * 100 + '%'; bar.style.width = Math.abs(f - z) * 100 + '%';
  j.classList.toggle('chg', Math.abs(val - def) > 1e-4);
}
function bindWheels(root) {
  let D = null, lastTap = { t: 0, k: '' };
  const fineOf = e => e.shiftKey || e.altKey ? 0.25 : 1;
  root.addEventListener('pointerdown', e => {
    const cv = e.target.closest && e.target.closest('canvas[data-wheel]'), jog = e.target.closest && e.target.closest('.vs-jog');
    if (!cv && !jog) return;
    const c = selClip(); if (!c || !c.g) return;
    const set = (cv || jog).closest('[data-wset]').dataset.wset, el = (cv || jog).closest('.vs-wheel'), k = el.dataset.wk, v = WSETS[set].src(c.g)[k];
    /* ketuk dua kali = reset */
    const now = performance.now(), tk = (cv ? 'w' : 'j' + jog.dataset.ji) + k;
    if (now - lastTap.t < 320 && lastTap.k === tk) { e.preventDefault(); if (cv) { v[0] = v[1] = v[2] = 0; } else { const i = +jog.dataset.ji; v[i] = i === 4 ? 1 : 0; } lastTap.t = 0; drawWheel(set, el); commit('Reset'); requestRender(); return; }
    lastTap = { t: now, k: tk };
    if (cv) { e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (er) {} }
    D = { set, el, k, v, cv, jog, id: e.pointerId, x0: e.clientX, y0: e.clientY, v0: v.slice(), on: !!cv, touch: e.pointerType !== 'mouse', w: (cv || jog).getBoundingClientRect().width };
    if (cv) el.classList.add('drag');
  }, true);
  root.addEventListener('pointermove', e => {
    if (!D || e.pointerId !== D.id) return;
    const dx = e.clientX - D.x0, dy = e.clientY - D.y0;
    if (D.jog && !D.on) {
      if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) { D = null; return; } /* gulir vertikal */
      if (Math.abs(dx) < 5) return;
      D.on = true; D.x0 = e.clientX; try { D.jog.setPointerCapture(e.pointerId); } catch (er) {} D.jog.classList.add('drag'); return;
    }
    e.preventDefault();
    const W = WSETS[D.set].list.find(x => x.k === D.k), f = fineOf(e);
    if (D.cv) {
      const R = D.w / 2 * 0.86, sens = (D.touch ? 0.75 : 1) * f;
      const [ox, oy] = wheelDir(D.v0[0], D.v0[1], D.v0[2]);
      let mx = ox / W.rng + dx / R * sens, my = oy / W.rng - dy / R * sens; const d = Math.hypot(mx, my); if (d > 1) { mx /= d; my /= d; }
      if (Math.hypot(mx, my) < 0.035) { mx = 0; my = 0; } /* magnet ke tengah */
      const [r, g, b] = dirRGB(mx * W.rng, my * W.rng); D.v[0] = r; D.v[1] = g; D.v[2] = b;
    } else {
      const i = +D.jog.dataset.ji, mn = +D.jog.dataset.min, mxv = +D.jog.dataset.max;
      let nv = D.v0[i] + dx / D.w * (mxv - mn) * 0.6 * f; const def = i === 4 ? 1 : 0; if (Math.abs(nv - def) < (mxv - mn) * 0.006) nv = def;
      D.v[i] = clamp(Math.round(nv * 1000) / 1000, mn, mxv);
      D.jog.querySelector('i').parentNode.style.backgroundPosition = (dx * 1.5) + 'px 0';
    }
    drawWheel(D.set, D.el); requestRender();
  }, { passive: false });
  const end = e => {
    if (!D || e.pointerId !== D.id) return; const d = D; D = null;
    d.el.classList.remove('drag'); if (d.jog) d.jog.classList.remove('drag'); drawWheel(d.set, d.el);
    if (d.v.some((x, i) => Math.abs(x - d.v0[i]) > 1e-6)) commit(d.cv ? 'Roda warna' : 'Jog');
  };
  root.addEventListener('pointerup', end); root.addEventListener('pointercancel', end);
  root.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-wreset]'); if (!b) return; const c = selClip(); if (!c || !c.g) return;
    const set = b.closest('[data-wset]').dataset.wset, k = b.dataset.wreset, v = WSETS[set].src(c.g)[k];
    v[0] = v[1] = v[2] = 0; v[3] = 0; if (v.length > 4) v[4] = 1; drawWheelsAll(); commit('Reset ' + k); requestRender();
  });
}

/* ---- r-davinci.js ---- */
/* ================= DAVINCI RESOLVE: still .dpx, grade .drx, cocokkan warna ================= */
function isDPX(f) { return /\.dpx$/i.test(f.name || ''); }
function isDRX(f) { return /\.drx$/i.test(f.name || ''); }
/* dekoder DPX (SMPTE 268M): 8/10/12/16 bit, RGB/RGBA/Luma, big & little endian */
function parseDPX(buf) {
  const dv = new DataView(buf), magic = dv.getUint32(0, false);
  let le; if (magic === 0x53445058) le = false; else if (magic === 0x58504453) le = true; else throw new Error('Bukan file DPX yang valid');
  const u32 = o => dv.getUint32(o, le), u16 = o => dv.getUint16(o, le);
  const W = u32(772), H = u32(776); if (!W || !H || W > 16384 || H > 16384) throw new Error('Ukuran DPX tidak valid');
  const desc = dv.getUint8(800), transfer = dv.getUint8(801), bits = dv.getUint8(803), packing = u16(804), enc = u16(806);
  let off = u32(808); if (!off || off === 0xffffffff) off = u32(4);
  if (enc !== 0) throw new Error('DPX terkompresi (RLE) belum didukung. Ekspor ulang DPX tanpa kompresi.');
  const nc = desc === 50 ? 3 : (desc === 51 || desc === 52) ? 4 : (desc === 6 || desc === 1 || desc === 2 || desc === 3 || desc === 4) ? 1 : 3;
  const max = Math.pow(2, bits) - 1, N = W * H, out = new Float32Array(N * 3);
  const put = (p, comps) => {
    let r, g, b;
    if (nc === 1) r = g = b = comps[0]; else if (desc === 52) { r = comps[3]; g = comps[2]; b = comps[1]; } else { r = comps[0]; g = comps[1]; b = comps[2]; }
    out[p * 3] = r / max; out[p * 3 + 1] = g / max; out[p * 3 + 2] = b / max;
  };
  const comps = new Array(nc);
  if (bits === 8) {
    const rowB = Math.ceil(W * nc / 4) * 4;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const o = off + y * rowB + x * nc; for (let k = 0; k < nc; k++) comps[k] = dv.getUint8(o + k); put(y * W + x, comps); }
  } else if (bits === 16 || (bits === 12 && packing !== 0)) {
    const rowB = Math.ceil(W * nc * 2 / 4) * 4, sh = bits === 12 ? (packing === 1 ? 4 : 0) : 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const o = off + y * rowB + x * nc * 2; for (let k = 0; k < nc; k++) comps[k] = (u16(o + k * 2) >> sh) & max; put(y * W + x, comps); }
  } else if (bits === 10 && packing !== 0) {
    /* 3 komponen per kata 32-bit; metode A (padding di bit rendah) atau B (padding di bit tinggi) */
    const per = W * nc, rowW = Math.ceil(per / 3), sh = packing === 1 ? 2 : 0;
    for (let y = 0; y < H; y++) {
      let ci = 0, word = 0, wi = 0, p = y * W, k = 0;
      for (let i = 0; i < per; i++) {
        if (ci === 0) { word = u32(off + (y * rowW + wi) * 4); wi++; }
        comps[k++] = (word >>> (sh + (2 - ci) * 10)) & 1023;
        ci = (ci + 1) % 3;
        if (k === nc) { put(p++, comps); k = 0; }
      }
    }
  } else if (bits === 10 || bits === 12) {
    /* dikemas rapat (packing 0): aliran bit big-endian per kata */
    let bitpos = 0; const base = off;
    const rd = () => { const wo = base + Math.floor(bitpos / 32) * 4, w = u32(wo), b = bitpos % 32; let v; if (b + bits <= 32) v = (w >>> (32 - b - bits)) & max; else { const w2 = u32(wo + 4), hi = bits - (32 - b); v = ((w & ((1 << (32 - b)) - 1)) << hi) | (w2 >>> (32 - hi)); } bitpos += bits; return v; };
    for (let p = 0; p < N; p++) { for (let k = 0; k < nc; k++) comps[k] = rd(); put(p, comps); }
  } else throw new Error('Kedalaman bit DPX ' + bits + ' belum didukung');
  /* transfer log (Cineon / printing density) -> tampilan */
  if (transfer === 1 || transfer === 3) {
    const blk = Math.pow(10, (95 - 685) * 0.002 / 0.6);
    for (let i = 0; i < out.length; i++) { const cv = out[i] * 1023; const lin = (Math.pow(10, (cv - 685) * 0.002 / 0.6) - blk) / (1 - blk); out[i] = Math.pow(clamp(lin, 0, 1), 1 / 2.2); }
  }
  return { w: W, h: H, data: out, bits, transfer };
}
function dpxToCanvas(d) {
  const k = Math.min(1, 4096 / Math.max(d.w, d.h)), tw = Math.max(1, Math.round(d.w * k)), th = Math.max(1, Math.round(d.h * k));
  const full = document.createElement('canvas'); full.width = d.w; full.height = d.h; const x = full.getContext('2d'), im = x.createImageData(d.w, d.h);
  for (let i = 0, n = d.w * d.h; i < n; i++) { im.data[i * 4] = clamp(d.data[i * 3] * 255 + 0.5, 0, 255); im.data[i * 4 + 1] = clamp(d.data[i * 3 + 1] * 255 + 0.5, 0, 255); im.data[i * 4 + 2] = clamp(d.data[i * 3 + 2] * 255 + 0.5, 0, 255); im.data[i * 4 + 3] = 255; }
  x.putImageData(im, 0, 0);
  if (k === 1) return { canvas: full, w: d.w, h: d.h };
  const c = document.createElement('canvas'); c.width = tw; c.height = th; const y = c.getContext('2d'); y.imageSmoothingQuality = 'high'; y.drawImage(full, 0, 0, tw, th);
  return { canvas: c, w: tw, h: th };
}
async function loadDPXFile(f) { const d = parseDPX(await f.arrayBuffer()); return dpxToCanvas(d); }
/* ---------- statistik warna ---------- */
function statsFromPixels(px, n) {
  const ch = [[], [], []], sat = [];
  const step = Math.max(1, Math.floor(n / 60000));
  for (let i = 0; i < n; i += step) { const r = px[i * 4] / 255, g = px[i * 4 + 1] / 255, b = px[i * 4 + 2] / 255; ch[0].push(r); ch[1].push(g); ch[2].push(b); const l = .2126 * r + .7152 * g + .0722 * b; sat.push(Math.hypot(r - l, g - l, b - l)); }
  const pct = (a, p) => a[Math.min(a.length - 1, Math.max(0, Math.floor(a.length * p)))];
  ch.forEach(a => a.sort((x, y) => x - y));
  const s = sat.reduce((a, b) => a + b, 0) / Math.max(1, sat.length);
  return { lo: ch.map(a => pct(a, 0.02)), md: ch.map(a => pct(a, 0.5)), hi: ch.map(a => pct(a, 0.98)), sat: s };
}
function canvasStats(cv) {
  const k = Math.min(1, 320 / Math.max(cv.width, cv.height)), w = Math.max(1, Math.round(cv.width * k)), h = Math.max(1, Math.round(cv.height * k));
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(cv, 0, 0, w, h);
  return statsFromPixels(x.getImageData(0, 0, w, h).data, w * h);
}
function clipFrameStats() {
  const W = 320, H = Math.max(16, Math.round(320 * P.h / P.w));
  const r = composeFrame(PH, W, H, previewSrc, { noGrade: true }); outputFrame(r.tex, W, H, {});
  const gl = GLR.gl, px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  layoutCanvas(); requestRender();
  return statsFromPixels(px, W * H);
}
/* cocokkan grade klip terpilih ke gambar referensi (still DaVinci) */
function matchGrade(c, ref) {
  const src = clipFrameStats(), g = c.g;
  const lift = [0, 0, 0], gain = [0, 0, 0], gam = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    const lo = src.lo[i], hi = Math.max(src.lo[i] + 0.02, src.hi[i]), LO = ref.lo[i], HI = Math.max(ref.lo[i] + 0.02, ref.hi[i]);
    const s = (HI - LO) / (hi - lo), b0 = LO - s * lo, A = Math.max(0.05, s + b0), L = clamp(b0 / A, -0.4, 0.6);
    lift[i] = L; gain[i] = clamp(A - 1, -0.9, 2);
    const m1 = clamp((L + src.md[i] * (1 - L)) * A, 0.02, 0.98), M = clamp(ref.md[i], 0.02, 0.98);
    const e = Math.log(M) / Math.log(m1); gam[i] = clamp(1 / e - 1, -0.8, 0.8);
  }
  const split = a => { const m = (a[0] + a[1] + a[2]) / 3; return [a[0] - m, a[1] - m, a[2] - m, m]; };
  Object.assign(g, { exp: 0, temp: 0, tint: 0, con: 1, piv: 0.435, hl: 0, sh: 0, wh: 0, bk: 0, vib: 0, hue: 0 });
  g.off = [0, 0, 0, 0]; g.lift = split(lift); g.gain = split(gain); g.gam = split(gam);
  g.sat = clamp(src.sat > 0.005 ? ref.sat / src.sat : 1, 0.2, 2.2);
  g.on = 1;
}
/* ---------- DPX 10-bit penuh: worker dekoder -> half float (RGB16F) ---------- */
const DPX_WORKER = `
function f2h(v){ const f = new Float32Array(1), u = new Uint32Array(f.buffer); f[0] = v; const x = u[0], s = (x >>> 16) & 0x8000; let e = ((x >>> 23) & 0xff) - 112, m = x & 0x7fffff; if (e <= 0) return s; if (e >= 31) return s | 0x7bff; return s | (e << 10) | (m >>> 13); }
const H = new Uint16Array(4096); for (let i = 0; i < 4096; i++) H[i] = f2h(i / 4095);
onmessage = e => {
  const { buf, ctf, step, id } = e.data;
  try {
    const dv = new DataView(buf), mg = dv.getUint32(0, false); let le; if (mg === 0x53445058) le = false; else if (mg === 0x58504453) le = true; else throw new Error('Bukan DPX');
    const u32 = o => dv.getUint32(o, le), u16 = o => dv.getUint16(o, le);
    const W = u32(772), Hh = u32(776), desc = dv.getUint8(800), tr = dv.getUint8(801), bits = dv.getUint8(803), pk = u16(804), enc = u16(806);
    let off = u32(808); if (!off || off === 0xffffffff) off = u32(4);
    if (enc !== 0) throw new Error('DPX terkompresi belum didukung');
    const nc = desc === 50 ? 3 : (desc === 51 || desc === 52) ? 4 : (desc >= 1 && desc <= 6) ? 1 : 3, max = Math.pow(2, bits) - 1;
    const st = Math.max(1, step || 1), w = Math.floor(W / st), h = Math.floor(Hh / st), out = new Uint16Array(w * h * 3);
    const mode = ctf === 'auto' ? ((tr === 1 || tr === 3) ? 'log' : 'video') : ctf;
    const blk = Math.pow(10, (95 - 685) * 0.002 / 0.6);
    const LUT = new Float32Array(max + 1);
    for (let i = 0; i <= max; i++) { let v = i / max; if (mode === 'log') { const lin = (Math.pow(10, (v * 1023 - 685) * 0.002 / 0.6) - blk) / (1 - blk); v = Math.pow(Math.max(0, lin), 1 / 2.2); } else if (mode === 'linear') { v = Math.pow(Math.max(0, v), 1 / 2.2); } LUT[i] = v; }
    const toH = v => { const q = Math.round(Math.min(1, Math.max(0, v)) * 4095); return H[q]; };
    const comps = new Array(nc);
    const get = (x, y) => {
      if (bits === 8) { const rowB = Math.ceil(W * nc / 4) * 4, o = off + y * rowB + x * nc; for (let k = 0; k < nc; k++) comps[k] = dv.getUint8(o + k); }
      else if (bits === 16 || (bits === 12 && pk !== 0)) { const rowB = Math.ceil(W * nc * 2 / 4) * 4, o = off + y * rowB + x * nc * 2, sh = bits === 12 && pk === 1 ? 4 : 0; for (let k = 0; k < nc; k++) comps[k] = (u16(o + k * 2) >> sh) & max; }
      else if (bits === 10 && pk !== 0) { const rowW = Math.ceil(W * nc / 3), sh = pk === 1 ? 2 : 0; for (let k = 0; k < nc; k++) { const ci = x * nc + k, wi = Math.floor(ci / 3), pos = ci % 3, word = u32(off + (y * rowW + wi) * 4); comps[k] = (word >>> (sh + (2 - pos) * 10)) & 1023; } }
      else { let bp = (y * W + x) * nc * bits; for (let k = 0; k < nc; k++) { const wo = off + Math.floor(bp / 32) * 4, ww = u32(wo), b = bp % 32; let v; if (b + bits <= 32) v = (ww >>> (32 - b - bits)) & max; else { const w2 = u32(wo + 4), hi = bits - (32 - b); v = ((ww & ((1 << (32 - b)) - 1)) << hi) | (w2 >>> (32 - hi)); } comps[k] = v; bp += bits; } }
    };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      get(x * st, y * st); let r, g, b;
      if (nc === 1) r = g = b = comps[0]; else if (desc === 52) { r = comps[3]; g = comps[2]; b = comps[1]; } else { r = comps[0]; g = comps[1]; b = comps[2]; }
      const o = (y * w + x) * 3; out[o] = toH(LUT[r]); out[o + 1] = toH(LUT[g]); out[o + 2] = toH(LUT[b]);
    }
    postMessage({ id, w, h, half: out, bits, tr }, [out.buffer]);
  } catch (err) { postMessage({ id, err: String(err.message || err) }); }
};`;
let DPXW = null, DPXQ = new Map(), DPXN = 0;
function dpxDecode(file, ctf, step) {
  if (!DPXW) { DPXW = new Worker(URL.createObjectURL(new Blob([DPX_WORKER], { type: 'text/javascript' }))); DPXW.onmessage = e => { const q = DPXQ.get(e.data.id); if (!q) return; DPXQ.delete(e.data.id); if (e.data.err) q.rej(new Error(e.data.err)); else q.res(e.data); }; }
  return file.arrayBuffer().then(buf => new Promise((res, rej) => { const id = ++DPXN; DPXQ.set(id, { res, rej }); DPXW.postMessage({ buf, ctf: ctf || 'auto', step: step || 1, id }, [buf]); }));
}
let HALF_VER = 0, DV_MODE = 'exact';
class DPXSeqSource {
  constructor(m) { this.m = m; this.cache = new Map(); }
  async frameAt(t) {
    const m = this.m, files = FILES[m.id], n = files.length, i = clamp(Math.floor(t * m.fps + 1e-4), 0, n - 1);
    if (this.cache.has(i)) return this.cache.get(i);
    const r = await dpxDecode(files[i], m.ctf, 1); const f = { half: r.half, w: r.w, h: r.h, ver: ++HALF_VER };
    this.cache.set(i, f); if (this.cache.size > 3) this.cache.delete(this.cache.keys().next().value);
    return f;
  }
  close() { this.cache.clear(); }
}
/* pratinjau sekuens DPX (asinkron, tampilkan bingkai terakhir yang siap) */
const DPXP = new Map();
function dpxPreviewSrc(c, t) {
  const m = mediaById(c.media); if (!m || !FILES[m.id]) return null;
  let s = DPXP.get(c.id); if (!s) { s = { src: new DPXSeqSource(m), want: -1, busy: false, cur: null }; DPXP.set(c.id, s); }
  const st = srcTime(c, clamp(t - c.start, 0, clipDur(c))), i = clamp(Math.floor(st * m.fps + 1e-4), 0, FILES[m.id].length - 1);
  if (s.want !== i && !s.busy) { s.want = i; s.busy = true; s.src.frameAt(st).then(f => { s.cur = f; s.busy = false; requestRender(); }).catch(e => { s.busy = false; console.warn(e); }); }
  else if (s.want !== i && s.busy) setTimeout(requestRender, 30);
  const f = s.cur; if (!f) return null;
  return { img: f, w: m.w, h: m.h, iw: f.w, ih: f.h, key: 'v:' + c.id, live: f.ver };
}
function groupDPX(list) {
  const seq = {}, singles = [];
  list.forEach(f => { const mm = (f.name || '').match(/^(.*?)(\d+)\.dpx$/i); if (!mm) { singles.push(f); return; } const k = mm[1] + '#' + mm[2].length; (seq[k] = seq[k] || []).push({ f, n: +mm[2] }); });
  const out = [];
  Object.keys(seq).forEach(k => { const a = seq[k].sort((x, y) => x.n - y.n); if (a.length < 2) { singles.push(a[0].f); return; } out.push({ name: k.split('#')[0].replace(/[._-]$/, '') || 'DPX', first: a[0].n, last: a[a.length - 1].n, files: a.map(x => x.f) }); });
  return { seqs: out, singles };
}
async function addDPXSequence(g) {
  const id = uid(), r = await dpxDecode(g.files[0], 'auto', 8);
  const head = new DataView(await g.files[0].slice(0, 2048).arrayBuffer()), le = head.getUint32(0, false) !== 0x53445058, W = head.getUint32(772, le), H = head.getUint32(776, le);
  const fps = P.fps || 24, size = g.files.reduce((s, f) => s + f.size, 0);
  const m = { id, name: g.name + ' [' + g.first + '-' + g.last + '].dpx', size, kind: 'video', mime: 'image/x-dpx', w: W, h: H, dur: g.files.length / fps, fps, rot: 0, hasAudio: false, vcodec: 'DPX ' + r.bits + '-bit', acodec: '', demux: 'dpxseq', stored: false, ctf: 'auto', nframes: g.files.length };
  FILES[id] = g.files;
  if (size <= STORE_MAX) { try { await withTimeout(DB.set('media', id, g.files), 60000); m.stored = true; } catch (e) {} }
  const cv = halfPreview({ half: r.half, w: r.w, h: r.h }, Math.max(8, Math.round(72 * W / H)), 72); THUMBS[id] = [{ t: 0, url: cv.toDataURL('image/jpeg', 0.7) }];
  P.media.push(m); return m;
}
async function loadDPXHalf(f) { const r = await dpxDecode(f, 'auto', 1); return { half: r.half, w: r.w, h: r.h, ver: ++HALF_VER, bits: r.bits }; }
/* ---------- tiru grade DaVinci dari still: bangun LUT 3D dari pasangan piksel ---------- */
function sourcePixels(c, W, H) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d', { willReadFrequently: true });
  const s = previewSrc(c, PH); if (!s) throw new Error('Bingkai klip belum siap. Tunggu sebentar lalu coba lagi.');
  if (s.img && s.img.half) x.drawImage(halfPreview(s.img, W, H), 0, 0); else x.drawImage(s.img, 0, 0, W, H);
  return x.getImageData(0, 0, W, H).data;
}
function refPixels(img, W, H) { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d', { willReadFrequently: true }); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, W, H); return x.getImageData(0, 0, W, H).data; }
function fitLutFromPair(A, B, W, H) {
  const N = 33, n3 = N * N * N, sw = new Float32Array(n3), sd = new Float32Array(n3 * 3);
  const lum = (d, i) => d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
  let used = 0;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = (y * W + x) * 4;
    const ga = Math.abs(lum(A, i + 4) - lum(A, i - 4)) + Math.abs(lum(A, i + W * 4) - lum(A, i - W * 4)), gb = Math.abs(lum(B, i + 4) - lum(B, i - 4)) + Math.abs(lum(B, i + W * 4) - lum(B, i - W * 4));
    if (ga > 40 || gb > 40) continue; /* lewati tepi tajam (rawan tidak sejajar) */
    const r = A[i] / 255 * (N - 1), g = A[i + 1] / 255 * (N - 1), b = A[i + 2] / 255 * (N - 1);
    const dr = (B[i] - A[i]) / 255, dg = (B[i + 1] - A[i + 1]) / 255, db = (B[i + 2] - A[i + 2]) / 255;
    const r0 = Math.min(N - 2, Math.floor(r)), g0 = Math.min(N - 2, Math.floor(g)), b0 = Math.min(N - 2, Math.floor(b)), fr = r - r0, fg = g - g0, fb = b - b0;
    for (let k = 0; k < 8; k++) { const ri = r0 + (k & 1), gi = g0 + (k >> 1 & 1), bi = b0 + (k >> 2 & 1), w = ((k & 1) ? fr : 1 - fr) * ((k >> 1 & 1) ? fg : 1 - fg) * ((k >> 2 & 1) ? fb : 1 - fb); const c = (bi * N + gi) * N + ri; sw[c] += w; sd[c * 3] += dr * w; sd[c * 3 + 1] += dg * w; sd[c * 3 + 2] += db * w; }
    used++;
  }
  if (used < 500) throw new Error('Gambar terlalu berbeda atau tidak sejajar. Pastikan playhead di bingkai yang sama dengan still.');
  /* isi sel kosong dengan difusi dari tetangga */
  const off = new Float32Array(n3 * 3), fix = new Float32Array(n3);
  for (let c = 0; c < n3; c++) { const w = sw[c]; if (w > 0.02) { off[c * 3] = sd[c * 3] / w; off[c * 3 + 1] = sd[c * 3 + 1] / w; off[c * 3 + 2] = sd[c * 3 + 2] / w; fix[c] = Math.min(1, w / 2); } }
  const tmp = new Float32Array(n3 * 3);
  for (let it = 0; it < 80; it++) {
    for (let bi = 0; bi < N; bi++) for (let gi = 0; gi < N; gi++) for (let ri = 0; ri < N; ri++) {
      const c = (bi * N + gi) * N + ri; let s0 = 0, s1 = 0, s2 = 0, k = 0;
      const nb = [[ri - 1, gi, bi], [ri + 1, gi, bi], [ri, gi - 1, bi], [ri, gi + 1, bi], [ri, gi, bi - 1], [ri, gi, bi + 1]];
      for (const [a, b2, c2] of nb) { if (a < 0 || b2 < 0 || c2 < 0 || a >= N || b2 >= N || c2 >= N) continue; const q = (c2 * N + b2) * N + a; s0 += off[q * 3]; s1 += off[q * 3 + 1]; s2 += off[q * 3 + 2]; k++; }
      const f = fix[c], m0 = s0 / k, m1 = s1 / k, m2 = s2 / k;
      tmp[c * 3] = f * (sw[c] > 0.02 ? sd[c * 3] / sw[c] : m0) + (1 - f) * m0; tmp[c * 3 + 1] = f * (sw[c] > 0.02 ? sd[c * 3 + 1] / sw[c] : m1) + (1 - f) * m1; tmp[c * 3 + 2] = f * (sw[c] > 0.02 ? sd[c * 3 + 2] / sw[c] : m2) + (1 - f) * m2;
    }
    off.set(tmp);
  }
  const data = new Float32Array(n3 * 3);
  for (let bi = 0; bi < N; bi++) for (let gi = 0; gi < N; gi++) for (let ri = 0; ri < N; ri++) { const c = (bi * N + gi) * N + ri; data[c * 3] = clamp(ri / (N - 1) + off[c * 3], 0, 1); data[c * 3 + 1] = clamp(gi / (N - 1) + off[c * 3 + 1], 0, 1); data[c * 3 + 2] = clamp(bi / (N - 1) + off[c * 3 + 2], 0, 1); }
  /* ukur kecocokan */
  let err = 0, cnt = 0;
  for (let i = 0; i < W * H * 4; i += 16) { const r = A[i] / 255 * (N - 1), g = A[i + 1] / 255 * (N - 1), b = A[i + 2] / 255 * (N - 1); const c = (Math.round(b) * N + Math.round(g)) * N + Math.round(r); err += Math.abs(data[c * 3] * 255 - B[i]) + Math.abs(data[c * 3 + 1] * 255 - B[i + 1]) + Math.abs(data[c * 3 + 2] * 255 - B[i + 2]); cnt += 3; }
  return { n: N, data, err: err / cnt };
}
async function grabRefImage(f) { if (isDPX(f)) { const h = await loadDPXHalf(f); return { img: halfPreview(h, Math.min(h.w, 960), Math.round(Math.min(h.w, 960) * h.h / h.w)), w: h.w, h: h.h }; } const r = await loadImageSrc(f); return { img: r.canvas, w: r.w, h: r.h }; }
/* ---------- impor dari DaVinci ---------- */
async function importDavinci(files, mode) {
  files = Array.from(files || []); if (!files.length) return;
  const c = selClip(); let applied = false;
  const drx = files.filter(isDRX), imgs = files.filter(f => !isDRX(f));
  for (const f of drx) {
    let text = ''; try { text = await f.text(); } catch (e) {}
    const m = text.match(/LUT_3D_SIZE[\s\S]*?(?=<\/|$)/);
    if (m) { try { const L2 = parseCube(m[0], f.name.replace(/\.drx$/i, '')); const id = 'L' + uid(); LUTS[id] = L2; await DB.set('luts', id, L2).catch(() => {}); if (c && c.g) { c.g.lut = id; c.g.lutMix = 1; applied = true; } toast('LUT dari ' + f.name + ' dipasang'); continue; } catch (e) {} }
    if (!imgs.length) drxHelp(f.name);
  }
  for (const f of imgs) {
    if (!c || !c.g) { toast('Pilih klip video/foto dulu', true); break; }
    try {
      setBusy('Membaca ' + f.name + '\u2026');
      const ref = await grabRefImage(f);
      if (mode === 'exact') {
        const W = 480, H = Math.max(16, Math.round(480 * ref.h / ref.w));
        const ar1 = ref.w / ref.h, ar2 = (mediaById(c.media) || P).w / (mediaById(c.media) || P).h;
        if (Math.abs(ar1 / ar2 - 1) > 0.03) toast('Rasio still berbeda dengan klip. Hasil bisa kurang tepat.', true);
        setBusy('Membangun LUT dari still DaVinci\u2026');
        await sleep(30);
        const A = sourcePixels(c, W, H), B = refPixels(ref.img, W, H), r = fitLutFromPair(A, B, W, H);
        const id = 'L' + uid(), L2 = { name: 'DaVinci: ' + f.name.replace(/\.[^.]+$/, ''), n: r.n, data: r.data };
        LUTS[id] = L2; await DB.set('luts', id, L2).catch(() => {});
        const g = c.g; Object.assign(g, { exp: 0, temp: 0, tint: 0, con: 1, piv: 0.435, sat: 1, hue: 0, vib: 0, hl: 0, sh: 0, wh: 0, bk: 0, lift: [0, 0, 0, 0], gam: [0, 0, 0, 0], gain: [0, 0, 0, 0], off: [0, 0, 0, 0], cv: { y: null, r: null, g: null, b: null }, hvh: null, hvs: null, lvs: null, hdr: null, lut: id, lutMix: 1, on: 1 });
        applied = true;
        const pct = Math.max(0, Math.round(100 - r.err / 2.55 * 1.5));
        toast('Grade DaVinci ditiru sebagai LUT (kecocokan \u00b1' + pct + '%). Atur kekuatannya di tab LUT.');
      } else { matchGrade(c, canvasStats(ref.img)); applied = true; toast('Warna klip dicocokkan dengan "' + f.name + '"'); }
    } catch (e) { toast(f.name + ': ' + e.message, true); }
    finally { setBusy(null); }
  }
  if (applied) { commit('Grade dari DaVinci'); renderColor(); requestRender(); }
}
function drxHelp(name) {
  modal('File grade DaVinci (.drx)', `<p style="margin-top:0"><b>${esc(name)}</b> menyimpan susunan node DaVinci Resolve dalam format tertutup milik Blackmagic, jadi isinya tidak bisa dibaca langsung oleh aplikasi selain DaVinci.</p>
  <p><b>Cara memindahkan grade DaVinci ke Video Studio:</b></p>
  <ol style="padding-left:18px;line-height:1.6;margin:0">
  <li><b>Tiru dari still (otomatis):</b> pilih <b>.drx bersama .dpx</b> pasangannya (keduanya dibuat DaVinci saat <i>Export still</i>), letakkan playhead di bingkai yang sama, lalu tekan <i>Tiru grade dari still</i>. Video Studio membangun LUT 3D yang meniru grade DaVinci itu.</li>
  <li><b>Paling akurat:</b> di DaVinci klik kanan klip &rarr; <i>Generate LUT</i> &rarr; <i>65 Point Cube</i>, lalu impor .cube di tab <b>LUT</b>.</li></ol>
  <p class="vs-note">Catatan: window/mask & tracking DaVinci tidak ikut terbawa, hanya transformasi warna keseluruhan.</p>`, '<button data-x>Mengerti</button>');
}

/* ---- s-motion.js ---- */
/* ================= ANALISIS GERAK: stabilizer & tracking window ================= */
const AW = 320; /* lebar analisis (px) */
/* baca bingkai berurutan dalam resolusi kecil -> luma */
async function* analysisFrames(m, t0, t1, W, onProg) {
  const src = makeFrameSource(m), fps = m.fps || 30, n = Math.max(1, Math.round((t1 - t0) * fps));
  const H = Math.max(8, Math.round(W * m.h / m.w)), cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const x = cv.getContext('2d', { willReadFrequently: true });
  try {
    for (let i = 0; i < n; i++) {
      const t = t0 + i / fps; let f = await src.frameAt(Math.min(t, m.dur - 1e-3));
      x.save(); x.clearRect(0, 0, W, H);
      if (f && f.half) { x.drawImage(halfPreview(f, W, H), 0, 0); }
      else {
        const isEl = f instanceof HTMLVideoElement, rot = isEl ? 0 : (m.rot || 0);
        if (rot) { x.translate(W / 2, H / 2); x.rotate(rot * Math.PI / 180); const sw = rot % 180 ? H : W, sh = rot % 180 ? W : H; x.drawImage(f, -sw / 2, -sh / 2, sw, sh); }
        else x.drawImage(f, 0, 0, W, H);
      }
      x.restore();
      const d = x.getImageData(0, 0, W, H).data, L = new Uint8Array(W * H);
      for (let k = 0, j = 0; k < L.length; k++, j += 4) L[k] = (d[j] * 77 + d[j + 1] * 150 + d[j + 2] * 29) >> 8;
      if (onProg && i % 4 === 0) { onProg(i / n); await yieldNow(); }
      yield { i, t, L, W, H };
    }
  } finally { src.close(); }
}
function half2(L, W, H) { const w = W >> 1, h = H >> 1, o = new Uint8Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const a = (y * 2) * W + x * 2; o[y * w + x] = (L[a] + L[a + 1] + L[a + W] + L[a + W + 1]) >> 2; } return { L: o, W: w, H: h }; }
function sad(A, B, W, H, ax, ay, bx, by, bs, best) {
  let s = 0;
  for (let y = 0; y < bs; y++) { const ra = (ay + y) * W + ax, rb = (by + y) * W + bx; for (let x = 0; x < bs; x++) { const d = A[ra + x] - B[rb + x]; s += d < 0 ? -d : d; } if (s >= best) return s; }
  return s;
}
/* cari pergeseran blok (x,y) dari A ke B dengan pencarian kasar-halus + sub-piksel */
function matchBlock(A, B, W, H, px, py, bs, R, A2, B2) {
  let bx = 0, by = 0;
  if (A2) {
    const W2 = A2.W, H2 = A2.H, x2 = px >> 1, y2 = py >> 1, b2 = bs >> 1, R2 = Math.ceil(R / 2); let best = Infinity;
    for (let dy = -R2; dy <= R2; dy++) for (let dx = -R2; dx <= R2; dx++) { const qx = x2 + dx, qy = y2 + dy; if (qx < 0 || qy < 0 || qx + b2 > W2 || qy + b2 > H2) continue; const s = sad(A2.L, B2.L, W2, H2, x2, y2, qx, qy, b2, best); if (s < best) { best = s; bx = dx * 2; by = dy * 2; } }
  }
  let best = Infinity, fx = bx, fy = by; const sc = {};
  const rr = A2 ? 2 : R;
  for (let dy = by - rr; dy <= by + rr; dy++) for (let dx = bx - rr; dx <= bx + rr; dx++) { const qx = px + dx, qy = py + dy; if (qx < 0 || qy < 0 || qx + bs > W || qy + bs > H) continue; const s = sad(A, B, W, H, px, py, qx, qy, bs, Infinity); sc[dx + ',' + dy] = s; if (s < best) { best = s; fx = dx; fy = dy; } }
  if (best === Infinity) return null;
  const g = (a, b, c) => { const d = a - 2 * b + c; return d > 0 ? clamp(0.5 * (a - c) / d, -0.5, 0.5) : 0; };
  const l = sc[(fx - 1) + ',' + fy], r = sc[(fx + 1) + ',' + fy], u = sc[fx + ',' + (fy - 1)], dn = sc[fx + ',' + (fy + 1)];
  const sx = l != null && r != null ? g(l, best, r) : 0, sy = u != null && dn != null ? g(u, best, dn) : 0;
  return { dx: fx + sx, dy: fy + sy, err: best / (bs * bs) };
}
/* gerak global (similaritas: geser, putar, skala) antar bingkai */
function globalMotion(A, B, W, H) {
  const A2 = half2(A, W, H), B2 = half2(B, W, H), bs = 16, R = Math.round(W * 0.06), pts = [];
  const gx = 8, gy = 6, cand = [];
  for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) {
    const px = Math.round((i + 0.5) * W / gx - bs / 2), py = Math.round((j + 0.5) * H / gy - bs / 2); if (px < R || py < R || px + bs + R > W || py + bs + R > H) continue;
    let m = 0, v = 0; for (let y = 0; y < bs; y += 2) for (let x = 0; x < bs; x += 2) { const p = A[(py + y) * W + px + x]; m += p; v += p * p; } const n = (bs / 2) * (bs / 2); m /= n; v = v / n - m * m;
    cand.push({ px, py, v });
  }
  cand.sort((a, b) => b.v - a.v);
  for (const c of cand.slice(0, 28)) { if (c.v < 25) break; const r = matchBlock(A, B, W, H, c.px, c.py, bs, R, A2, B2); if (r && r.err < 40) pts.push({ x: c.px + bs / 2 - W / 2, y: c.py + bs / 2 - H / 2, dx: r.dx, dy: r.dy }); }
  if (pts.length < 3) { if (pts.length) { const mx = pts.reduce((s, p) => s + p.dx, 0) / pts.length, my = pts.reduce((s, p) => s + p.dy, 0) / pts.length; return { dx: mx, dy: my, da: 0, ds: 0, ok: 1 }; } return { dx: 0, dy: 0, da: 0, ds: 0, ok: 0 }; }
  let use = pts, res = null;
  for (let it = 0; it < 3; it++) {
    /* kuadrat terkecil: q = [a -b; b a] p + t */
    let sx = 0, sy = 0, sqx = 0, sqy = 0, n = use.length; use.forEach(p => { sx += p.x; sy += p.y; sqx += p.x + p.dx; sqy += p.y + p.dy; }); const mx = sx / n, my = sy / n, mqx = sqx / n, mqy = sqy / n;
    let num1 = 0, num2 = 0, den = 0; use.forEach(p => { const ax = p.x - mx, ay = p.y - my, bx = p.x + p.dx - mqx, by = p.y + p.dy - mqy; num1 += ax * bx + ay * by; num2 += ax * by - ay * bx; den += ax * ax + ay * ay; });
    const a = den > 1e-6 ? num1 / den : 1, b = den > 1e-6 ? num2 / den : 0, tx = mqx - (a * mx - b * my), ty = mqy - (b * mx + a * my);
    res = { a, b, tx, ty };
    const er = use.map(p => Math.hypot(a * p.x - b * p.y + tx - (p.x + p.dx), b * p.x + a * p.y + ty - (p.y + p.dy)));
    const med = er.slice().sort((x, y) => x - y)[Math.floor(er.length / 2)], lim = Math.max(1, med * 2.5);
    const keep = use.filter((p, k) => er[k] <= lim); if (keep.length === use.length || keep.length < 3) break; use = keep;
  }
  return { dx: res.tx, dy: res.ty, da: Math.atan2(res.b, res.a), ds: Math.log(Math.hypot(res.a, res.b)), ok: 1 };
}
/* ---------- stabilizer ---------- */
async function analyzeStab(c) {
  const m = mediaById(c.media); if (!m || !FILES[m.id]) throw new Error('Media tidak tersedia');
  const t0 = c.in, t1 = c.freeze != null ? c.in + 0.1 : Math.min(m.dur, c.out);
  const X = [0], Y = [0], Aa = [0], S = [0]; let prev = null, W = AW, H = 0;
  setBusy('Menganalisis guncangan kamera\u2026 0%');
  for await (const fr of analysisFrames(m, t0, t1, AW, p => setBusy('Menganalisis guncangan kamera\u2026 ' + Math.round(p * 100) + '%'))) {
    H = fr.H;
    if (prev) { const g = globalMotion(prev, fr.L, fr.W, fr.H); const k = X.length - 1; X.push(X[k] + g.dx); Y.push(Y[k] + g.dy); Aa.push(Aa[k] + g.da); S.push(S[k] + g.ds); }
    prev = fr.L;
  }
  setBusy(null);
  const r4 = v => Math.round(v * 1e4) / 1e4;
  c.stab = { t0, fps: m.fps || 30, n: X.length, w: W, h: H, X: X.map(v => r4(v / W)), Y: Y.map(v => r4(v / H)), A: Aa.map(r4), S: S.map(r4) };
  STAB_CACHE.delete(c.id);
  return c.stab;
}
const STAB_CACHE = new Map();
function stabCorr(c) {
  const s = c.stab, key = [c.p.stabStr, c.p.stabMode, c.p.stabZoom, s.n, s.t0].join('|'), hit = STAB_CACHE.get(c.id);
  if (hit && hit.key === key) return hit;
  const n = s.n, str = clamp(c.p.stabStr / 100, 0, 1), tripod = c.p.stabMode === 'tripod';
  const sm = arr => { if (tripod) { const v = arr[0]; return arr.map(() => v); } const sig = Math.max(1, (0.15 + str * 2) * s.fps * 0.5), R = Math.ceil(sig * 2.5), out = new Array(n), w = []; for (let k = -R; k <= R; k++) w.push(Math.exp(-k * k / (2 * sig * sig))); for (let i = 0; i < n; i++) { let a = 0, ws = 0; for (let k = -R; k <= R; k++) { const j = clamp(i + k, 0, n - 1); a += arr[j] * w[k + R]; ws += w[k + R]; } out[i] = a / ws; } return out; };
  const sx = sm(s.X), sy = sm(s.Y), sa = sm(s.A), ss = sm(s.S);
  const cx = [], cy = [], ca = [], cs = []; let need = [];
  for (let i = 0; i < n; i++) { cx.push(sx[i] - s.X[i]); cy.push(sy[i] - s.Y[i]); ca.push(sa[i] - s.A[i]); cs.push(ss[i] - s.S[i]); const asp = s.w / s.h; need.push((1 + 2 * Math.max(Math.abs(cx[i]), Math.abs(cy[i]))) * (Math.cos(Math.abs(ca[i])) + Math.sin(Math.abs(ca[i])) * Math.max(asp, 1 / asp)) * Math.exp(Math.abs(cs[i]))); }
  need.sort((a, b) => a - b); const auto = clamp(need[Math.floor(need.length * 0.97)] || 1, 1, 1.6);
  const z = c.p.stabZoom > 0 ? 1 + c.p.stabZoom / 100 : auto;
  const r = { key, cx, cy, ca, cs, z, auto };
  STAB_CACHE.set(c.id, r); return r;
}
function stabAt(c, st) {
  const s = c.stab; if (!s || !s.n) return null; const r = stabCorr(c);
  const f = clamp((st - s.t0) * s.fps, 0, s.n - 1), i = Math.floor(f), k = f - i, j = Math.min(s.n - 1, i + 1);
  const L = (a) => a[i] + (a[j] - a[i]) * k;
  return [L(r.cx), L(r.cy), L(r.ca), L(r.cs), r.z];
}
/* ---------- tracking window node (ikuti objek) ---------- */
async function trackWindow(c, ni, dir) {
  const m = mediaById(c.media); if (!m || !FILES[m.id]) throw new Error('Media tidak tersedia');
  const n = c.g.nodes[ni]; if (!n || n.win === 'none') throw new Error('Pilih bentuk window dulu');
  const D = clipDur(c), lt0 = clamp(PH - c.start, 0, D), fps = m.fps || 30;
  const P0 = 'g.nodes.' + ni + '.';
  let cx = valAt(c, P0 + 'cx', lt0), cy = valAt(c, P0 + 'cy', lt0);
  /* daftar waktu lokal yang dilacak */
  const step = 1 / fps * (c.speed || 1), times = [];
  if (dir > 0) for (let lt = lt0; lt <= D + 1e-6; lt += 1 / fps) times.push(lt); else for (let lt = lt0; lt >= -1e-6; lt -= 1 / fps) times.push(lt);
  if (times.length < 2) throw new Error('Tidak ada bingkai untuk dilacak');
  const src = makeFrameSource(m), W = 384, H = Math.max(8, Math.round(W * m.h / m.w)), cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d', { willReadFrequently: true });
  const grab = async lt => { const st = srcTime(c, clamp(lt, 0, D - 1e-4)); const f = await src.frameAt(Math.min(st, m.dur - 1e-3)); x.save(); x.clearRect(0, 0, W, H); if (f && f.half) x.drawImage(halfPreview(f, W, H), 0, 0); else { const isEl = f instanceof HTMLVideoElement, rot = isEl ? 0 : (m.rot || 0); if (rot) { x.translate(W / 2, H / 2); x.rotate(rot * Math.PI / 180); const sw = rot % 180 ? H : W, sh = rot % 180 ? W : H; x.drawImage(f, -sw / 2, -sh / 2, sw, sh); } else x.drawImage(f, 0, 0, W, H); } x.restore(); const d = x.getImageData(0, 0, W, H).data, L = new Uint8Array(W * H); for (let k = 0, j = 0; k < L.length; k++, j += 4) L[k] = (d[j] * 77 + d[j + 1] * 150 + d[j + 2] * 29) >> 8; return L; };
  const bs = clamp(Math.round(Math.min(n.ww * W, n.wh * H) * 1.1 / 2) * 2, 16, 72), R = Math.round(W * 0.05);
  c.kf = c.kf || {}; ['cx', 'cy'].forEach(k => { const p = P0 + k; const lo = Math.min(times[0], times[times.length - 1]), hi = Math.max(times[0], times[times.length - 1]); if (c.kf[p]) c.kf[p] = c.kf[p].filter(f => f[0] < lo - 1e-4 || f[0] > hi + 1e-4); else { c.kf[p] = []; } });
  const put = (lt, X, Y) => { [['cx', X], ['cy', Y]].forEach(([k, v]) => { const p = P0 + k; c.kf[p].push([Math.round(lt * 1e4) / 1e4, Math.round(v * 1e4) / 1e4, 0]); }); };
  let prev = await grab(times[0]); put(times[0], cx, cy);
  let tpl = null; let lost = 0;
  try {
    for (let i = 1; i < times.length; i++) {
      if (i % 3 === 0) { setBusy('Melacak objek\u2026 ' + Math.round(i / times.length * 100) + '%'); await yieldNow(); }
      if (TRACK_CANCEL) break;
      const cur = await grab(times[i]);
      const px = clamp(Math.round(cx * W - bs / 2), 0, W - bs), py = clamp(Math.round(cy * H - bs / 2), 0, H - bs);
      if (!tpl) tpl = { L: prev, W, H };
      const r = matchBlock(prev, cur, W, H, px, py, bs, R, half2(prev, W, H), half2(cur, W, H));
      if (!r || r.err > 55) { lost++; if (lost > 6) break; prev = cur; put(times[i], cx, cy); continue; }
      lost = 0; cx = clamp(cx + r.dx / W, -0.2, 1.2); cy = clamp(cy + r.dy / H, -0.2, 1.2);
      put(times[i], cx, cy); prev = cur;
    }
  } finally { src.close(); setBusy(null); }
  ['cx', 'cy'].forEach(k => { const p = P0 + k; c.kf[p].sort((a, b) => a[0] - b[0]); });
  return times.length;
}
let TRACK_CANCEL = false;
/* pratinjau setengah-float -> kanvas kecil (untuk analisis DPX) */
function halfPreview(f, W, H) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d'), im = x.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let i = 0; i < W; i++) { const sx = Math.floor(i * f.w / W), sy = Math.floor(y * f.h / H), s = (sy * f.w + sx) * 3, o = (y * W + i) * 4; for (let k = 0; k < 3; k++) im.data[o + k] = clamp(h2f(f.half[s + k]) * 255, 0, 255); im.data[o + 3] = 255; }
  x.putImageData(im, 0, 0); return cv;
}
function h2f(h) { const s = (h & 0x8000) ? -1 : 1, e = (h >> 10) & 0x1f, m = h & 0x3ff; if (e === 0) return s * m * 5.960464477539063e-8; if (e === 31) return m ? NaN : s * Infinity; return s * Math.pow(2, e - 15) * (1 + m / 1024); }

/* ---- m-overlay.js ---- */
/* ================= OVERLAY PRATINJAU: geser/skala/putar langsung di layar, window warna ================= */
let OVK = '';
function clipSrcSize(c) {
  if (c.kind === 'text') { const r = renderTextCanvas(c, PH - c.start, GLR.w || P.w, GLR.h || P.h); return [r.w, r.h]; }
  const m = mediaById(c.media); return m ? [m.w, m.h] : [P.w, P.h];
}
function clipBox(c) {
  /* kotak klip dalam koordinat proyek (px) */
  /* sama persis dengan render: termasuk zoom dinamis & animasi masuk/keluar */
  const lt = lt0(c), [sw, sh] = clipSrcSize(c), X = clipXf(c, lt, clipDur(c));
  const L = layerMatrix(P.w, P.h, sw, sh, { x: X.x, y: X.y, scale: X.sc, rot: X.rot, flipH: c.p.flipH, flipV: c.p.flipV, fit: c.p.fit || 'fit', rs: 1 });
  return { cx: L.cx, cy: L.cy, w: L.bw, h: L.bh, rot: X.rot, rotAdd: X.rot - valAt(c, 'p.rot', lt), sw, sh, flipH: c.p.flipH, flipV: c.p.flipV };
}
/* geometri kanvas yang benar-benar tampil (lebar tata letak, bukan nilai style yang bisa basi) */
function cvGeom() {
  const cv = GLR.cv, w = cv.offsetWidth || parseFloat(cv.style.width) || cv.clientWidth || 1, r = cv.getBoundingClientRect();
  return { k: w / P.w, kc: (r.width || w) / P.w, left: cv.offsetLeft, top: cv.offsetTop, w, h: cv.offsetHeight || parseFloat(cv.style.height) || 1, r };
}
function drawOverlay() {
  const ov = $('#vs-ov'); if (!ov || !P) return;
  const c = selClip(), G = cvGeom(), k = G.k;
  ov.style.left = G.left + 'px'; ov.style.top = G.top + 'px'; ov.style.width = G.w + 'px'; ov.style.height = G.h + 'px';
  let html = '', key = '';
  const active = c && c.p && PH >= c.start && PH <= clipEnd(c) + 1e-6 && !PB.on;
  if (active && MODE === 'edit' && !TL.drag) {
    const b = clipBox(c); key = ['e', c.id, b.cx, b.cy, b.w, b.h, b.rot, k, G.left, G.top].map(v => typeof v === 'number' ? Math.round(v * 10) : v).join(',');
    if (key !== OVK) html = `<div class="bx" data-ov="move" style="left:${(b.cx - b.w / 2) * k}px;top:${(b.cy - b.h / 2) * k}px;width:${b.w * k}px;height:${b.h * k}px;transform:rotate(${b.rot}deg)"><i data-h="nw" style="left:0;top:0;cursor:nwse-resize"></i><i data-h="ne" style="left:100%;top:0;cursor:nesw-resize"></i><i data-h="sw" style="left:0;top:100%;cursor:nesw-resize"></i><i data-h="se" style="left:100%;top:100%;cursor:nwse-resize"></i><i data-h="rot" style="left:50%;top:-26px"></i></div>`;
  } else if (active && MODE === 'color' && c.g && CTAB === 'nodes' && c.g.nodes[CNODE] && c.g.nodes[CNODE].win !== 'none') {
    const n = c.g.nodes[CNODE], b = clipBox(c), lt = lt0(c), NV = kk => valAt(c, 'g.nodes.' + CNODE + '.' + kk, lt);
    const cx = NV('cx'), cy = NV('cy'), ww = NV('ww'), wh = NV('wh'), wr = NV('wr');
    const uvToP = (u, v) => { let x = (u - 0.5) * b.w, y = (v - 0.5) * b.h; if (b.flipH) x = -x; if (b.flipV) y = -y; const a = b.rot * Math.PI / 180; return [b.cx + x * Math.cos(a) - y * Math.sin(a), b.cy + x * Math.sin(a) + y * Math.cos(a)]; };
    const [px, py] = uvToP(cx, cy);
    const W2 = n.win === 'linear' ? Math.max(b.w, b.h) * 1.5 : ww * b.w * 2, H2 = n.win === 'linear' ? 2 : wh * b.h * 2;
    key = ['c', c.id, CNODE, n.win, px, py, W2, H2, wr, k].map(v => typeof v === 'number' ? Math.round(v * 10) : v).join(',');
    if (key !== OVK) html = `<div class="win ${n.win === 'rect' ? 'rect' : n.win === 'linear' ? 'lin' : ''}" data-ov="win" style="left:${(px - W2 / 2) * k}px;top:${(py - H2 / 2) * k}px;width:${W2 * k}px;height:${Math.max(2, H2 * k)}px;transform:rotate(${b.rot + wr}deg)">${n.win !== 'linear' ? '<i data-h="wsz" style="left:100%;top:100%;cursor:nwse-resize"></i>' : '<i data-h="wmv" style="left:50%;top:50%"></i>'}</div>`;
  }
  if (!key) { if (ov.firstChild) ov.innerHTML = ''; OVK = ''; } else if (key !== OVK) { ov.innerHTML = html; OVK = key; }
}
function bindOverlay() {
  const ov = $('#vs-ov'); let D = null; const pts = new Map();
  ov.addEventListener('pointerdown', e => {
    const c = selClip(); if (!c) return; const t = e.target.closest('[data-ov]'); if (!t) return;
    e.preventDefault(); e.stopPropagation(); ov.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    const G = cvGeom(), k = G.kc, lt = lt0(c);
    const h = e.target.dataset.h || t.dataset.ov;
    if (pts.size === 2 && D && D.mode === 'move') { const [a, b] = Array.from(pts.values()); D.mode = 'pinch'; D.d0 = Math.hypot(a[0] - b[0], a[1] - b[1]); D.a0 = Math.atan2(b[1] - a[1], b[0] - a[0]); D.s0 = valAt(c, 'p.scale', lt); D.r0 = valAt(c, 'p.rot', lt); return; }
    const box = clipBox(c), r = G.r;
    D = { touch: e.pointerType !== 'mouse', mode: h, c, k, x0: e.clientX, y0: e.clientY, lt, px0: valAt(c, 'p.x', lt), py0: valAt(c, 'p.y', lt), s0: valAt(c, 'p.scale', lt), r0: valAt(c, 'p.rot', lt), box, ccx: r.left + box.cx * k, ccy: r.top + box.cy * k, moved: false };
    if (h === 'win' || h === 'wsz' || h === 'wmv') { const n = 'g.nodes.' + CNODE + '.'; D.n = n; D.cx0 = valAt(c, n + 'cx', lt); D.cy0 = valAt(c, n + 'cy', lt); D.ww0 = valAt(c, n + 'ww', lt); D.wh0 = valAt(c, n + 'wh', lt); }
  });
  ov.addEventListener('pointermove', e => {
    if (!D || !pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]); const c = D.c;
    const dx = (e.clientX - D.x0) / D.k, dy = (e.clientY - D.y0) / D.k;
    /* sentuhan: abaikan getaran jari kecil agar posisi tidak bergeser tanpa sengaja */
    if (!D.moved && D.mode !== 'pinch' && Math.hypot(e.clientX - D.x0, e.clientY - D.y0) < (D.touch ? 7 : 2)) return;
    if (!D.moved && D.touch && navigator.vibrate) try { navigator.vibrate(8); } catch (er) {}
    D.moved = true;
    if (D.mode === 'move') { let nx = D.px0 + dx * 2 / P.w, ny = D.py0 + dy * 2 / P.h; if (Math.abs(nx) < 0.012) nx = 0; if (Math.abs(ny) < 0.012) ny = 0; setVal(c, 'p.x', nx, D.lt); setVal(c, 'p.y', ny, D.lt); }
    else if (D.mode === 'pinch' && pts.size >= 2) { const [a, b] = Array.from(pts.values()); const d = Math.hypot(a[0] - b[0], a[1] - b[1]), an = Math.atan2(b[1] - a[1], b[0] - a[0]); setVal(c, 'p.scale', clamp(D.s0 * d / D.d0, 1, 1000), D.lt); let r = D.r0 + (an - D.a0) * 180 / Math.PI; if (Math.abs(r % 90) < 2.5) r = Math.round(r / 90) * 90; setVal(c, 'p.rot', r, D.lt); }
    else if (/^(nw|ne|sw|se)$/.test(D.mode)) { const d0 = Math.hypot(D.x0 - D.ccx, D.y0 - D.ccy), d1 = Math.hypot(e.clientX - D.ccx, e.clientY - D.ccy); setVal(c, 'p.scale', clamp(D.s0 * d1 / Math.max(4, d0), 1, 1000), D.lt); }
    else if (D.mode === 'rot') { const a = Math.atan2(e.clientY - D.ccy, e.clientX - D.ccx) * 180 / Math.PI + 90 - (D.box.rotAdd || 0); let r = a; if (!e.shiftKey && Math.abs(((r % 45) + 45) % 45) < 3) r = Math.round(r / 45) * 45; setVal(c, 'p.rot', Math.round(r * 10) / 10, D.lt); }
    else if (D.mode === 'win' || D.mode === 'wmv') { const b = D.box, a = -b.rot * Math.PI / 180; let ux = (dx * Math.cos(a) - dy * Math.sin(a)) / b.w, uy = (dx * Math.sin(a) + dy * Math.cos(a)) / b.h; if (b.flipH) ux = -ux; if (b.flipV) uy = -uy; setVal(c, D.n + 'cx', D.cx0 + ux, D.lt); setVal(c, D.n + 'cy', D.cy0 + uy, D.lt); }
    else if (D.mode === 'wsz') { const b = D.box; setVal(c, D.n + 'ww', clamp(D.ww0 + dx / b.w, 0.01, 2), D.lt); setVal(c, D.n + 'wh', clamp(D.wh0 + dy / b.h, 0.01, 2), D.lt); }
    requestRender(); syncInspector();
  });
  const up = e => { pts.delete(e.pointerId); if (!D) return; if (pts.size === 0) { const moved = D.moved; if (moved) window.__vsOvUp = Date.now(); D = null; OVK = ''; if (moved) { commit('Ubah di layar'); syncInspector(); renderTimeline(); } } else if (D.mode === 'pinch') { D.mode = 'none'; } };
  ov.addEventListener('pointerup', up); ov.addEventListener('pointercancel', up);
  /* jari kedua boleh di mana saja di area pratinjau untuk cubit (skala & putar) */
  $('#vs-stage').addEventListener('pointerdown', e => {
    if (!D || D.mode !== 'move' || e.pointerType === 'mouse' || pts.has(e.pointerId) || e.target.closest('[data-ov]')) return;
    e.preventDefault(); try { ov.setPointerCapture(e.pointerId); } catch (er) {}
    pts.set(e.pointerId, [e.clientX, e.clientY]); const [a, b] = Array.from(pts.values()), c = D.c, lt = D.lt;
    D.mode = 'pinch'; D.moved = true; D.d0 = Math.hypot(a[0] - b[0], a[1] - b[1]); D.a0 = Math.atan2(b[1] - a[1], b[0] - a[0]); D.s0 = valAt(c, 'p.scale', lt); D.r0 = valAt(c, 'p.rot', lt);
  }, true);
  /* klik pratinjau: ambil warna / pilih klip */
  $('#vs-stage').addEventListener('click', e => {
    if (e.target.closest('[data-ov]') || e.target.closest('button')) return;
    if (PICK) { const rgb = pickAt(e.clientX, e.clientY); const f = PICK; PICK = null; $('#vs-stage').style.cursor = ''; f(rgb); return; }
    if (MODE !== 'edit') return;
    /* pilih klip teratas di titik ini */
    if (Date.now() - (window.__vsOvUp || 0) < 350) return;
    const r = GLR.cv.getBoundingClientRect(); const X = (e.clientX - r.left) / r.width * P.w, Y = (e.clientY - r.top) / r.height * P.h;
    const vt = P.tracks.filter(t => t.kind === 'video' && !t.hide);
    for (const tr of vt) { const c = clipsOn(tr.id).find(x => x.p && PH >= x.start && PH < clipEnd(x)); if (!c) continue; const b = clipBox(c); const a = -b.rot * Math.PI / 180, dx = X - b.cx, dy = Y - b.cy, lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a); if (Math.abs(lx) <= b.w / 2 && Math.abs(ly) <= b.h / 2) { if (SEL !== c.id) { SEL = c.id; renderAll(); } return; } }
  });
}
function startPick(cb, msg) { PICK = cb; $('#vs-stage').style.cursor = 'crosshair'; toast(msg || 'Klik / ketuk warna di layar pratinjau'); if (NARROW()) closeSheets(); }

/* ---- t-inspect.js ---- */
/* ================= PERIKSA DETAIL: layar penuh, resolusi asli proyek, zoom piksel 1:1, geser, nilai warna, clipping ================= */
const IX = { on: false, z: 1, tx: 0, ty: 0, W: 0, H: 0, busy: 0, tok: 0, clip: false, before: false, bt: -1, play: false, fs: false, at: -1, lastPx: null };
function ixDpr() { return Math.min(3, window.devicePixelRatio || 1); }
function openInspect() {
  if (!P || !P.clips.length) { toast('Tambahkan video atau foto dulu', true); return; }
  if (IX.on) return; pause(); if (NARROW()) closeSheets();
  const el = document.createElement('div'); el.className = 'vs-ix'; el.id = 'vs-ix'; el.tabIndex = -1;
  const zb = (z, t) => `<button data-ix="z" data-z="${z}">${t}</button>`;
  el.innerHTML = `<div class="ixtop"><b>Periksa Detail</b><span id="vs-ixinfo"></span><div class="sp"></div>
    <button class="vs-ib" data-ix="png" title="Simpan bingkai ini (PNG resolusi penuh)">${ico('save')}</button>
    <button class="vs-ib" data-ix="close" title="Tutup (Esc)">${ico('x')}</button></div>
  <div class="ixview" id="vs-ixview"><div class="ixwrap" id="vs-ixwrap"><canvas id="vs-ixcv"></canvas><canvas id="vs-ixbf" hidden></canvas><canvas id="vs-ixcl" hidden></canvas></div>
    <div class="ixload" id="vs-ixload"><i></i><span>Merender resolusi penuh&hellip;</span></div>
    <div class="ixpx" id="vs-ixpx" hidden></div><div class="ixtag" id="vs-ixtag" hidden>SEBELUM (tanpa grading)</div></div>
  <div class="ixbar">
    <div class="ixrow ixzoom">${zb('fit', 'Pas')}${zb(1, '100%')}${zb(2, '200%')}${zb(4, '400%')}<span class="ixz" id="vs-ixz"></span></div>
    <div class="ixrow ixplay">
      <button class="vs-ib" data-ix="prev" title="Mundur 1 bingkai">${ico('back')}</button>
      <button class="vs-play" data-ix="play" id="vs-ixplay" title="Putar / Jeda">${ico('play')}</button>
      <button class="vs-ib" data-ix="next" title="Maju 1 bingkai">${ico('next')}</button>
      <input type="range" id="vs-ixt" min="0" max="1000" step="1" aria-label="Posisi waktu">
      <span class="ixtime" id="vs-ixtime"></span>
    </div>
    <div class="ixrow ixtools">
      <button data-ix="before" title="Tahan untuk melihat sebelum color grading">${ico('tr')}<span>Tahan: Sebelum</span></button>
      <button data-ix="clip" id="vs-ixclipb" title="Tandai area terlalu terang (merah) &amp; terlalu gelap (biru)">${ico('drop2')}<span>Clipping</span></button>
      <span class="ixhint">Cubit / scroll untuk zoom &middot; seret untuk geser &middot; ketuk 2x: Pas &harr; 100%</span>
    </div>
  </div>`;
  A.appendChild(el); IX.on = true; IX.el = el; IX.before = false; IX.bt = -1; IX.clip = false; IX.at = -1;
  IX.cv = $('#vs-ixcv'); IX.ctx = IX.cv.getContext('2d', { willReadFrequently: true });
  IX.bf = $('#vs-ixbf'); IX.cl = $('#vs-ixcl');
  document.documentElement.classList.add('vs-noscroll');
  if (el.requestFullscreen && !/iPhone|iPod/.test(navigator.userAgent)) { el.requestFullscreen().then(() => { IX.fs = true; setTimeout(ixFit, 80); }).catch(() => {}); }
  ixBind(el); IX.mode = 'fit'; ixSize(); ixFit(); ixRender(); try { el.focus({ preventScroll: true }); } catch (e) {}
}
function closeInspect() {
  if (!IX.on) return; if (PB.on) pause(); IX.on = false; IX.play = false; IX.tok++;
  if (document.fullscreenElement === IX.el) { try { document.exitFullscreen(); } catch (e) {} }
  document.removeEventListener('keydown', ixKey, true);
  if (!A.classList.contains('vs-full')) document.documentElement.classList.remove('vs-noscroll');
  IX.el.remove(); IX.el = null; placePlayhead(true); layoutCanvas(); requestRender();
}
function ixSize() {
  /* ukuran kanvas = resolusi proyek; ukuran CSS dihitung agar zoom 100% = 1 piksel video : 1 piksel layar */
  const W = P.w, H = P.h; IX.W = W; IX.H = H; const d = ixDpr();
  [IX.cv, IX.bf, IX.cl].forEach(c => { if (c.width !== W || c.height !== H) { c.width = W; c.height = H; } });
  const wr = $('#vs-ixwrap'); wr.style.width = (W / d) + 'px'; wr.style.height = (H / d) + 'px';
}
function ixFitZ() { const v = $('#vs-ixview'), d = ixDpr(); return Math.min((v.clientWidth - 16) / (IX.W / d), (v.clientHeight - 16) / (IX.H / d)); }
function ixFit() { if (!IX.on) return; IX.mode = 'fit'; const v = $('#vs-ixview'), d = ixDpr(), z = ixFitZ(); IX.z = z; IX.tx = (v.clientWidth - IX.W / d * z) / 2; IX.ty = (v.clientHeight - IX.H / d * z) / 2; ixApply(); }
function ixZoomAt(z, cx, cy) {
  const v = $('#vs-ixview'), r = v.getBoundingClientRect(); if (cx == null) { cx = r.left + v.clientWidth / 2; cy = r.top + v.clientHeight / 2; }
  z = clamp(z, Math.min(ixFitZ(), 0.05), 16); const px = cx - r.left, py = cy - r.top;
  IX.tx = px - (px - IX.tx) * z / IX.z; IX.ty = py - (py - IX.ty) * z / IX.z; IX.z = z; IX.mode = 'free'; ixApply();
}
function ixApply() {
  const v = $('#vs-ixview'), d = ixDpr(), w = IX.W / d * IX.z, h = IX.H / d * IX.z, vw = v.clientWidth, vh = v.clientHeight;
  /* jaga gambar tetap terlihat */
  IX.tx = w <= vw ? (vw - w) / 2 : clamp(IX.tx, vw - w - 40, 40); IX.ty = h <= vh ? (vh - h) / 2 : clamp(IX.ty, vh - h - 40, 40);
  const wr = $('#vs-ixwrap'); wr.style.transform = `translate(${IX.tx}px,${IX.ty}px) scale(${IX.z})`;
  wr.classList.toggle('px', IX.z >= 1.99);
  $('#vs-ixz').textContent = Math.round(IX.z * 100) + '%';
  $$('#vs-ix [data-ix=z]').forEach(b => { const zz = b.dataset.z; b.classList.toggle('on', zz === 'fit' ? IX.mode === 'fit' : IX.mode !== 'fit' && Math.abs(IX.z - +zz) < 0.01); });
}
function ixInfo() {
  if (!IX.on) return; $('#vs-ixinfo').textContent = `${P.w}\u00d7${P.h} \u00b7 ${P.fps} fps`;
  $('#vs-ixtime').textContent = fmtTime(PH, P.fps); const D = Math.max(0.001, projDur()), s = $('#vs-ixt'); if (document.activeElement !== s || !IX.scrub) s.value = Math.round(PH / D * 1000);
  fillRange && fillRange(s);
}
/* tunggu semua video aktif selesai mencari bingkai yang tepat */
async function ixSettle(tok) {
  const t0 = performance.now();
  while (performance.now() - t0 < 3000 && tok === IX.tok) {
    syncMedia(PH, false); let ok = true;
    for (const c of P.clips) { if (c.kind !== 'video' || PH < c.start || PH >= clipEnd(c)) continue; const e = ELS.get(c.id); if (!e || e.el.readyState < 2 || e.el.seeking || e.seekT >= 0) { ok = false; break; } }
    if (ok) break; await sleep(40);
  }
  await new Promise(r => requestAnimationFrame(() => r()));
}
function ixDraw(target, noGrade) {
  const W = P.w, H = P.h; let r = null;
  try { r = composeFrame(PH, W, H, previewSrc, { noGrade }); outputFrame(r.tex, W, H, { export: true }); const x = target.getContext('2d'); x.clearRect(0, 0, W, H); x.drawImage(GLR.cv, 0, 0); }
  catch (e) { console.error(e); }
  return r;
}
async function ixRender() {
  if (!IX.on) return; const tok = ++IX.tok; ixInfo(); ixSize();
  const ld = $('#vs-ixload'); ld.hidden = false;
  await ixSettle(tok); if (tok !== IX.tok || !IX.on || PB.on) return;
  let r = null;
  for (let i = 0; i < 6; i++) { r = ixDraw(IX.cv, false); if (!r || !r.missing) break; await sleep(120); if (tok !== IX.tok) return; }
  IX.at = PH; IX.bt = -1; TXT_CACHE.clear(); layoutCanvas(); requestRender();
  ld.hidden = true; if (IX.clip) ixClipMap(); if (IX.before) ixShowBefore(true); ixPxAgain();
}
function ixShowBefore(on) {
  IX.before = on; $('#vs-ixtag').hidden = !on; const b = $('#vs-ix [data-ix=before]'); if (b) b.classList.toggle('on', on);
  if (on && IX.bt !== IX.at) { ixDraw(IX.bf, true); IX.bt = IX.at; TXT_CACHE.clear(); layoutCanvas(); requestRender(); }
  IX.bf.hidden = !on; ixPxAgain();
}
function ixClipMap() {
  const W = IX.W, H = IX.H, src = (IX.before ? IX.bf : IX.cv).getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data;
  const x = IX.cl.getContext('2d'), out = x.createImageData(W, H), o = out.data;
  const bg = hexRGB(P.bg).map(v => Math.round(v * 255));
  for (let i = 0; i < src.length; i += 4) {
    if (Math.abs(src[i] - bg[0]) < 2 && Math.abs(src[i + 1] - bg[1]) < 2 && Math.abs(src[i + 2] - bg[2]) < 2) continue; /* latar kanvas proyek, bukan video */
    const mx = Math.max(src[i], src[i + 1], src[i + 2]);
    if (mx >= 253) { o[i] = 255; o[i + 1] = 30; o[i + 2] = 60; o[i + 3] = 210; } else if (mx <= 2) { o[i] = 30; o[i + 1] = 110; o[i + 2] = 255; o[i + 3] = 190; }
  }
  x.putImageData(out, 0, 0); IX.cl.hidden = false;
}
function ixToggleClip() { IX.clip = !IX.clip; $('#vs-ixclipb').classList.toggle('on', IX.clip); if (IX.clip) ixClipMap(); else IX.cl.hidden = true; }
/* nilai piksel di bawah jari / kursor */
function ixPx(cx, cy) {
  const box = $('#vs-ixwrap').getBoundingClientRect(), tip = $('#vs-ixpx'); IX.lastPx = [cx, cy];
  const X = Math.floor((cx - box.left) / box.width * IX.W), Y = Math.floor((cy - box.top) / box.height * IX.H);
  if (X < 0 || Y < 0 || X >= IX.W || Y >= IX.H) { tip.hidden = true; return; }
  const p = (IX.before ? IX.bf : IX.cv).getContext('2d', { willReadFrequently: true }).getImageData(X, Y, 1, 1).data;
  const L = Math.round((0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]) / 2.55), hx = '#' + [p[0], p[1], p[2]].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  const v = $('#vs-ixview').getBoundingClientRect();
  tip.hidden = false; tip.innerHTML = `<i style="background:${hx}"></i><b>R ${p[0]}</b> <b>G ${p[1]}</b> <b>B ${p[2]}</b><span>${hx} &middot; Luma ${L}% &middot; x${X} y${Y}</span>`;
  tip.style.left = clamp(cx - v.left + 16, 6, v.width - 230) + 'px'; tip.style.top = clamp(cy - v.top - 60, 6, v.height - 50) + 'px';
}
function ixPxAgain() { if (IX.lastPx && !$('#vs-ixpx').hidden) ixPx(IX.lastPx[0], IX.lastPx[1]); }
function ixStep(n) { if (PB.on) ixPlay(false); PH = clamp(Math.round(PH * P.fps + n) / P.fps, 0, Math.max(0, projDur())); seek(PH); ixRender(); }
function ixPlay(on) {
  if (on == null) on = !PB.on; IX.play = on; $('#vs-ixplay').innerHTML = ico(on ? 'pause' : 'play');
  if (on) { IX.tok++; $('#vs-ixload').hidden = true; if (IX.before) ixShowBefore(false); IX.cl.hidden = true; play(); if (!PB.on) { IX.play = false; $('#vs-ixplay').innerHTML = ico('play'); } }
  else { pause(); ixRender(); }
}
/* dipanggil dari loop render saat diputar di layar periksa */
function ixBlit() {
  if (!IX.on || !PB.on) return; const x = IX.ctx; x.drawImage(GLR.cv, 0, 0, IX.W, IX.H); ixInfo();
}
function ixKey(e) {
  if (!IX.on) return; const k = e.key; let used = true;
  if (k === 'Escape') closeInspect(); else if (k === ' ') ixPlay(); else if (k === 'ArrowLeft') ixStep(e.shiftKey ? -P.fps : -1); else if (k === 'ArrowRight') ixStep(e.shiftKey ? P.fps : 1);
  else if (k === '+' || k === '=') ixZoomAt(IX.z * 1.5); else if (k === '-') ixZoomAt(IX.z / 1.5); else if (k === '0') ixFit(); else if (k === '1') ixZoomAt(1); else if (k === '2') ixZoomAt(2); else if (k === '4') ixZoomAt(4);
  else if (k.toLowerCase() === 'b') { if (!e.repeat) ixShowBefore(!IX.before); } else if (k.toLowerCase() === 'c') ixToggleClip(); else used = false;
  if (used) { e.preventDefault(); e.stopPropagation(); }
}
function ixBind(el) {
  document.addEventListener('keydown', ixKey, true);
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-ix]'); if (!b) return; const a = b.dataset.ix;
    if (a === 'close') closeInspect(); else if (a === 'prev') ixStep(-1); else if (a === 'next') ixStep(1); else if (a === 'play') ixPlay();
    else if (a === 'z') { if (b.dataset.z === 'fit') ixFit(); else ixZoomAt(+b.dataset.z); }
    else if (a === 'clip') ixToggleClip();
    else if (a === 'png') { IX.cv.toBlob(bl => { const u = URL.createObjectURL(bl), l = document.createElement('a'); l.href = u; l.download = (P.name || 'frame').replace(/[^\w\- ]+/g, '') + '-' + fmtTime(PH, P.fps).replace(/:/g, '') + '.png'; l.click(); setTimeout(() => URL.revokeObjectURL(u), 4000); }, 'image/png'); toast('Bingkai resolusi penuh disimpan'); }
  });
  /* tahan tombol "Sebelum" */
  const bb = el.querySelector('[data-ix=before]');
  bb.addEventListener('pointerdown', e => { e.preventDefault(); if (PB.on) return; bb.setPointerCapture(e.pointerId); ixShowBefore(true); if (IX.clip) ixClipMap(); });
  const bup = () => { if (IX.before) { ixShowBefore(false); if (IX.clip) ixClipMap(); } };
  bb.addEventListener('pointerup', bup); bb.addEventListener('pointercancel', bup); bb.addEventListener('contextmenu', e => e.preventDefault());
  /* slider waktu */
  const s = $('#vs-ixt'); let st = 0;
  s.addEventListener('input', () => { IX.scrub = 1; if (PB.on) ixPlay(false); const D = projDur(); PH = clamp(+s.value / 1000 * D, 0, D); seek(PH); $('#vs-ixtime').textContent = fmtTime(PH, P.fps); clearTimeout(st); st = setTimeout(ixRender, 140); });
  s.addEventListener('change', () => { IX.scrub = 0; });
  /* geser, cubit, roda, ketuk 2x */
  const v = $('#vs-ixview'), pts = new Map(); let G = null, lastTap = 0;
  v.addEventListener('pointerdown', e => {
    v.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 1) { G = { m: 'pan', x: e.clientX, y: e.clientY, tx: IX.tx, ty: IX.ty, moved: false }; ixPx(e.clientX, e.clientY); }
    else if (pts.size === 2) { const [a, b] = Array.from(pts.values()); G = { m: 'pinch', d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: IX.z, cx: (a[0] + b[0]) / 2, cy: (a[1] + b[1]) / 2, tx: IX.tx, ty: IX.ty, moved: true }; $('#vs-ixpx').hidden = true; }
  });
  v.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) { if (e.pointerType === 'mouse') ixPx(e.clientX, e.clientY); return; }
    pts.set(e.pointerId, [e.clientX, e.clientY]); if (!G) return;
    if (G.m === 'pan' && pts.size === 1) {
      if (Math.hypot(e.clientX - G.x, e.clientY - G.y) > 4) G.moved = true;
      IX.tx = G.tx + e.clientX - G.x; IX.ty = G.ty + e.clientY - G.y; IX.mode = IX.mode === 'fit' && !G.moved ? 'fit' : 'free'; ixApply(); ixPx(e.clientX, e.clientY);
    } else if (G.m === 'pinch' && pts.size >= 2) {
      const [a, b] = Array.from(pts.values()), d = Math.hypot(a[0] - b[0], a[1] - b[1]), cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2;
      const r = v.getBoundingClientRect(), z = clamp(G.z * d / Math.max(10, G.d), Math.min(ixFitZ(), 0.05), 16), px = G.cx - r.left, py = G.cy - r.top;
      IX.tx = px - (px - G.tx) * z / G.z + (cx - G.cx); IX.ty = py - (py - G.ty) * z / G.z + (cy - G.cy); IX.z = z; IX.mode = 'free'; ixApply();
    }
  });
  const up = e => {
    if (!pts.has(e.pointerId)) return; pts.delete(e.pointerId);
    if (G && G.m === 'pan' && !G.moved && e.type === 'pointerup') {
      const now = Date.now();
      if (now - lastTap < 320) { lastTap = 0; if (IX.mode === 'fit' || IX.z < 0.99) ixZoomAt(1, e.clientX, e.clientY); else ixFit(); } else lastTap = now;
    }
    if (pts.size === 1 && G && G.m === 'pinch') { const [p] = Array.from(pts.values()); G = { m: 'pan', x: p[0], y: p[1], tx: IX.tx, ty: IX.ty, moved: true }; }
    else if (!pts.size) { G = null; if (e.pointerType !== 'mouse') setTimeout(() => { if (!pts.size) $('#vs-ixpx').hidden = true; }, 1600); }
  };
  v.addEventListener('pointerup', up); v.addEventListener('pointercancel', up);
  v.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !pts.size) $('#vs-ixpx').hidden = true; });
  v.addEventListener('wheel', e => { e.preventDefault(); ixZoomAt(IX.z * Math.pow(1.0018, -e.deltaY), e.clientX, e.clientY); }, { passive: false });
  const onRs = () => { if (!IX.on) return; if (IX.mode === 'fit') ixFit(); else ixApply(); };
  IX.ro = new ResizeObserver(onRs); IX.ro.observe(v);
  el.addEventListener('fullscreenchange', () => setTimeout(onRs, 60));
}
BUS.on('play', on => { if (IX.on) { IX.play = on; const b = $('#vs-ixplay'); if (b) b.innerHTML = ico(on ? 'pause' : 'play'); if (!on && IX.el) ixRender(); } });

/* ---- n-audio.js ---- */
/* ================= AUDIO EKSPOR: mixer, EQ, kompresor, normalisasi LUFS, limiter ================= */
const ASR = 48000;
class PCMCursor {
  constructor(m) { this.m = m; this.src = makePCMSource(m); this.sr = 0; this.ch = null; this.t0 = 0; this.len = 0; this.next = 0; this.done = false; }
  async ensure(a, b) {
    if (!this.src) return false;
    a = Math.max(0, a); b = Math.min(this.m.dur + 0.05, b);
    if (this.ch && (a < this.t0 - 1e-3 || a > this.t0 + this.len / this.sr + 1)) { this.ch = null; } /* lompat: mulai ulang */
    if (!this.ch) { this.t0 = Math.max(0, a - 0.05); this.next = this.t0; this.len = 0; this.done = false; }
    while (!this.done && (!this.ch || this.t0 + this.len / (this.sr || ASR) < b)) {
      const r = await this.src.read(this.next, this.next + 1.5);
      this.next += 1.5; if (this.next >= this.m.dur + 0.1) this.done = true;
      if (!r) { if (this.next > this.m.dur) this.done = true; continue; }
      if (!this.ch) { this.sr = r.sr; this.ch = r.ch.map(() => new Float32Array(0)); this.t0 = r.t0; }
      const add = r.ch[0].length, keepFrom = Math.max(0, Math.floor((a - 0.2 - this.t0) * this.sr));
      this.ch = this.ch.map((old, i) => { const src = r.ch[Math.min(i, r.ch.length - 1)], nn = new Float32Array(this.len - keepFrom + add); nn.set(old.subarray(keepFrom, this.len), 0); nn.set(src, this.len - keepFrom); return nn; });
      while (this.ch.length < 2) this.ch.push(this.ch[0]);
      this.t0 += keepFrom / this.sr; this.len = this.len - keepFrom + add;
    }
    return !!this.ch;
  }
  sample(c, t) { if (!this.ch) return 0; const p = (t - this.t0) * this.sr, i = Math.floor(p); if (i < 0 || i + 1 >= this.len) return 0; const f = p - i, d = this.ch[Math.min(c, this.ch.length - 1)]; return d[i] + (d[i + 1] - d[i]) * f; }
  close() { if (this.src) this.src.close(); }
}
/* ---------- pengurang noise suara (spectral gating, FFT 1024, overlap 75%) ---------- */
function fftIn(re, im, inv) {
  const n = re.length; for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
  for (let len = 2; len <= n; len <<= 1) { const ang = 2 * Math.PI / len * (inv ? 1 : -1), wr = Math.cos(ang), wi = Math.sin(ang); for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let j = 0; j < len / 2; j++) { const a = i + j, b = a + len / 2, xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr; re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } } }
  if (inv) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}
class Denoiser {
  constructor(amount) {
    this.N = 1024; this.H = 256; this.amt = clamp(amount, 0, 1); const N = this.N;
    this.win = new Float32Array(N); for (let i = 0; i < N; i++) this.win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
    this.inL = new Float32Array(N); this.inR = new Float32Array(N); this.olaL = new Float32Array(N); this.olaR = new Float32Array(N);
    this.fill = 0; this.qL = new Float32Array(8192); this.qR = new Float32Array(8192); this.qw = 0; this.qr = 0; this.o2 = [0, 0]; this.P = new Float32Array(N / 2 + 1); this.Nz = new Float32Array(N / 2 + 1).fill(1e9); this.G = new Float32Array(N / 2 + 1).fill(1); this.frames = 0;
    this.norm = 1 / 1.5; this.latency = N;
  }
  push(l, r) {
    const N = this.N, H = this.H; this.inL[N - H + this.fill] = l; this.inR[N - H + this.fill] = r; this.fill++;
    if (this.fill === H) { this.fill = 0; this.frame(); this.inL.copyWithin(0, H); this.inR.copyWithin(0, H); }
    if (this.qr < this.qw) { const j = this.qr++ & 8191; this.o2[0] = this.qL[j]; this.o2[1] = this.qR[j]; } else { this.o2[0] = 0; this.o2[1] = 0; }
    return this.o2;
  }
  frame() {
    const N = this.N, H = this.H, B = N / 2 + 1, w = this.win;
    const rl = new Float32Array(N), il = new Float32Array(N), rr = new Float32Array(N), ir = new Float32Array(N);
    for (let i = 0; i < N; i++) { rl[i] = this.inL[i] * w[i]; rr[i] = this.inR[i] * w[i]; }
    fftIn(rl, il, false); fftIn(rr, ir, false);
    this.frames++;
    for (let k = 0; k < B; k++) {
      const p = (rl[k] * rl[k] + il[k] * il[k] + rr[k] * rr[k] + ir[k] * ir[k]) * 0.5;
      this.P[k] = this.frames < 3 ? p : this.P[k] * 0.7 + p * 0.3;
      /* lantai noise: minimum yang naik perlahan (minimum statistics) */
      this.Nz[k] = Math.min(this.Nz[k] * 1.0025 + 1e-12, this.P[k]);
      const snr = this.P[k] / (this.Nz[k] * (1 + this.amt * 3) + 1e-12);
      let g = snr <= 1 ? 0 : 1 - 1 / snr; g = Math.max(1 - this.amt * 0.97, g);
      this.G[k] = this.G[k] * 0.55 + g * 0.45;
    }
    for (let k = 0; k < B; k++) { const g = this.G[k]; rl[k] *= g; il[k] *= g; rr[k] *= g; ir[k] *= g; if (k > 0 && k < N / 2) { rl[N - k] = rl[k]; il[N - k] = -il[k]; rr[N - k] = rr[k]; ir[N - k] = -ir[k]; } }
    fftIn(rl, il, true); fftIn(rr, ir, true);
    for (let i = 0; i < N; i++) { this.olaL[i] += rl[i] * w[i] * this.norm; this.olaR[i] += rr[i] * w[i] * this.norm; }
    for (let i = 0; i < H; i++) { const j = this.qw++ & 8191; this.qL[j] = this.olaL[i]; this.qR[j] = this.olaR[i]; }
    this.olaL.copyWithin(0, H); this.olaR.copyWithin(0, H); this.olaL.fill(0, N - H); this.olaR.fill(0, N - H);
  }
}
/* biquad RBJ */
function biq(type, f, gainDb, Q) {
  const A = Math.pow(10, gainDb / 40), w = 2 * Math.PI * f / ASR, cs = Math.cos(w), sn = Math.sin(w), al = sn / (2 * Q);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'hp') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = (1 + cs) / 2; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
  else if (type === 'peak') { b0 = 1 + al * A; b1 = -2 * cs; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cs; a2 = 1 - al / A; }
  else if (type === 'low') { const s = 2 * Math.sqrt(A) * al; b0 = A * ((A + 1) - (A - 1) * cs + s); b1 = 2 * A * ((A - 1) - (A + 1) * cs); b2 = A * ((A + 1) - (A - 1) * cs - s); a0 = (A + 1) + (A - 1) * cs + s; a1 = -2 * ((A - 1) + (A + 1) * cs); a2 = (A + 1) + (A - 1) * cs - s; }
  else { const s = 2 * Math.sqrt(A) * al; b0 = A * ((A + 1) + (A - 1) * cs + s); b1 = -2 * A * ((A - 1) + (A + 1) * cs); b2 = A * ((A + 1) + (A - 1) * cs - s); a0 = (A + 1) - (A - 1) * cs + s; a1 = 2 * ((A - 1) - (A + 1) * cs); a2 = (A + 1) - (A - 1) * cs - s; }
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0, z: [[0, 0], [0, 0]] };
}
function biqRun(F, ch, x) { const z = F.z[ch]; const y = F.b0 * x + z[0]; z[0] = F.b1 * x - F.a1 * y + z[1]; z[1] = F.b2 * x - F.a2 * y; return y; }
class AudioMixer {
  constructor() {
    this.items = P.clips.filter(c => (c.kind === 'audio' || c.kind === 'video') && c.au && !c.au.mute && c.media && mediaById(c.media) && (mediaById(c.media).hasAudio || mediaById(c.media).kind === 'audio') && FILES[c.media]).map(c => {
      const au = c.au, f = [];
      if (au.hpf) f.push(biq('hp', 80, 0, 0.707));
      if (au.eq) { if (au.eqL) f.push(biq('low', 120, au.eqL, 0.707)); if (au.eqM) f.push(biq('peak', 1500, au.eqM, 0.8)); if (au.eqH) f.push(biq('high', 8000, au.eqH, 0.707)); }
      return { c, cur: new PCMCursor(mediaById(c.media)), f, env: 0, gr: 0, dn: au.dn > 0 ? new Denoiser(au.dn / 100) : null };
    });
    this.atk = Math.exp(-1 / (0.01 * ASR)); this.rel = Math.exp(-1 / (0.15 * ASR));
  }
  get active() { return this.items.length > 0; }
  async block(t, n) {
    const L = new Float32Array(n), R = new Float32Array(n), dur = n / ASR;
    for (const it of this.items) {
      const c = it.c, D = clipDur(c), s = c.start; if (t + dur <= s || t >= s + D) continue;
      const tr = trackById(c.track); if (tr && tr.mute) continue;
      const lt0b = Math.max(0, t - s), lt1b = Math.min(D, t + dur - s);
      const st0 = srcTime(c, lt0b), st1 = srcTime(c, lt1b);
      if (!(await it.cur.ensure(Math.min(st0, st1) - 0.02, Math.max(st0, st1) + 0.05 + (it.dn ? 0.05 : 0)))) continue;
      const au = c.au, pan = (au.pan || 0) / 100, gl = Math.min(1, 1 - pan), gr2 = Math.min(1, 1 + pan);
      const comp = au.comp, thr = au.cThr, ratio = Math.max(1, au.cRat), mk = dbToLin(au.cGain || 0);
      const SUB = 64; let stA = 0, stB = 0, gA = 0, gB = 0;
      for (let i = 0; i < n; i++) {
        const tt = t + i / ASR, lt = tt - s; if (lt < 0 || lt >= D) continue;
        if (i % SUB === 0 || i === 0) { const lt2 = Math.min(D, lt + SUB / ASR); stA = srcTime(c, lt); stB = srcTime(c, lt2); gA = clipGainAt(c, lt); gB = clipGainAt(c, lt2); }
        const k = (i % SUB) / SUB, st = stA + (stB - stA) * k, g = gA + (gB - gA) * k;
        let l, r;
        if (it.dn) { const la = it.dn.latency / ASR * (c.speed || 1), sa = st + la; const o = it.dn.push(it.cur.sample(0, sa), it.cur.sample(1, sa)); l = o[0]; r = o[1]; }
        else { l = it.cur.sample(0, st); r = it.cur.sample(1, st); }
        for (const F of it.f) { l = biqRun(F, 0, l); r = biqRun(F, 1, r); }
        if (comp) {
          const lv = Math.max(Math.abs(l), Math.abs(r)); it.env = lv > it.env ? this.atk * it.env + (1 - this.atk) * lv : this.rel * it.env + (1 - this.rel) * lv;
          const db = 20 * Math.log10(it.env + 1e-9), red = db > thr ? (db - thr) * (1 - 1 / ratio) : 0; const gg = Math.pow(10, -red / 20) * mk; l *= gg; r *= gg;
        }
        L[i] += l * g * gl; R[i] += r * g * gr2;
      }
    }
    return [L, R];
  }
  close() { this.items.forEach(it => it.cur.close()); }
}
/* pengukur kenyaringan ITU-R BS.1770 (K-weighting, gating) */
class LoudMeter {
  constructor() { this.f1 = { b: [1.53512485958697, -2.69169618940638, 1.19839281085285], a: [-1.69065929318241, 0.73248077421585] }; this.f2 = { b: [1, -2, 1], a: [-1.99004745483398, 0.99007225036621] }; this.z = [[0, 0, 0, 0], [0, 0, 0, 0]]; this.sub = []; this.acc = 0; this.cnt = 0; this.hop = ASR / 10; }
  push(L, R) {
    for (let i = 0; i < L.length; i++) {
      let e = 0;
      for (let ch = 0; ch < 2; ch++) { const z = this.z[ch]; const x = ch ? R[i] : L[i]; const y1 = this.f1.b[0] * x + z[0]; z[0] = this.f1.b[1] * x - this.f1.a[0] * y1 + z[1]; z[1] = this.f1.b[2] * x - this.f1.a[1] * y1; const y2 = y1 + z[2]; z[2] = -2 * y1 - this.f2.a[0] * y2 + z[3]; z[3] = y1 - this.f2.a[1] * y2; e += y2 * y2; }
      this.acc += e; if (++this.cnt >= this.hop) { this.sub.push(this.acc / this.cnt); this.acc = 0; this.cnt = 0; }
    }
  }
  lufs() {
    const blocks = []; for (let i = 0; i + 4 <= this.sub.length; i++) blocks.push((this.sub[i] + this.sub[i + 1] + this.sub[i + 2] + this.sub[i + 3]) / 4);
    const L = z => -0.691 + 10 * Math.log10(z + 1e-12);
    const g1 = blocks.filter(z => L(z) > -70); if (!g1.length) return -Infinity;
    const m1 = g1.reduce((a, b) => a + b, 0) / g1.length, thr = L(m1) - 10;
    const g2 = g1.filter(z => L(z) > thr); if (!g2.length) return L(m1);
    return L(g2.reduce((a, b) => a + b, 0) / g2.length);
  }
}
class Limiter {
  constructor(ceilDb) { this.c = dbToLin(ceilDb); this.la = Math.round(0.005 * ASR); this.bL = new Float32Array(this.la); this.bR = new Float32Array(this.la); this.p = 0; this.g = 1; this.rel = Math.exp(-1 / (0.08 * ASR)); this.pk = new Float32Array(this.la); }
  run(L, R) {
    for (let i = 0; i < L.length; i++) {
      const x = Math.max(Math.abs(L[i]), Math.abs(R[i])); this.pk[this.p] = x; let mx = 0; for (let k = 0; k < this.la; k += 4) if (this.pk[k] > mx) mx = this.pk[k];
      const want = mx > this.c ? this.c / mx : 1; this.g = want < this.g ? want : this.rel * this.g + (1 - this.rel) * want;
      const oL = this.bL[this.p], oR = this.bR[this.p]; this.bL[this.p] = L[i]; this.bR[this.p] = R[i]; this.p = (this.p + 1) % this.la;
      L[i] = clamp(oL * this.g, -this.c, this.c); R[i] = clamp(oR * this.g, -this.c, this.c);
    }
  }
}

/* ---- o-export.js ---- */
/* ================= EKSPOR: sampai 4K, H.264 / HEVC / AV1 / VP9 + audio AAC / Opus ================= */
let EXPORTING = false, EXP_CANCEL = false;
const yieldNow = () => new Promise(r => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
const CODECS = [
  { id: 'avc', n: 'H.264 (paling kompatibel)', mux: 'avc', str: (w, h, f) => w * h > 2228224 ? (f > 30 ? 'avc1.640034' : 'avc1.640033') : w * h > 921600 ? (f > 30 ? 'avc1.64002A' : 'avc1.640028') : 'avc1.64001F', ext: { avc: { format: 'avc' } } },
  { id: 'hevc', n: 'HEVC / H.265 (file lebih kecil)', mux: 'hevc', str: (w, h, f) => w * h > 2228224 ? (f > 30 ? 'hvc1.1.6.L156.B0' : 'hvc1.1.6.L153.B0') : 'hvc1.1.6.L123.B0', ext: { hevc: { format: 'hevc' } } },
  { id: 'av1', n: 'AV1 (modern, efisien)', mux: 'av1', str: (w, h, f) => w * h > 2228224 ? 'av01.0.12M.08' : 'av01.0.08M.08', ext: {} },
  { id: 'vp9', n: 'VP9', mux: 'vp9', str: () => 'vp09.00.51.08', ext: {} }
];
const QUAL = { std: { n: 'Standar', bpp: 0.07 }, high: { n: 'Tinggi', bpp: 0.12 }, max: { n: 'Maksimal (kualitas master)', bpp: 0.2 } };
function exportSizes() {
  const ar = P.w / P.h, out = [], add = (n, short) => { let w, h; if (ar >= 1) { h = short; w = Math.round(short * ar / 2) * 2; } else { w = short; h = Math.round(short / ar / 2) * 2; } if (!out.find(o => o.w === w && o.h === h)) out.push({ n, w, h }); };
  out.push({ n: 'Sesuai proyek', w: P.w, h: P.h });
  add('720p HD', 720); add('1080p Full HD', 1080); add('1440p 2K', 1440); add('2160p 4K Ultra HD', 2160);
  return out;
}
async function codecSupport(w, h, fps) {
  const res = {};
  if (!window.VideoEncoder) return res;
  for (const c of CODECS) {
    const cfg = Object.assign({ codec: c.str(w, h, fps), width: w, height: h, bitrate: 2e7, framerate: fps }, c.ext);
    try { const s = await VideoEncoder.isConfigSupported(cfg); res[c.id] = !!(s && s.supported); } catch (e) { res[c.id] = false; }
  }
  return res;
}
async function openExport() {
  if (!P.clips.length) { toast('Timeline masih kosong', true); return; }
  if (!window.VideoEncoder || !window.VideoFrame) { modal('Ekspor belum didukung', '<p>Browser ini belum mendukung WebCodecs untuk membuat video. Gunakan <b>Chrome</b> atau <b>Edge</b> terbaru (laptop/Android), atau <b>Safari 16.4+</b> (iPhone/iPad/Mac).</p>', '<button data-x>Tutup</button>'); return; }
  const off = P.media.filter(m => m.offline && P.clips.some(c => c.media === m.id));
  if (off.length) { toast('Hubungkan ulang media yang hilang dulu: ' + off.map(m => m.name).join(', '), true); return; }
  pause();
  const sizes = exportSizes(), def = sizes.find(s => Math.min(s.w, s.h) === Math.min(P.w, P.h)) || sizes[0];
  const d = modal('Ekspor Video', `
    <div class="vs-row"><label>Resolusi</label><select id="vx-res">${sizes.map((s, i) => `<option value="${i}"${s === def ? ' selected' : ''}>${s.n} \u2014 ${s.w}\u00d7${s.h}</option>`).join('')}</select></div>
    <div class="vs-row"><label>Frame rate</label><select id="vx-fps">${FPS_LIST.map(f => `<option value="${f}"${f === P.fps ? ' selected' : ''}>${String(f).replace('.', ',')} fps</option>`).join('')}</select></div>
    <div class="vs-row"><label>Codec</label><select id="vx-codec"></select></div>
    <div class="vs-row"><label>Kualitas</label><select id="vx-q">${Object.keys(QUAL).map(k => `<option value="${k}"${k === 'high' ? ' selected' : ''}>${QUAL[k].n}</option>`).join('')}</select></div>
    <div class="vs-note" id="vx-info"></div>
    <div class="vs-note">Tips: biarkan layar tetap menyala & tab ini tetap terbuka selama ekspor. Laptop/HP dengan GPU lebih cepat.</div>
    <div id="vx-run" hidden><div class="vs-prog"><i id="vx-bar"></i></div><div id="vx-stat" class="vs-note"></div></div>
    <div id="vx-done" hidden></div>`,
    `<button data-x id="vx-cancel">Batal</button><button class="vs-go" id="vx-go">${ico('export')} Mulai Ekspor</button>`, { sticky: true, onClose: () => { EXP_CANCEL = true; } });
  const upd = async () => {
    const s = sizes[+d.$('#vx-res').value], f = +d.$('#vx-fps').value; const sup = await codecSupport(s.w, s.h, f);
    const sel = d.$('#vx-codec'), prev = sel.value; sel.innerHTML = CODECS.map(c => `<option value="${c.id}"${sup[c.id] ? '' : ' disabled'}>${c.n}${sup[c.id] ? '' : ' (tidak didukung)'}</option>`).join('');
    const first = CODECS.find(c => sup[c.id]); sel.value = prev && sup[prev] ? prev : first ? first.id : '';
    const br = Math.round(s.w * s.h * f * QUAL[d.$('#vx-q').value].bpp), dur = projDur();
    d.$('#vx-info').innerHTML = first ? `Bitrate video \u00b1 <b>${(br / 1e6).toFixed(1).replace('.', ',')} Mbps</b> \u00b7 durasi ${fmtTime(dur)} \u00b7 perkiraan file <b>${fmtSize((br + 320000) / 8 * dur)}</b>` : '<span style="color:var(--warn)">Perangkat ini tidak bisa meng-encode ukuran ini. Pilih resolusi lebih kecil.</span>';
    d.$('#vx-go').disabled = !first;
  };
  ['#vx-res', '#vx-fps', '#vx-q'].forEach(s => d.$(s).addEventListener('change', upd)); await upd();
  d.$('#vx-go').onclick = async () => {
    const s = sizes[+d.$('#vx-res').value], cfg = { w: s.w, h: s.h, fps: +d.$('#vx-fps').value, codec: d.$('#vx-codec').value, q: d.$('#vx-q').value };
    d.$('#vx-go').disabled = true; ['#vx-res', '#vx-fps', '#vx-codec', '#vx-q'].forEach(x => d.$(x).disabled = true); d.$('#vx-run').hidden = false; d.$('#vx-cancel').textContent = 'Batalkan';
    try {
      const blob = await runExport(cfg, (p, msg) => { d.$('#vx-bar').style.width = (p * 100).toFixed(1) + '%'; d.$('#vx-stat').textContent = msg; });
      if (!blob) { d.$('#vx-stat').textContent = 'Ekspor dibatalkan.'; return; }
      const name = (P.name || 'video').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') + '-' + cfg.h + 'p.mp4';
      const url = URL.createObjectURL(blob);
      d.$('#vx-done').hidden = false;
      d.$('#vx-done').innerHTML = `<p style="margin:8px 0"><b>Selesai!</b> ${fmtSize(blob.size)} \u00b7 ${cfg.w}\u00d7${cfg.h} \u00b7 ${String(cfg.fps).replace('.', ',')} fps</p><div class="vs-row"><a class="vs-go" href="${url}" download="${esc(name)}" style="display:inline-flex;align-items:center;gap:6px;padding:9px 14px;border-radius:9px;color:#fff;text-decoration:none">${ico('export')} Unduh MP4</a>${navigator.canShare ? '<button id="vx-share">Bagikan / Simpan ke Galeri</button>' : ''}</div>`;
      const sh = d.$('#vx-share'); if (sh) sh.onclick = async () => { try { const f = new File([blob], name, { type: 'video/mp4' }); if (navigator.canShare({ files: [f] })) await navigator.share({ files: [f], title: name }); else toast('Berbagi file tidak didukung, gunakan tombol Unduh', true); } catch (e) {} };
      d.$('#vx-cancel').textContent = 'Tutup'; d.$('#vx-run').hidden = true;
      try { const a = d.$('#vx-done a'); a.click(); } catch (e) {}
    } catch (e) { console.error(e); d.$('#vx-stat').innerHTML = '<span style="color:#ff8a8a">Gagal: ' + esc(e.message || e) + '</span>'; d.$('#vx-cancel').textContent = 'Tutup'; }
  };
}
class OutWriter {
  constructor() { this.parts = []; this.end = 0; this.patches = []; }
  write(data, pos) {
    data = new Uint8Array(data);
    if (pos === this.end) { this.parts.push({ pos, len: data.byteLength, d: this.parts.length < 2 ? data : new Blob([data]) }); this.end += data.byteLength; return; }
    if (pos < this.end) { this.patches.push({ pos, data: data.slice() }); if (pos + data.byteLength > this.end) { const extra = data.subarray(this.end - pos); this.parts.push({ pos: this.end, len: extra.byteLength, d: new Blob([extra]) }); this.end += extra.byteLength; } return; }
    const gap = pos - this.end; this.parts.push({ pos: this.end, len: gap, d: new Blob([new Uint8Array(gap)]) }); this.end = pos; this.write(data, pos);
  }
  async blob() {
    for (const p of this.patches) {
      for (const part of this.parts) {
        const a = Math.max(p.pos, part.pos), b = Math.min(p.pos + p.data.byteLength, part.pos + part.len); if (a >= b) continue;
        if (part.d instanceof Blob) part.d = new Uint8Array(await part.d.arrayBuffer());
        part.d.set(p.data.subarray(a - p.pos, b - p.pos), a - part.pos);
      }
    }
    return new Blob(this.parts.map(p => p.d), { type: 'video/mp4' });
  }
}
const STAT = { dec: 0, ren: 0, enc: 0, n: 0 };
async function runExport(cfg, prog) {
  STAT.dec = STAT.ren = STAT.enc = STAT.n = 0;
  EXPORTING = true; EXP_CANCEL = false; pause();
  let wake = null; try { if (navigator.wakeLock) wake = await navigator.wakeLock.request('screen'); } catch (e) {}
  const srcs = new Map(), cleanup = [];
  const { w: W, h: H, fps } = cfg, dur = projDur(), N = Math.max(1, Math.ceil(dur * fps - 1e-6));
  try {
    await loadScript(LIB.muxer, 'Mp4Muxer');
    /* font */
    prog(0, 'Menyiapkan font & media\u2026');
    await Promise.all(P.clips.filter(c => c.kind === 'text').map(c => loadFont(c.tx.font, c.tx.wt)));
    TXT_CACHE.clear();
    /* audio */
    const mixer = new AudioMixer(); cleanup.push(() => mixer.close());
    let aCodec = null, aChunks = [], aEnc = null;
    if (mixer.active) {
      for (const c of [{ id: 'aac', s: 'mp4a.40.2', br: 320000 }, { id: 'opus', s: 'opus', br: 256000 }]) { try { const s = await AudioEncoder.isConfigSupported({ codec: c.s, sampleRate: ASR, numberOfChannels: 2, bitrate: c.br }); if (s.supported) { aCodec = c; break; } } catch (e) {} }
      if (!aCodec) toast('Encoder audio tidak tersedia di perangkat ini, video diekspor tanpa suara.', true);
    }
    if (aCodec) {
      const BS = 4800 * 4; let gain = dbToLin(P.master.vol || 0);
      if (P.master.loud) {
        const meter = new LoudMeter();
        for (let t = 0; t < dur; t += BS / ASR) { if (EXP_CANCEL) return null; const [L, R] = await mixer.block(t, BS); for (let i = 0; i < L.length; i++) { L[i] *= gain; R[i] *= gain; } meter.push(L, R); prog(0.1 * t / dur, 'Mengukur kenyaringan audio\u2026 ' + Math.round(t / dur * 100) + '%'); }
        const lu = meter.lufs(); if (isFinite(lu)) gain *= dbToLin(clamp(P.master.loud - lu, -30, 24));
        mixer.close(); mixer.items.forEach(it => it.cur = new PCMCursor(mediaById(it.c.media))); mixer.items.forEach(it => it.f.forEach(f => f.z = [[0, 0], [0, 0]]));
      }
      aEnc = new AudioEncoder({ output: (ch, meta) => aChunks.push([ch, meta]), error: e => console.error(e) });
      aEnc.configure({ codec: aCodec.s, sampleRate: ASR, numberOfChannels: 2, bitrate: aCodec.br });
      const lim = P.master.lim ? new Limiter(-1.2) : null; let ts = 0;
      for (let t = 0; t < dur; t += BS / ASR) {
        if (EXP_CANCEL) return null;
        const n = Math.min(BS, Math.max(1, Math.round((dur - t) * ASR)));
        const [L, R] = await mixer.block(t, n); for (let i = 0; i < n; i++) { L[i] *= gain; R[i] *= gain; }
        if (lim) lim.run(L, R);
        const buf = new Float32Array(n * 2); buf.set(L, 0); buf.set(R, n);
        const ad = new AudioData({ format: 'f32-planar', sampleRate: ASR, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round(ts * 1e6 / ASR), data: buf }); aEnc.encode(ad); ad.close(); ts += n;
        while (aEnc.encodeQueueSize > 20) await sleep(1);
        prog(0.1 + 0.1 * t / dur, 'Merender audio\u2026 ' + Math.round(t / dur * 100) + '%');
      }
      await aEnc.flush(); aEnc.close(); aEnc = null; mixer.close();
    }
    /* sumber bingkai video */
    const fsFor = c => { let s = srcs.get(c.id); if (!s) { const m = mediaById(c.media); s = makeFrameSource(m); srcs.set(c.id, s); } return s; };
    const frames = new Map(); let useBitmap = false;
    const exportSrc = (c, t) => {
      if (c.kind === 'text') return renderTextCanvas(c, t - c.start, W, H);
      const m = c.media ? mediaById(c.media) : null; if (!m) return null;
      if (c.kind === 'image') return imageSrc(m);
      const f = frames.get(c.id); if (!f) return null;
      if (f.half) return { img: f, w: m.w, h: m.h, iw: f.w, ih: f.h, rot: 0, key: 'x:' + c.id, live: f.ver };
      const isEl = f instanceof HTMLVideoElement, rot = isEl ? 0 : (m.rot || 0);
      const iw = isEl ? f.videoWidth : (f.displayWidth || f.codedWidth || f.width), ih = isEl ? f.videoHeight : (f.displayHeight || f.codedHeight || f.height);
      return { img: f, w: m.w, h: m.h, iw, ih, rot, key: 'x:' + c.id, live: true };
    };
    const cdef = CODECS.find(c => c.id === cfg.codec), br = Math.round(W * H * fps * QUAL[cfg.q].bpp), kfEvery = Math.max(1, Math.round(fps * 2));
    let out, mux, enc, chunks, encErr, ai;
    const pushAudio = upTo => { if (!mux || !mux._a) return; while (ai < aChunks.length && aChunks[ai][0].timestamp <= upTo) { mux.addAudioChunk(aChunks[ai][0], aChunks[ai][1]); ai++; } };
    const setup = accel => {
      out = new OutWriter(); chunks = 0; encErr = null; ai = 0;
      /* catatan: frameRate tidak diisi agar fps desimal (23,976 / 29,97 / 59,94) tetap valid; waktu tiap bingkai diambil dari timestamp */
      const muxOpt = { target: new Mp4Muxer.StreamTarget({ onData: (d, p) => out.write(d, p), chunked: true, chunkSize: 8 * 1048576 }), video: { codec: cdef.mux, width: W, height: H }, fastStart: false, firstTimestampBehavior: 'offset' };
      if (aCodec && aChunks.length) muxOpt.audio = { codec: aCodec.id, numberOfChannels: 2, sampleRate: ASR };
      mux = new Mp4Muxer.Muxer(muxOpt); mux._a = !!muxOpt.audio;
      enc = new VideoEncoder({ output: (ch, meta) => { chunks++; pushAudio(ch.timestamp); mux.addVideoChunk(ch, meta); }, error: e => { encErr = e; } });
      enc.configure(Object.assign({ codec: cdef.str(W, H, fps), width: W, height: H, bitrate: br, framerate: fps, bitrateMode: 'variable', latencyMode: 'quality', hardwareAcceleration: accel }, cdef.ext));
    };
    cleanup.push(() => { try { if (enc && enc.state !== 'closed') enc.close(); } catch (e) {} });
    const waitQueue = () => new Promise(res => { if (enc.encodeQueueSize <= 3) return res(); const done = () => { enc.removeEventListener && enc.removeEventListener('dequeue', done); res(); }; if (enc.addEventListener) enc.addEventListener('dequeue', done); setTimeout(done, 50); });
    let accel = 'no-preference', tries = 0;
    setup(accel);
    const t0 = performance.now();
    for (let i = 0; i < N; i++) {
      if (EXP_CANCEL) return null;
      if (encErr || (enc && enc.state === 'closed')) {
        /* encoder perangkat keras gagal: ulang otomatis dengan encoder software */
        if (chunks < 3 && tries < 1 && i < fps * 3) { tries++; accel = 'prefer-software'; try { enc.close(); } catch (e) {} prog(0.2, 'Encoder GPU gagal, beralih ke encoder software\u2026'); setup(accel); i = -1; continue; }
        throw encErr || new Error('Encoder berhenti');
      }
      const t = i / fps;
      const need = []; visualStack(t).forEach(it => { [it.c, it.a, it.b].forEach(c => { if (c && c.kind === 'video') need.push(c); }); });
      frames.forEach(f => { if (f && f.close && useBitmap) f.close(); }); frames.clear();
      const tA = performance.now();
      for (const c of need) {
        const lt = clamp(t - c.start, 0, clipDur(c) - 1e-6), st = srcTime(c, lt);
        let f = await fsFor(c).frameAt(st);
        if (useBitmap && f && !f.half && !(f instanceof HTMLVideoElement)) f = await createImageBitmap(f);
        frames.set(c.id, f);
      }
      const tB = performance.now(); STAT.dec += tB - tA;
      let r;
      try { r = composeFrame(t, W, H, exportSrc, { frame: i }); }
      catch (e) { if (!useBitmap) { useBitmap = true; i--; continue; } throw e; }
      outputFrame(r.tex, W, H, { export: true, frame: i });
      const vf = new VideoFrame(GLR.cv, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
      const tC = performance.now(); STAT.ren += tC - tB;
      try { enc.encode(vf, { keyFrame: i % kfEvery === 0 }); } catch (e) { encErr = encErr || e; }
      vf.close();
      while (enc.state === 'configured' && enc.encodeQueueSize > 3 && !encErr) await waitQueue();
      STAT.enc += performance.now() - tC; STAT.n++;
      if (i % 3 === 0 || i === N - 1) {
        const el = (performance.now() - t0) / 1000, per = el / (i + 1), eta = per * (N - i - 1);
        prog(0.2 + 0.8 * (i + 1) / N, `Bingkai ${i + 1}/${N} \u00b7 ${(1 / per).toFixed(1).replace('.', ',')} fps render \u00b7 sisa \u00b1 ${fmtTime(eta)}${accel === 'prefer-software' ? ' \u00b7 encoder software' : ''}`);
        await yieldNow();
      }
    }
    await enc.flush(); if (encErr) throw encErr; enc.close();
    pushAudio(Infinity);
    mux.finalize();
    prog(1, 'Menyusun file MP4\u2026');
    return await out.blob();
  } finally {
    srcs.forEach(s => { try { s.close(); } catch (e) {} });
    cleanup.forEach(f => { try { f(); } catch (e) {} });
    for (const k of Array.from(GLR.tex.keys())) if (/^x:/.test(k)) dropTex(k);
    TXT_CACHE.clear();
    if (wake) try { wake.release(); } catch (e) {}
    EXPORTING = false; layoutCanvas(); requestRender();
  }
}
async function exportStill() {
  pause(); const W = P.w, H = P.h;
  const r = composeFrame(PH, W, H, previewSrc, {}); outputFrame(r.tex, W, H, { export: true });
  const b = await new Promise(res => GLR.cv.toBlob(res, 'image/png'));
  const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = (P.name || 'frame').replace(/[^\w\- ]+/g, '') + '-' + fmtTime(PH).replace(/:/g, '') + '.png'; a.click();
  TXT_CACHE.clear(); layoutCanvas(); requestRender(); toast('Bingkai disimpan sebagai PNG');
}

/* ---- p-init.js ---- */
/* ================= INISIALISASI & AKSI ================= */
function renderAll() {
  if (!P) return;
  $('#vs-name').value = P.name;
  $('#vs-stagemsg').hidden = P.clips.length > 0;
  A.classList.toggle('vs-narrow', NARROW());
  if (MODE === 'color') renderColor(); else renderTimeline();
  renderInspector(); renderLib(); renderMNav(); updTime(); $$('input[type=range]').forEach(fillRange);
  OVK = ''; requestRender();
}
function updTime() { const t = $('#vs-time'); if (t && P) t.innerHTML = fmtTime(PH, P.fps) + ' <span>/ ' + fmtTime(projDur(), P.fps) + '</span>'; }
/* navigasi bawah HP */
function renderMNav() {
  const N = $('#vs-mnav'); if (!N) return; const c = selClip();
  const b = (a, i, n, cls) => `<button data-a="${a}"${cls ? ' class="' + cls + '"' : ''}>${ico(i)}${n}</button>`;
  if (MODE === 'color') { N.innerHTML = b('modeEdit', 'back', 'Kembali') + b('scopes', 'color', 'Scope') + b('split2', 'tr', 'Banding'); return; }
  if (c) N.innerHTML = b('deselect', 'back', 'Selesai') + b('editClip', 'canvas', 'Edit') + (c.g ? b('modeColor', 'color', 'Warna') + b('libFlt', 'drop', 'Filter') : '') + b('split', 'split', 'Potong') + (isTimed(c) ? b('speedTab', 'speed', 'Kecepatan') : '') + (c.p ? b('animTab', 'fx', 'Animasi') : '') + (c.au ? b('audioTab', 'audio', 'Audio') : '') + b('kfAll', 'key', 'Keyframe') + b('dup', 'dup', 'Duplikat') + (c.kind === 'video' ? b('freeze', 'freeze', 'Bekukan') + b('detach', 'detach', 'Pisah audio') : '') + b('delete', 'del', 'Hapus', 'danger');
  else N.innerHTML = b('libMedia', 'media', 'Media') + b('libFlt', 'drop', 'Filter') + b('libText', 'text', 'Teks') + b('libFx', 'fx', 'Efek') + b('libTrans', 'tr', 'Transisi') + b('libAudio', 'audio', 'Audio') + b('libCanvas', 'canvas', 'Kanvas') + b('modeColor', 'color', 'Warna') + b('projects', 'folder', 'Proyek');
}
const ACT = {
  undo: () => { undo(); renderAll(); }, redo: () => { redo(); renderAll(); },
  play: () => togglePlay(), prevFrame: () => stepFrame(-1), nextFrame: () => stepFrame(1), toStart: () => { pause(); seek(0); placePlayhead(true); }, toEnd: () => { pause(); seek(projDur()); placePlayhead(true); },
  import: () => $('#vs-file').click(), importAudio: () => $('#vs-afile').click(), importFont: () => $('#vs-ffile').click(), importLut: () => $('#vs-lfile').click(),
  full: () => { const on = !A.classList.contains('vs-full'); A.classList.toggle('vs-full', on); document.documentElement.classList.toggle('vs-noscroll', on); setTimeout(() => { layoutCanvas(); renderTimeline(); }, 60); },
  inspect: () => openInspect(), closeSheet: () => closeSheets(), deselect: () => { SEL = null; renderAll(); closeSheets(); },
  split: () => actSplit(), delete: () => actDelete(), dup: () => actDup(), freeze: () => actFreeze(), detach: () => actDetach(), kfAll: () => actKfAll(), closeGap: () => actCloseGap(),
  speedTab: () => { const c = selClip(); if (!c || !isTimed(c)) { toast('Pilih klip video/audio', true); return; } INSPTAB = 'speed'; openInsp(); },
  animTab: () => { INSPTAB = 'anim'; openInsp(); }, audioTab: () => { INSPTAB = 'audio'; openInsp(); }, editClip: () => { const c = selClip(); INSPTAB = inspTabsFor(c)[0]; openInsp(); },
  snap: b => { TL.snap = !TL.snap; b.classList.toggle('on', TL.snap); }, zin: () => zoomTL(1.4), zout: () => zoomTL(1 / 1.4), zfit: () => zoomFit(),
  addVTrack: () => { addTrack('video'); commit('Trek video'); renderTimeline(); }, addATrack: () => { addTrack('audio'); commit('Trek audio'); renderTimeline(); },
  libMedia: () => openLib('media'), libText: () => openLib('text'), libFx: () => openLib('fx'), libTrans: () => openLib('trans'), libAudio: () => openLib('audio'), libCanvas: () => openLib('canvas'),
  modeColor: () => setMode('color'), modeEdit: () => setMode('edit'), scopes: () => { renderColorSide(); $('#vs-insp').classList.add('open'); },
  addText: () => { addTextClip(null); closeSheets(); }, export: () => openExport(), projects: () => openProjects(),
  split2: b => { PB.split = PB.split > 0 ? 0 : 0.5; const s = $('#vs-splitv'); if (s) s.value = PB.split; $('#vs-splitbtn').classList.toggle('on', PB.split > 0); requestRender(); },
  resetTf: () => { const c = selClip(); if (!c) return; ['x', 'y', 'rot', 'flipH', 'flipV'].forEach(k => c.p[k] = 0); c.p.scale = 100; c.p.opacity = 100; ['p.x', 'p.y', 'p.scale', 'p.rot', 'p.opacity'].forEach(k => delete c.kf[k]); commit('Reset transformasi'); renderAll(); },
  spNormal: () => { const c = selClip(); if (c && c.ramp) { setRamp(c, null); commit('Kecepatan konstan'); renderAll(); } },
  spCurve: () => { const c = selClip(); if (c && !c.ramp) { setRamp(c, deep(RAMPS.montage)); commit('Speed ramp'); renderAll(); } },
  pickKey: () => { const c = selClip(); startPick(rgb => { c.p.key = 1; c.p.keyC = '#' + rgb.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join(''); commit('Warna kunci'); renderInspector(); requestRender(); }, 'Ketuk warna latar (hijau/biru) di layar'); },
  pickQual: () => { const c = selClip(); const n = c && c.g.nodes[CNODE]; if (!n) return; startPick(rgb => { const [hh, s, v] = rgbToHsv(rgb[0], rgb[1], rgb[2]); const l = .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2]; Object.assign(n, { ql: 1, qh: hh, qhw: s < 0.12 ? 0.5 : 0.06, qs0: clamp(s - 0.25, 0, 1), qs1: clamp(s + 0.35, 0, 1), ql0: clamp(l - 0.3, 0, 1), ql1: clamp(l + 0.3, 0, 1), qsoft: 0.08 }); PB.showMask = CNODE + 1; commit('Qualifier'); renderColor(); requestRender(); toast('Area warna dipilih. Tekan "Lihat mask" untuk mematikan tampilan mask.'); }, 'Ketuk warna/objek yang ingin dikoreksi'); },
  showMask: b => { PB.showMask = PB.showMask ? 0 : CNODE + 1; b.classList.toggle('on', !!PB.showMask); requestRender(); },
  addNode: () => { const c = selClip(); if (!c || !c.g) return; if (c.g.nodes.length >= 4) return; c.g.nodes.push(defNode()); CNODE = c.g.nodes.length - 1; commit('Node baru'); renderColor(); requestRender(); },
  delNode: () => { const c = selClip(); if (!c) return; c.g.nodes.splice(CNODE, 1); for (const k in c.kf) if (k.startsWith('g.nodes.')) delete c.kf[k]; CNODE = -1; PB.showMask = 0; commit('Hapus node'); renderColor(); requestRender(); },
  cvReset: () => { const c = selClip(); if (!c) return; if (/^(y|r|g|b)$/.test(CCURVE)) c.g.cv[CCURVE] = null; else c.g[CCURVE] = null; commit('Reset kurva'); renderColor(); requestRender(); },
  noLut: () => { const c = selClip(); c.g.lut = null; commit('Lepas LUT'); renderColor(); requestRender(); },
  copyGrade: () => { const c = selClip(); GRADE_CB = deep(c.g); toast('Grade disalin'); renderColor(); },
  pasteGrade: () => { const c = selClip(); if (!GRADE_CB) return; c.g = deep(GRADE_CB); commit('Tempel grade'); renderColor(); requestRender(); },
  pasteAll: () => { if (!GRADE_CB) return; gradeClips().forEach(c => c.g = deep(GRADE_CB)); commit('Tempel grade ke semua'); renderColor(); requestRender(); toast('Grade diterapkan ke semua klip'); },
  resetGrade: () => { const c = selClip(); c.g = defG(); commit('Reset grade'); renderColor(); requestRender(); },
  autoColor: () => autoColor(),
  stabAnalyze: async () => { const c = selClip(); if (!c || c.kind !== 'video') return; pause(); try { await analyzeStab(c); c.p.stab = 1; commit('Stabilizer'); renderInspector(); requestRender(); toast('Stabilizer aktif. Atur kehalusan sesuai selera.'); } catch (e) { setBusy(null); toast(e.message, true); } },
  trackFwd: () => runTrack(1), trackBack: () => runTrack(-1),
  trackClear: () => { const c = selClip(); if (!c) return; ['cx', 'cy'].forEach(k => { delete c.kf['g.nodes.' + CNODE + '.' + k]; }); commit('Hapus tracking'); renderColor(); requestRender(); },
  fltAll: () => { const c = filterTarget(); if (!c || !c.flt) return; P.clips.forEach(x => { if (x.g) x.flt = deep(c.flt); }); commit('Filter ke semua'); renderAll(); toast('Filter dipasang di semua klip'); },
  libFlt: () => openLib('flt'),
  importDavinci: () => { DV_MODE = 'exact'; $('#vs-dvfile').click(); },
  dvExact: () => { const c = selClip(); if (!c || !c.g) { toast('Pilih klip video/foto dulu', true); return; } pause(); DV_MODE = 'exact'; $('#vs-dvfile').click(); },
  dvApprox: () => { const c = selClip(); if (!c || !c.g) { toast('Pilih klip video/foto dulu', true); return; } DV_MODE = 'approx'; $('#vs-dvfile').click(); },
  trAll: () => { const d = +($('#vs-trdur') || { value: 0.8 }).value; const id = (TRANS.find(t => t.id === (LAST_TR || 'dissolve')) || TRANS[0]).id; let n = 0; P.clips.forEach(c => { if (c.kind !== 'audio' && c.kind !== 'fx' && prevOnTrack(c)) { c.tr = { type: id, dur: d }; n++; } }); commit('Transisi semua'); renderAll(); toast(n + ' transisi dipasang'); },
  trNone: () => { P.clips.forEach(c => c.tr = null); commit('Hapus transisi'); renderAll(); },
  customCanvas: () => { const w = clamp(Math.round(+$('#vs-cw').value / 2) * 2, 16, 8192), h = clamp(Math.round(+$('#vs-ch').value / 2) * 2, 16, 8192); setCanvas(w, h); },
  fitAll: () => { P.clips.forEach(c => { if (c.p && c.kind !== 'text') c.p.fit = 'fit'; }); commit('Fit semua'); requestRender(); }, fillAll: () => { P.clips.forEach(c => { if (c.p && c.kind !== 'text') c.p.fit = 'fill'; }); commit('Fill semua'); requestRender(); },
  still: () => exportStill()
};
let LAST_TR = 'dissolve';
async function runTrack(dir) { const c = selClip(); if (!c || c.kind !== 'video') { toast('Tracking hanya untuk klip video', true); return; } pause(); TRACK_CANCEL = false; try { const n = await trackWindow(c, CNODE, dir); commit('Tracking window'); renderColor(); requestRender(); toast('Window dilacak di ' + n + ' bingkai. Putar video untuk melihat hasilnya.'); } catch (e) { setBusy(null); toast(e.message, true); } }
function setCanvas(w, h) { P.w = w; P.h = h; P._canvasSet = 1; TXT_CACHE.clear(); commit('Ukuran kanvas'); BUS.emit('canvas'); renderLib(); }
/* ---------- proyek ---------- */
async function openProjects() {
  await saveProject();
  const list = await listProjects();
  const d = modal('Proyek Saya', `<button class="vs-go" data-np style="width:100%;margin-bottom:10px">${ico('plus')} Proyek baru</button><div class="vs-plist">${list.map(p => `<div class="vs-pitem${p.id === P.id ? ' cur' : ''}"><div><b>${esc(p.name)}</b><small>${p.w}\u00d7${p.h} \u00b7 ${fmtTime(p.dur || 0)} \u00b7 ${p.n || 0} klip \u00b7 ${new Date(p.updated).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</small></div>${p.id === P.id ? '<small>Dibuka</small>' : `<button data-op="${p.id}">Buka</button>`}<button class="vs-ib" data-dp="${p.id}" title="Hapus">${ico('del')}</button></div>`).join('')}</div>
  <div class="vs-row" style="margin-top:12px"><button data-a2="still">${ico('media')} Simpan bingkai saat ini (PNG)</button></div>`, '');
  d.el.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.np != null) { d.close(); newProjectDlg(); }
    if (b.dataset.op) { d.close(); await switchProject(b.dataset.op); }
    if (b.dataset.dp) { if (b.dataset.dp === P.id) { toast('Proyek yang sedang dibuka tidak bisa dihapus', true); return; } if (await confirmDlg('Hapus proyek ini beserta media tersimpannya?', 'Hapus')) { await deleteProject(b.dataset.dp); d.close(); openProjects(); } }
    if (b.dataset.a2 === 'still') { d.close(); exportStill(); }
  });
}
function newProjectDlg() {
  const d = modal('Proyek baru', `<input type="text" id="vn-name" value="Proyek ${new Date().toLocaleDateString('id-ID')}" style="margin-bottom:10px"><div class="vs-presets">${CANVAS_PRESETS.map((c, i) => { const s = 34 / Math.max(c.w, c.h); return `<button data-pi="${i}"><i style="width:${Math.round(c.w * s)}px;height:${Math.round(c.h * s)}px"></i><b>${c.k}</b><small>${c.n}</small></button>`; }).join('')}</div><div class="vs-note">Ukuran bisa diubah kapan saja di menu Kanvas. Bila dibiarkan, ukuran mengikuti video pertama.</div>`, '');
  d.el.addEventListener('click', async e => { const b = e.target.closest('[data-pi]'); if (!b) return; const c = CANVAS_PRESETS[+b.dataset.pi]; await saveProject(); P = newProject(d.$('#vn-name').value.trim() || 'Proyek Baru', c.w, c.h, 30); P._canvasSet = 1; resetHist(); SEL = null; PH = 0; ELS.forEach((e2, id) => dropEl(id)); d.close(); BUS.emit('canvas'); renderAll(); saveProject(); });
}
async function switchProject(id) {
  setBusy('Membuka proyek\u2026'); pause(); ELS.forEach((e, k) => dropEl(k));
  try { const miss = await loadProject(id); renderAll(); if (miss.length) relinkDlg(miss); }
  catch (e) { toast(e.message, true); }
  setBusy(null);
}
function relinkDlg(miss) {
  const d = modal('Hubungkan ulang media', `<p class="vs-note" style="margin-top:0">File besar tidak disimpan di browser. Pilih lagi file aslinya dari perangkat agar proyek bisa diputar & diekspor.</p><div class="vs-plist">${miss.map(m => `<div class="vs-pitem"><div><b>${esc(m.name)}</b><small>${fmtSize(m.size)} \u00b7 ${fmtDur(m.dur)}</small></div><button data-rl="${m.id}">Pilih file</button></div>`).join('')}</div>`, '<button data-x>Nanti saja</button>');
  d.el.addEventListener('click', e => { const b = e.target.closest('[data-rl]'); if (b) relink(b.dataset.rl, () => { b.textContent = '\u2713 Terhubung'; b.disabled = true; }); });
}
function relink(id, done) {
  const inp = $('#vs-relink'); inp.value = ''; inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return; const old = mediaById(id);
    if (old && Math.abs(f.size - old.size) > 1024 && !(await confirmDlg('Ukuran file berbeda dengan aslinya. Tetap pakai file ini?', 'Pakai'))) return;
    setBusy('Menghubungkan ' + f.name + '\u2026');
    try { await addMedia(f, id); delete mediaById(id).offline; genThumbs(mediaById(id)); commit('Hubungkan ulang'); renderAll(); if (done) done(); } catch (e) { toast(e.message, true); }
    setBusy(null);
  }; inp.click();
}
/* ---------- binding ---------- */
function bindUI() {
  bindTouchSliders(A);
  A.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (b && A.contains(b) && !b.disabled) { const k = b.dataset.a; if (ACT[k]) { ACT[k](b, e); return; } }
    const m = e.target.closest('[data-mode]'); if (m) { setMode(m.dataset.mode); return; }
    const lt = e.target.closest('[data-lib]'); if (lt) { libTab(lt.dataset.lib); return; }
    const sc = e.target.closest('[data-scope]'); if (sc) { SCOPE = sc.dataset.scope; renderColorSide(); return; }
  });
  /* pustaka */
  const L = $('#vs-libbody');
  L.addEventListener('click', async e => {
    const del = e.target.closest('[data-delmedia]'); if (del) { e.stopPropagation(); const id = del.dataset.delmedia; const used = P.clips.some(c => c.media === id); if (used && !(await confirmDlg('Media ini dipakai di timeline. Hapus juga klipnya?', 'Hapus'))) return; P.clips = P.clips.filter(c => c.media !== id); P.media = P.media.filter(m => m.id !== id); pruneTracks(); DB.del('media', id).catch(() => {}); commit('Hapus media'); renderAll(); return; }
    const mc = e.target.closest('[data-media]'); if (mc) { const m = mediaById(mc.dataset.media); if (!m) return; if (m.offline) { relink(m.id); return; } addMediaToTimeline(m); closeSheets(); renderAll(); requestRender(); toast('Ditambahkan di playhead'); return; }
    const tp = e.target.closest('[data-tpl]'); if (tp) { addTextClip(TEXT_TPL[+tp.dataset.tpl]); closeSheets(); renderAll(); return; }
    const fx = e.target.closest('[data-fx]'); if (fx) { addFx(fx.dataset.fx); return; }
    const fl = e.target.closest('[data-flt]'); if (fl) { const c = filterTarget(); if (!c) { toast('Pilih klip video/foto dulu', true); return; } SEL = c.id; const id = fl.dataset.flt; c.flt = id ? { id, amt: c.flt && c.flt.amt != null ? c.flt.amt : 80 } : null; if (c.kf) delete c.kf['flt.amt']; commit(id ? 'Filter ' + FLT[id].n : 'Hapus filter'); renderLib(); renderTimeline(); renderInspector(); requestRender(); return; }
    const tr = e.target.closest('[data-tr]'); if (tr) { const c = selClip(); const d = +($('#vs-trdur') || { value: 0.8 }).value; LAST_TR = tr.dataset.tr; if (applyTrans(tr.dataset.tr, c, d)) { commit('Transisi'); renderAll(); seek(c.start - d / 2 - 0.3); placePlayhead(true); play(); } return; }
    const cvp = e.target.closest('[data-cv]'); if (cvp) { const [w, h] = cvp.dataset.cv.split('x').map(Number); setCanvas(w, h); return; }
    const fp = e.target.closest('[data-fps]'); if (fp) { P.fps = +fp.dataset.fps; commit('Frame rate'); renderLib(); renderTimeline(); return; }
  });
  L.addEventListener('dragstart', e => { const mc = e.target.closest('[data-media]'); if (mc) { e.dataTransfer.setData('text/vs-media', mc.dataset.media); e.dataTransfer.effectAllowed = 'copy'; } });
  L.addEventListener('input', e => { if (e.target.id === 'vs-bg') { P.bg = e.target.value; requestRender(); } });
  L.addEventListener('change', e => {
    if (e.target.id === 'vs-bg') commit('Warna latar');
    if (e.target.dataset.master === 'loud') { P.master.loud = +e.target.value; commit('Kenyaringan'); }
    if (e.target.dataset.master === 'lim') { P.master.lim = e.target.checked ? 1 : 0; commit('Limiter'); }
  });
  bindControls(L, () => { if (MASTER) MASTER.g.gain.value = dbToLin(P.master.vol || 0); });
  /* seret file ke pustaka */
  L.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); const z = $('#vs-dropz'); if (z) z.classList.add('hot'); } });
  L.addEventListener('dragleave', () => { const z = $('#vs-dropz'); if (z) z.classList.remove('hot'); });
  L.addEventListener('drop', e => { if (e.dataTransfer.files.length) { e.preventDefault(); importFiles(e.dataTransfer.files); } });
  $('#vs-stage').addEventListener('dragover', e => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); });
  $('#vs-stage').addEventListener('drop', e => { if (e.dataTransfer.files.length) { e.preventDefault(); importFiles(e.dataTransfer.files, { toTimeline: true }).then(() => renderAll()); } });
  /* file input */
  $('#vs-file').addEventListener('change', async e => { const fs = Array.from(e.target.files || []); e.target.value = ''; const first = !P.clips.length; const ms = await importFiles(fs); if (first && ms.length) { let t = 0; ms.forEach(m => { if (m.kind !== 'audio') { const c = addMediaToTimeline(m, t); t = clipEnd(c); } }); } closeSheets(); renderAll(); requestRender(); });
  $('#vs-afile').addEventListener('change', async e => { const fs = Array.from(e.target.files || []); e.target.value = ''; const ms = await importFiles(fs); ms.forEach(m => { if (m.kind === 'audio') addMediaToTimeline(m, PH); }); closeSheets(); renderAll(); });
  $('#vs-ffile').addEventListener('change', async e => { for (const f of Array.from(e.target.files || [])) { try { const n = await importFont(f); toast('Font "' + n + '" siap dipakai'); const c = selClip(); if (c && c.kind === 'text') { c.tx.font = n; commit('Font'); } } catch (er) { toast('Font ' + f.name + ' gagal dibaca', true); } } e.target.value = ''; renderAll(); });
  $('#vs-lfile').addEventListener('change', async e => {
    let last = null; for (const f of Array.from(e.target.files || [])) { try { const L2 = parseCube(await f.text(), f.name.replace(/\.cube$/i, '')); const id = 'L' + uid(); LUTS[id] = L2; await DB.set('luts', id, L2).catch(() => {}); last = id; toast('LUT "' + L2.name + '" diimpor'); } catch (er) { toast(f.name + ': ' + er.message, true); } }
    e.target.value = ''; const c = selClip(); if (last && c && c.g) { c.g.lut = last; c.g.lutMix = 1; commit('Pasang LUT'); } renderAll();
  });
  $('#vs-dvfile').addEventListener('change', e => { const fs = Array.from(e.target.files || []); e.target.value = ''; importDavinci(fs, DV_MODE); });
  $('#vs-name').addEventListener('change', e => { P.name = e.target.value.trim() || 'Proyek'; commit('Nama proyek'); });
  $('#vs-quality').addEventListener('change', e => { PB.quality = e.target.value; layoutCanvas(); });
  A.addEventListener('input', e => { if (e.target.id === 'vs-splitv') { PB.split = +e.target.value; $('#vs-splitbtn').classList.toggle('on', PB.split > 0); requestRender(); } });
  bindInspector(); bindRampEditor(); bindColor(); bindOverlay();
  /* pintasan keyboard */
  document.addEventListener('keydown', e => {
    if (!P || !A.isConnected || IX.on) return; const tg = e.target; if (tg && (tg.tagName === 'INPUT' && tg.type !== 'range' || tg.tagName === 'TEXTAREA' || tg.tagName === 'SELECT' || tg.isContentEditable)) return;
    if (!A.contains(document.activeElement) && document.activeElement !== document.body) return;
    const k = e.key, mod = e.ctrlKey || e.metaKey;
    if (k === ' ') { e.preventDefault(); togglePlay(); }
    else if (mod && k.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? ACT.redo() : ACT.undo(); }
    else if (mod && k.toLowerCase() === 'y') { e.preventDefault(); ACT.redo(); }
    else if (mod && k.toLowerCase() === 'd') { e.preventDefault(); actDup(); }
    else if (mod && k.toLowerCase() === 'b' || (!mod && k.toLowerCase() === 's')) { e.preventDefault(); actSplit(); }
    else if (k === 'Delete' || k === 'Backspace') { if (SEL) { e.preventDefault(); actDelete(); } }
    else if (k === 'ArrowLeft') { e.preventDefault(); stepFrame(e.shiftKey ? -P.fps : -1); placePlayhead(true); }
    else if (k === 'ArrowRight') { e.preventDefault(); stepFrame(e.shiftKey ? P.fps : 1); placePlayhead(true); }
    else if (k === 'Home') { ACT.toStart(); } else if (k === 'End') { ACT.toEnd(); }
    else if (k === '+' || k === '=') zoomTL(1.4); else if (k === '-') zoomTL(1 / 1.4);
    else if (k.toLowerCase() === 'k' && !mod) actKfAll();
    else if (k.toLowerCase() === 'f' && !mod) openInspect();
    else if (k === 'Escape') { if (A.classList.contains('vs-full')) ACT.full(); else { SEL = null; renderAll(); } }
  });
  window.addEventListener('resize', () => { clearTimeout(window.__vsrz); window.__vsrz = setTimeout(() => { A.classList.toggle('vs-narrow', NARROW()); layoutCanvas(); renderTimeline(); renderMNav(); }, 120); });
  new ResizeObserver(() => layoutCanvas()).observe($('#vs-stage'));
  window.addEventListener('beforeunload', () => { saveProject(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { saveProject(); if (PB.on) pause(); } });
}
/* ---------- event bus ---------- */
BUS.on('time', t => { updTime(); if (PB.on || !TL.drag) placePlayhead(false); clearTimeout(BUS._st); BUS._st = setTimeout(() => { syncInspector(); if ($('#vs-rampcv')) drawRamp(); }, PB.on ? 250 : 30); });
BUS.on('play', on => { const b = $('#vs-playbtn'); if (b) b.innerHTML = ico(on ? 'pause' : 'play'); OVK = ''; });
BUS.on('canvas', () => { layoutCanvas(); });
BUS.on('thumbs', id => { clearTimeout(BUS._tt); BUS._tt = setTimeout(() => { if (MODE === 'color') renderColorStrip(); else if (!TL.drag) renderTimeline(); renderMedia(); }, 200); });
BUS.on('change', lbl => { if (PB.on && AC) { clearTimeout(BUS._ar); BUS._ar = setTimeout(() => { if (PB.on) { const t = PA.on ? PA.base + (AC.currentTime - PA.at) : PH; startAudio(t); } }, 120); } const s = $('#vs-saved'); if (s) s.textContent = 'Menyimpan\u2026'; updTime(); if (lbl === 'hist' || lbl === 'load') renderAll(); else renderMNav(); });
/* ---------- mulai ---------- */
async function start() {
  const st = document.createElement('style'); st.textContent = "#vs-app{--bg:#121417;--pn:#1a1d21;--pn2:#202429;--pn3:#2a2f35;--ln:#2c3137;--ln2:#3a414a;--tx:#eceef1;--mu:#98a0aa;--a:#ff3d8b;--a2:#c2185b;--ag:linear-gradient(135deg,#c2185b,#ff4f7b);--ok:#3ccf7a;--warn:#ffb020;--vid:#2b5f8f;--img:#3c6e4c;--txt:#8a4fc9;--fx:#b0532a;--aud:#1f7a6b;position:relative;display:flex;flex-direction:column;width:100%;height:min(92vh,980px);min-height:600px;background:var(--bg);color:var(--tx);font:13px/1.4 system-ui,-apple-system,\"Segoe UI\",Roboto,Arial,sans-serif;border-radius:16px;overflow:hidden;text-align:left;box-shadow:0 24px 60px -28px rgba(0,0,0,.6);-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}#vs-app *,#vs-app *::before,#vs-app *::after{box-sizing:border-box}#vs-app [hidden]{display:none!important}#vs-app button,#vs-app select,#vs-app input,#vs-app textarea{font:inherit;color:inherit;margin:0;letter-spacing:0;text-transform:none;box-shadow:none;max-width:none;line-height:1.25}#vs-app input,#vs-app textarea{user-select:text;-webkit-user-select:text}#vs-app button{cursor:pointer;background:var(--pn2);border:1px solid var(--ln);border-radius:9px;padding:7px 11px;display:inline-flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap;min-height:32px}#vs-app button:hover{border-color:var(--ln2)}#vs-app button:disabled{opacity:.38;cursor:default}#vs-app button.on{border-color:var(--a);color:var(--a);background:rgba(255,61,139,.1)}#vs-app svg{width:16px;height:16px;stroke:currentColor;stroke-width:1.7;fill:none;stroke-linecap:round;stroke-linejoin:round;flex:0 0 auto}#vs-app select,#vs-app input[type=text],#vs-app input[type=number],#vs-app textarea{background:var(--pn2);border:1px solid var(--ln);border-radius:9px;padding:7px 9px;width:100%;outline:0;min-height:32px}#vs-app textarea{resize:vertical;min-height:70px}#vs-app select:focus,#vs-app input:focus,#vs-app textarea:focus{border-color:var(--a)}#vs-app input[type=color]{width:34px;height:30px;padding:0;border:1px solid var(--ln);border-radius:8px;background:none;cursor:pointer;flex:0 0 auto}#vs-app .vs-go{background:var(--ag);border-color:transparent;color:#fff;font-weight:700}#vs-app .vs-ib{padding:0;width:34px;height:34px;flex:0 0 auto}#vs-app.vs-full{position:fixed;inset:0;z-index:2147483000;height:auto;min-height:0;border-radius:0;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}html.vs-noscroll,html.vs-noscroll body{overflow:hidden!important}/* bar atas */#vs-app .vs-top{display:flex;align-items:center;gap:8px;padding:8px 10px;background:#0a0b0d;border-bottom:1px solid var(--ln);flex:0 0 auto;min-width:0}#vs-app .vs-logo{width:32px;height:32px;border-radius:9px;background:#c2185b;color:#fff;display:flex;align-items:center;justify-content:center;font:700 18px/1 'Mali','Comic Sans MS',cursive;flex:0 0 auto;box-shadow:inset 0 -3px 0 rgba(255,122,32,.9)}#vs-app .vs-ttl{display:flex;flex-direction:column;min-width:0;flex:1 1 auto}#vs-app .vs-ttl input{background:transparent;border:1px solid transparent;font-weight:700;font-size:14px;padding:2px 6px;min-height:0;width:100%;max-width:340px}#vs-app .vs-ttl input:hover{border-color:var(--ln)}#vs-app .vs-ttl span{font-size:11px;color:var(--mu);padding-left:7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#vs-app .vs-modes{display:flex;background:var(--pn2);border:1px solid var(--ln);border-radius:10px;padding:2px;flex:0 0 auto}#vs-app .vs-modes button{border:0;background:transparent;min-height:30px;padding:5px 12px;border-radius:8px}#vs-app .vs-modes button.on{background:var(--ag);color:#fff}#vs-app .vs-acts{display:flex;gap:6px;align-items:center;flex:0 0 auto}/* area utama */#vs-app .vs-main{flex:1 1 auto;display:flex;min-height:0;position:relative}#vs-app .vs-lib,#vs-app .vs-insp{background:var(--pn);display:flex;flex-direction:column;min-height:0;flex:0 0 auto}#vs-app .vs-lib{width:300px;border-right:1px solid var(--ln)}#vs-app .vs-insp{width:330px;border-left:1px solid var(--ln)}#vs-app .vs-tabs{display:flex;gap:2px;padding:4px 6px 0;border-bottom:1px solid var(--ln);overflow-x:auto;flex:0 0 auto;scrollbar-width:none}#vs-app .vs-tabs::-webkit-scrollbar{display:none}#vs-app .vs-tabs button{flex:1 0 auto;border:0;border-bottom:2px solid transparent;border-radius:0;background:transparent;flex-direction:column;gap:3px;padding:7px 7px 8px;font-size:11.5px;font-weight:600;color:var(--mu);min-height:0}#vs-app .vs-tabs button.on{color:#fff;background:transparent;border-bottom-color:var(--a)}#vs-app .vs-tabs button.on svg{color:var(--a)}#vs-app .vs-tabs button svg{width:18px;height:18px}#vs-app .vs-body{flex:1 1 auto;overflow-y:auto;padding:10px;min-height:0;overscroll-behavior:contain}#vs-app .vs-sec{border-top:1px solid var(--ln);margin:0 -10px;padding:0 10px 8px}#vs-app .vs-sec:first-child{border-top:0}#vs-app .vs-sec>h4{margin:0 -10px 4px;padding:11px 10px 7px;font-size:13px;letter-spacing:0;text-transform:none;color:#fff;font-weight:700;display:flex;align-items:center;gap:6px;cursor:pointer;user-select:none}#vs-app .vs-sec>h4::after{content:'';width:7px;height:7px;border-right:2px solid var(--mu);border-bottom:2px solid var(--mu);transform:rotate(45deg);margin:0 4px 3px auto;transition:transform .15s;flex:0 0 auto}#vs-app .vs-sec>h4 .sp{flex:1}#vs-app .vs-sec>h4 .sp~*{margin-right:6px}#vs-app .vs-sec.closed{padding-bottom:0}#vs-app .vs-sec.closed>h4::after{transform:rotate(-45deg)}#vs-app .vs-sec.closed>*:not(h4){display:none!important}#vs-app .vs-sec>h4 .sp{flex:1}#vs-app .vs-note{font-size:11.5px;color:var(--mu);line-height:1.45;margin:6px 0}#vs-app .vs-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(86px,1fr));gap:6px}#vs-app .vs-card{display:flex;flex-direction:column;align-items:stretch;gap:4px;padding:6px;background:var(--pn2);border:1px solid var(--ln);border-radius:10px;cursor:pointer;min-height:0;white-space:normal;text-align:left;font-size:11.5px;position:relative}#vs-app .vs-card:hover{border-color:var(--a)}#vs-app .vs-card .th{aspect-ratio:16/10;border-radius:7px;background:#000 center/cover no-repeat;display:flex;align-items:center;justify-content:center;color:var(--mu);overflow:hidden}#vs-app .vs-card .th svg{width:22px;height:22px}#vs-app .vs-card b{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}#vs-app .vs-card small{color:var(--mu);font-size:10.5px}#vs-app .vs-card .bad{color:var(--warn)}#vs-app .vs-card .x{position:absolute;top:3px;right:3px;width:22px;height:22px;min-height:0;padding:0;border-radius:6px;background:rgba(0,0,0,.6);border:0;opacity:0}#vs-app .vs-card:hover .x{opacity:1}#vs-app .vs-pgrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:4px 0}#vs-app .vs-pc{display:block;position:relative;background:#111316;border:1.5px solid transparent;border-radius:9px;padding:0;overflow:hidden;text-align:left;min-height:0;white-space:normal}#vs-app .vs-pc.on{border-color:var(--a);box-shadow:0 0 0 2px rgba(255,61,139,.25)}#vs-app .vs-pc img{display:block;width:100%;aspect-ratio:1.25;object-fit:cover;background:#22262b}#vs-app .vs-pc span{display:block;font-size:10.5px;line-height:1.25;padding:4px 5px 5px;color:#d5d9de}#vs-app .vs-fltamt{position:sticky;top:-10px;z-index:2;background:var(--pn);margin:-10px -10px 6px;padding:8px 10px 4px;border-bottom:1px solid var(--ln)}#vs-app .vs-drop{border:1.5px dashed var(--ln2);border-radius:12px;padding:16px;text-align:center;color:var(--mu);margin-bottom:10px;cursor:pointer;display:block;width:100%;background:transparent;white-space:normal;flex-direction:column}#vs-app .vs-drop b{color:var(--tx);display:block;font-size:13.5px;margin-bottom:3px}#vs-app .vs-drop.hot{border-color:var(--a);background:rgba(255,61,139,.08)}#vs-app .vs-fxc .th{background:linear-gradient(135deg,#2b2140,#40222f)}#vs-app .vs-fxc .th i{font-style:normal;font-weight:800;font-size:17px;color:#fff;opacity:.85}/* tengah: panggung */#vs-app .vs-center{flex:1 1 auto;display:flex;flex-direction:column;min-width:0;min-height:0}#vs-app #vs-stage{flex:1 1 auto;position:relative;display:flex;align-items:center;justify-content:center;background:#060708;min-height:120px;overflow:hidden}#vs-app #vs-cv{display:block;background:#000;box-shadow:0 0 0 1px #222}#vs-app #vs-ov{position:absolute;pointer-events:none}#vs-app #vs-ov .bx{position:absolute;border:1.5px solid var(--a);pointer-events:auto;touch-action:none;cursor:move;box-shadow:0 0 0 1px rgba(0,0,0,.4)}#vs-app #vs-ov .bx i{position:absolute;width:14px;height:14px;margin:-7px 0 0 -7px;background:#fff;border:2px solid var(--a);border-radius:50%;touch-action:none}#vs-app #vs-ov .bx i::before{content:\"\";position:absolute;inset:-12px}#vs-app #vs-ov .bx i[data-h=rot]{background:var(--a);border-color:#fff;cursor:grab}#vs-app #vs-ov .win{position:absolute;border:1.5px dashed #ffd400;border-radius:50%;pointer-events:auto;touch-action:none;cursor:move}#vs-app #vs-ov .win.rect{border-radius:2px}#vs-app #vs-ov .win.lin{border-radius:0;border-width:0 0 2px 0;border-style:solid}#vs-app #vs-ov .win i{position:absolute;width:14px;height:14px;margin:-7px 0 0 -7px;background:#ffd400;border:2px solid #111;border-radius:3px;touch-action:none}#vs-app #vs-ov .win i::before{content:\"\";position:absolute;inset:-12px}#vs-app .vs-stagemsg{position:absolute;inset:0;z-index:3;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:10px;color:var(--mu);text-align:center;padding:14px;pointer-events:none;background:#060708;overflow:hidden}#vs-app .vs-stagemsg[hidden]{display:none}#vs-app .vs-stagemsg b{color:var(--tx);font-size:16px;line-height:1.3;max-width:340px}#vs-app .vs-stagemsg span{font-size:12.5px;line-height:1.45;max-width:340px}#vs-app .vs-stagemsg button{pointer-events:auto}#vs-app .vs-pbar{display:flex;align-items:center;gap:6px;padding:6px 10px;border-top:1px solid var(--ln);background:var(--pn);flex:0 0 auto;min-width:0}#vs-app .vs-time{font:600 12.5px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:var(--tx);white-space:nowrap}#vs-app .vs-time span{color:var(--mu)}#vs-app .vs-pbar .sp{flex:1}#vs-app .vs-play{width:42px;height:42px;flex:0 0 auto;border-radius:50%;padding:0;background:#fff;color:#111;border:0}#vs-app .vs-play svg{width:18px;height:18px}#vs-app .vs-pbar select{width:auto;min-height:30px;padding:4px 6px;font-size:12px}/* inspector */#vs-app .vs-sl{touch-action:pan-y}#vs-app .vs-ctl{display:grid;grid-template-columns:minmax(0,1fr) 62px 28px;grid-template-areas:'l n k' 'r r r';align-items:center;gap:0 6px;margin:2px 0 6px;padding:2px 0}#vs-app .vs-ctl>label{grid-area:l;font-size:12.5px;color:#d5d9de;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#vs-app .vs-ctl>input[type=range]{grid-area:r}#vs-app .vs-ctl>input[type=number]{grid-area:n}#vs-app .vs-ctl>.vs-kf,#vs-app .vs-ctl>span{grid-area:k}#vs-app .vs-ctl input[type=number]{padding:1px 6px;min-height:24px;height:24px;font-size:12px;text-align:right;background:#111316;border-radius:6px;font-variant-numeric:tabular-nums;-moz-appearance:textfield;appearance:textfield}#vs-app .vs-ctl.chg input[type=number]{border-color:#6b3a52;color:#ff9cc4}#vs-app .vs-ctl input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}#vs-app .vs-kf{width:26px;height:26px;min-height:0;padding:0;border:0;background:transparent;color:var(--mu)}#vs-app .vs-kf svg{width:14px;height:14px}#vs-app .vs-kf.has{color:#ffcf4d}#vs-app .vs-kf.at svg{fill:#ffcf4d}#vs-app .vs-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:6px 0}#vs-app .vs-row>label{font-size:12px;color:#c9ced5;min-width:90px}#vs-app .vs-row select{flex:1;width:auto}#vs-app .vs-chips{display:flex;flex-wrap:wrap;gap:5px;margin:6px 0}#vs-app .vs-chips button{padding:5px 9px;min-height:30px;font-size:12px;border-radius:20px}#vs-app .vs-sw{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:6px 0;font-size:12.5px}#vs-app .vs-sw input{width:40px;height:22px;appearance:none;-webkit-appearance:none;background:var(--ln2);border-radius:20px;position:relative;cursor:pointer;flex:0 0 auto;margin:0}#vs-app .vs-sw input::after{content:\"\";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:left .15s}#vs-app .vs-sw input:checked{background:var(--a)}#vs-app .vs-sw input:checked::after{left:21px}#vs-app .vs-empty{color:var(--mu);text-align:center;padding:30px 12px;font-size:12.5px;line-height:1.5}#vs-app .vs-empty svg{width:32px;height:32px;display:block;margin:0 auto 8px;opacity:.6}/* slider */#vs-app input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:26px;background:transparent;cursor:pointer;margin:0;padding:0;border:0;min-height:0;touch-action:pan-y}#vs-app input[type=range]::-webkit-slider-runnable-track{height:5px;border-radius:5px;background:linear-gradient(to right,var(--ln2) var(--f0,0%),var(--a) var(--f0,0%),var(--a) var(--f1,0%),var(--ln2) var(--f1,0%))}#vs-app input[type=range]::-moz-range-track{height:5px;border-radius:5px;background:linear-gradient(to right,var(--ln2) var(--f0,0%),var(--a) var(--f0,0%),var(--a) var(--f1,0%),var(--ln2) var(--f1,0%))}#vs-app input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;background:#fff;margin-top:-6.5px;border:2px solid var(--a);box-shadow:0 1px 4px rgba(0,0,0,.5)}#vs-app input[type=range]::-moz-range-thumb{width:16px;height:16px;border-radius:50%;background:#fff;border:0}#vs-app input[type=range].vs-touch::-webkit-slider-thumb{background:var(--a);transform:scale(1.25)}@media (pointer:coarse){#vs-app input[type=range]{pointer-events:none;height:34px}#vs-app .vs-sl{cursor:ew-resize}#vs-app input[type=range]::-webkit-slider-thumb{width:24px;height:24px;margin-top:-9.5px}#vs-app .vs-ctl{min-height:40px}}/* timeline */#vs-app .vs-tl{flex:0 0 auto;height:280px;display:flex;flex-direction:column;border-top:1px solid var(--ln);background:var(--pn);position:relative;min-height:0}#vs-app .vs-tlrs{position:absolute;top:-5px;left:0;right:0;height:10px;cursor:ns-resize;z-index:5;touch-action:none}#vs-app .vs-tlrs i{display:none}#vs-app .vs-tlbar{display:flex;align-items:center;gap:4px;padding:5px 8px;border-bottom:1px solid var(--ln);overflow-x:auto;flex:0 0 auto;scrollbar-width:none}#vs-app .vs-tlbar::-webkit-scrollbar{display:none}#vs-app .vs-tlbar button{min-height:30px;padding:4px 8px;font-size:12px;gap:5px}#vs-app .vs-tlbar .sep{width:1px;height:20px;background:var(--ln);flex:0 0 auto;margin:0 3px}#vs-app .vs-tlbar .sp{flex:1}#vs-app .vs-tlview{flex:1 1 auto;position:relative;min-height:0}#vs-app .vs-sc{position:absolute;inset:0;overflow:auto;overscroll-behavior:contain;touch-action:pan-x pan-y;scrollbar-width:thin}#vs-app .vs-ruler{position:sticky;top:0;height:24px;z-index:4;background:var(--pn);border-bottom:1px solid var(--ln);touch-action:none;cursor:pointer}#vs-app .vs-ruler canvas{position:absolute;top:0;height:24px}#vs-app .vs-rows{position:relative}#vs-app .vs-trk{position:relative;border-bottom:1px solid #202329;display:flex}#vs-app .vs-trk.drop{background:rgba(255,61,139,.07)}#vs-app .vs-th{position:sticky;left:0;z-index:3;width:62px;flex:0 0 62px;background:var(--pn2);border-right:1px solid var(--ln);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-size:10px;color:var(--mu)}#vs-app .vs-th div{display:flex;gap:2px}#vs-app .vs-th button{width:24px;height:22px;min-height:0;padding:0;border:0;background:transparent;color:var(--mu)}#vs-app .vs-th button.on{color:var(--warn);background:transparent}#vs-app .vs-th button svg{width:13px;height:13px}#vs-app .vs-lane{position:relative;flex:0 0 auto}#vs-app .vs-clip{position:absolute;top:3px;bottom:3px;border-radius:7px;overflow:hidden;background:var(--vid);border:1.5px solid rgba(255,255,255,.08);cursor:grab;touch-action:pan-x pan-y;color:#fff;font-size:11px;-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;transition:transform .12s ease,box-shadow .12s ease}#vs-app .vs-clip.k-image{background:var(--img)}#vs-app .vs-clip.k-text{background:var(--txt)}#vs-app .vs-clip.k-fx{background:var(--fx)}#vs-app .vs-clip.k-audio{background:var(--aud)}#vs-app .vs-clip.sel{border-color:#fff;box-shadow:0 0 0 1px #fff,0 0 0 4px rgba(255,61,139,.55);z-index:2}#vs-app .vs-clip.drag{opacity:.9;z-index:6;cursor:grabbing;box-shadow:0 0 0 2px #fff,0 10px 24px rgba(0,0,0,.65);transform:translateY(-3px) scale(1.02);transition:none}#vs-app .vs-dtip{position:absolute;z-index:9;transform:translateX(-50%);background:#fff;color:#111;font:700 11.5px ui-monospace,Menlo,Consolas,monospace;padding:4px 8px;border-radius:8px;pointer-events:none;box-shadow:0 4px 14px rgba(0,0,0,.5);white-space:nowrap}#vs-app .vs-dtip[hidden]{display:none}#vs-app .vs-clip .fs{position:absolute;inset:0;display:flex;overflow:hidden;pointer-events:none;opacity:.85}#vs-app .vs-clip .fs img{height:100%;flex:0 0 auto;object-fit:cover}#vs-app .vs-clip canvas.wv{position:absolute;left:0;bottom:0;height:60%;width:100%;pointer-events:none;opacity:.9}#vs-app .vs-clip .lb{position:absolute;left:6px;top:3px;right:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 1px 2px #000;pointer-events:none;font-weight:600}#vs-app .vs-clip .bd{display:inline-block;background:rgba(0,0,0,.55);border-radius:4px;padding:0 4px;margin-right:4px;font-size:10px}#vs-app .vs-clip .kfm{position:absolute;bottom:3px;width:8px;height:8px;margin-left:-4px;background:#ffcf4d;transform:rotate(45deg);pointer-events:none;box-shadow:0 0 0 1px #000}#vs-app .vs-clip .hd{position:absolute;top:0;bottom:0;width:14px;background:rgba(255,255,255,.92);display:none;touch-action:none;cursor:ew-resize;z-index:3}#vs-app .vs-clip .hd::after{content:\"\";position:absolute;left:5px;top:35%;bottom:35%;width:2px;border-radius:2px;background:#555}#vs-app .vs-clip .hd.l{left:0;border-radius:6px 0 0 6px}#vs-app .vs-clip .hd.r{right:0;border-radius:0 6px 6px 0}#vs-app .vs-clip.sel .hd{display:block}#vs-app .vs-trx{position:absolute;bottom:5px;width:20px;height:18px;margin:0 0 0 -10px;border-radius:5px;background:#fff;color:#111;z-index:4;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;cursor:pointer;border:0;padding:0;min-height:0;box-shadow:0 1px 4px rgba(0,0,0,.6)}#vs-app .vs-trx.has{background:var(--a);color:#fff}#vs-app .vs-trx svg{width:12px;height:12px}#vs-app .vs-ph{position:absolute;top:0;bottom:0;width:2px;margin-left:-1px;background:#fff;z-index:7;pointer-events:none;box-shadow:0 0 0 1px rgba(0,0,0,.35)}#vs-app .vs-ph::before{content:\"\";position:absolute;top:0;left:-6px;border:7px solid transparent;border-top:9px solid #fff}#vs-app .vs-snapl{position:absolute;top:24px;bottom:0;width:1px;background:#ffd400;z-index:6;pointer-events:none}#vs-app .vs-addtr{display:flex;gap:6px;padding:6px 6px 10px 68px;position:sticky;left:0;width:max-content}#vs-app .vs-addtr button{min-height:28px;padding:3px 9px;font-size:11.5px;color:var(--mu)}/* panel warna (mode warna) */#vs-app .vs-colorp{flex:0 0 auto;height:390px;display:flex;flex-direction:column;border-top:1px solid var(--ln);background:var(--pn);min-height:0}#vs-app .vs-strip{display:flex;gap:6px;padding:6px 8px;overflow-x:auto;border-bottom:1px solid var(--ln);flex:0 0 auto}#vs-app .vs-strip button{flex:0 0 auto;width:96px;height:58px;padding:0;border-radius:8px;overflow:hidden;background:#000 center/cover no-repeat;position:relative;min-height:0;border:2px solid transparent}#vs-app .vs-strip button.on{border-color:var(--a)}#vs-app .vs-strip button span{position:absolute;left:0;right:0;bottom:0;font-size:10px;background:rgba(0,0,0,.65);padding:1px 4px;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#vs-app .vs-strip button i{position:absolute;top:3px;left:4px;font-style:normal;font-size:10px;background:rgba(0,0,0,.6);border-radius:4px;padding:0 4px}#vs-app .vs-cbody{flex:1 1 auto;display:flex;min-height:0}#vs-app .vs-ctabs{display:flex;flex-direction:column;gap:2px;padding:6px;border-right:1px solid var(--ln);flex:0 0 auto;overflow-y:auto}#vs-app .vs-ctabs button{border:0;background:transparent;font-size:12px;justify-content:flex-start;color:var(--mu);min-height:30px}#vs-app .vs-ctabs button.on{background:var(--pn3);color:var(--tx)}#vs-app .vs-cpane{flex:1 1 auto;overflow:auto;padding:10px;min-width:0}#vs-app .vs-wheels{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;max-width:1100px;margin:0 auto}#vs-app .vs-wheel{display:flex;flex-direction:column;align-items:stretch;gap:6px;background:var(--pn2);border:1px solid var(--ln);border-radius:14px;padding:8px 10px 10px;min-width:0}#vs-app .vs-wheel.drag{border-color:var(--a)}#vs-app .vs-wheel .whd{display:flex;align-items:center;justify-content:space-between}#vs-app .vs-wheel .whd b{font-size:12.5px;letter-spacing:.02em}#vs-app .vs-wheel .rs{width:28px;height:28px;min-height:0;padding:0;border-radius:8px;background:transparent;border:0;color:var(--mu)}#vs-app .vs-wheel .wcv{display:block;width:100%;max-width:150px;aspect-ratio:1;margin:0 auto;touch-action:none;cursor:grab;border-radius:50%}#vs-app .vs-wheel.drag .wcv{cursor:grabbing}#vs-app .vs-wheel .vals{display:flex;justify-content:center;gap:8px;font:11px ui-monospace,Menlo,Consolas,monospace}#vs-app .vs-wheel .vals .r{color:#ff8a8a}#vs-app .vs-wheel .vals .g{color:#8aff9a}#vs-app .vs-wheel .vals .b{color:#8fb0ff}#vs-app .vs-jog{position:relative;height:34px;border-radius:9px;border:1px solid var(--ln2);background:#0c0d10 repeating-linear-gradient(90deg,rgba(255,255,255,.13) 0 1px,transparent 1px 7px);display:flex;align-items:center;justify-content:space-between;padding:0 9px;font-size:11px;color:var(--mu);touch-action:pan-y;cursor:ew-resize;overflow:hidden}#vs-app .vs-jog i{position:absolute;top:0;bottom:0;background:rgba(255,61,139,.28);pointer-events:none}#vs-app .vs-jog span,#vs-app .vs-jog output{position:relative;pointer-events:none}#vs-app .vs-jog output{font:600 11.5px ui-monospace,Menlo,Consolas,monospace;color:var(--tx)}#vs-app .vs-jog.chg output{color:var(--a)}#vs-app .vs-jog.drag{border-color:var(--a);box-shadow:0 0 0 3px rgba(255,61,139,.2)}#vs-app .vs-curve{display:flex;gap:12px;flex-wrap:wrap;align-items:flex-start}#vs-app .vs-curve canvas{width:260px;height:260px;max-width:100%;background:#0b0c0e;border:1px solid var(--ln);border-radius:8px;touch-action:none;cursor:crosshair}#vs-app .vs-scopes{display:flex;flex-direction:column;gap:6px}#vs-app .vs-scopes canvas{width:100%;height:150px;background:#050506;border:1px solid var(--ln);border-radius:8px;display:block}#vs-app .vs-nodes{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:8px}#vs-app .vs-nodes button{min-height:30px;font-size:12px;padding:4px 10px}#vs-app .vs-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:4px 18px}/* modal, busy, toast */#vs-app .vs-modal{position:absolute;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:50;padding:14px}#vs-app .vs-dlg{background:var(--pn);border:1px solid var(--ln);border-radius:16px;width:min(560px,100%);max-height:100%;display:flex;flex-direction:column;box-shadow:0 30px 80px rgba(0,0,0,.6)}#vs-app .vs-dlg header{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid var(--ln)}#vs-app .vs-dlg header b{flex:1;font-size:15px}#vs-app .vs-dlg .bd{padding:14px;overflow-y:auto}#vs-app .vs-dlg footer{display:flex;gap:8px;justify-content:flex-end;padding:12px 14px;border-top:1px solid var(--ln);flex-wrap:wrap}#vs-app .vs-plist{display:flex;flex-direction:column;gap:6px}#vs-app .vs-pitem{display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--pn2);border:1px solid var(--ln);border-radius:10px}#vs-app .vs-pitem div{flex:1;min-width:0}#vs-app .vs-pitem b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#vs-app .vs-pitem small{color:var(--mu)}#vs-app .vs-pitem.cur{border-color:var(--a)}#vs-app .vs-presets{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:6px}#vs-app .vs-presets button{flex-direction:column;align-items:center;gap:6px;padding:10px 6px;white-space:normal;text-align:center;font-size:11.5px}#vs-app .vs-presets button i{display:block;border:2px solid currentColor;border-radius:3px;opacity:.8}#vs-app .vs-presets button small{color:var(--mu);font-size:10.5px}#vs-app .vs-prog{height:10px;background:var(--pn3);border-radius:10px;overflow:hidden;margin:10px 0}#vs-app .vs-prog i{display:block;height:100%;width:0;background:var(--ag);transition:width .2s}#vs-app #vs-busy{position:absolute;inset:0;background:rgba(10,11,13,.72);display:flex;align-items:center;justify-content:center;z-index:60;flex-direction:column;gap:12px;color:#fff;text-align:center;padding:20px}#vs-app #vs-busy i{width:34px;height:34px;border-radius:50%;border:3px solid rgba(255,255,255,.2);border-top-color:var(--a);animation:vsspin .8s linear infinite}@keyframes vsspin{to{transform:rotate(360deg)}}#vs-app #vs-toast{position:absolute;left:50%;bottom:16px;transform:translate(-50%,12px);background:#f1f2f4;color:#111;padding:10px 14px;border-radius:12px;font-size:13px;font-weight:600;opacity:0;pointer-events:none;transition:opacity .2s,transform .2s;z-index:80;max-width:min(560px,92%);text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.5)}#vs-app #vs-toast.show{opacity:1;transform:translate(-50%,0)}#vs-app #vs-toast.bad{background:#ffdddd;color:#7a0000}#vs-app .vs-mnav{display:none}#vs-app .vs-sheethd{display:none}/* ---------- HP & tablet ---------- */@media (max-width:859px){#vs-app .vs-wheels{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}#vs-app .vs-wheel .wcv{max-width:160px}#vs-app{height:min(94vh,980px)}#vs-app.vs-narrow .vs-top{padding:6px 8px;gap:6px}#vs-app .vs-hide-n{display:none!important}#vs-app .vs-modes button{padding:5px 9px}#vs-app .vs-lib,#vs-app .vs-insp{position:absolute;left:0;right:0;bottom:0;width:auto;height:min(64%,520px);z-index:30;border:0;border-top:1px solid var(--ln2);border-radius:16px 16px 0 0;transform:translateY(105%);transition:transform .22s ease;box-shadow:0 -20px 50px rgba(0,0,0,.6)}#vs-app .vs-lib.open,#vs-app .vs-insp.open{transform:none}#vs-app .vs-sheethd{display:flex;align-items:center;gap:8px;padding:8px 10px 4px}#vs-app .vs-sheethd::before{content:\"\";position:absolute;left:50%;top:6px;width:40px;height:4px;margin-left:-20px;border-radius:4px;background:var(--ln2)}#vs-app .vs-sheethd b{flex:1;font-size:14px;padding-top:6px}#vs-app .vs-main{flex:0 0 auto;flex-direction:column;position:static}#vs-app .vs-center{flex:0 0 auto;height:auto}#vs-app #vs-stage{flex:0 0 auto;height:clamp(170px,33vh,460px)}#vs-app.vs-full #vs-stage{height:clamp(170px,36vh,520px)}#vs-app.vs-mode-color #vs-stage{height:clamp(150px,27vh,380px)}#vs-app .vs-ttl{display:none}#vs-app .vs-modes button span{display:none}#vs-app .vs-modes button{padding:5px 10px}#vs-app .vs-acts{gap:4px;margin-left:auto}#vs-app .vs-acts [data-a=projects]{display:none}#vs-app .vs-acts .vs-ib{width:32px;height:32px}#vs-app #vs-quality{display:none}#vs-app .vs-tl{flex:1 1 auto;height:auto!important}#vs-app .vs-colorp{flex:1 1 auto;height:auto}#vs-app .vs-tlrs{position:relative;top:0;height:18px;flex:0 0 18px;display:flex;align-items:center;justify-content:center;background:var(--pn);border-bottom:1px solid var(--ln)}#vs-app .vs-tlrs i{display:block;width:44px;height:5px;border-radius:5px;background:var(--ln2)}#vs-app .vs-tlrs.on i{background:var(--a);width:64px}#vs-app .vs-clip .hd{width:22px}#vs-app .vs-clip .hd::after{left:9px}#vs-app .vs-mnav{display:flex;gap:2px;padding:4px 4px calc(4px + env(safe-area-inset-bottom));border-top:1px solid var(--ln);background:#0a0b0d;overflow-x:auto;flex:0 0 auto;scrollbar-width:none}#vs-app .vs-mnav::-webkit-scrollbar{display:none}#vs-app .vs-mnav button{flex:1 0 auto;min-width:58px;flex-direction:column;gap:2px;border:0;background:transparent;font-size:10.5px;color:#c9ced5;padding:6px 4px;min-height:48px}#vs-app .vs-mnav button svg{width:20px;height:20px}#vs-app .vs-mnav button.danger{color:#ff8a8a}#vs-app .vs-th{width:46px;flex-basis:46px}#vs-app .vs-th span{display:none}#vs-app .vs-addtr{padding-left:52px}#vs-app .vs-ctl{grid-template-columns:minmax(0,1fr) 64px 32px}#vs-app .vs-cbody{flex-direction:column}#vs-app .vs-ctabs{flex-direction:row;border-right:0;border-bottom:1px solid var(--ln);overflow-x:auto;flex:0 0 auto}#vs-app .vs-ctabs button{flex:0 0 auto}#vs-app .vs-strip button{width:76px;height:46px}#vs-app .vs-pbar{padding:4px 8px}#vs-app .vs-play{width:38px;height:38px}}@media (pointer:coarse){#vs-app .vs-kf{width:30px;height:30px}#vs-app .vs-clip .hd{width:22px}}/* ---------- layar periksa detail ---------- */#vs-app .vs-ix{position:fixed;inset:0;z-index:2147483200;background:#000;display:flex;flex-direction:column;color:#eceef1;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);outline:0}#vs-app .vs-ix .ixtop{display:flex;align-items:center;gap:10px;padding:8px 10px;background:rgba(18,20,23,.96);border-bottom:1px solid #22262b;flex:0 0 auto}#vs-app .vs-ix .ixtop b{font-size:14px;white-space:nowrap}#vs-app .vs-ix .ixtop span{font-size:12px;color:var(--mu);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#vs-app .vs-ix .sp{flex:1}#vs-app .vs-ix .ixview{flex:1 1 auto;position:relative;overflow:hidden;touch-action:none;cursor:grab;background:#0b0b0c repeating-conic-gradient(#121214 0 25%,#0b0b0c 0 50%) 0 0/24px 24px}#vs-app .vs-ix .ixwrap{position:absolute;left:0;top:0;transform-origin:0 0;box-shadow:0 0 0 1px rgba(255,255,255,.12)}#vs-app .vs-ix .ixwrap canvas{position:absolute;inset:0;width:100%;height:100%;display:block}#vs-app .vs-ix .ixwrap canvas[hidden]{display:none}#vs-app .vs-ix .ixwrap.px canvas{image-rendering:pixelated;image-rendering:crisp-edges}#vs-app .vs-ix .ixload{position:absolute;left:50%;top:12px;transform:translateX(-50%);display:flex;align-items:center;gap:8px;background:rgba(0,0,0,.75);padding:7px 12px;border-radius:20px;font-size:12px;pointer-events:none}#vs-app .vs-ix .ixload[hidden]{display:none}#vs-app .vs-ix .ixload i{width:14px;height:14px;border-radius:50%;border:2px solid rgba(255,255,255,.25);border-top-color:var(--a);animation:vsspin .8s linear infinite}#vs-app .vs-ix .ixtag{position:absolute;left:12px;top:12px;background:#ffd400;color:#111;font-weight:800;font-size:11px;padding:4px 8px;border-radius:6px;pointer-events:none}#vs-app .vs-ix .ixtag[hidden],#vs-app .vs-ix .ixpx[hidden]{display:none}#vs-app .vs-ix .ixpx{position:absolute;display:flex;flex-wrap:wrap;align-items:center;gap:2px 8px;max-width:224px;background:rgba(10,11,13,.9);border:1px solid #333;border-radius:10px;padding:6px 9px;font:11.5px ui-monospace,Menlo,Consolas,monospace;pointer-events:none}#vs-app .vs-ix .ixpx i{width:14px;height:14px;border-radius:4px;box-shadow:0 0 0 1px #fff}#vs-app .vs-ix .ixpx b:nth-of-type(1){color:#ff8a8a}#vs-app .vs-ix .ixpx b:nth-of-type(2){color:#8aff9a}#vs-app .vs-ix .ixpx b:nth-of-type(3){color:#8fb0ff}#vs-app .vs-ix .ixpx span{flex-basis:100%;color:#b9c0c8;font-size:10.5px}#vs-app .vs-ix .ixbar{flex:0 0 auto;background:rgba(18,20,23,.97);border-top:1px solid #22262b;padding:6px 10px 8px;display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center}#vs-app .vs-ix .ixrow{display:flex;align-items:center;gap:6px;min-width:0}#vs-app .vs-ix .ixplay{flex:1 1 320px}#vs-app .vs-ix .ixplay input{flex:1 1 auto;min-width:60px;pointer-events:auto;height:30px}#vs-app .vs-ix .ixtime{font:12px ui-monospace,Menlo,Consolas,monospace;color:var(--mu);white-space:nowrap}#vs-app .vs-ix .ixzoom button,#vs-app .vs-ix .ixtools button{min-height:32px;padding:4px 10px;font-size:12px}#vs-app .vs-ix .ixzoom button.on,#vs-app .vs-ix .ixtools button.on{background:var(--a);border-color:var(--a);color:#fff}#vs-app .vs-ix .ixz{font:12px ui-monospace,Menlo,Consolas,monospace;color:var(--mu);min-width:44px}#vs-app .vs-ix .ixtools button{gap:5px;-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;touch-action:none}#vs-app .vs-ix .ixhint{font-size:11px;color:#7d858f}@media (max-width:640px){#vs-app .vs-ix .ixhint{display:none}#vs-app .vs-ix .ixbar{gap:6px}#vs-app .vs-ix .ixrow{flex:1 1 100%;justify-content:center}#vs-app .vs-ix .ixtop{padding:6px 8px}}#vs-app .vs-ixbtn{min-height:32px;padding:4px 10px;font-size:12px;gap:5px}"; document.head.appendChild(st);
  buildShell(); buildTimeline();
  try { glInit($('#vs-cv')); } catch (e) { $('#vs-stagemsg').innerHTML = '<b>Perangkat tidak didukung</b><span>' + esc(e.message) + '</span>'; return; }
  await restoreFonts();
  try { const all = await DB.keys('luts'); for (const k of all) { const L = await DB.get('luts', k); if (L) LUTS[k] = L; } } catch (e) {}
  let ok = false;
  try { const last = await DB.get('kv', 'last'); if (last) { const miss = await loadProject(last); ok = true; if (miss.length) setTimeout(() => relinkDlg(miss), 400); } } catch (e) { console.warn(e); }
  if (!ok) { P = newProject('Proyek Pertama', 1080, 1920, 30); resetHist(); }
  bindUI(); libTab('media'); renderAll(); layoutCanvas();
  if (NARROW()) TL.pps = 40;
  requestAnimationFrame(frame);
  if (location.hash === '#vstest') window.__vs = { get P() { return P; }, set P(v) { P = v; }, get SEL() { return SEL; }, set SEL(v) { SEL = v; }, get PH() { return PH; }, seek, play, pause, commit, renderAll, importFiles, addMediaToTimeline, runExport, composeFrame, FILES, MP4, GLR, TL, ACT, setMode, splitClip, clipEnd, clipDur, srcTime, PB, LUTS, parseCube, makeFrameSource, AudioMixer, LoudMeter, projDur, renderTimeline, ELS, STAT, outputFrame, previewSrc, importDavinci, mediaById, IMGS };
}
start();

})();
