'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { shortName } from '@san7/core';
import type { MatchDTO, PlayerDTO, TeamView } from '@/lib/types';
import type { ActionResult } from '@/server/result';

interface Ctx {
  view: TeamView;
  teamId: string;
  canEdit: boolean;
  players: PlayerDTO[];
  byId: (id: string | null | undefined) => PlayerDTO | undefined;
  nameOf: (id: string | null | undefined) => string;
  matchById: (id: string | null | undefined) => MatchDTO | undefined;
  now: Date;
  toast: (msg: string) => void;
  /** chạy server action: báo lỗi/cảnh báo bằng toast; trả về data khi thành công */
  act: <T>(fn: () => Promise<ActionResult<T>>, okMsg?: string | ((d: T) => string)) => Promise<T | undefined>;
  pending: boolean;
  /** stats nháp của form cầu thủ cho popover công thức */
  draft: React.RefObject<{ stats: Record<string, number>; foot: string } | null>;
}

const TeamCtx = createContext<Ctx | null>(null);

export function useTeam(): Ctx {
  const c = useContext(TeamCtx);
  if (!c) throw new Error('useTeam ngoài TeamProvider');
  return c;
}

export function TeamProvider({ view, children }: { view: TeamView; children: React.ReactNode }) {
  const [toastMsg, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pending, start] = useTransition();
  const draft = useRef<{ stats: Record<string, number>; foot: string } | null>(null);
  // Đánh dấu đã hydrate (listener tooltip/popover của component con đã gắn) — dùng cho E2E.
  useEffect(() => {
    document.documentElement.dataset.hydrated = '1';
  }, []);

  const toast = useCallback((m: string) => {
    setToast(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  const act = useCallback(
    <T,>(fn: () => Promise<ActionResult<T>>, okMsg?: string | ((d: T) => string)) =>
      new Promise<T | undefined>((resolve) => {
        start(async () => {
          const r = await fn();
          if (!r.ok) {
            toast(r.error);
            resolve(undefined);
            return;
          }
          if (r.warning) toast(r.warning);
          else if (okMsg) toast(typeof okMsg === 'function' ? okMsg(r.data) : okMsg);
          resolve(r.data);
        });
      }),
    [toast],
  );

  const value = useMemo<Ctx>(() => {
    const pm = new Map(view.players.map((p) => [p.id, p]));
    const fm = new Map(view.formerPlayers.map((p) => [p.id, p]));
    const mm = new Map(view.matches.map((m) => [m.id, m]));
    return {
      view,
      teamId: view.team.id,
      canEdit: view.canEdit,
      players: view.players,
      byId: (id) => (id ? pm.get(id) : undefined),
      nameOf: (id) => (id ? shortName(pm.get(id) ?? fm.get(id)) : '?'),
      matchById: (id) => (id ? mm.get(id) : undefined),
      now: new Date(view.now),
      toast,
      act,
      pending,
      draft,
    };
  }, [view, toast, act, pending]);

  return (
    <TeamCtx.Provider value={value}>
      {children}
      <div className="toast" role="status" aria-live="polite" hidden={!toastMsg}>{toastMsg}</div>
    </TeamCtx.Provider>
  );
}
