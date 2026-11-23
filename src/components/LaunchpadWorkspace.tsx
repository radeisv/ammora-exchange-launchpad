import React, { useMemo, useState } from 'react';
import { Check, Code2, Copy, ExternalLink, Loader2, Rocket, ShieldCheck } from 'lucide-react';
import { formatUnits, type Address } from 'viem';
import {
  GIWA_EXPLORER_URL,
  buildLaunchpadPlan,
  fetchOnChainV4Config,
  getCanonicalTammPolicySummary,
  giwaSepoliaAutoRouteDeployment,
  sendOrSimulateTransaction,
  type LaunchpadFormInput,
  type WalletState,
} from '../lib/ammora';
import { BondingCurveChart } from './BondingCurveChart';
import { CalldataDrawer } from './CalldataDrawer';
import { TokenMark } from './TokenMark';

interface LaunchpadWorkspaceProps {
  wallet: WalletState;
  nextConfigId: bigint;
  onConnectWallet: () => void;
}

interface LaunchDraftRecord {
  id: string;
  name: string;
  symbol: string;
  decimals: number;
  migrationThresholdWeth: string;
  migrationKind: string;
  createdAt: string;
  factory: string;
}

const STORAGE_KEY = 'ammora_launchpad_drafts_v1';

const DEFAULT_SEED_LAUNCHES: LaunchDraftRecord[] = [
  {
    id: 'canary-aiv4c',
    name: 'Ammora V4 Canary',
    symbol: 'AIV4C',
    decimals: 9,
    migrationThresholdWeth: '1000.0000',
    migrationKind: 'concentrated',
    createdAt: 'Verified GIWA Deployment',
    factory: giwaSepoliaAutoRouteDeployment.contracts.launch.factory,
  },
];

export const LaunchpadWorkspace: React.FC<LaunchpadWorkspaceProps> = ({
  wallet,
  nextConfigId,
  onConnectWallet,
}) => {
  const [launchMode, setLaunchMode] = useState<'custom-curve' | 'existing-config'>('custom-curve');
  const [existingConfigId, setExistingConfigId] = useState<string>('1');
  const [fetchedConfigInfo, setFetchedConfigInfo] = useState<{
    configId: string;
    owner: string;
    totalSupply: string;
    decimals: number;
    cliffFeeBps: number;
    enabled: boolean;
  } | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);

  const [form, setForm] = useState<LaunchpadFormInput>({
    name: 'Hyperion AI',
    symbol: 'HYPR',
    tokenDecimals: 6,
    totalSupplyWhole: '1000000000',
    saleAllocationPct: 80,
    creatorLockedPct: 5,
    startFdvWeth: '4',
    graduationFdvWeth: '24',
    cliffFeeBps: 125,
    creatorFeeShareBps: 8000,
    migrationKind: 'compounding',
    metadataURI: 'ipfs://bafybeihyperiontokenmetadata',
    creatorMetadataURI: 'ipfs://bafybeihyperioncreatormetadata',
    creatorAddress: wallet.address ?? ('0x13cD27a6E337097dB858C9C4FA472FbAd2F2c637' as Address),
    firstBuyWeth: '0',
  });

  const [showSdkCode, setShowSdkCode] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<{
    mode: 'sent' | 'simulated';
    hash?: string;
    note: string;
  } | null>(null);

  const [savedLaunches, setSavedLaunches] = useState<LaunchDraftRecord[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as LaunchDraftRecord[];
    } catch {
      // ignore storage failure
    }
    return DEFAULT_SEED_LAUNCHES;
  });

  const tammSummary = useMemo(() => getCanonicalTammPolicySummary(), []);

  const plan = useMemo(() => {
    const parsedId = BigInt(Math.max(1, parseInt(existingConfigId, 10) || 1));
    return buildLaunchpadPlan(
      {
        ...form,
        creatorAddress: wallet.address ?? form.creatorAddress,
      },
      parsedId,
    );
  }, [form, wallet.address, existingConfigId]);

  const applyPreset = (preset: 'tamm' | 'fair' | 'concentrated') => {
    setDeployResult(null);
    if (preset === 'tamm') {
      setForm((prev) => ({
        ...prev,
        tokenDecimals: 6,
        totalSupplyWhole: '1000000000',
        saleAllocationPct: 80,
        creatorLockedPct: 0,
        startFdvWeth: '3',
        graduationFdvWeth: '24',
        cliffFeeBps: 125,
        creatorFeeShareBps: 3000,
        migrationKind: 'compounding',
      }));
    } else if (preset === 'fair') {
      setForm((prev) => ({
        ...prev,
        tokenDecimals: 9,
        totalSupplyWhole: '1000000000',
        saleAllocationPct: 85,
        creatorLockedPct: 0,
        startFdvWeth: '5',
        graduationFdvWeth: '30',
        cliffFeeBps: 100,
        creatorFeeShareBps: 8000,
        migrationKind: 'compounding',
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        tokenDecimals: 6,
        totalSupplyWhole: '500000000',
        saleAllocationPct: 75,
        creatorLockedPct: 5,
        startFdvWeth: '6',
        graduationFdvWeth: '36',
        cliffFeeBps: 125,
        creatorFeeShareBps: 7500,
        migrationKind: 'concentrated',
      }));
    }
  };

  const handleFetchExistingConfig = async () => {
    setLoadingConfig(true);
    try {
      const id = BigInt(Math.max(1, parseInt(existingConfigId, 10) || 1));
      const snap = await fetchOnChainV4Config(id);
      setFetchedConfigInfo({
        configId: snap.configId.toString(),
        owner: snap.identity.owner,
        totalSupply: Number(formatUnits(snap.config.totalSupply, snap.config.tokenDecimals)).toLocaleString('en-US'),
        decimals: snap.config.tokenDecimals,
        cliffFeeBps: snap.config.cliffFeeBps,
        enabled: snap.enabled,
      });
    } catch {
      setFetchedConfigInfo(null);
    } finally {
      setLoadingConfig(false);
    }
  };

  const activeTx =
    launchMode === 'custom-curve' ? plan.registerAndLaunchTx : plan.existingConfigLaunchTx;

  const handleDeploy = async () => {
    if (!activeTx) return;
    setDeploying(true);
    setDeployResult(null);
    try {
      const res = await sendOrSimulateTransaction({
        wallet,
        to: activeTx.to,
        data: activeTx.data,
        value: activeTx.value,
      });
      setDeployResult(res);

      const newRecord: LaunchDraftRecord = {
        id: `${form.symbol}-${Date.now()}`,
        name: form.name,
        symbol: form.symbol.toUpperCase(),
        decimals: form.tokenDecimals,
        migrationThresholdWeth: plan.migrationQuoteThresholdWeth,
        migrationKind: form.migrationKind,
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        factory: activeTx.to,
      };
      const updated = [newRecord, ...savedLaunches].slice(0, 6);
      setSavedLaunches(updated);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignore storage errors
      }
    } finally {
      setDeploying(false);
    }
  };

  const sdkSnippet = `import {
  buildPortableAmmoraV4Config,
  buildRegisterConfigAndCreateAmmoraV4Launch,
  giwaSepoliaAutoRouteDeployment,
} from '@ammora-protocol/sdk';

const built = buildPortableAmmoraV4Config({
  baseDecimals: ${form.tokenDecimals},
  quoteDecimals: 18,
  totalSupplyRaw: ${form.totalSupplyWhole}n * 10n ** ${form.tokenDecimals}n,
  saleAllocationRaw: ${(BigInt(Math.floor(Number(form.totalSupplyWhole) || 0)) * BigInt(Math.round(form.saleAllocationPct * 100))) / 10000n}n * 10n ** ${form.tokenDecimals}n,
  lockedBaseRaw: ${(BigInt(Math.floor(Number(form.totalSupplyWhole) || 0)) * BigInt(Math.round(form.creatorLockedPct * 100))) / 10000n}n * 10n ** ${form.tokenDecimals}n,
  start: { fdv: { numerator: ${form.startFdvWeth || 4}n, denominator: 1n } },
  graduation: { fdv: { numerator: ${form.graduationFdvWeth || 24}n, denominator: 1n } },
  migrationQuoteThreshold: { kind: 'derive' },
  migrationQuoteFeeBps: 0n,
  migration: { kind: '${form.migrationKind}', /* derived budgets */ },
}, policy);

const tx = buildRegisterConfigAndCreateAmmoraV4Launch(
  built.config,
  built.segments,
  {
    name: '${form.name}',
    symbol: '${form.symbol.toUpperCase()}',
    metadataURI: '${form.metadataURI}',
    creatorMetadataURI: '${form.creatorMetadataURI}',
    tokenDecimals: ${form.tokenDecimals},
    callback: '0x0000000000000000000000000000000000000000',
    callbackData: '0x',
  }
);
// Submit to GIWA V4 Launch Factory: ${giwaSepoliaAutoRouteDeployment.contracts.launch.factory}`;

  const handleCopySnippet = () => {
    navigator.clipboard?.writeText(sdkSnippet).catch(() => {});
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1800);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between border-b border-slate-800/80 pb-6">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight text-slate-50">
            Developer Token Launchpad Studio
          </h1>
          <p className="mt-1.5 text-sm text-slate-400">
            Configure tokenomics, validate Q64.64 bonding curve invariants with{' '}
            <span className="font-mono text-slate-300">buildPortableAmmoraV4Config</span>, and deploy to GIWA Sepolia.
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-[#111827] p-1 border border-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => setLaunchMode('custom-curve')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              launchMode === 'custom-curve'
                ? 'bg-slate-800 text-emerald-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            New Curve + Token
          </button>
          <button
            type="button"
            onClick={() => setLaunchMode('existing-config')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              launchMode === 'existing-config'
                ? 'bg-slate-800 text-emerald-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Use Registered Config
          </button>
        </div>
      </div>

      {/* Main Studio Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Configuration Controls */}
        <div className="lg:col-span-6 rounded-xl border border-slate-800 bg-[#111827] p-6 space-y-6">
          {/* Quick SDK Presets */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <span className="text-xs font-medium text-slate-400">SDK Curve Presets</span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => applyPreset('tamm')}
                className="rounded-md border border-slate-700 bg-[#0B101B] px-2.5 py-1 text-xs text-slate-200 hover:border-emerald-500/60 transition-colors whitespace-nowrap"
              >
                tAMM Policy
              </button>
              <button
                type="button"
                onClick={() => applyPreset('fair')}
                className="rounded-md border border-slate-700 bg-[#0B101B] px-2.5 py-1 text-xs text-slate-200 hover:border-emerald-500/60 transition-colors whitespace-nowrap"
              >
                Fair Launch (85%)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('concentrated')}
                className="rounded-md border border-slate-700 bg-[#0B101B] px-2.5 py-1 text-xs text-slate-200 hover:border-emerald-500/60 transition-colors whitespace-nowrap"
              >
                Concentrated ARL
              </button>
            </div>
          </div>

          {/* Token Identity */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1">
              <label htmlFor="launch-symbol" className="block text-xs font-medium text-slate-300 mb-1.5">
                Ticker Symbol
              </label>
              <input
                id="launch-symbol"
                type="text"
                maxLength={12}
                value={form.symbol}
                onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })}
                className={`w-full rounded-lg border bg-[#0B101B] px-3 py-2 font-mono text-sm text-slate-100 outline-none focus:border-emerald-500 ${
                  form.symbol.trim() ? 'border-slate-700' : 'border-rose-500'
                }`}
              />
              {!form.symbol.trim() && (
                <p className="mt-1.5 text-xs text-rose-400">Ticker symbol is required.</p>
              )}
            </div>
            <div className="sm:col-span-1">
              <label htmlFor="launch-name" className="block text-xs font-medium text-slate-300 mb-1.5">
                Token Name
              </label>
              <input
                id="launch-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-[#0B101B] px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
              />
            </div>
            <div className="sm:col-span-1">
              <label htmlFor="launch-decimals" className="block text-xs font-medium text-slate-300 mb-1.5">
                Decimals (6–9)
              </label>
              <select
                id="launch-decimals"
                value={form.tokenDecimals}
                onChange={(e) => setForm({ ...form, tokenDecimals: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-700 bg-[#0B101B] px-3 py-2 font-mono text-sm text-slate-100 outline-none focus:border-emerald-500"
              >
                <option value={6}>6 decimals</option>
                <option value={8}>8 decimals</option>
                <option value={9}>9 decimals</option>
              </select>
            </div>
          </div>

          {launchMode === 'existing-config' ? (
            <div className="rounded-lg border border-slate-800 bg-[#0B101B] p-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>On-Chain GIWA V4 Config ID</span>
                <span className="font-mono tabular-nums">
                  Registered IDs: 1 – {nextConfigId > 0n ? (nextConfigId - 1n).toString() : '81'}
                </span>
              </div>
              <div className="flex gap-2.5">
                <input
                  type="number"
                  min={1}
                  value={existingConfigId}
                  onChange={(e) => setExistingConfigId(e.target.value)}
                  className="w-32 rounded-lg border border-slate-700 bg-[#111827] px-3 py-2 font-mono text-sm text-slate-100 outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleFetchExistingConfig}
                  disabled={loadingConfig}
                  className="rounded-lg border border-slate-700 bg-[#151E30] px-4 py-2 text-xs font-medium text-slate-200 hover:border-slate-600 transition-colors whitespace-nowrap"
                >
                  {loadingConfig ? 'Fetching…' : 'Verify Config On-Chain'}
                </button>
              </div>
              {fetchedConfigInfo && (
                <div className="border-t border-slate-800 pt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="text-slate-400">
                    Supply: <span className="font-mono text-slate-200">{fetchedConfigInfo.totalSupply}</span>
                  </div>
                  <div className="text-slate-400">
                    Cliff Fee: <span className="font-mono text-slate-200">{fetchedConfigInfo.cliffFeeBps} bps</span>
                  </div>
                  <div className="text-slate-400">
                    Status:{' '}
                    <span className={fetchedConfigInfo.enabled ? 'text-emerald-400' : 'text-amber-400'}>
                      {fetchedConfigInfo.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div className="text-slate-400 font-mono truncate">
                    Owner: {fetchedConfigInfo.owner.slice(0, 8)}…
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Supply & Curve Economics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="launch-supply" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Total Token Supply
                  </label>
                  <input
                    id="launch-supply"
                    type="number"
                    min="1000"
                    value={form.totalSupplyWhole}
                    onChange={(e) => setForm({ ...form, totalSupplyWhole: e.target.value })}
                    className="w-full rounded-lg border border-slate-700 bg-[#0B101B] px-3 py-2 font-mono text-sm tabular-nums text-slate-100 outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label htmlFor="launch-migration-kind" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Graduated Pool Architecture
                  </label>
                  <select
                    id="launch-migration-kind"
                    value={form.migrationKind}
                    onChange={(e) =>
                      setForm({ ...form, migrationKind: e.target.value as 'compounding' | 'concentrated' })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-[#0B101B] px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
                  >
                    <option value="compounding">ARL Compounding Pool</option>
                    <option value="concentrated">ARL Concentrated Range Pool</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="launch-start-fdv" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Starting FDV (WETH)
                  </label>
                  <input
                    id="launch-start-fdv"
                    type="number"
                    step="0.5"
                    min="0.1"
                    value={form.startFdvWeth}
                    onChange={(e) => setForm({ ...form, startFdvWeth: e.target.value })}
                    className="w-full rounded-lg border border-slate-700 bg-[#0B101B] px-3 py-2 font-mono text-sm tabular-nums text-slate-100 outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label htmlFor="launch-grad-fdv" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Graduation FDV (WETH)
                  </label>
                  <input
                    id="launch-grad-fdv"
                    type="number"
                    step="1"
                    min="0.5"
                    value={form.graduationFdvWeth}
                    onChange={(e) => setForm({ ...form, graduationFdvWeth: e.target.value })}
                    className="w-full rounded-lg border border-slate-700 bg-[#0B101B] px-3 py-2 font-mono text-sm tabular-nums text-slate-100 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Allocation Sliders */}
              <div className="space-y-4 border-t border-slate-800 pt-4">
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-300">Bonding Curve Sale Allocation</span>
                    <span className="font-mono tabular-nums text-emerald-400">{form.saleAllocationPct}%</span>
                  </div>
                  <input
                    type="range"
                    min={40}
                    max={92}
                    step={1}
                    value={form.saleAllocationPct}
                    onChange={(e) => setForm({ ...form, saleAllocationPct: Number(e.target.value) })}
                    className="w-full accent-emerald-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-300">Creator Locked Base Allocation</span>
                    <span className="font-mono tabular-nums text-sky-400">{form.creatorLockedPct}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={25}
                    step={1}
                    value={form.creatorLockedPct}
                    onChange={(e) => setForm({ ...form, creatorLockedPct: Number(e.target.value) })}
                    className="w-full accent-sky-500"
                  />
                </div>
              </div>

              {/* Fee Policy */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-800 pt-4">
                <div>
                  <label htmlFor="launch-fee" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Curve Trading Fee (bps)
                  </label>
                  <input
                    id="launch-fee"
                    type="number"
                    min={25}
                    max={500}
                    step={25}
                    value={form.cliffFeeBps}
                    onChange={(e) => setForm({ ...form, cliffFeeBps: Number(e.target.value) })}
                    className="w-full rounded-lg border border-slate-700 bg-[#0B101B] px-3 py-2 font-mono text-sm tabular-nums text-slate-100 outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label htmlFor="launch-creator-share" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Creator Fee Share (bps)
                  </label>
                  <input
                    id="launch-creator-share"
                    type="number"
                    min={0}
                    max={10000}
                    step={500}
                    value={form.creatorFeeShareBps}
                    onChange={(e) => setForm({ ...form, creatorFeeShareBps: Number(e.target.value) })}
                    className="w-full rounded-lg border border-slate-700 bg-[#0B101B] px-3 py-2 font-mono text-sm tabular-nums text-slate-100 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </>
          )}

          {/* Metadata URIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-800 pt-4">
            <div>
              <label htmlFor="launch-meta-uri" className="block text-xs font-medium text-slate-300 mb-1.5">
                Token Metadata URI
              </label>
              <input
                id="launch-meta-uri"
                type="text"
                value={form.metadataURI}
                onChange={(e) => setForm({ ...form, metadataURI: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-[#0B101B] px-3 py-2 font-mono text-xs text-slate-200 outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label htmlFor="launch-creator-uri" className="block text-xs font-medium text-slate-300 mb-1.5">
                Creator Metadata URI
              </label>
              <input
                id="launch-creator-uri"
                type="text"
                value={form.creatorMetadataURI}
                onChange={(e) => setForm({ ...form, creatorMetadataURI: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-[#0B101B] px-3 py-2 font-mono text-xs text-slate-200 outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Right: SDK Math Verification, Bonding Curve & Deploy */}
        <div className="lg:col-span-6 space-y-6">
          <div className="rounded-xl border border-slate-800 bg-[#111827] p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <TokenMark symbol={form.symbol || 'AM'} size={34} />
                <div>
                  <h2 className="font-display text-lg font-semibold text-slate-50">
                    {form.name || 'New Token'} ({(form.symbol || 'TKN').toUpperCase()})
                  </h2>
                  <div className="text-xs text-slate-400">
                    {form.tokenDecimals} decimals · {form.migrationKind} ARL graduation
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowSdkCode((prev) => !prev)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#0B101B] px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-slate-600 transition-colors whitespace-nowrap"
              >
                <Code2 className="h-3.5 w-3.5 text-sky-400" />
                <span>{showSdkCode ? 'Hide SDK Code' : 'Export SDK Code'}</span>
              </button>
            </div>

            {!plan.valid ? (
              <div className="rounded-lg border border-rose-500/30 bg-rose-950/30 p-4 text-xs text-rose-300">
                SDK Invariant Check: {plan.error}
              </div>
            ) : (
              <>
                {/* Exact SDK Reconciliation Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 border-b border-slate-800 pb-5">
                  <div>
                    <div className="text-xs text-slate-400">Graduation Raise</div>
                    <div className="mt-1 font-mono text-sm font-semibold tabular-nums text-emerald-400">
                      {plan.migrationQuoteThresholdWeth} WETH
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Tokens on Curve</div>
                    <div className="mt-1 font-mono text-sm font-semibold tabular-nums text-slate-100">
                      {plan.curveBaseFormatted}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">ARL Migration Pool</div>
                    <div className="mt-1 font-mono text-sm font-semibold tabular-nums text-slate-100">
                      {100 - form.saleAllocationPct - form.creatorLockedPct}% Reserve
                    </div>
                  </div>
                </div>

                {/* Live Curve Trajectory */}
                <BondingCurveChart
                  startPrice={plan.startPriceWeth}
                  graduationPrice={plan.graduationPriceWeth}
                  progressPct={0}
                  baseSymbol={(form.symbol || 'TKN').toUpperCase()}
                />

                {showSdkCode && (
                  <div className="rounded-lg border border-slate-800 bg-[#080C14] p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-300">@ammora-protocol/sdk TypeScript Integration</span>
                      <button
                        type="button"
                        onClick={handleCopySnippet}
                        className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300"
                      >
                        {copiedCode ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <pre className="max-h-56 overflow-auto font-mono text-[11px] leading-relaxed text-slate-300">
                      {sdkSnippet}
                    </pre>
                  </div>
                )}

                {/* Primary Launch Button */}
                {!wallet.connected ? (
                  <button
                    type="button"
                    onClick={onConnectWallet}
                    className="w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-400 transition-colors whitespace-nowrap"
                  >
                    Connect Wallet to Deploy Token
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleDeploy}
                    disabled={deploying || !activeTx}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 transition-colors whitespace-nowrap"
                  >
                    {deploying ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Building Launch Transaction…</span>
                      </>
                    ) : (
                      <>
                        <Rocket className="h-4 w-4" />
                        <span>
                          {wallet.isSimulated
                            ? 'Simulate Launch & Inspect Calldata'
                            : 'Deploy Token Launch on GIWA Sepolia'}
                        </span>
                      </>
                    )}
                  </button>
                )}

                {deployResult && (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-3.5 text-xs text-emerald-200 space-y-1.5">
                    <div className="flex items-center gap-1.5 font-medium text-emerald-300">
                      <ShieldCheck className="h-4 w-4 shrink-0" />
                      <span>{deployResult.mode === 'sent' ? 'Launch Transaction Sent' : 'SDK Pre-Flight Passed'}</span>
                    </div>
                    <p className="text-slate-300 leading-relaxed">{deployResult.note}</p>
                    {deployResult.hash && (
                      <a
                        href={`${GIWA_EXPLORER_URL}/tx/${deployResult.hash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-sky-400 hover:text-sky-300"
                      >
                        <span>View on GIWA Explorer</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                )}

                {activeTx && (
                  <CalldataDrawer
                    title={
                      launchMode === 'custom-curve'
                        ? 'Inspect RegisterConfigAndCreateLaunch Calldata'
                        : `Inspect CreateLaunch (Config #${existingConfigId}) Calldata`
                    }
                    to={activeTx.to}
                    data={activeTx.data}
                    value={activeTx.value}
                  />
                )}
              </>
            )}
          </div>

          {/* Canonical Reference + Recent Launches */}
          <div className="rounded-xl border border-slate-800 bg-[#111827] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold text-slate-100">
                Launchpad Ledger &amp; Canonical Reference
              </h3>
              <span className="font-mono text-xs text-slate-400">
                tAMM Ref: {tammSummary.migrationQuoteThreshold} WETH threshold
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-2 font-medium">Token</th>
                    <th className="pb-2 font-medium">Graduation</th>
                    <th className="pb-2 font-medium">Mode</th>
                    <th className="pb-2 font-medium text-right">Factory</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {savedLaunches.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 pr-3">
                        <div className="font-medium text-slate-200">
                          {item.symbol} <span className="text-slate-400 font-normal">· {item.name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 font-mono tabular-nums text-slate-200">
                        {item.migrationThresholdWeth} WETH
                      </td>
                      <td className="py-2.5 pr-3 text-slate-300 capitalize">{item.migrationKind}</td>
                      <td className="py-2.5 text-right font-mono text-sky-400">
                        <a
                          href={`${GIWA_EXPLORER_URL}/address/${item.factory}`}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline"
                        >
                          {item.factory.slice(0, 6)}…{item.factory.slice(-4)}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
