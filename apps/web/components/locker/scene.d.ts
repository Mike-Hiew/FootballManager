export interface LkPlayer {
  id: string; n: number | null; name: string; short: string; line: number; pos: string; posVi: string; ovr: number;
  tier: 'silver' | 'gold' | 'dd'; cap: boolean; stats: Array<[string, number]>; age: number | null; foot: string;
  gp: number; g: number; a: number; mvp: number; att: string | null; me: boolean; isNew?: boolean; pending?: boolean;
}
export interface LkApi { start(i: number): void; go(i: number): void; step(d: number): void; focus(): number; states(): void; resize(): void; destroy(): void }
export function lkScene(THREE: unknown, canvas: HTMLCanvasElement, PL: LkPlayer[], o: {
  reduce: boolean; flashEl: HTMLElement; matchday: boolean; team: string; post?: Record<string, unknown>;
  showPlayer(i: number): void; onPick(p: LkPlayer): boolean; onReveal(p: LkPlayer): void; onPulse(): void;
}): LkApi;
