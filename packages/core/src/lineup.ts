import { type Foot, type Position, positionScore, rankedPositions } from './positions';
import { slotsOf } from './formation';
import type { Stats } from './stats';

export interface LineupPlayer {
  id: string;
  name: string;
  stats: Partial<Stats>;
  foot: Foot | string;
  styles: readonly string[];
  isCaptain?: boolean;
}

/** Slot là "đúng sở trường" khi vị trí nằm trong top 3 điểm của người đó (BRD 5.2). */
export function isNatural(p: Pick<LineupPlayer, 'stats' | 'foot'>, pos: Position): boolean {
  return rankedPositions(p.stats, p.foot)
    .slice(0, 3)
    .some(([k]) => k === pos);
}

export interface LineupSummary {
  avg: number | null;
  filled: number;
  size: number;
  natural: number;
  styles: Array<[string, number]>;
  tips: string[];
}

/** Tổng quan đội hình: điểm đội hình, ra sân x/7, đúng sở trường, lối chơi nổi bật, cảnh báo. */
export function lineupSummary(
  formation: string,
  lineup: ReadonlyArray<string | null>,
  players: ReadonlyMap<string, LineupPlayer>,
  goingIds?: ReadonlySet<string> | null,
): LineupSummary {
  const slots = slotsOf(formation);
  let sum = 0;
  let n = 0;
  let nat = 0;
  const sc: Record<string, number> = {};
  slots.forEach(([pos], i) => {
    const p = lineup[i] ? players.get(lineup[i] as string) : undefined;
    if (!p) return;
    sum += positionScore(p.stats, p.foot, pos);
    n++;
    if (isNatural(p, pos)) nat++;
    for (const s of p.styles) sc[s] = (sc[s] || 0) + 1;
  });
  const tips: string[] = [];
  if (n < slots.length) tips.push(`Còn ${slots.length - n} vị trí trống.`);
  const gk = lineup[0] ? players.get(lineup[0] as string) : undefined;
  if (gk && positionScore(gk.stats, gk.foot, 'GK') < 6) tips.push('Người đang bắt gôn có điểm thủ môn thấp.');
  if (!gk) tips.push('Chưa có thủ môn.');
  if (n && !sc['Dứt điểm']) tips.push('Chưa có ai mạnh dứt điểm trên sân.');
  if (n >= 5 && !sc['Càn quét'] && !sc['Đọc tình huống']) tips.push('Tuyến dưới thiếu người thu hồi bóng.');
  if (n && !lineup.some((id) => id && players.get(id)?.isCaptain)) tips.push('Chưa có đội trưởng trên sân.');
  if (goingIds) {
    const out = lineup.filter((id): id is string => !!id && !goingIds.has(id)).map((id) => players.get(id)?.name ?? '?');
    if (out.length) tips.push(`${out.join(', ')} chưa xác nhận đi trận này.`);
  }
  return {
    avg: n ? sum / n : null,
    filled: n,
    size: slots.length,
    natural: nat,
    styles: Object.entries(sc).sort((a, b) => b[1] - a[1]).slice(0, 5),
    tips,
  };
}

/** Top 3 người hợp nhất cho một vị trí (điểm ≥ 6.5), dùng khi chạm slot (BRD 5.3). */
export function suggestForPosition<T extends Pick<LineupPlayer, 'id' | 'stats' | 'foot'>>(
  candidates: readonly T[],
  pos: Position,
  limit = 3,
): Array<{ player: T; score: number }> {
  return candidates
    .map((player) => ({ player, score: positionScore(player.stats, player.foot, pos) }))
    .filter((x) => x.score >= 6.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Điểm của một người ở từng slot (trừ slot người đó đang đứng) + slot hợp nhất (BRD 5.3). */
export function slotGlow(
  formation: string,
  lineup: ReadonlyArray<string | null>,
  p: Pick<LineupPlayer, 'id' | 'stats' | 'foot'>,
): { glow: Record<number, number>; best: number } {
  const glow: Record<number, number> = {};
  let best = -1;
  let bv = -1;
  slotsOf(formation).forEach(([pos], i) => {
    if (lineup[i] === p.id) return;
    const v = positionScore(p.stats, p.foot, pos);
    glow[i] = v;
    if (v > bv) {
      bv = v;
      best = i;
    }
  });
  return { glow, best };
}
