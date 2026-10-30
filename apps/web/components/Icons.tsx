const P = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, 'aria-hidden': true } as const;

export const TAB_ICONS: Record<string, React.ReactNode> = {
  doi: <svg {...P}><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" /><path d="M9 11.5l2 2 4-4" /></svg>,
  toi: <svg {...P}><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.8-3.8 3.6-6 7-6s6.2 2.2 7 6" /></svg>,
  'chien-thuat': <svg {...P}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M4 12h16" /><circle cx="12" cy="12" r="2.5" /></svg>,
  'cau-thu': <svg {...P}><circle cx="9" cy="8" r="3.2" /><path d="M3 20c.6-3.4 3-5.4 6-5.4s5.4 2 6 5.4" /><path d="M16 5.2a3 3 0 0 1 0 5.6M18 14.8c1.6.7 2.6 2.4 3 5.2" /></svg>,
  lich: <svg {...P}><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>,
  'thong-ke': <svg {...P}><path d="M5 20V11M12 20V5M19 20v-6" /></svg>,
  quy: <svg {...P}><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M16 14.5h2" /></svg>,
  duyet: <svg {...P}><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 12.5l3 3 5-6" /></svg>,
  'kham-pha': <svg {...P}><circle cx="12" cy="12" r="8.5" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></svg>,
  'he-thong': <svg {...P}><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" /></svg>,
};

export const Bell = () => <svg {...P}><path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>;

const RIC: Record<string, React.ReactNode> = {
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  check: <><rect x="4" y="4" width="16" height="16" rx="4" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>,
  coin: <><ellipse cx="12" cy="7" rx="7" ry="3" /><path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" /></>,
  shield: <><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" /></>,
  shirt: <><path d="M8 4l4 2 4-2 4 3-2 4-2-1v10H8V10l-2 1-2-4z" /></>,
  heart: <><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></>,
};
export const RuleIcon = ({ k }: { k: string }) => <svg {...P} width={18} height={18} strokeLinecap="round" strokeLinejoin="round">{RIC[k] ?? RIC.info}</svg>;
