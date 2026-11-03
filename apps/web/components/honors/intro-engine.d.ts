export interface IntroPlayer { name: string; ovr: number; pos: string; num: number | null }
export interface Intro {
  play(): void;
  finish(): void;
  isDone(): boolean;
  attachThree(three: unknown): void;
  destroy(): void;
}
export function createIntro(opts: {
  root: HTMLElement;
  tier: 'dd' | 'gold' | 'silver';
  team: string;
  player: IntroPlayer;
  reduce?: boolean;
  onStart?: () => void;
  onLand?: () => void;
  onDone?: () => void;
}): Intro;
