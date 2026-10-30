import { faceStats, type Stats } from '@san7/core';

export function Radar({ stats }: { stats: Partial<Stats> }) {
  const f = faceStats(stats);
  const cx = 110, cy = 100, R = 72, n = f.length;
  const pt = (i: number, r: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  };
  return (
    <svg viewBox="0 0 220 200" role="img" aria-label="Biểu đồ chỉ số">
      {[0.25, 0.5, 0.75, 1].map((t) => <polygon key={t} className="rg" points={f.map((_, i) => pt(i, R * t).join(',')).join(' ')} />)}
      {f.map((_, i) => <line key={i} className="rg" x1={cx} y1={cy} x2={pt(i, R)[0]} y2={pt(i, R)[1]} />)}
      <polygon className="rv" points={f.map(({ value }, i) => pt(i, (R * value) / 10).join(',')).join(' ')} />
      {f.map(({ label, value }, i) => {
        const [x, y] = pt(i, R + 18);
        return (
          <text key={label} x={x} y={y} textAnchor="middle" dominantBaseline="middle">
            <tspan className="rn">{Math.round(value * 10)}</tspan> <tspan>{label}</tspan>
          </text>
        );
      })}
    </svg>
  );
}
