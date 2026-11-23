import React from 'react';

interface BondingCurveChartProps {
  startPrice: number;
  graduationPrice: number;
  currentPrice?: number;
  progressPct?: number;
  baseSymbol: string;
  quoteSymbol?: string;
}

export const BondingCurveChart: React.FC<BondingCurveChartProps> = ({
  startPrice,
  graduationPrice,
  currentPrice,
  progressPct = 0,
  baseSymbol,
  quoteSymbol = 'WETH',
}) => {
  const width = 640;
  const height = 220;
  const padLeft = 56;
  const padRight = 24;
  const padTop = 20;
  const padBottom = 34;

  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const safeStart = startPrice > 0 ? startPrice : 0.000001;
  const safeGrad = graduationPrice > safeStart ? graduationPrice : safeStart * 4;

  // Constant-product / concentrated curve trajectory: P(x) grows smoothly from startPrice to graduationPrice
  const samples = 40;
  const points: Array<{ x: number; y: number; progress: number; price: number }> = [];

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    // Quadratic-like price acceleration characteristic of concentrated single-segment bonding curves:
    // sqrtPrice(t) interpolates monotonically; price(t) = (sqrtP0 + t*(sqrtP1 - sqrtP0))^2
    const sqrt0 = Math.sqrt(safeStart);
    const sqrt1 = Math.sqrt(safeGrad);
    const sqrtT = sqrt0 + t * (sqrt1 - sqrt0);
    const p = sqrtT * sqrtT;

    const normY = (p - safeStart) / (safeGrad - safeStart);
    const cx = padLeft + t * plotW;
    const cy = padTop + plotH - normY * plotH;
    points.push({ x: cx, y: cy, progress: t * 100, price: p });
  }

  const linePath = points
    .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
    .join(' ');

  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} Z`;

  const clampedProg = Math.min(100, Math.max(0, progressPct));
  const activeIdx = Math.min(samples, Math.round((clampedProg / 100) * samples));
  const activePoint = points[activeIdx];
  const filledPath = points
    .slice(0, activeIdx + 1)
    .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
    .join(' ');

  const formatCompactPrice = (val: number) => {
    if (val === 0) return '0';
    if (val < 0.0001) return val.toExponential(2);
    if (val < 1) return val.toFixed(6);
    return val.toFixed(3);
  };

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible"
        role="img"
        aria-label={`Bonding curve trajectory for ${baseSymbol} against ${quoteSymbol}`}
      >
        <defs>
          <linearGradient id="ammoraCurveFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Horizontal Gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((step) => {
          const y = padTop + plotH - step * plotH;
          const labelVal = safeStart + step * (safeGrad - safeStart);
          return (
            <g key={step}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                stroke="rgba(148,163,184,0.12)"
                strokeDasharray={step === 0 || step === 1 ? undefined : '3 3'}
              />
              <text
                x={padLeft - 8}
                y={y + 3.5}
                textAnchor="end"
                className="fill-slate-400 font-mono text-[10px]"
              >
                {formatCompactPrice(labelVal)}
              </text>
            </g>
          );
        })}

        {/* Graduation Ceiling Marker */}
        <line
          x1={width - padRight}
          y1={padTop}
          x2={width - padRight}
          y2={padTop + plotH}
          stroke="rgba(56,189,248,0.35)"
          strokeDasharray="4 3"
        />

        {/* Area & Full Curve Track */}
        <path d={areaPath} fill="url(#ammoraCurveFill)" />
        <path
          d={linePath}
          fill="none"
          stroke="rgba(148,163,184,0.35)"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Active Traversed Portion */}
        {clampedProg > 0 && (
          <path
            d={filledPath}
            fill="none"
            stroke="#10b981"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        )}

        {/* Spot Price Marker */}
        {activePoint && (
          <g>
            <line
              x1={activePoint.x}
              y1={padTop}
              x2={activePoint.x}
              y2={padTop + plotH}
              stroke="rgba(16,185,129,0.3)"
              strokeDasharray="2 2"
            />
            <circle
              cx={activePoint.x}
              cy={activePoint.y}
              r="5"
              className="fill-emerald-400 stroke-[#0B101B]"
              strokeWidth="2"
            />
          </g>
        )}

        {/* X Axis Labels */}
        <text x={padLeft} y={height - 10} className="fill-slate-400 font-mono text-[10px]">
          0% Sold
        </text>
        <text
          x={padLeft + plotW * 0.5}
          y={height - 10}
          textAnchor="middle"
          className="fill-slate-400 font-mono text-[10px]"
        >
          50% Curve Depth
        </text>
        <text
          x={width - padRight}
          y={height - 10}
          textAnchor="end"
          className="fill-sky-400 font-mono text-[10px]"
        >
          100% ARL Graduation
        </text>
      </svg>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-4 border-t border-slate-800/80 pt-3 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span>Start:</span>
          <span className="font-mono tabular-nums text-slate-200">
            {formatCompactPrice(safeStart)} {quoteSymbol}
          </span>
        </div>
        {currentPrice !== undefined && (
          <div className="flex items-center gap-2">
            <span>Current Spot:</span>
            <span className="font-mono tabular-nums text-emerald-400">
              {formatCompactPrice(currentPrice)} {quoteSymbol}
            </span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span>Graduation:</span>
          <span className="font-mono tabular-nums text-sky-400">
            {formatCompactPrice(safeGrad)} {quoteSymbol}
          </span>
        </div>
      </div>
    </div>
  );
};
