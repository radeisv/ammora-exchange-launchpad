import React, { useState } from 'react';
import { Check, ChevronDown, ChevronUp, Copy, ExternalLink } from 'lucide-react';
import { formatUnits, type Address, type Hex } from 'viem';
import { GIWA_EXPLORER_URL } from '../lib/ammora';

interface CalldataDrawerProps {
  title: string;
  to: Address;
  data: Hex;
  value?: bigint;
  approvalSpender?: Address | null;
  approvalToken?: Address | null;
  defaultOpen?: boolean;
}

export const CalldataDrawer: React.FC<CalldataDrawerProps> = ({
  title,
  to,
  data,
  value = 0n,
  approvalSpender,
  approvalToken,
  defaultOpen = false,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const payload = JSON.stringify({ to, data, value: value.toString() }, null, 2);
    navigator.clipboard?.writeText(payload).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="rounded-lg border border-slate-800 bg-[#0D1320]">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-medium text-slate-300 hover:text-slate-100 transition-colors"
      >
        <span className="whitespace-nowrap">{title}</span>
        <span className="flex items-center gap-2 text-slate-400">
          <span className="font-mono text-[11px]">{data.slice(0, 10)}…</span>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-800 px-4 py-3 space-y-2.5 text-xs">
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-400">Target Contract</span>
            <a
              href={`${GIWA_EXPLORER_URL}/address/${to}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-mono text-sky-400 hover:text-sky-300"
            >
              <span>{to}</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-400">Native Value</span>
            <span className="font-mono tabular-nums text-slate-200">
              {formatUnits(value, 18)} ETH
            </span>
          </div>

          {approvalSpender && approvalToken && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-400">Required ERC-20 Spender</span>
              <span className="font-mono text-amber-300">{approvalSpender}</span>
            </div>
          )}

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-slate-400">ABI Calldata</span>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:border-slate-600 hover:text-white transition-colors"
              >
                {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                <span>{copied ? 'Copied' : 'Copy JSON'}</span>
              </button>
            </div>
            <pre className="max-h-28 overflow-auto rounded border border-slate-800/80 bg-[#080C14] p-2.5 font-mono text-[11px] leading-relaxed text-slate-300 break-all whitespace-pre-wrap">
              {data}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
