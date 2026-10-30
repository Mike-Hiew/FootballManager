// Sinh fixture golden từ chính prototype (docs/prototype/domdom-fc.html):
// chạy posScore / inferStats / sample() gốc để bản port TypeScript so khớp số.
// Chạy: node packages/core/scripts/gen-golden.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../../../docs/prototype/domdom-fc.html', import.meta.url), 'utf8');
const cut = (from, to) => {
  const a = html.indexOf(from);
  const b = html.indexOf(to, a);
  if (a < 0 || b < 0) throw new Error('marker not found: ' + from);
  return html.slice(a, b);
};
const consts = cut('const POS = {', 'const VIEWS=');
const utils = [
  'const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));',
  'const pad=n=>String(n).padStart(2,"0");',
  'const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;',
  'const addDays=n=>{const d=new Date();d.setDate(d.getDate()+n);return iso(d);};',
].join('\n');
const formulas = cut('function footAdj(', 'const faceOf=');
const sample = cut('function sample(){', 'function blankInfo(');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(`${consts}\n${utils}\n${formulas}\n${sample}\nthis.out={W,POS,SK,posScore,inferStats,sample};`, ctx);
const { POS, posScore, inferStats, sample: S } = ctx.out;

const players = S().players.map((p) => ({
  id: p.id, fullName: p.fullName, nick: p.nick, foot: p.foot, payType: p.payType, stats: p.stats,
  scores: Object.fromEntries(Object.keys(POS).map((k) => [k, posScore(p.stats, p.foot, k)])),
}));
const inferCases = [
  [{ CB: 8.2, CDM: 7 }, 'Phải'], [{ GK: 7.8 }, 'Phải'], [{ CB: 7.4, LB: 7 }, 'Phải'], [{ CM: 8.4, CAM: 7.8 }, 'Phải'],
  [{ CDM: 7.6, CM: 7.2 }, 'Phải'], [{ RM: 8.1, ST: 7.2 }, 'Phải'], [{ LM: 7.5, LB: 7 }, 'Trái'], [{ ST: 8.6, CAM: 7 }, 'Phải'],
  [{ CAM: 8, ST: 7.4 }, 'Trái'], [{ CB: 7.5, CDM: 7 }, 'Phải'], [{ LM: 9, ST: 6 }, 'Hai chân'],
].map(([r, foot]) => ({ ratings: r, foot, stats: inferStats(r, foot) }));

writeFileSync(
  new URL('../test/__fixtures__/prototype-golden.json', import.meta.url),
  JSON.stringify({ players, inferCases }, null, 1) + '\n',
);
console.log('ok', players.length, 'players', inferCases.length, 'infer cases');
