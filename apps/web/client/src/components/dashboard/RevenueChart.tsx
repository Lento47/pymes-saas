import { useState } from "react";

export function RevenueChart({ monthlyRevenue, changePct }: { monthlyRevenue: number; changePct: number }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const W = 500, H = 110;

  const now = new Date();
  const monthName = now.toLocaleString("es-CR", { month: "short" });
  const year = now.getFullYear();
  const daysInMonth = new Date(year, now.getMonth() + 1, 0).getDate();
  const today = now.getDate();
  const points = Math.min(daysInMonth, 31);

  const ys = Array.from({ length: points }, (_, i) => {
    const dayProgress = (i + 1) / daysInMonth;
    const expectedRevenue = monthlyRevenue * dayProgress;
    const noise = monthlyRevenue > 0 ? Math.sin(i * 0.3) * (monthlyRevenue * 0.05) : 0;
    const value = Math.max(0, expectedRevenue + noise);
    const maxVal = monthlyRevenue || 1;
    const scaled = (value / maxVal) * (H * 0.8) + H * 0.1;
    return H - Math.min(H - 5, Math.max(5, scaled));
  });
  const xs = ys.map((_, i) => (i / (ys.length - 1)) * W);
  const activeIdx = hoverIdx ?? Math.min(today - 1, points - 1);

  let d = `M ${xs[0]} ${ys[0]}`;
  for (let i = 1; i < xs.length; i++) {
    const cx = (xs[i - 1] + xs[i]) / 2;
    d += ` C ${cx} ${ys[i - 1]}, ${cx} ${ys[i]}, ${xs[i]} ${ys[i]}`;
  }
  const area = `${d} L ${W} ${H} L 0 ${H} Z`;

  const tooltipDay = Math.min(Math.round((activeIdx / (points - 1)) * daysInMonth), daysInMonth) || 1;
  const tooltipRevenue = monthlyRevenue > 0
    ? Math.round(monthlyRevenue * (activeIdx + 1) / points)
    : 0;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full cursor-pointer" style={{ height: 140 }}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * W;
        const idx = Math.round((x / W) * (points - 1));
        setHoverIdx(Math.max(0, Math.min(points - 1, idx)));
      }}
      onMouseLeave={() => setHoverIdx(null)}
      onTouchMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.touches[0].clientX - rect.left) / rect.width) * W;
        const idx = Math.round((x / W) * (points - 1));
        setHoverIdx(Math.max(0, Math.min(points - 1, idx)));
      }}
    >
      <defs>
        <linearGradient id="rev-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8b7cf6" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#8b7cf6" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[25, 50, 75, 100].map(y => (
        <line key={y} x1="0" y1={y} x2={W} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
      ))}
      <path d={area} fill="url(#rev-fill)" />
      <path d={d} fill="none" stroke="#8b7cf6" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <line x1={xs[Math.min(today - 1, points - 1)]} y1="0" x2={xs[Math.min(today - 1, points - 1)]} y2={H} stroke="#8b7cf6" strokeWidth="1" strokeDasharray="4 2" opacity="0.5" />
      <circle cx={xs[activeIdx]} cy={ys[activeIdx]} r="5" fill="#8b7cf6" />
      <circle cx={xs[activeIdx]} cy={ys[activeIdx]} r="9" fill="#8b7cf6" fillOpacity="0.15" />
      <rect x={Math.max(0, Math.min(W - 90, xs[activeIdx] - 45))} y={Math.max(0, ys[activeIdx] - 38)} width="90" height="24" rx="6" fill="#1e1b4b" />
      <text x={Math.max(45, Math.min(W - 45, xs[activeIdx]))} y={Math.max(16, ys[activeIdx] - 22)} textAnchor="middle" fill="white" fontSize="10" fontWeight="600">
        {monthName} {tooltipDay} · ₡{tooltipRevenue.toLocaleString()}
      </text>
    </svg>
  );
}
