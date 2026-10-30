import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

export const REPORT_DIR = new URL('../visual-report/', import.meta.url).pathname;

export interface Result {
  view: string;
  width: number;
  ratio: number;
  budget: number;
  protoH: number;
  appH: number;
}

/**
 * So hai ảnh full-page khác chiều cao: phần chung so từng pixel (ngưỡng màu 0.15),
 * phần chiều cao chênh lệch tính là lệch toàn bộ. Tỉ lệ = pixel lệch / diện tích ảnh lớn hơn.
 */
export function diff(proto: Buffer, app: Buffer, name: string) {
  const a = PNG.sync.read(proto);
  const b = PNG.sync.read(app);
  const w = Math.min(a.width, b.width);
  const h = Math.min(a.height, b.height);
  const crop = (img: PNG) => {
    const out = new PNG({ width: w, height: h });
    PNG.bitblt(img, out, 0, 0, w, h, 0, 0);
    return out;
  };
  const ca = crop(a);
  const cb = crop(b);
  const d = new PNG({ width: w, height: h });
  const n = pixelmatch(ca.data, cb.data, d.data, w, h, { threshold: 0.15, includeAA: false, alpha: 0.25 });
  const total = Math.max(a.width, b.width) * Math.max(a.height, b.height);
  const extra = total - w * h;
  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(`${REPORT_DIR}${name}-proto.png`, proto);
  writeFileSync(`${REPORT_DIR}${name}-app.png`, app);
  writeFileSync(`${REPORT_DIR}${name}-diff.png`, PNG.sync.write(d));
  return { ratio: (n + extra) / total, protoH: a.height, appH: b.height };
}

/** Ghi dồn kết quả ra file (worker bị khởi động lại sau mỗi test fail nên không giữ trong bộ nhớ). */
export function record(r: Result) {
  mkdirSync(REPORT_DIR, { recursive: true });
  const f = `${REPORT_DIR}results.json`;
  const all: Result[] = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : [];
  const next = all.filter((x) => !(x.view === r.view && x.width === r.width)).concat(r);
  writeReport(next);
}

export function writeReport(results: Result[]) {
  const pct = (x: number) => (x * 100).toFixed(2) + '%';
  const rows = results
    .map((r) => {
      const n = `${r.view}-${r.width}`;
      const bad = r.ratio > r.budget;
      return `<tr class="${bad ? 'bad' : ''}"><td>${r.view}</td><td>${r.width}</td><td>${pct(r.ratio)}</td><td>${pct(r.budget)}</td><td>${r.protoH} / ${r.appH}</td>
        <td><a href="${n}-proto.png">prototype</a> · <a href="${n}-app.png">app</a> · <a href="${n}-diff.png">diff</a></td></tr>`;
    })
    .join('');
  const html = `<!doctype html><html lang="vi"><meta charset="utf-8"><title>So sánh giao diện với prototype</title>
<style>body{font:14px system-ui;margin:24px;background:#f8f6f1}table{border-collapse:collapse}td,th{padding:6px 12px;border-bottom:1px solid #ddd;text-align:left}tr.bad td{color:#c43e33;font-weight:600}</style>
<h1>So sánh giao diện app ↔ prototype</h1><p>Tỉ lệ pixel lệch trên ảnh full-page (ngưỡng màu 0.15, chiều cao chênh tính là lệch). Đỏ = vượt ngân sách.</p>
<table><tr><th>Màn</th><th>Rộng</th><th>Lệch</th><th>Ngân sách</th><th>Cao (proto / app)</th><th>Ảnh</th></tr>${rows}</table></html>`;
  writeFileSync(`${REPORT_DIR}index.html`, html);
  writeFileSync(`${REPORT_DIR}results.json`, JSON.stringify(results, null, 1));
}
