import React from 'react';

interface TokenMarkProps {
  symbol: string;
  size?: number;
}

export const TokenMark: React.FC<TokenMarkProps> = ({ symbol, size = 28 }) => {
  const clean = symbol.toUpperCase();
  if (clean === 'ETH' || clean === 'WETH') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect
          width="32"
          height="32"
          rx="8"
          className={clean === 'ETH' ? 'fill-slate-800' : 'fill-sky-950'}
        />
        <rect
          x="0.5"
          y="0.5"
          width="31"
          height="31"
          rx="7.5"
          className={clean === 'ETH' ? 'stroke-slate-700' : 'stroke-sky-700/60'}
        />
        <path
          d="M16 5.5L9.5 16.2L16 20L22.5 16.2L16 5.5Z"
          className={clean === 'ETH' ? 'fill-slate-200' : 'fill-sky-300'}
        />
        <path
          d="M16 21.3L9.5 17.5L16 26.5L22.5 17.5L16 21.3Z"
          className={clean === 'ETH' ? 'fill-slate-400' : 'fill-sky-500'}
        />
      </svg>
    );
  }

  // Deterministic geometric hue from symbol characters
  const hash = clean.split('').reduce((acc, ch) => acc + ch.charCodeAt(0) * 17, 0);
  const palettes = [
    { bg: 'fill-emerald-950', stroke: 'stroke-emerald-700/60', text: 'fill-emerald-300' },
    { bg: 'fill-cyan-950', stroke: 'stroke-cyan-700/60', text: 'fill-cyan-300' },
    { bg: 'fill-amber-950', stroke: 'stroke-amber-700/60', text: 'fill-amber-300' },
    { bg: 'fill-indigo-950', stroke: 'stroke-indigo-700/60', text: 'fill-indigo-300' },
  ];
  const palette = palettes[hash % palettes.length];
  const monogram = clean.slice(0, 2);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect width="32" height="32" rx="8" className={palette.bg} />
      <rect x="0.5" y="0.5" width="31" height="31" rx="7.5" className={palette.stroke} />
      <text
        x="16"
        y="20.5"
        textAnchor="middle"
        className={`${palette.text} font-mono text-[11px] font-semibold`}
      >
        {monogram}
      </text>
    </svg>
  );
};
