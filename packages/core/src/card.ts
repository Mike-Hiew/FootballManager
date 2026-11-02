import { rankedPositions, type Position } from './positions';
import type { Stats } from './stats';

/**
 * Thẻ cầu thủ (Vinh danh, BRD 13): hạng thẻ theo OVR và 6 chỉ số hiển thị trên mặt thẻ (thang 0–99).
 */
export type CardTier = 'dd' | 'gold' | 'silver';
export const TIER_NAME: Record<CardTier, string> = { dd: 'Hạng Đom Đóm', gold: 'Hạng Vàng', silver: 'Hạng Bạc' };

/** Đom Đóm ≥ 85 · Vàng 75–84 · Bạc < 75. */
export const cardTier = (ovr: number): CardTier => (ovr >= 85 ? 'dd' : ovr >= 75 ? 'gold' : 'silver');

const avg = (s: Partial<Stats>, keys: Array<keyof Stats>) => keys.reduce((a, k) => a + (s[k] ?? 5), 0) / keys.length;
const to99 = (v: number) => Math.max(1, Math.min(99, Math.round(v * 10)));

/** 6 chỉ số mặt thẻ. Thủ môn dùng nhóm riêng. */
export function cardStats(s: Partial<Stats>, pos: Position): Array<[string, number]> {
  if (pos === 'GK') {
    return [
      ['BẮT', to99(avg(s, ['HAN']))], ['PHẢN', to99(avg(s, ['REF']))], ['PHÁT', to99(avg(s, ['GKP']))],
      ['ĐỌC', to99(avg(s, ['REA']))], ['CHUYỀN', to99(avg(s, ['PAS', 'LPA']))], ['THỂ', to99(avg(s, ['STA', 'STR']))],
    ];
  }
  return [
    ['TỐC', to99(avg(s, ['PAC']))], ['RÊ', to99(avg(s, ['DRI']))], ['SÚT', to99(avg(s, ['FIN', 'SHO']))],
    ['THỦ', to99(avg(s, ['TAC', 'DEF']))], ['CHUYỀN', to99(avg(s, ['PAS', 'VIS', 'LPA']))], ['THỂ', to99(avg(s, ['STA', 'STR']))],
  ];
}

/** Ảnh chụp thẻ tại thời điểm vinh danh. */
export interface CardSnapshot {
  name: string;
  fullName: string;
  num: number | null;
  avatarUrl: string | null;
  foot: string;
  style: string | null;
  pos: Position;
  ovr: number;
  alt: string;
  stats: Array<[string, number]>;
  /** chỉ có ở thẻ "lên chỉ số" */
  prevOvr?: number;
  prevStats?: Array<[string, number]>;
}

export function cardOf(p: { nick: string | null; fullName: string; num: number | null; avatarUrl: string | null; foot: string; styles: string[] }, stats: Partial<Stats>): CardSnapshot {
  const ranked = rankedPositions(stats, p.foot);
  const [pos, score] = ranked[0];
  const alt = ranked.slice(1, 3).map(([k, v]) => `${k} ${Math.round(v * 10)}`).join(' · ');
  return {
    name: p.nick?.trim() || p.fullName.trim().split(/\s+/).slice(-2).join(' '),
    fullName: p.fullName, num: p.num, avatarUrl: p.avatarUrl, foot: p.foot, style: p.styles[0] ?? null,
    pos, ovr: Math.round(score * 10), alt, stats: cardStats(stats, pos),
  };
}
