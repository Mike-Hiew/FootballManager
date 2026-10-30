// @ts-nocheck — port nguyên văn, giữ để so khớp prototype
/* eslint-disable */
// Hình minh hoạ SVG tĩnh port nguyên từ prototype (cúp Giày vàng, Vua kiến tạo, sân mini động).
// Chuỗi SVG không chứa dữ liệu người dùng nên an toàn khi chèn bằng dangerouslySetInnerHTML.
export const bootSVG=()=>`<svg class="emb" viewBox="0 0 150 150" aria-hidden="true"><defs>
  <linearGradient id="gbG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff6c4"/><stop offset=".22" stop-color="#ffd84f"/><stop offset=".5" stop-color="#e8a417"/><stop offset=".68" stop-color="#ffe27a"/><stop offset="1" stop-color="#9a6106"/></linearGradient>
  <linearGradient id="gbS" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8a5506"/><stop offset=".45" stop-color="#ffe58a"/><stop offset="1" stop-color="#9a6106"/></linearGradient>
  <linearGradient id="gbP" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3a42"/><stop offset=".12" stop-color="#1c1c22"/><stop offset="1" stop-color="#0d0d10"/></linearGradient>
  <radialGradient id="gbH" cx=".5" cy=".45" r=".5"><stop offset="0" stop-color="#e3bf86" stop-opacity=".42"/><stop offset=".55" stop-color="#e3bf86" stop-opacity=".12"/><stop offset="1" stop-color="#e3bf86" stop-opacity="0"/></radialGradient></defs>
  <ellipse cx="75" cy="62" rx="70" ry="56" fill="url(#gbH)"/>
  <path d="M10 112h130v26a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4z" fill="url(#gbP)"/>
  <path d="M10 112h130v4H10z" fill="#4a4a54"/>
  <rect x="50" y="122" width="50" height="9" rx="1.5" fill="url(#gbS)"/>
  <ellipse cx="52" cy="111" rx="15" ry="4" fill="url(#gbS)"/>
  <path d="M45 82h14v28H45z" fill="url(#gbS)"/>
  <path d="M28 33c0-6 6-11 13-10l24 6c6 1.6 9 6 14 8.5l29 10c13 4.5 20 13 19 22.5-1 6.5-6.5 9.5-14 9.5H33c-8.5 0-13-5.5-13-13z" fill="url(#gbG)" stroke="#7a4c05" stroke-width="1.6"/>
  <path d="M20 78h107c0 5.5-4.5 8.5-10 8.5H30c-5.5 0-10-3-10-8.5z" fill="url(#gbS)" stroke="#7a4c05" stroke-width="1"/>
  <g fill="url(#gbS)" stroke="#7a4c05" stroke-width=".8"><rect x="28" y="85" width="7" height="8" rx="2"/><rect x="72" y="85" width="7" height="8" rx="2"/><rect x="94" y="85" width="7" height="8" rx="2"/><rect x="113" y="84" width="7" height="8" rx="2"/></g>
  <path d="M58 41l9-6.5M66.5 44l9-6.5M75 47l9-6.5" stroke="#fff4c2" stroke-width="2.8" stroke-linecap="round"/>
  <path d="M46 64c10-1 20-4 30-9M50 70c12-1 24-5 36-10M56 75c12-1 24-5 36-10" stroke="#b97a0a" stroke-width="2.2" fill="none" stroke-linecap="round" opacity=".75"/>
  <path d="M34 34c10-1.5 20 .5 28 4.5" stroke="#fffbe8" stroke-width="3.4" stroke-linecap="round" opacity=".95" fill="none"/>
  <path d="M96 52c9 3 17 6 22 11" stroke="#fffbe8" stroke-width="2.4" stroke-linecap="round" opacity=".7" fill="none"/>
  <g fill="#fffbe0"><path d="M124 18l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/><path d="M16 46l1.4 4 4 1.4-4 1.4-1.4 4-1.4-4-4-1.4 4-1.4z"/></g></svg>`;
export const assistSVG=()=>`<svg class="emb" viewBox="0 0 150 150" aria-hidden="true"><defs>
  <linearGradient id="gpG" gradientUnits="userSpaceOnUse" x1="30" y1="10" x2="120" y2="120"><stop offset="0" stop-color="#fff2b8"/><stop offset=".3" stop-color="#f3c34a"/><stop offset=".6" stop-color="#c8891a"/><stop offset=".8" stop-color="#f7d478"/><stop offset="1" stop-color="#8f5a08"/></linearGradient>
  <linearGradient id="gpP" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3a42"/><stop offset=".12" stop-color="#1c1c22"/><stop offset="1" stop-color="#0d0d10"/></linearGradient>
  <linearGradient id="gpS" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8a5506"/><stop offset=".45" stop-color="#ffe58a"/><stop offset="1" stop-color="#9a6106"/></linearGradient>
  <radialGradient id="gpH" cx=".5" cy=".42" r=".5"><stop offset="0" stop-color="#e3bf86" stop-opacity=".42"/><stop offset=".55" stop-color="#e3bf86" stop-opacity=".12"/><stop offset="1" stop-color="#e3bf86" stop-opacity="0"/></radialGradient></defs>
  <ellipse cx="75" cy="58" rx="70" ry="58" fill="url(#gpH)"/>
  <path d="M8 124h134v16a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4z" fill="url(#gpP)"/>
  <path d="M22 112h106v12H22z" fill="url(#gpP)"/><path d="M22 112h106v3H22z" fill="#4a4a54"/><path d="M8 124h134v3H8z" fill="#4a4a54"/>
  <rect x="46" y="130" width="58" height="7" rx="1.5" fill="url(#gpS)"/>
  <g fill="none" stroke="url(#gpG)" stroke-linecap="round" stroke-linejoin="round">
    <path d="M86 66l-2 22-4 23" stroke-width="10"/>
    <path d="M78 66l-14 18-22 16" stroke-width="10"/>
    <path d="M90 34l20-6 14 6" stroke-width="7"/>
    <path d="M80 36l-18 10-14-2" stroke-width="7"/>
  </g>
  <path d="M78 32c4-3 12-3 15 0l-1 34H76z" fill="url(#gpG)"/>
  <path d="M74 62h20l2 12H72z" fill="url(#gpG)" stroke="#8f5a08" stroke-width=".8"/>
  <circle cx="86" cy="22" r="8.5" fill="url(#gpG)"/>
  <path d="M78 110h10l3 3H76z" fill="#8f5a08"/>
  <circle cx="33" cy="103" r="9" fill="url(#gpG)" stroke="#8f5a08" stroke-width="1"/>
  <path d="M33 98.5l4.2 3-1.6 5h-5.2l-1.6-5z" fill="#8f5a08" opacity=".8"/>
  <path d="M82 17c2-2 6-2 8 0" stroke="#fffbe8" stroke-width="2" stroke-linecap="round" fill="none"/>
  <path d="M80 40c1 8 1 16 0 22" stroke="#fffbe8" stroke-width="2.2" stroke-linecap="round" opacity=".8" fill="none"/>
  <g fill="#fffbe0"><path d="M126 60l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/><path d="M20 30l1.4 4 4 1.4-4 1.4-1.4 4-1.4-4-4-1.4 4-1.4z"/></g></svg>`;

export function pitchScene(): string {
  const KT='0;.15;.22;.37;.44;.58;.64;.74;1';
  const bands=[30,44,60,79,102,130,164,206,256,300];
  const X=y=>{const k=(y-30)/270;return [80-140*k,320+140*k];};
  const band=bands.slice(0,-1).map((y,i)=>{const y2=bands[i+1];const [a,b]=X(y),[c,d]=X(y2);return `<polygon points="${a},${y} ${b},${y} ${d},${y2} ${c},${y2}" fill="${i%2?'#1d6b3c':'#22783f'}"/>`;}).join('');
  const [l1,r1]=X(30),[l2,r2]=X(300),[hl,hr]=X(170);
  const ff=(x,y,d)=>`<g transform="translate(${x} ${y})"><ellipse cx="0" cy="3" rx="9" ry="3" fill="rgba(0,0,0,.35)"/><circle r="11" fill="url(#ffg)" opacity=".55"><animate attributeName="r" values="9;14;9" dur="2.4s" begin="${d}s" repeatCount="indefinite"/></circle><circle cy="-9" r="4.2" fill="#ffe3a8"/><rect x="-3.6" y="-5" width="7.2" height="9" rx="3" fill="#f3c58a"/></g>`;
  const opp=(x,y,dx,d)=>`<g><animateTransform attributeName="transform" type="translate" values="${x} ${y};${x+dx} ${y+2};${x} ${y}" dur="${d}s" repeatCount="indefinite"/><ellipse cx="0" cy="3" rx="7" ry="2.5" fill="rgba(0,0,0,.3)"/><circle cy="-8" r="3.6" fill="#9fd3e0"/><rect x="-3" y="-4.5" width="6" height="8" rx="3" fill="#5aa9bd"/></g>`;
  return `<svg class="nx-pitch-svg" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <defs>
    <radialGradient id="ffg"><stop offset="0" stop-color="#ffe7b3" stop-opacity=".9"/><stop offset="1" stop-color="#f3c58a" stop-opacity="0"/></radialGradient>
    <radialGradient id="flood" cx=".5" cy="0" r=".9"><stop offset="0" stop-color="#ffe9c4" stop-opacity=".45"/><stop offset=".6" stop-color="#ffe9c4" stop-opacity="0"/></radialGradient>
    <radialGradient id="ballg" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#fff"/><stop offset=".7" stop-color="#e9e4da"/><stop offset="1" stop-color="#a9a294"/></radialGradient>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a0b0d" stop-opacity=".85"/><stop offset=".25" stop-color="#0a0b0d" stop-opacity="0"/></linearGradient>
    <clipPath id="ballclip"><circle r="9"/></clipPath>
  </defs>
  <rect width="400" height="300" fill="#0d1a12"/>
  ${band}
  <g fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.4">
    <polygon points="${l1},30 ${r1},30 ${r2},300 ${l2},300"/>
    <line x1="${hl}" y1="170" x2="${hr}" y2="170"/>
    <ellipse cx="200" cy="170" rx="58" ry="20"/>
    <polygon points="140,30 260,30 266,64 134,64"/>
    <polygon points="172,30 228,30 230,42 170,42"/>
    <path d="M176 64 Q200 76 224 64"/>
  </g>
  <circle cx="200" cy="170" r="2.2" fill="#fff" opacity=".7"/>
  <rect width="400" height="300" fill="url(#flood)"/>
  <g class="goal">
    <g><animateTransform attributeName="transform" type="translate" values="0 0;0 0;0 -3;0 1;0 0;0 0" keyTimes="0;.74;.77;.8;.84;1" dur="6s" repeatCount="indefinite"/>
      <path d="M172 31 L174 14 L226 14 L228 31" fill="rgba(255,255,255,.08)" stroke="rgba(255,255,255,.35)" stroke-width=".6"/>
      <g stroke="rgba(255,255,255,.28)" stroke-width=".5">${Array.from({length:9},(_,i)=>`<line x1="${176+i*6}" y1="14" x2="${175+i*6.3}" y2="31"/>`).join('')}${[18,22,26].map(y=>`<line x1="173" y1="${y}" x2="227" y2="${y}"/>`).join('')}</g>
    </g>
    <path d="M172 31 L172 12 L228 12 L228 31" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>
  </g>
  <g><animateTransform attributeName="transform" type="translate" values="200 34;188 34;200 34;212 34;200 34;200 34;222 36;200 34" keyTimes="0;.2;.4;.6;.7;.73;.78;1" dur="6s" repeatCount="indefinite"/>
    <ellipse cx="0" cy="2" rx="6" ry="2" fill="rgba(0,0,0,.3)"/><circle cy="-7" r="3.2" fill="#9fd3e0"/><rect x="-2.6" y="-4" width="5.2" height="7" rx="2.6" fill="#5aa9bd"/></g>
  ${opp(300,210,-14,3.2)}${opp(110,175,12,2.8)}${opp(250,120,-10,3.6)}${opp(170,90,8,2.6)}
  ${ff(262,206,0)}${ff(128,146,.6)}${ff(242,100,1.2)}${ff(90,258,1.8)}
  <g class="ball">
    <animateMotion values="120,272;250,204;250,204;140,144;140,144;230,98;230,98;200,26;200,26" keyTimes="${KT}" calcMode="spline" keySplines="${Array(8).fill('.4 0 .3 1').join(';')}" dur="6s" repeatCount="indefinite"/>
    <animate attributeName="opacity" values="1;1;0;0;1" keyTimes="0;.88;.94;.99;1" dur="6s" repeatCount="indefinite"/>
    <g><animateTransform attributeName="transform" type="scale" values="1.15;.9;.9;.72;.72;.58;.58;.42;.42" keyTimes="${KT}" dur="6s" repeatCount="indefinite"/>
      <ellipse cx="2" cy="9" rx="9" ry="3" fill="rgba(0,0,0,.45)"/>
      <g><animateTransform attributeName="transform" type="translate" values="0 0;0 0;0 -14;0 -10;0 -10" keyTimes="0;.64;.69;.74;1" dur="6s" repeatCount="indefinite"/>
        <circle r="9" fill="url(#ballg)"/>
        <g clip-path="url(#ballclip)"><g fill="#1c1c1c"><animateTransform attributeName="transform" type="rotate" values="0;720" dur="6s" repeatCount="indefinite"/>
          <polygon points="0,-3.4 3.2,-1 2,2.8 -2,2.8 -3.2,-1"/><polygon points="0,-12 4,-9 2,-6 -2,-6 -4,-9"/><polygon points="10,-2 11,3 7,4 6,0 8,-3"/><polygon points="-10,-2 -8,-3 -6,0 -7,4 -11,3"/><polygon points="5,10 2,7 4,5 8,6 8,10"/><polygon points="-5,10 -8,10 -8,6 -4,5 -2,7"/></g></g>
        <circle r="9" fill="none" stroke="rgba(0,0,0,.25)" stroke-width=".8"/>
      </g>
    </g>
  </g>
  <g opacity="0"><animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;.74;.77;.88;.93;1" dur="6s" repeatCount="indefinite"/>
    <circle cx="200" cy="24" r="40" fill="url(#ffg)"/>
    <text x="200" y="66" text-anchor="middle" font-family="Jost,system-ui,sans-serif" font-size="26" font-weight="600" letter-spacing="4" fill="#ffe3a8" stroke="#0a0b0d" stroke-width="3" paint-order="stroke">VÀO!</text>
  </g>
  <rect width="400" height="300" fill="url(#fade)"/>
</svg>`;}
