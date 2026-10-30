/**
 * Cảnh sân vận động về đêm phủ kín khối "Trận tới": khán đài có đèn flash, hai cột đèn pha chiếu xuống,
 * sân phối cảnh tràn khung, khung thành phía xa, cầu thủ đom đóm (đội mình) phối hợp ghi bàn.
 * Trả về chuỗi SVG để chèn bằng dangerouslySetInnerHTML — chữ duy nhất từ người dùng (tên đội) được escape.
 */
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const W = 1200;
const H = 400;
const TOP = 150; // vạch biên xa
const BOT = 460; // vạch biên gần (ngoài khung → sân tràn xuống mép dưới)
/** Mép trái/phải của sân tại độ sâu y (phối cảnh tuyến tính). */
const X = (y: number): [number, number] => {
  const k = (y - TOP) / (BOT - TOP);
  return [330 - 450 * k, 870 + 450 * k];
};
/** Tỉ lệ thu nhỏ theo độ sâu. */
const S = (y: number) => 0.55 + 0.95 * ((y - TOP) / (BOT - TOP));

function ours(x: number, y: number, d: number) {
  const s = S(y);
  return `<g transform="translate(${x} ${y}) scale(${s.toFixed(2)})"><ellipse cx="0" cy="4" rx="12" ry="4" fill="rgba(0,0,0,.4)"/><circle r="15" fill="url(#sFF)" opacity=".6"><animate attributeName="r" values="12;19;12" dur="2.4s" begin="${d}s" repeatCount="indefinite"/></circle><circle cy="-12" r="5.6" fill="#ffe3a8"/><rect x="-4.8" y="-6.6" width="9.6" height="12" rx="4" fill="#f3c58a"/></g>`;
}

function theirs(x: number, y: number, dx: number, dur: number) {
  const s = S(y).toFixed(2);
  return `<g><animateTransform attributeName="transform" type="translate" values="${x} ${y};${x + dx} ${y + 2};${x} ${y}" dur="${dur}s" repeatCount="indefinite"/><g transform="scale(${s})"><ellipse cx="0" cy="4" rx="10" ry="3.4" fill="rgba(0,0,0,.35)"/><circle cy="-11" r="5" fill="#9fd3e0"/><rect x="-4" y="-6" width="8" height="11" rx="4" fill="#5aa9bd"/></g></g>`;
}

export function stadiumScene(teamName: string): string {
  const ys = [TOP, 166, 186, 210, 238, 272, 312, 360, 416, BOT];
  const stripes = ys
    .slice(0, -1)
    .map((y, i) => `<rect x="0" y="${y}" width="${W}" height="${ys[i + 1] - y + 0.5}" fill="${i % 2 ? '#1c6a3b' : '#227a43'}"/>`)
    .join('');
  const [l1, r1] = X(TOP);
  const [l2, r2] = X(BOT);
  const half = 272;
  const [hl, hr] = X(half);
  // khán giả: chấm nhiều màu theo hàng ghế
  const crowd = Array.from({ length: 7 }, (_, row) => {
    const y = 44 + row * 13;
    return Array.from({ length: 96 }, (_, i) => {
      const x = 6 + i * 12.5 + (row % 2) * 6;
      const c = ['#3b4656', '#5a4636', '#2f4a3b', '#4d3a4f', '#6b5a3a'][(i * 7 + row * 3) % 5];
      return `<circle cx="${x.toFixed(1)}" cy="${y}" r="3.2" fill="${c}"/>`;
    }).join('');
  }).join('');
  // đèn flash máy ảnh trên khán đài
  const flashes = Array.from({ length: 16 }, (_, i) => {
    const x = 40 + ((i * 271) % 1120);
    const y = 46 + ((i * 37) % 80);
    return `<circle cx="${x}" cy="${y}" r="3" fill="#fff" opacity="0"><animate attributeName="opacity" values="0;0;1;0;0" keyTimes="0;.6;.62;.66;1" dur="${3 + (i % 5) * 0.7}s" begin="${(i * 0.37).toFixed(2)}s" repeatCount="indefinite"/></circle>`;
  }).join('');
  const tower = (x: number, flip: boolean) => {
    const dir = flip ? -1 : 1;
    return `<g>
      <line x1="${x}" y1="140" x2="${x}" y2="22" stroke="#2a2f36" stroke-width="5"/>
      <rect x="${x - 26}" y="8" width="52" height="20" rx="3" fill="#20252c" stroke="#3a414a"/>
      ${[0, 1, 2, 3].map((i) => `<circle cx="${x - 18 + i * 12}" cy="18" r="4" fill="#fff8e6"/>`).join('')}
      <circle cx="${x}" cy="18" r="70" fill="url(#sLamp)"/>
      <polygon points="${x - 22},24 ${x + 22},24 ${x + dir * 520},${H} ${x + dir * 120},${H}" fill="url(#sBeam)" opacity=".5"><animate attributeName="opacity" values=".42;.58;.42" dur="5s" repeatCount="indefinite"/></polygon>
    </g>`;
  };
  const KT = '0;.15;.22;.37;.44;.58;.64;.74;1';
  return `<svg class="nx-stadium" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <defs>
    <linearGradient id="sSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05070a"/><stop offset="1" stop-color="#121a22"/></linearGradient>
    <radialGradient id="sLamp"><stop offset="0" stop-color="#fff4d6" stop-opacity=".8"/><stop offset=".35" stop-color="#ffe7b3" stop-opacity=".25"/><stop offset="1" stop-color="#ffe7b3" stop-opacity="0"/></radialGradient>
    <linearGradient id="sBeam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6dc" stop-opacity=".55"/><stop offset="1" stop-color="#fff6dc" stop-opacity="0"/></linearGradient>
    <radialGradient id="sFF"><stop offset="0" stop-color="#ffe7b3" stop-opacity=".95"/><stop offset="1" stop-color="#f3c58a" stop-opacity="0"/></radialGradient>
    <radialGradient id="sPitchGlow" cx=".5" cy=".35" r=".7"><stop offset="0" stop-color="#ffefc8" stop-opacity=".28"/><stop offset="1" stop-color="#ffefc8" stop-opacity="0"/></radialGradient>
    <radialGradient id="sBall" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#fff"/><stop offset=".7" stop-color="#e9e4da"/><stop offset="1" stop-color="#a9a294"/></radialGradient>
    <linearGradient id="sBoard" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1a1408"/><stop offset=".5" stop-color="#3a2a0c"/><stop offset="1" stop-color="#1a1408"/></linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sSky)"/>
  <rect x="0" y="34" width="${W}" height="106" fill="#0d1117"/>
  <g opacity=".85">${crowd}</g>
  ${flashes}
  <rect x="0" y="128" width="${W}" height="16" fill="url(#sBoard)"/>
  <text x="${W / 2}" y="140" text-anchor="middle" font-family="Jost,system-ui,sans-serif" font-size="11" font-weight="600" letter-spacing="8" fill="#e3bf86" opacity=".9">${esc(teamName.toUpperCase())} · ${esc(teamName.toUpperCase())} · ${esc(teamName.toUpperCase())}</text>
  ${stripes}
  <polygon points="0,${TOP} ${l1},${TOP} ${l2},${BOT} 0,${BOT}" fill="rgba(0,0,0,.28)"/>
  <polygon points="${W},${TOP} ${r1},${TOP} ${r2},${BOT} ${W},${BOT}" fill="rgba(0,0,0,.28)"/>
  <rect y="${TOP}" width="${W}" height="${H - TOP}" fill="url(#sPitchGlow)"/>
  <g fill="none" stroke="rgba(255,255,255,.6)" stroke-width="2">
    <polygon points="${l1},${TOP} ${r1},${TOP} ${r2},${BOT} ${l2},${BOT}"/>
    <line x1="${hl}" y1="${half}" x2="${hr}" y2="${half}"/>
    <ellipse cx="600" cy="${half}" rx="120" ry="30"/>
    <polygon points="470,${TOP} 730,${TOP} 744,196 456,196"/>
    <polygon points="545,${TOP} 655,${TOP} 660,166 540,166"/>
    <path d="M550 196 Q600 214 650 196"/>
  </g>
  <circle cx="600" cy="${half}" r="3" fill="#fff" opacity=".75"/>
  <g>
    <g><animateTransform attributeName="transform" type="translate" values="0 0;0 0;0 -4;0 1;0 0;0 0" keyTimes="0;.74;.77;.8;.84;1" dur="6s" repeatCount="indefinite"/>
      <path d="M562 ${TOP} L565 122 L635 122 L638 ${TOP}" fill="rgba(255,255,255,.08)" stroke="rgba(255,255,255,.35)" stroke-width=".8"/>
      <g stroke="rgba(255,255,255,.25)" stroke-width=".6">${Array.from({ length: 11 }, (_, i) => `<line x1="${567 + i * 6.6}" y1="122" x2="${565 + i * 7.2}" y2="${TOP}"/>`).join('')}${[130, 138, 145].map((y) => `<line x1="563" y1="${y}" x2="637" y2="${y}"/>`).join('')}</g>
    </g>
    <path d="M562 ${TOP} L562 118 L638 118 L638 ${TOP}" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
  </g>
  <g><animateTransform attributeName="transform" type="translate" values="600 156;584 156;600 156;616 156;600 156;600 156;628 158;600 156" keyTimes="0;.2;.4;.6;.7;.73;.78;1" dur="6s" repeatCount="indefinite"/>
    <g transform="scale(.55)"><ellipse cx="0" cy="4" rx="10" ry="3.4" fill="rgba(0,0,0,.35)"/><circle cy="-11" r="5" fill="#9fd3e0"/><rect x="-4" y="-6" width="8" height="11" rx="4" fill="#5aa9bd"/></g></g>
  ${theirs(470, 230, 14, 3.2)}${theirs(760, 250, -16, 2.8)}${theirs(560, 196, 10, 3.6)}${theirs(690, 330, -12, 2.6)}${theirs(400, 360, 16, 3)}
  ${ours(520, 380, 0)}${ours(760, 310, 0.5)}${ours(430, 262, 1)}${ours(690, 214, 1.5)}${ours(880, 370, 2)}${ours(330, 330, 2.4)}
  <g>
    <animateMotion values="520,388;760,318;760,318;430,270;430,270;690,222;690,222;600,140;600,140" keyTimes="${KT}" calcMode="spline" keySplines="${Array(8).fill('.4 0 .3 1').join(';')}" dur="6s" repeatCount="indefinite"/>
    <animate attributeName="opacity" values="1;1;0;0;1" keyTimes="0;.88;.94;.99;1" dur="6s" repeatCount="indefinite"/>
    <g><animateTransform attributeName="transform" type="scale" values="1.3;1.05;1.05;.85;.85;.7;.7;.5;.5" keyTimes="${KT}" dur="6s" repeatCount="indefinite"/>
      <ellipse cx="2" cy="9" rx="9" ry="3" fill="rgba(0,0,0,.45)"/>
      <circle r="8" fill="url(#sBall)"/>
      <circle r="8" fill="none" stroke="rgba(0,0,0,.3)" stroke-width=".8"/>
      <circle r="2.6" fill="#1c1c1c"/>
    </g>
  </g>
  <g opacity="0"><animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;.74;.77;.88;.93;1" dur="6s" repeatCount="indefinite"/>
    <circle cx="600" cy="136" r="70" fill="url(#sFF)"/>
    <text x="600" y="104" text-anchor="middle" font-family="Jost,system-ui,sans-serif" font-size="34" font-weight="700" letter-spacing="6" fill="#ffe3a8" stroke="#0a0b0d" stroke-width="4" paint-order="stroke">VÀO!</text>
  </g>
  ${tower(60, false)}${tower(W - 60, true)}
</svg>`;
}
