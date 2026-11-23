import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownUp, ExternalLink, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { formatUnits, isAddress, type Address } from 'viem';
import {
  CANARY_V4_CURVE,
  CORE_ASSETS,
  FEATURED_GIWA_MARKETS,
  GIWA_EXPLORER_URL,
  TAMM_CURVE_ADDRESS,
  TAMM_POOL_ADDRESS,
  TAMM_TOKEN_ADDRESS,
  executeSwapPlan,
  fetchLiveCurveBundle,
  fetchTammPoolSpot,
  quoteAndPlanSwap,
  sqrtPriceX64ToHumanPrice,
  type LiveCurveBundle,
  type SwapQuoteResult,
  type TokenAsset,
  type WalletState,
} from '../lib/ammora';
import { BondingCurveChart } from './BondingCurveChart';
import { CalldataDrawer } from './CalldataDrawer';
import { TokenMark } from './TokenMark';

interface SwapWorkspaceProps {
  wallet: WalletState;
  initialCurveBundle: LiveCurveBundle | null;
  selectedCurveAddress: Address;
  onSelectCurveAddress: (addr: Address) => void;
  onConnectWallet: () => void;
  onRefreshBalances?: () => Promise<void>;
}

const SLIPPAGE_PRESETS_BPS = [
  { label: '0.1%', bps: 10 },
  { label: '0.5%', bps: 50 },
  { label: '1.0%', bps: 100 },
  { label: '2.5%', bps: 250 },
];

export const SwapWorkspace: React.FC<SwapWorkspaceProps> = ({
  wallet,
  initialCurveBundle,
  selectedCurveAddress,
  onSelectCurveAddress,
  onConnectWallet,
  onRefreshBalances,
}) => {
  const [curveBundle, setCurveBundle] = useState<LiveCurveBundle | null>(initialCurveBundle);
  const [tammSpot, setTammSpot] = useState<{ sqrtPrice: bigint; feeBps: number; spotPriceWeth: number; live: boolean } | null>(null);
  const [loadingCurve, setLoadingCurve] = useState(false);
  const [customCurveInput, setCustomCurveInput] = useState<string>(selectedCurveAddress);

  const availableAssets: TokenAsset[] = useMemo(() => {
    const base = CORE_ASSETS.filter((a) => a.symbol !== 'AIV4C');
    const featuredExtras: TokenAsset[] = FEATURED_GIWA_MARKETS.filter(
      (m) => m.symbol !== 'tAMM' && m.symbol !== 'AIV4C',
    ).map((m) => ({
      address: m.tokenAddress,
      symbol: m.symbol,
      name: m.name,
      decimals: m.decimals,
      curveAddress: m.curveAddress,
      poolKind: m.venueKind,
    }));

    if (curveBundle && !CORE_ASSETS.some((a) => a.address.toLowerCase() === curveBundle.state.baseToken.toLowerCase())) {
      const existingCustom = featuredExtras.some(
        (e) => e.address.toLowerCase() === curveBundle.state.baseToken.toLowerCase(),
      );
      const list = [...base, ...featuredExtras];
      if (!existingCustom) {
        list.push({
          address: curveBundle.state.baseToken,
          symbol: curveBundle.tokenMeta.symbol,
          name: curveBundle.tokenMeta.name,
          decimals: curveBundle.tokenMeta.decimals,
          curveAddress: curveBundle.curveAddress,
          poolKind: 'v4-curve',
        });
      }
      return list;
    }

    return [
      ...base,
      CORE_ASSETS.find((a) => a.symbol === 'AIV4C')!,
      ...featuredExtras,
    ];
  }, [curveBundle]);

  const [tokenInSymbol, setTokenInSymbol] = useState<string>('ETH');
  const [tokenOutSymbol, setTokenOutSymbol] = useState<string>(
    selectedCurveAddress.toLowerCase() === TAMM_CURVE_ADDRESS.toLowerCase() ? 'tAMM' : 'tAMM',
  );
  const [amountIn, setAmountIn] = useState<string>('0.005');
  const [slippageBps, setSlippageBps] = useState<number>(100);
  const [quote, setQuote] = useState<SwapQuoteResult | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);
  const [executionProgress, setExecutionProgress] = useState<string | null>(null);
  const [txResult, setTxResult] = useState<{
    mode: 'sent' | 'simulated';
    hash?: string;
    note: string;
  } | null>(null);

  useEffect(() => {
    fetchTammPoolSpot().then(setTammSpot);
  }, []);

  useEffect(() => {
    const matched = availableAssets.find(
      (a) => a.curveAddress && a.curveAddress.toLowerCase() === selectedCurveAddress.toLowerCase(),
    );
    if (matched && tokenOutSymbol !== matched.symbol && tokenInSymbol !== matched.symbol) {
      setTokenOutSymbol(matched.symbol);
    }
  }, [selectedCurveAddress, availableAssets]);

  useEffect(() => {
    if (initialCurveBundle && selectedCurveAddress === initialCurveBundle.curveAddress) {
      setCurveBundle(initialCurveBundle);
      setCustomCurveInput(initialCurveBundle.curveAddress);
    }
  }, [initialCurveBundle, selectedCurveAddress]);

  const refreshCurve = async (addr: Address) => {
    setLoadingCurve(true);
    setQuoteError(null);
    try {
      const next = await fetchLiveCurveBundle(addr);
      setCurveBundle(next);
      onSelectCurveAddress(addr);
      setTokenOutSymbol((prev) => (prev === 'WETH' || prev === 'ETH' ? prev : next.tokenMeta.symbol));
    } catch (err) {
      setQuoteError(err instanceof Error ? err.message : 'Unable to load curve from GIWA Sepolia.');
    } finally {
      setLoadingCurve(false);
    }
  };

  useEffect(() => {
    if (selectedCurveAddress && (!curveBundle || curveBundle.curveAddress.toLowerCase() !== selectedCurveAddress.toLowerCase())) {
      refreshCurve(selectedCurveAddress);
    }
  }, [selectedCurveAddress]);

  const tokenIn = useMemo(
    () => availableAssets.find((a) => a.symbol === tokenInSymbol) ?? availableAssets[1],
    [availableAssets, tokenInSymbol],
  );
  const tokenOut = useMemo(
    () => availableAssets.find((a) => a.symbol === tokenOutSymbol) ?? availableAssets[availableAssets.length - 1],
    [availableAssets, tokenOutSymbol],
  );

  // Live quote whenever inputs change
  useEffect(() => {
    let cancelled = false;
    const numericVal = Number(amountIn);
    if (!amountIn || Number.isNaN(numericVal) || numericVal <= 0) {
      setQuote(null);
      setQuoteError(null);
      return;
    }

    if (tokenIn.symbol === tokenOut.symbol) {
      setQuote(null);
      setQuoteError('Select two different assets.');
      return;
    }

    const recipient = wallet.address ?? ('0x13cD27a6E337097dB858C9C4FA472FbAd2F2c637' as Address);
    const timer = setTimeout(async () => {
      setQuoting(true);
      setQuoteError(null);
      try {
        const res = await quoteAndPlanSwap({
          tokenIn,
          tokenOut,
          amountInHuman: amountIn,
          slippageBps,
          recipient,
          activeCurve: curveBundle,
        });
        if (!cancelled) {
          setQuote(res);
        }
      } catch (err) {
        if (!cancelled) {
          setQuote(null);
          setQuoteError(err instanceof Error ? err.message.split('\n')[0] : 'Quote unavailable.');
        }
      } finally {
        if (!cancelled) setQuoting(false);
      }
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [amountIn, tokenIn, tokenOut, slippageBps, wallet.address, curveBundle]);

  const handleFlipDirection = () => {
    const prevIn = tokenIn.symbol;
    setTokenInSymbol(tokenOut.symbol);
    setTokenOutSymbol(prevIn);
    setTxResult(null);
  };

  const handleLoadCustomCurve = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAddress(customCurveInput.trim())) {
      setQuoteError('Enter a valid 0x EVM curve address on GIWA Sepolia.');
      return;
    }
    refreshCurve(customCurveInput.trim() as Address);
  };

  const handleExecuteSwap = async () => {
    if (!quote) return;
    setExecuting(true);
    setExecutionProgress(null);
    setTxResult(null);
    setQuoteError(null);
    try {
      const res = await executeSwapPlan({
        wallet,
        quote,
        onProgress: (status) => setExecutionProgress(status),
      });
      setTxResult(res);
      if (res.mode === 'sent') {
        await onRefreshBalances?.();
      }
    } catch (err) {
      setQuoteError(err instanceof Error ? err.message.split('\n')[0] : 'Swap execution rejected or reverted.');
    } finally {
      setExecutionProgress(null);
      setExecuting(false);
    }
  };

  const formattedOut = quote
    ? Number(formatUnits(quote.amountOutRaw, tokenOut.decimals)).toLocaleString('en-US', {
        maximumFractionDigits: 6,
      })
    : '0.0';

  const formattedMinOut = quote
    ? Number(formatUnits(quote.minimumAmountOutRaw, tokenOut.decimals)).toLocaleString('en-US', {
        maximumFractionDigits: 6,
      })
    : '0.0';

  const formattedFee = quote
    ? Number(formatUnits(quote.feeRaw, tokenIn.decimals)).toExponential(3)
    : '0';

  const curveStartPrice = curveBundle
    ? sqrtPriceX64ToHumanPrice(
        18446744073709551616n,
        curveBundle.tokenMeta.decimals,
        18,
      )
    : 0.000001;
  const curveGradPrice = curveBundle
    ? sqrtPriceX64ToHumanPrice(
        curveBundle.state.migrationSqrtPrice,
        curveBundle.tokenMeta.decimals,
        18,
      )
    : 0.000004;

  const migrationPct = curveBundle ? curveBundle.progress.progressBps / 100 : 0;

  return (
    <div className="space-y-8">
      {/* Header Row */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between border-b border-slate-800/80 pb-6">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight text-slate-50">
            Low-Slippage Swap Router
          </h1>
          <p className="mt-1.5 text-sm text-slate-400">
            Exact-input quotes, native ETH auto-routing, and slippage-protected execution via{' '}
            <span className="font-mono text-slate-300">AmmoraRouteClient</span> and{' '}
            <span className="font-mono text-slate-300">AmmoraV4LaunchCurveClient</span>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <span>GIWA Sepolia</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">Chain 91342</span>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={() => refreshCurve(curveBundle?.curveAddress ?? CANARY_V4_CURVE)}
            disabled={loadingCurve}
            className="inline-flex items-center gap-1.5 text-sky-400 hover:text-sky-300 transition-colors whitespace-nowrap"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingCurve ? 'animate-spin' : ''}`} />
            <span>Refresh On-Chain State</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Trading Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Swap Ticket */}
        <div className="lg:col-span-5 rounded-xl border border-slate-800 bg-[#111827] p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-slate-100">Swap Assets</h2>
            <div className="flex items-center gap-1 rounded-lg bg-[#0B101B] p-1 border border-slate-800">
              {SLIPPAGE_PRESETS_BPS.map((preset) => (
                <button
                  key={preset.bps}
                  type="button"
                  onClick={() => setSlippageBps(preset.bps)}
                  className={`px-2.5 py-1 text-xs font-mono rounded-md transition-colors whitespace-nowrap ${
                    slippageBps === preset.bps
                      ? 'bg-slate-800 text-emerald-400'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Pay Input */}
          <div className="rounded-lg border border-slate-800 bg-[#0B101B] p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>You Pay</span>
              <span className="font-mono tabular-nums">
                {tokenIn.symbol === 'ETH'
                  ? `Bal: ${wallet.ethBalance} ETH`
                  : tokenIn.symbol === 'WETH'
                    ? `Bal: ${wallet.wethBalance} WETH`
                    : tokenIn.symbol === 'tAMM'
                      ? `Bal: ${wallet.tammBalance} tAMM`
                      : `Curve Base Asset`}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <input
                type="number"
                min="0"
                step="any"
                value={amountIn}
                onChange={(e) => {
                  setAmountIn(e.target.value);
                  setTxResult(null);
                }}
                placeholder="0.0"
                aria-label="Amount to pay"
                className="w-full bg-transparent font-mono text-2xl font-medium tabular-nums text-slate-50 outline-none placeholder:text-slate-600"
              />
              <div className="flex items-center gap-2 shrink-0">
                <TokenMark symbol={tokenIn.symbol} size={24} />
                <select
                  value={tokenIn.symbol}
                  onChange={(e) => setTokenInSymbol(e.target.value)}
                  aria-label="Pay asset"
                  className="rounded-lg border border-slate-700 bg-[#151E30] px-2.5 py-1.5 text-sm font-medium text-slate-100 outline-none focus:border-emerald-500"
                >
                  {availableAssets.map((asset) => (
                    <option key={asset.symbol} value={asset.symbol}>
                      {asset.symbol}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Flip Button */}
          <div className="flex justify-center -my-2 relative z-10">
            <button
              type="button"
              onClick={handleFlipDirection}
              aria-label="Reverse swap direction"
              className="rounded-lg border border-slate-700 bg-[#151E30] p-2 text-slate-300 hover:border-emerald-500/60 hover:text-emerald-400 transition-colors"
            >
              <ArrowDownUp className="h-4 w-4" />
            </button>
          </div>

          {/* Receive Output */}
          <div className="rounded-lg border border-slate-800 bg-[#0B101B] p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>You Receive (Estimated)</span>
              <span className="font-mono tabular-nums">
                {quoting ? 'Quoting RPC…' : quote ? `Block #${quote.asOfBlock.toString()}` : 'Ready'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="font-mono text-2xl font-medium tabular-nums text-slate-50 truncate">
                {quoting ? '…' : formattedOut}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <TokenMark symbol={tokenOut.symbol} size={24} />
                <select
                  value={tokenOut.symbol}
                  onChange={(e) => setTokenOutSymbol(e.target.value)}
                  aria-label="Receive asset"
                  className="rounded-lg border border-slate-700 bg-[#151E30] px-2.5 py-1.5 text-sm font-medium text-slate-100 outline-none focus:border-emerald-500"
                >
                  {availableAssets.map((asset) => (
                    <option key={asset.symbol} value={asset.symbol}>
                      {asset.symbol}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Quote Details Table (Hairline Dividers, Tabular Nums) */}
          {quote && (
            <div className="border-t border-slate-800 pt-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-400 shrink-0">Route Venue</span>
                <span className="text-slate-200 font-medium text-right">{quote.routeLabel}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-400 shrink-0">Auto-Route Path</span>
                <span className="font-mono text-sky-400">
                  {quote.routePath.join(' → ')}
                  {quote.executionSteps.length > 1 ? ` (${quote.executionSteps.length} steps)` : ' (Single Tx)'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Minimum Received ({(slippageBps / 100).toFixed(2)}% slippage)</span>
                <span className="font-mono tabular-nums text-emerald-400">
                  {formattedMinOut} {tokenOut.symbol}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Protocol &amp; LP Fee</span>
                <span className="font-mono tabular-nums text-slate-200">
                  {formattedFee} {tokenIn.symbol} ({quote.feeBps} bps)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Price Impact</span>
                <span
                  className={`font-mono tabular-nums ${
                    quote.priceImpactPct > 2 ? 'text-amber-400' : 'text-slate-200'
                  }`}
                >
                  {quote.priceImpactPct.toFixed(4)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Fill Classification</span>
                <span className="font-mono text-slate-300">{quote.fillKind}</span>
              </div>
            </div>
          )}

          {quoteError && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-950/30 px-3.5 py-2.5 text-xs text-rose-300">
              {quoteError}
            </div>
          )}

          {/* Action CTA */}
          {!wallet.connected ? (
            <button
              type="button"
              onClick={onConnectWallet}
              className="w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-400 transition-colors whitespace-nowrap"
            >
              Connect Wallet to Trade
            </button>
          ) : (
            <button
              type="button"
              disabled={!quote || quoting || executing}
              onClick={handleExecuteSwap}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              {executing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{executionProgress ?? 'Preparing Transaction…'}</span>
                </>
              ) : wallet.isSimulated ? (
                <span>Simulate Swap &amp; Inspect Calldata</span>
              ) : (
                <span>
                  {quote && quote.executionSteps.length > 1
                    ? `Auto-Route Swap (${quote.routePath.join(' → ')})`
                    : 'Execute Swap on GIWA Sepolia'}
                </span>
              )}
            </button>
          )}

          {txResult && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-3.5 text-xs text-emerald-200 space-y-1.5">
              <div className="flex items-center gap-1.5 font-medium text-emerald-300">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span>{txResult.mode === 'sent' ? 'Transaction Broadcast' : 'Pre-Flight Simulation Complete'}</span>
              </div>
              <p className="text-slate-300 leading-relaxed">{txResult.note}</p>
              {txResult.hash && (
                <a
                  href={`${GIWA_EXPLORER_URL}/tx/${txResult.hash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-sky-400 hover:text-sky-300"
                >
                  <span>View Tx {txResult.hash.slice(0, 12)}…</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          )}

          {quote && (
            <CalldataDrawer
              title="Inspect Unsigned SDK Swap Calldata"
              to={quote.unsignedTx.to}
              data={quote.unsignedTx.data}
              value={quote.unsignedTx.value}
              approvalSpender={quote.unsignedTx.approvalSpender}
              approvalToken={quote.unsignedTx.approvalToken}
            />
          )}
        </div>

        {/* Right Column: Live Market & Bonding Curve / ARL Pool Depth */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-xl border border-slate-800 bg-[#111827] p-6 space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-5">
              <div className="flex items-center gap-3">
                <TokenMark
                  symbol={
                    tokenOut.symbol === 'tAMM' || tokenIn.symbol === 'tAMM'
                      ? 'tAMM'
                      : curveBundle?.tokenMeta.symbol ?? 'AIV4C'
                  }
                  size={36}
                />
                <div>
                  <h2 className="font-display text-lg font-semibold text-slate-50">
                    {tokenOut.symbol === 'tAMM' || tokenIn.symbol === 'tAMM'
                      ? 'tAmm Coin (tAMM) · Graduated ARL Pool'
                      : `${curveBundle?.tokenMeta.name ?? 'Ammora V4 Canary'} (${curveBundle?.tokenMeta.symbol ?? 'AIV4C'})`}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-0.5">
                    {tokenOut.symbol === 'tAMM' || tokenIn.symbol === 'tAMM' ? (
                      <>
                        <span className="font-mono">
                          Token {TAMM_TOKEN_ADDRESS.slice(0, 6)}…{TAMM_TOKEN_ADDRESS.slice(-4)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">
                          Pool {TAMM_POOL_ADDRESS.slice(0, 6)}…{TAMM_POOL_ADDRESS.slice(-4)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>Fee {tammSpot ? `${tammSpot.feeBps / 100}%${tammSpot.live ? '' : ' (cached)'}` : '—'}</span>
                      </>
                    ) : (
                      <>
                        <span className="font-mono">
                          Curve {selectedCurveAddress.slice(0, 6)}…{selectedCurveAddress.slice(-4)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>Fee {curveBundle ? `${curveBundle.state.currentFeeBps / 100}%` : '1.25%'}</span>
                        <span aria-hidden="true">·</span>
                        <span>{curveBundle?.progress.migrated ? 'Graduated to ARL' : 'Active Bonding Curve'}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <a
                href={`${GIWA_EXPLORER_URL}/address/${
                  tokenOut.symbol === 'tAMM' || tokenIn.symbol === 'tAMM'
                    ? TAMM_POOL_ADDRESS
                    : selectedCurveAddress
                }`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-400 hover:text-sky-300 whitespace-nowrap"
              >
                <span>Explorer</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>

            {/* 4-Column Flat Metrics Row */}
            {tokenOut.symbol === 'tAMM' || tokenIn.symbol === 'tAMM' ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-slate-800 pb-5">
                <div>
                  <div className="text-xs text-slate-400">tAMM Spot Price</div>
                  <div className="mt-1 font-mono text-sm font-semibold tabular-nums text-slate-100">
                    {tammSpot ? `${tammSpot.spotPriceWeth.toFixed(6)} WETH${tammSpot.live ? '' : ' (cached)'}` : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Rate per 1 WETH</div>
                  <div className="mt-1 font-mono text-sm font-semibold tabular-nums text-emerald-400">
                    {tammSpot && tammSpot.spotPriceWeth > 0
                      ? `${(1 / tammSpot.spotPriceWeth).toFixed(1)} tAMM${tammSpot.live ? '' : ' (cached)'}`
                      : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Pool Standard</div>
                  <div className="mt-1 font-mono text-sm font-semibold text-slate-100">
                    ARL Compounding
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Curve Status</div>
                  <div className="mt-1 font-mono text-sm font-semibold text-sky-400">
                    100% Graduated
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-slate-800 pb-5">
                <div>
                  <div className="text-xs text-slate-400">Spot Price</div>
                  <div className="mt-1 font-mono text-sm font-semibold tabular-nums text-slate-100">
                    {curveBundle ? `${curveBundle.spotPriceQuotePerBase.toExponential(3)} WETH` : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Base Reserve</div>
                  <div className="mt-1 font-mono text-sm font-semibold tabular-nums text-slate-100">
                    {curveBundle
                      ? `${Number(formatUnits(curveBundle.state.baseReserve, curveBundle.tokenMeta.decimals)).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                      : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Quote Reserve</div>
                  <div className="mt-1 font-mono text-sm font-semibold tabular-nums text-slate-100">
                    {curveBundle
                      ? `${Number(formatUnits(curveBundle.state.quoteReserve, 18)).toFixed(4)} WETH`
                      : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Graduation Fill</div>
                  <div className="mt-1 font-mono text-sm font-semibold tabular-nums text-emerald-400">
                    {migrationPct.toFixed(2)}%
                  </div>
                </div>
              </div>
            )}

            {/* Bonding Curve Trajectory */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-200">
                  {tokenOut.symbol === 'tAMM' || tokenIn.symbol === 'tAMM'
                    ? 'tAMM Launch Curve → Graduated ARL Pool'
                    : 'Bonding Curve Price Trajectory'}
                </h3>
                <span className="text-xs text-slate-400">Q64.64 Single-Segment Curve</span>
              </div>
              {tokenOut.symbol === 'tAMM' || tokenIn.symbol === 'tAMM' ? (
                <BondingCurveChart
                  startPrice={0.00013}
                  graduationPrice={tammSpot?.spotPriceWeth ?? 0.003573}
                  currentPrice={tammSpot?.spotPriceWeth ?? 0.003573}
                  progressPct={100}
                  baseSymbol="tAMM"
                />
              ) : (
                <BondingCurveChart
                  startPrice={curveStartPrice}
                  graduationPrice={curveGradPrice}
                  currentPrice={curveBundle?.spotPriceQuotePerBase}
                  progressPct={migrationPct}
                  baseSymbol={curveBundle?.tokenMeta.symbol ?? 'AIV4C'}
                />
              )}
            </div>

            {/* Custom Curve Loader */}
            <form onSubmit={handleLoadCustomCurve} className="border-t border-slate-800 pt-5">
              <label htmlFor="curve-address-input" className="block text-xs font-medium text-slate-300 mb-2">
                Load Any GIWA Sepolia V4 Launch Curve Address
              </label>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  id="curve-address-input"
                  type="text"
                  value={customCurveInput}
                  onChange={(e) => setCustomCurveInput(e.target.value)}
                  placeholder="0x..."
                  className="flex-1 rounded-lg border border-slate-700 bg-[#0B101B] px-3.5 py-2 font-mono text-xs text-slate-100 outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  disabled={loadingCurve}
                  className="rounded-lg border border-slate-700 bg-[#151E30] px-4 py-2 text-xs font-medium text-slate-200 hover:border-slate-600 hover:text-white transition-colors whitespace-nowrap"
                >
                  {loadingCurve ? 'Loading…' : 'Inspect Curve'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
