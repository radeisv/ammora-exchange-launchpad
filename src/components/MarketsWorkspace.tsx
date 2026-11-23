import React, { useEffect, useState } from 'react';
import { ArrowRight, ExternalLink, Search } from 'lucide-react';
import { formatUnits, isAddress, type Address } from 'viem';
import {
  AMMORA_IDENTITY_ADDRESS,
  AMMORA_SEASON2_ROUTER,
  CANARY_V4_CURVE,
  FEATURED_GIWA_MARKETS,
  GIWATER_DEX_TOKENS,
  GIWATER_INFRA,
  GIWA_ETH_VAULT_ADDRESS,
  GIWA_EXPLORER_URL,
  TAMM_POOL_ADDRESS,
  TAMM_POOL_IMPL_ADDRESS,
  TAMM_STAKING_ADDRESS,
  fetchGiwaterTokenBalances,
  fetchLiveCurveBundle,
  fetchOnChainV4Config,
  giwaSepoliaAutoRouteAddresses,
  giwaSepoliaAutoRouteDeployment,
  type LiveCurveBundle,
  type NetworkSnapshot,
  type WalletState,
} from '../lib/ammora';
import { TokenMark } from './TokenMark';

interface MarketsWorkspaceProps {
  network: NetworkSnapshot | null;
  wallet: WalletState;
  onTradeCurve: (curveAddress: Address) => void;
}

export const MarketsWorkspace: React.FC<MarketsWorkspaceProps> = ({ network, wallet, onTradeCurve }) => {
  const [configIdInput, setConfigIdInput] = useState<string>('1');
  const [configLoading, setConfigLoading] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [inspectedConfig, setInspectedConfig] = useState<{
    id: string;
    owner: string;
    totalSupply: string;
    decimals: number;
    cliffFeeBps: number;
    creatorShareBps: number;
    migrationQuoteThreshold: string;
    enabled: boolean;
    configHash: string;
  } | null>(null);

  const [curveInput, setCurveInput] = useState<string>(CANARY_V4_CURVE);
  const [curveLoading, setCurveLoading] = useState(false);
  const [curveError, setCurveError] = useState<string | null>(null);
  const [inspectedCurve, setInspectedCurve] = useState<LiveCurveBundle | null>(
    network?.canaryCurve ?? null,
  );
  const [giwaterBalances, setGiwaterBalances] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!wallet.connected || !wallet.address) {
      setGiwaterBalances({});
      return;
    }
    fetchGiwaterTokenBalances(wallet.address).then(setGiwaterBalances);
  }, [wallet.connected, wallet.address]);

  const handleInspectConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfigLoading(true);
    setConfigError(null);
    try {
      const id = BigInt(Math.max(1, parseInt(configIdInput, 10) || 1));
      const snap = await fetchOnChainV4Config(id);
      setInspectedConfig({
        id: snap.configId.toString(),
        owner: snap.identity.owner,
        totalSupply: Number(formatUnits(snap.config.totalSupply, snap.config.tokenDecimals)).toLocaleString('en-US'),
        decimals: snap.config.tokenDecimals,
        cliffFeeBps: snap.config.cliffFeeBps,
        creatorShareBps: snap.config.creatorShareOfNonProtocolBps,
        migrationQuoteThreshold: Number(formatUnits(snap.config.migrationQuoteThreshold, 18)).toLocaleString('en-US'),
        enabled: snap.enabled,
        configHash: snap.configHash,
      });
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : 'Unable to read Config from GIWA Sepolia.');
      setInspectedConfig(null);
    } finally {
      setConfigLoading(false);
    }
  };

  const handleInspectCurve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAddress(curveInput.trim())) {
      setCurveError('Enter a valid 0x curve address on GIWA Sepolia.');
      return;
    }
    setCurveLoading(true);
    setCurveError(null);
    try {
      const bundle = await fetchLiveCurveBundle(curveInput.trim() as Address);
      setInspectedCurve(bundle);
    } catch (err) {
      setCurveError(err instanceof Error ? err.message.split('\n')[0] : 'Curve read failed.');
    } finally {
      setCurveLoading(false);
    }
  };

  const contractsList = [
    { label: 'Ammora Season 2 Native Router', address: AMMORA_SEASON2_ROUTER },
    { label: 'tAMM ARL Pool (Proxy)', address: TAMM_POOL_ADDRESS },
    { label: 'ARLCompoundingPoolV4 Impl', address: TAMM_POOL_IMPL_ADDRESS },
    { label: 'GIWA ETH Vault (Season 2)', address: GIWA_ETH_VAULT_ADDRESS },
    { label: 'tAMM Staking (Season 2)', address: TAMM_STAKING_ADDRESS },
    { label: 'Ammora Identity Gate', address: AMMORA_IDENTITY_ADDRESS },
    { label: 'V4 Launch Factory', address: giwaSepoliaAutoRouteDeployment.contracts.launch.factory },
    { label: 'V4 Config Registry', address: giwaSepoliaAutoRouteDeployment.contracts.launch.configRegistry },
    { label: 'Aggregation Router', address: giwaSepoliaAutoRouteAddresses.router },
    { label: 'GIWATER UniversalRouter', address: GIWATER_INFRA.universalRouter },
    { label: 'GIWATER clPoolManager', address: GIWATER_INFRA.clPoolManager },
    { label: 'GIWATER Vault', address: GIWATER_INFRA.vault },
    { label: 'GIWATER Faucet', address: GIWATER_INFRA.faucet },
    { label: 'Permit2 / Multicall3', address: GIWATER_INFRA.permit2 },
  ];

  const displayCurve = inspectedCurve ?? network?.canaryCurve ?? null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between border-b border-slate-800/80 pb-6">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight text-slate-50">
            GIWA Sepolia Markets &amp; Protocol Explorer
          </h1>
          <p className="mt-1.5 text-sm text-slate-400">
            Live RPC verification of Ammora Season 2 contracts, GIWATER DEX assets, V4 launch curves, and Config Registry.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <span>Block</span>
          <span className="font-mono tabular-nums text-slate-200">
            #{network?.blockNumber ? network.blockNumber.toString() : '—'}
          </span>
          <span aria-hidden="true">·</span>
          <span>Registered Configs</span>
          <span className="font-mono tabular-nums text-emerald-400">
            {network?.nextConfigId ? (network.nextConfigId - 1n).toString() : '81'}
          </span>
        </div>
      </div>

      {/* Featured On-Chain GIWA Sepolia Markets */}
      <div className="rounded-xl border border-slate-800 bg-[#111827] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-slate-100">
            Verified Ammora Markets on GIWA Sepolia
          </h2>
          <span className="text-xs text-slate-400">Live On-Chain Tokens &amp; Venues</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="pb-2.5 font-medium">Asset</th>
                <th className="pb-2.5 font-medium">Venue Type</th>
                <th className="pb-2.5 font-medium">Token Address</th>
                <th className="pb-2.5 font-medium">Pool / Curve</th>
                <th className="pb-2.5 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {FEATURED_GIWA_MARKETS.map((mkt) => {
                const venueAddr = mkt.poolAddress ?? mkt.curveAddress;
                return (
                  <tr key={mkt.symbol} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2.5">
                        <TokenMark symbol={mkt.symbol} size={24} />
                        <div>
                          <div className="font-semibold text-slate-100">{mkt.symbol}</div>
                          <div className="text-[11px] text-slate-400">{mkt.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-slate-300">
                      {mkt.venueKind === 'compounding' ? 'Graduated ARL Pool (6 dec)' : 'V4 Launch Curve (9 dec)'}
                    </td>
                    <td className="py-3 pr-4 font-mono text-slate-300">
                      <a
                        href={`${GIWA_EXPLORER_URL}/address/${mkt.tokenAddress}`}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-sky-400"
                      >
                        {mkt.tokenAddress.slice(0, 8)}…{mkt.tokenAddress.slice(-6)}
                      </a>
                    </td>
                    <td className="py-3 pr-4 font-mono text-slate-300">
                      <a
                        href={`${GIWA_EXPLORER_URL}/address/${venueAddr}`}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-sky-400"
                      >
                        {venueAddr.slice(0, 8)}…{venueAddr.slice(-6)}
                      </a>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onTradeCurve(mkt.curveAddress)}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-[#0B101B] px-3 py-1.5 text-xs font-medium text-emerald-400 hover:border-emerald-500/60 transition-colors whitespace-nowrap"
                      >
                        <span>Trade</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* GIWATER DEX Token Registry */}
      <div className="rounded-xl border border-slate-800 bg-[#111827] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-slate-100">
            GIWATER DEX Assets (GIWA Sepolia)
          </h2>
          <a
            href={`${GIWA_EXPLORER_URL}/address/${GIWATER_INFRA.faucet}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 whitespace-nowrap"
          >
            <span>Faucet Contract</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="pb-2.5 font-medium">Token</th>
                <th className="pb-2.5 font-medium">Decimals</th>
                <th className="pb-2.5 font-medium">Contract Address</th>
                <th className="pb-2.5 font-medium text-right">Wallet Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {GIWATER_DEX_TOKENS.map((tok) => (
                <tr key={tok.symbol} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2.5">
                      <TokenMark symbol={tok.symbol} size={24} />
                      <div>
                        <div className="font-semibold text-slate-100">{tok.symbol}</div>
                        <div className="text-[11px] text-slate-400">{tok.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4 font-mono tabular-nums text-slate-300">{tok.decimals}</td>
                  <td className="py-3 pr-4 font-mono text-slate-300">
                    <a
                      href={`${GIWA_EXPLORER_URL}/address/${tok.address}`}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-sky-400"
                    >
                      {tok.address}
                    </a>
                  </td>
                  <td className="py-3 text-right font-mono tabular-nums text-slate-200">
                    {wallet.connected ? `${giwaterBalances[tok.symbol] ?? '0'} ${tok.symbol}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Inspectors Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Live Curve Inspector */}
        <div className="lg:col-span-6 rounded-xl border border-slate-800 bg-[#111827] p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <h2 className="font-display text-base font-semibold text-slate-100">
              Live Launch Curve Inspector
            </h2>
            <span className="text-xs text-slate-400">AmmoraV4LaunchCurveClient</span>
          </div>

          <form onSubmit={handleInspectCurve} className="flex gap-2.5">
            <input
              type="text"
              value={curveInput}
              onChange={(e) => setCurveInput(e.target.value)}
              placeholder="0x..."
              aria-label="Curve contract address"
              className="flex-1 rounded-lg border border-slate-700 bg-[#0B101B] px-3.5 py-2 font-mono text-xs text-slate-100 outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={curveLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#151E30] px-4 py-2 text-xs font-medium text-slate-200 hover:border-slate-600 transition-colors whitespace-nowrap"
            >
              <Search className="h-3.5 w-3.5" />
              <span>{curveLoading ? 'Reading…' : 'Query RPC'}</span>
            </button>
          </form>

          {curveError && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-950/30 p-3 text-xs text-rose-300">
              {curveError}
            </div>
          )}

          {displayCurve && (
            <div className="space-y-4 pt-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <TokenMark symbol={displayCurve.tokenMeta.symbol} size={32} />
                  <div>
                    <div className="font-display text-sm font-semibold text-slate-100">
                      {displayCurve.tokenMeta.name} ({displayCurve.tokenMeta.symbol})
                    </div>
                    <div className="font-mono text-xs text-slate-400">
                      Token {displayCurve.state.baseToken.slice(0, 8)}…{displayCurve.state.baseToken.slice(-6)}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onTradeCurve(displayCurve.curveAddress)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 transition-colors whitespace-nowrap"
                >
                  <span>Trade in Swap</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-slate-800 pt-4 text-xs">
                <div>
                  <span className="text-slate-400">Spot Price</span>
                  <div className="mt-1 font-mono tabular-nums text-slate-100">
                    {displayCurve.spotPriceQuotePerBase.toExponential(4)} WETH
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Trading Fee</span>
                  <div className="mt-1 font-mono tabular-nums text-slate-100">
                    {(displayCurve.state.currentFeeBps / 100).toFixed(2)}% ({displayCurve.state.currentFeeBps} bps)
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Quote Reserve</span>
                  <div className="mt-1 font-mono tabular-nums text-slate-100">
                    {Number(formatUnits(displayCurve.state.quoteReserve, 18)).toFixed(5)} WETH
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Config ID</span>
                  <div className="mt-1 font-mono tabular-nums text-slate-100">
                    #{displayCurve.state.configId.toString()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: On-Chain V4 Config Registry Lookup */}
        <div className="lg:col-span-6 rounded-xl border border-slate-800 bg-[#111827] p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <h2 className="font-display text-base font-semibold text-slate-100">
              V4 Config Registry Reader
            </h2>
            <span className="text-xs text-slate-400">getAmmoraV4ConfigAtBlock</span>
          </div>

          <form onSubmit={handleInspectConfig} className="flex gap-2.5">
            <input
              type="number"
              min={1}
              value={configIdInput}
              onChange={(e) => setConfigIdInput(e.target.value)}
              aria-label="Config ID"
              className="w-36 rounded-lg border border-slate-700 bg-[#0B101B] px-3.5 py-2 font-mono text-sm tabular-nums text-slate-100 outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={configLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#151E30] px-4 py-2 text-xs font-medium text-slate-200 hover:border-slate-600 transition-colors whitespace-nowrap"
            >
              <Search className="h-3.5 w-3.5" />
              <span>{configLoading ? 'Reading…' : 'Fetch Config'}</span>
            </button>
          </form>

          {configError && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-950/30 p-3 text-xs text-rose-300">
              {configError}
            </div>
          )}

          {inspectedConfig ? (
            <div className="grid grid-cols-2 gap-4 border-t border-slate-800 pt-4 text-xs">
              <div>
                <span className="text-slate-400">Total Supply</span>
                <div className="mt-1 font-mono tabular-nums text-slate-100">
                  {inspectedConfig.totalSupply} ({inspectedConfig.decimals} dec)
                </div>
              </div>
              <div>
                <span className="text-slate-400">Registry Status</span>
                <div
                  className={`mt-1 font-medium ${
                    inspectedConfig.enabled ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {inspectedConfig.enabled ? 'Active & Enabled' : 'Disabled'}
                </div>
              </div>
              <div>
                <span className="text-slate-400">Cliff Fee / Creator Split</span>
                <div className="mt-1 font-mono tabular-nums text-slate-100">
                  {inspectedConfig.cliffFeeBps} bps · {inspectedConfig.creatorShareBps / 100}%
                </div>
              </div>
              <div>
                <span className="text-slate-400">Config Owner</span>
                <div className="mt-1 font-mono text-slate-200">
                  {inspectedConfig.owner.slice(0, 8)}…{inspectedConfig.owner.slice(-6)}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-800/80 bg-[#0B101B] p-4 text-xs text-slate-400">
              Query any registered configuration ID (1 to{' '}
              <span className="font-mono text-slate-200">
                {network?.nextConfigId ? (network.nextConfigId - 1n).toString() : '81'}
              </span>
              ) directly from the GIWA Sepolia Config Registry contract.
            </div>
          )}
        </div>
      </div>

      {/* Verified GIWA Sepolia Contracts Table */}
      <div className="rounded-xl border border-slate-800 bg-[#111827] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-slate-100">
            Verified Ammora Season 2 &amp; GIWATER Contract Directory
          </h2>
          <span className="text-xs text-slate-400">Chain ID 91342</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="pb-2.5 font-medium">Component</th>
                <th className="pb-2.5 font-medium">Contract Address</th>
                <th className="pb-2.5 font-medium text-right">Explorer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {contractsList.map((row) => (
                <tr key={row.label} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-2.5 pr-4 font-medium text-slate-200">{row.label}</td>
                  <td className="py-2.5 pr-4 font-mono text-slate-300">{row.address}</td>
                  <td className="py-2.5 text-right">
                    <a
                      href={`${GIWA_EXPLORER_URL}/address/${row.address}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 whitespace-nowrap"
                    >
                      <span>View</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
