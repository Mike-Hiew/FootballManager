import { type Position } from './positions';

export type Slot = readonly [pos: Position, x: number, y: number];

/** 5 sơ đồ sân 7, toạ độ %, khung thành đội mình ở dưới (BRD 5.1). Slot 0 luôn là GK. */
export const FORMATIONS = {
  '2-3-1': [['GK', 50, 91], ['CB', 30, 73], ['CB', 70, 73], ['LM', 17, 48], ['CM', 50, 52], ['RM', 83, 48], ['ST', 50, 20]],
  '3-2-1': [['GK', 50, 91], ['LB', 18, 72], ['CB', 50, 75], ['RB', 82, 72], ['CM', 32, 49], ['CM', 68, 49], ['ST', 50, 20]],
  '2-1-2-1': [['GK', 50, 91], ['CB', 30, 75], ['CB', 70, 75], ['CDM', 50, 59], ['LM', 20, 40], ['RM', 80, 40], ['ST', 50, 17]],
  '3-1-2': [['GK', 50, 91], ['LB', 18, 72], ['CB', 50, 75], ['RB', 82, 72], ['CM', 50, 51], ['ST', 32, 23], ['ST', 68, 23]],
  '2-2-2': [['GK', 50, 91], ['CB', 30, 74], ['CB', 70, 74], ['CM', 30, 50], ['CM', 70, 50], ['ST', 30, 23], ['ST', 70, 23]],
} as const satisfies Record<string, readonly Slot[]>;

export type FormationId = keyof typeof FORMATIONS;
export const FORMATION_IDS = Object.keys(FORMATIONS) as FormationId[];
export const DEFAULT_FORMATION: FormationId = '2-3-1';
export const SQUAD_SIZE = 7;

export function isFormation(f: string): f is FormationId {
  return f in FORMATIONS;
}

export function slotsOf(f: FormationId | string): readonly Slot[] {
  return FORMATIONS[isFormation(f) ? f : DEFAULT_FORMATION];
}

export function slotPositions(f: FormationId | string): Position[] {
  return slotsOf(f).map((s) => s[0]);
}

export type Lineup = Array<string | null>;

/** Chuẩn hoá đội hình: đủ 7 phần tử, bỏ id không còn trong danh sách, bỏ trùng. */
export function cleanLineup(lineup: ReadonlyArray<string | null> | null | undefined, validIds: Iterable<string>): Lineup {
  const ok = new Set(validIds);
  const seen = new Set<string>();
  const out: Lineup = [];
  for (let i = 0; i < SQUAD_SIZE; i++) {
    const id = lineup?.[i] ?? null;
    if (id && ok.has(id) && !seen.has(id)) {
      out.push(id);
      seen.add(id);
    } else out.push(null);
  }
  return out;
}

/**
 * Đổi sơ đồ: giữ người cũ ở slot cùng vị trí, người còn lại đặt vào slot trống
 * có điểm cao nhất của họ (BRD 5.1).
 */
export function changeFormation(
  from: FormationId | string,
  lineup: ReadonlyArray<string | null>,
  to: FormationId | string,
  scoreOf: (playerId: string, pos: Position) => number,
): Lineup {
  const oldSlots = slotPositions(from);
  const newSlots = slotPositions(to);
  const out: Lineup = new Array(newSlots.length).fill(null);
  const rest: string[] = [];
  oldSlots.forEach((pos, i) => {
    const id = lineup[i];
    if (!id) return;
    const j = newSlots.findIndex((p, k) => p === pos && !out[k]);
    if (j >= 0) out[j] = id;
    else rest.push(id);
  });
  for (const id of rest) {
    let bi = -1;
    let bs = -Infinity;
    newSlots.forEach((pos, k) => {
      if (out[k]) return;
      const s = scoreOf(id, pos);
      if (s > bs) {
        bs = s;
        bi = k;
      }
    });
    if (bi >= 0) out[bi] = id;
  }
  return out;
}

/** Đặt cầu thủ vào slot; nếu slot có người thì hoán đổi; nếu người đó đang ở slot khác thì đổi chỗ. */
export function placeInLineup(lineup: ReadonlyArray<string | null>, playerId: string, slot: number): Lineup {
  const out = [...lineup];
  const cur = out.indexOf(playerId);
  if (cur === slot) return out;
  const occ = out[slot] ?? null;
  if (cur >= 0) out[cur] = occ;
  out[slot] = playerId;
  return out;
}

export function swapSlots(lineup: ReadonlyArray<string | null>, a: number, b: number): Lineup {
  const out = [...lineup];
  [out[a], out[b]] = [out[b] ?? null, out[a] ?? null];
  return out;
}

export function removeFromLineup(lineup: ReadonlyArray<string | null>, playerId: string): Lineup {
  return lineup.map((x) => (x === playerId ? null : x));
}
