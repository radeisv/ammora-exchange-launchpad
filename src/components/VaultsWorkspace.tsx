import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ExternalLink, Loader2, Plus, RefreshCw, ShieldCheck } from 'lucide-react';
import { formatUnits, isAddress, parseUnits, type Address } from 'viem';
import {
  AMMORA_IDENTITY_ADDRESS,
  AMMORA_VAULT_CATALOG,
  GIWA_ETH_VAULT_ADDRESS,
  GIWA_EXPLORER_URL,
  TAMM_POOL_ADDRESS,
  TAMM_POOL_IMPL_ADDRESS,
  TAMM_STAKING_ADDRESS,
  WETH_ADDRESS,
  buildGiwaEthVaultDepositStep,
  buildNewVaultDeployCalldata,
  buildTammPoolAddLiquiditySteps,
  buildTammStakingSteps,
  computeVaultPreview,
  executeExecutionSteps,
  fetchSeason2OnChainState,
  previewTammAddLiquidity,
  sendOrSimulateTransaction,
  type Season2OnChainState,
  type SwapExecutionStep,
  type VaultModel,
  type WalletState,
} from '../lib/ammora';
import { CalldataDrawer } from './CalldataDrawer';
import { TokenMark } from './TokenMark';

interface VaultsWorkspaceProps {
  wallet: WalletState;
  vaultFactoriesActive: {
    yieldFactory: boolean;
    genesisFactory: boolean;
    executionRegistry: boolean;
  };
  onConnectWallet: () => void;
  onRefreshBalances?: () => Promise<void>;
}

type Season2StrategyId = 'season2-eth-vault' | 'season2-tamm-staking' | 'season2-tamm-lp';

export const VaultsWorkspace: React.FC<VaultsWorkspaceProps> = ({
  wallet,
  vaultFactoriesActive,
  onConnectWallet,
  onRefreshBalances,
}) => {
  const [vaults, setVaults] = useState<VaultModel[]>(AMMORA_VAULT_CATALOG);
  const [filterKind, setFilterKind] = useState<'all' | 'season2' | 'AYVault' | 'AStakeV2'>('all');
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>('season2-eth-vault');
  const [season2State, setSeason2State] = useState<Season2OnChainState | null>(null);
  const [loadingSeason2, setLoadingSeason2] = useState(false);

  // Season 2 ETH Vault state
  const [ethVaultAmount, setEthVaultAmount] = useState<string>('0.01');

  // Season 2 tAMM Staking state
  const [stakeTab, setStakeTab] = useState<'deposit' | 'requestWithdrawal' | 'withdraw' | 'claim'>('deposit');
  const [stakeTammAmount, setStakeTammAmount] = useState<string>('10');

  // Pool tAMM / WETH Add LP state
  const [lpMaxBase, setLpMaxBase] = useState<string>('10');
  const [lpMaxQuote, setLpMaxQuote] = useState<string>('0.001');
  const [lpPreview, setLpPreview] = useState<{ liquidity: bigint; baseUsed: bigint; quoteUsed: bigint } | null>(null);
  const [loadingLpPreview, setLoadingLpPreview] = useState(false);

  // Factory Vaults (AYVault / AStakeV2) state
  const [actionTab, setActionTab] = useState<'deposit' | 'withdraw' | 'claim'>('deposit');
  const [amountInput, setAmountInput] = useState<string>('1.5');

  const [submitting, setSubmitting] = useState(false);
  const [execProgress, setExecProgress] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [txFeedback, setTxFeedback] = useState<{
    mode: 'sent' | 'simulated';
    hash?: string;
    note: string;
  } | null>(null);

  // Create New Vault drawer state
  const [showCreateVault, setShowCreateVault] = useState(false);
  const [newVaultKind, setNewVaultKind] = useState<'AYVault' | 'AStakeV2'>('AStakeV2');
  const [newVaultAsset, setNewVaultAsset] = useState<string>(WETH_ADDRESS);
  const [newVaultPerfFeeBps, setNewVaultPerfFeeBps] = useState<number>(500);
  const [newVaultLockHours, setNewVaultLockHours] = useState<number>(48);
  const [newVaultTx, setNewVaultTx] = useState<{ to: Address; data: `0x${string}`; value: bigint } | null>(null);

  const loadSeason2 = async () => {
    setLoadingSeason2(true);
    try {
      const state = await fetchSeason2OnChainState(wallet.address);
      setSeason2State(state);
    } finally {
      setLoadingSeason2(false);
    }
  };

  useEffect(() => {
    loadSeason2();
  }, [wallet.address]);

  useEffect(() => {
    let active = true;
    const baseNum = Number(lpMaxBase);
    const quoteNum = Number(lpMaxQuote);
    if (!lpMaxBase || !lpMaxQuote || Number.isNaN(baseNum) || Number.isNaN(quoteNum) || baseNum <= 0 || quoteNum <= 0) {
      setLpPreview(null);
      return;
    }
    setLoadingLpPreview(true);
    const timer = setTimeout(async () => {
      try {
        const res = await previewTammAddLiquidity(lpMaxBase, lpMaxQuote);
        if (active) setLpPreview(res);
      } catch {
        if (active) setLpPreview(null);
      } finally {
        if (active) setLoadingLpPreview(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [lpMaxBase, lpMaxQuote]);

  const recipient = wallet.address ?? ('0x13cD27a6E337097dB858C9C4FA472FbAd2F2c637' as Address);

  const isSeason2Selected =
    selectedStrategyId === 'season2-eth-vault' ||
    selectedStrategyId === 'season2-tamm-staking' ||
    selectedStrategyId === 'season2-tamm-lp';

  const activeVault = useMemo(
    () => vaults.find((v) => v.id === selectedStrategyId) ?? vaults[0],
    [vaults, selectedStrategyId],
  );

  const filteredFactoryVaults = useMemo(() => {
    if (filterKind === 'season2') return [];
    return vaults.filter((v) => filterKind === 'all' || v.protocolKind === filterKind);
  }, [vaults, filterKind]);

  const factoryPreview = useMemo(() => {
    const mode = actionTab === 'withdraw' ? 'withdraw' : 'deposit';
    return computeVaultPreview(activeVault, amountInput, mode, recipient);
  }, [activeVault, amountInput, actionTab, recipient]);

  const activeFactoryTx = useMemo(() => {
    if (!factoryPreview) return null;
    if (actionTab === 'claim' && factoryPreview.claimTx) return factoryPreview.claimTx;
    return factoryPreview.tx;
  }, [factoryPreview, actionTab]);

  const activeSeason2Steps: SwapExecutionStep[] = useMemo(() => {
    if (selectedStrategyId === 'season2-eth-vault') {
      if (!ethVaultAmount || Number(ethVaultAmount) <= 0) return [];
      return buildGiwaEthVaultDepositStep(ethVaultAmount);
    }
    if (selectedStrategyId === 'season2-tamm-staking') {
      if (stakeTab !== 'claim' && (!stakeTammAmount || Number(stakeTammAmount) <= 0)) return [];
      return buildTammStakingSteps(stakeTab, stakeTammAmount);
    }
    if (selectedStrategyId === 'season2-tamm-lp') {
      if (!lpPreview || lpPreview.liquidity <= 0n) return [];
      return buildTammPoolAddLiquiditySteps({
        maxBaseRaw: parseUnits(lpMaxBase || '0', 6),
        maxQuoteRaw: parseUnits(lpMaxQuote || '0', 18),
        minLiquidityRaw: (lpPreview.liquidity * 99n) / 100n,
        recipient,
      });
    }
    return [];
  }, [selectedStrategyId, ethVaultAmount, stakeTab, stakeTammAmount, lpPreview, lpMaxBase, lpMaxQuote, recipient]);

  const handleSeason2Submit = async () => {
    if (activeSeason2Steps.length === 0) return;
    setSubmitting(true);
    setExecProgress(null);
    setTxError(null);
    setTxFeedback(null);
    try {
      const res = await executeExecutionSteps({
        wallet,
        steps: activeSeason2Steps,
        onProgress: (msg) => setExecProgress(msg),
      });
      setTxFeedback(res);
      if (res.mode === 'sent') {
        await Promise.all([loadSeason2(), onRefreshBalances?.()]);
      }
    } catch (err) {
      setTxError(err instanceof Error ? err.message.split('\n')[0] : 'Vault transaction reverted or rejected.');
    } finally {
      setExecProgress(null);
      setSubmitting(false);
    }
  };

  const handleFactoryVaultAction = async () => {
    if (!activeFactoryTx) return;
    setSubmitting(true);
    setTxError(null);
    setTxFeedback(null);
    try {
      const res = await sendOrSimulateTransaction({
        wallet,
        to: activeFactoryTx.to,
        data: activeFactoryTx.data,
        value: activeFactoryTx.value,
      });
      setTxFeedback(res);

      const decimals = activeVault.stakeTokenSymbol === 'AIV4C' ? 9 : activeVault.stakeTokenSymbol === 'tAMM' ? 6 : 18;
      const deltaRaw = parseUnits(amountInput || '0', decimals);
      const deltaWeth = Number(amountInput) || 0;
      setVaults((prev) =>
        prev.map((v) => {
          if (v.id !== activeVault.id) return v;
          if (actionTab === 'deposit') {
            return {
              ...v,
              userStakedRaw: v.userStakedRaw + deltaRaw,
              tvlWeth: v.stakeTokenSymbol === 'WETH' ? v.tvlWeth + deltaWeth : v.tvlWeth,
            };
          }
          if (actionTab === 'withdraw') {
            const nextStaked = v.userStakedRaw > deltaRaw ? v.userStakedRaw - deltaRaw : 0n;
            return { ...v, userStakedRaw: nextStaked };
          }
          return {
            ...v,
            pendingQuoteFeeRaw: 0n,
            userStakedRaw: v.userStakedRaw + v.pendingStakeFeeRaw,
            pendingStakeFeeRaw: 0n,
          };
        }),
      );
    } catch (err) {
      setTxError(err instanceof Error ? err.message.split('\n')[0] : 'Transaction failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateNewVaultTx = (e: React.FormEvent) => {
    e.preventDefault();
    const asset = isAddress(newVaultAsset.trim()) ? (newVaultAsset.trim() as Address) : WETH_ADDRESS;
    const tx = buildNewVaultDeployCalldata({
      kind: newVaultKind,
      assetAddress: asset,
      ownerAddress: recipient,
      performanceFeeBps: newVaultPerfFeeBps,
      unstakeLockHours: newVaultLockHours,
    });
    setNewVaultTx(tx);
  };

  const userStakeDecimals = activeVault.stakeTokenSymbol === 'AIV4C' ? 9 : activeVault.stakeTokenSymbol === 'tAMM' ? 6 : 18;

  const season2Strategies: Array<{
    id: Season2StrategyId;
    name: string;
    subtitle: string;
    tokenSymbol: string;
    metricLabel: string;
    metricValue: string;
    secondaryLabel: string;
    secondaryValue: string;
    contract: Address;
  }> = [
    {
      id: 'season2-eth-vault',
      name: 'GIWA ETH Vault',
      subtitle: 'Season 2 Vault · Payable deposit() with Native ETH',
      tokenSymbol: 'ETH',
      metricLabel: 'Live Vault Assets',
      metricValue: season2State ? `${season2State.vaultTotalAssetsEth} ETH` : '—',
      secondaryLabel: 'Method',
      secondaryValue: 'deposit() payable',
      contract: GIWA_ETH_VAULT_ADDRESS,
    },
    {
      id: 'season2-tamm-staking',
      name: 'tAMM Season 2 Staking',
      subtitle: 'Approve tAMM (6 dec) + deposit() · Identity gated',
      tokenSymbol: 'tAMM',
      metricLabel: 'Your Staked',
      metricValue: season2State
        ? `${Number(formatUnits(season2State.userStakedTammRaw, 6)).toLocaleString('en-US', { maximumFractionDigits: 2 })} tAMM`
        : '0 tAMM',
      secondaryLabel: 'Deposits',
      secondaryValue: season2State?.stakingDepositsPaused ? 'Paused' : 'Open',
      contract: TAMM_STAKING_ADDRESS,
    },
    {
      id: 'season2-tamm-lp',
      name: 'tAMM / WETH ARL Pool LP',
      subtitle: 'ARLCompoundingPoolV4 · previewAddLiquidity & addLiquidity',
      tokenSymbol: 'tAMM',
      metricLabel: 'Pool Quote Reserve',
      metricValue: season2State
        ? `${Number(formatUnits(season2State.poolQuoteReserveWei, 18)).toFixed(4)} WETH`
        : '—',
      secondaryLabel: 'Your LP Positions',
      secondaryValue: `${season2State?.userLpPositionsCount ?? 0} NFT`,
      contract: TAMM_POOL_ADDRESS,
    },
  ];

  const primarySeason2Step = activeSeason2Steps[activeSeason2Steps.length - 1];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between border-b border-slate-800/80 pb-6">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight text-slate-50">
            LP Staking, ETH Vault &amp; Pool Liquidity
          </h1>
          <p className="mt-1.5 text-sm text-slate-400">
            Live Season 2 <span className="font-mono text-slate-300">GIWA ETH Vault</span>,{' '}
            <span className="font-mono text-slate-300">tAMM Staking</span>,{' '}
            <span className="font-mono text-slate-300">ARLCompoundingPoolV4 LP</span>, dan factory vaults.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={loadSeason2}
            disabled={loadingSeason2}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#111827] px-3.5 py-2 text-xs font-medium text-sky-400 hover:border-slate-700 transition-colors whitespace-nowrap"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingSeason2 ? 'animate-spin' : ''}`} />
            <span>Sync On-Chain</span>
          </button>
          <button
            type="button"
            onClick={() => setShowCreateVault((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-[#111827] px-4 py-2 text-xs font-medium text-slate-100 hover:border-emerald-500/60 transition-colors whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5 text-emerald-400" />
            <span>{showCreateVault ? 'Close Vault Creator' : 'Deploy LP Vault'}</span>
          </button>
        </div>
      </div>

      {/* 4-Column Flat KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 border-b border-slate-800/80 pb-6">
        <div>
          <div className="text-xs text-slate-400">GIWA ETH Vault Total Assets</div>
          <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-emerald-400">
            {season2State ? `${season2State.vaultTotalAssetsEth} ETH` : '—'}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-400">tAMM Staking Status</div>
          <div className="mt-1 font-mono text-xl font-semibold text-slate-50">
            {season2State?.stakingDepositsPaused ? 'Paused' : 'Deposits Open'}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-400">Identity Eligibility</div>
          <div
            className={`mt-1 font-mono text-sm font-semibold ${
              season2State?.identityEligible === true
                ? 'text-emerald-400'
                : season2State?.identityEligible === false
                  ? 'text-amber-400'
                  : 'text-slate-300'
            }`}
          >
            {!wallet.connected
              ? 'Connect Wallet'
              : season2State?.identityEligible === true
                ? 'Eligible (Verified)'
                : season2State?.identityEligible === false
                  ? 'Not Eligible (0xb4fa3fb3)'
                  : 'Checking…'}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-400">SDK Vault Factories</div>
          <div className="mt-1 font-mono text-sm font-medium text-slate-200">
            {vaultFactoriesActive.yieldFactory && vaultFactoriesActive.genesisFactory ? 'Deployed & Verified' : 'Configured'}
          </div>
        </div>
      </div>

      {/* Optional Deploy New Vault Studio Panel */}
      {showCreateVault && (
        <div className="rounded-xl border border-slate-800 bg-[#111827] p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-100">
                Create Permissionless Staking or Yield Vault
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Generates deterministic factory calldata via <span className="font-mono">buildCreateAYVault</span> or{' '}
                <span className="font-mono">buildCreateAStakeV2</span>.
              </p>
            </div>
          </div>

          <form onSubmit={handleGenerateNewVaultTx} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
            <div>
              <label htmlFor="new-vault-kind" className="block text-xs font-medium text-slate-300 mb-1.5">
                Vault Standard
              </label>
              <select
                id="new-vault-kind"
                value={newVaultKind}
                onChange={(e) => setNewVaultKind(e.target.value as 'AYVault' | 'AStakeV2')}
                className="w-full rounded-lg border border-slate-700 bg-[#0B101B] px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
              >
                <option value="AStakeV2">AStakeV2 (Fee Sharing)</option>
                <option value="AYVault">AYVault (Auto-Compound)</option>
              </select>
            </div>
            <div>
              <label htmlFor="new-vault-asset" className="block text-xs font-medium text-slate-300 mb-1.5">
                Stake / Underlying Asset
              </label>
              <input
                id="new-vault-asset"
                type="text"
                value={newVaultAsset}
                onChange={(e) => setNewVaultAsset(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#0B101B] px-3 py-2 font-mono text-xs text-slate-100 outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label htmlFor="new-vault-param" className="block text-xs font-medium text-slate-300 mb-1.5">
                {newVaultKind === 'AYVault' ? 'Perf Fee (bps)' : 'Unstake Lock (hours)'}
              </label>
              <input
                id="new-vault-param"
                type="number"
                min={0}
                max={newVaultKind === 'AYVault' ? 2000 : 720}
                value={newVaultKind === 'AYVault' ? newVaultPerfFeeBps : newVaultLockHours}
                onChange={(e) =>
                  newVaultKind === 'AYVault'
                    ? setNewVaultPerfFeeBps(Number(e.target.value))
                    : setNewVaultLockHours(Number(e.target.value))
                }
                className="w-full rounded-lg border border-slate-700 bg-[#0B101B] px-3 py-2 font-mono text-sm tabular-nums text-slate-100 outline-none focus:border-emerald-500"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 transition-colors whitespace-nowrap"
            >
              Build Factory Calldata
            </button>
          </form>

          {newVaultTx && (
            <CalldataDrawer
              title={`Unsigned ${newVaultKind} Factory Deployment Calldata`}
              to={newVaultTx.to}
              data={newVaultTx.data}
              value={newVaultTx.value}
              defaultOpen
            />
          )}
        </div>
      )}

      {/* Main Master-Detail Vault Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Strategy Selection List */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 rounded-lg bg-[#111827] p-1 border border-slate-800">
              {(['all', 'season2', 'AYVault', 'AStakeV2'] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setFilterKind(kind)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    filterKind === kind
                      ? 'bg-slate-800 text-emerald-400'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {kind === 'all'
                    ? 'All Venues'
                    : kind === 'season2'
                      ? 'Season 2 Live'
                      : kind === 'AYVault'
                        ? 'AYVault'
                        : 'AStakeV2'}
                </button>
              ))}
            </div>
            <span className="text-xs text-slate-400 tabular-nums">
              {(filterKind === 'all' || filterKind === 'season2' ? season2Strategies.length : 0) +
                filteredFactoryVaults.length}{' '}
              Strategies
            </span>
          </div>

          <div className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-[#111827] overflow-hidden">
            {(filterKind === 'all' || filterKind === 'season2') &&
              season2Strategies.map((item) => {
                const isSelected = selectedStrategyId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedStrategyId(item.id);
                      setTxFeedback(null);
                      setTxError(null);
                    }}
                    className={`w-full text-left p-5 transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${
                      isSelected ? 'bg-slate-800/45' : 'hover:bg-slate-800/25'
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      <TokenMark symbol={item.tokenSymbol} size={36} />
                      <div>
                        <div className="font-display text-sm font-semibold text-slate-100">{item.name}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                          <span className="font-mono text-emerald-400">GIWA On-Chain</span>
                          <span aria-hidden="true">·</span>
                          <span>{item.subtitle}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 sm:text-right shrink-0">
                      <div>
                        <div className="text-[11px] text-slate-400">{item.metricLabel}</div>
                        <div className="font-mono text-sm font-semibold tabular-nums text-emerald-400">
                          {item.metricValue}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-400">{item.secondaryLabel}</div>
                        <div className="font-mono text-sm font-medium tabular-nums text-slate-200">
                          {item.secondaryValue}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}

            {filteredFactoryVaults.map((vault) => {
              const isSelected = vault.id === selectedStrategyId;
              return (
                <button
                  key={vault.id}
                  type="button"
                  onClick={() => {
                    setSelectedStrategyId(vault.id);
                    setTxFeedback(null);
                    setTxError(null);
                    if (vault.protocolKind === 'AYVault' && actionTab === 'claim') {
                      setActionTab('deposit');
                    }
                  }}
                  className={`w-full text-left p-5 transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${
                    isSelected ? 'bg-slate-800/45' : 'hover:bg-slate-800/25'
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    <TokenMark symbol={vault.stakeTokenSymbol} size={36} />
                    <div>
                      <div className="font-display text-sm font-semibold text-slate-100">{vault.name}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <span className="font-mono text-slate-300">{vault.protocolKind}</span>
                        <span aria-hidden="true">·</span>
                        <span>{vault.pairLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {vault.unstakeLockHours > 0 ? `${vault.unstakeLockHours}h unstake lock` : 'Instant liquidity'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 sm:text-right shrink-0">
                    <div>
                      <div className="text-[11px] text-slate-400">Est. APY</div>
                      <div className="font-mono text-base font-semibold tabular-nums text-emerald-400">
                        {vault.apyPct.toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-400">TVL (ref.)</div>
                      <div className="font-mono text-sm font-medium tabular-nums text-slate-200">
                        {vault.tvlWeth.toFixed(2)} WETH
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] leading-relaxed text-slate-500">
            APY &amp; TVL pada factory vault (AYVault / AStakeV2) adalah angka referensi. Nilai live
            on-chain ditampilkan pada strategi Season 2 di atas.
          </p>
        </div>

        {/* Right: Active Workbench */}
        <div className="lg:col-span-5 rounded-xl border border-slate-800 bg-[#111827] p-6 space-y-5">
          {selectedStrategyId === 'season2-eth-vault' && (
            <>
              <div className="border-b border-slate-800 pb-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-display text-base font-semibold text-slate-50">GIWA ETH Vault</h2>
                  <a
                    href={`${GIWA_EXPLORER_URL}/address/${GIWA_ETH_VAULT_ADDRESS}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 whitespace-nowrap"
                  >
                    <span>0x016e…7c4b</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                  Memanggil fungsi <span className="font-mono text-slate-300">deposit() payable</span> pada kontrak GIWA
                  ETH Vault (bukan transfer ETH biasa).
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 border-b border-slate-800 pb-4 text-xs">
                <div>
                  <span className="text-slate-400">Total Vault Assets</span>
                  <div className="mt-1 font-mono text-sm font-semibold tabular-nums text-emerald-400">
                    {season2State?.vaultTotalAssetsEth ?? '—'} ETH
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Your Wallet ETH</span>
                  <div className="mt-1 font-mono text-sm font-semibold tabular-nums text-slate-100">
                    {wallet.ethBalance} ETH
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-800 bg-[#0B101B] p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>ETH Deposit Amount</span>
                  <button
                    type="button"
                    onClick={() => setEthVaultAmount('0.01')}
                    className="font-mono text-sky-400 hover:text-sky-300"
                  >
                    Preset 0.01 ETH
                  </button>
                </div>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={ethVaultAmount}
                  onChange={(e) => {
                    setEthVaultAmount(e.target.value);
                    setTxFeedback(null);
                  }}
                  aria-label="ETH Vault deposit amount"
                  className="w-full bg-transparent font-mono text-2xl font-medium tabular-nums text-slate-50 outline-none"
                />
              </div>
            </>
          )}

          {selectedStrategyId === 'season2-tamm-staking' && (
            <>
              <div className="border-b border-slate-800 pb-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-display text-base font-semibold text-slate-50">tAMM Season 2 Staking</h2>
                  <a
                    href={`${GIWA_EXPLORER_URL}/address/${TAMM_STAKING_ADDRESS}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 whitespace-nowrap"
                  >
                    <span>0x091d…3C27</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                  Approve <span className="font-mono text-slate-300">tAMM</span> (6 dec) lalu panggil{' '}
                  <span className="font-mono text-slate-300">deposit(uint256)</span>. Memerlukan status Identity{' '}
                  <span className="font-mono text-slate-300">eligible == true</span>.
                </p>
              </div>

              {wallet.connected && season2State?.identityEligible === false && (
                <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-950/25 p-3 text-xs text-amber-200">
                  <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    Wallet ini belum terverifikasi di kontrak{' '}
                    <a
                      href={`${GIWA_EXPLORER_URL}/address/${AMMORA_IDENTITY_ADDRESS}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono underline text-amber-300"
                    >
                      Identity (0x95E4…B3B7)
                    </a>
                    . Deposit pada kontrak staking akan revert <span className="font-mono">0xb4fa3fb3</span> sampai
                    eligible.
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3 border-b border-slate-800 pb-4 text-xs">
                <div>
                  <span className="text-slate-400">Staked tAMM</span>
                  <div className="mt-1 font-mono text-sm font-semibold tabular-nums text-slate-100">
                    {season2State ? Number(formatUnits(season2State.userStakedTammRaw, 6)).toFixed(2) : '0.00'}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Pending Unstake</span>
                  <div className="mt-1 font-mono text-sm font-semibold tabular-nums text-slate-200">
                    {season2State ? Number(formatUnits(season2State.userPendingWithdrawalRaw, 6)).toFixed(2) : '0.00'}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Claimable</span>
                  <div className="mt-1 font-mono text-sm font-semibold tabular-nums text-emerald-400">
                    {season2State ? Number(formatUnits(season2State.userClaimableRewardRaw, 6)).toFixed(4) : '0.0000'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-1 rounded-lg bg-[#0B101B] p-1 border border-slate-800">
                {(
                  [
                    { id: 'deposit', label: 'Stake' },
                    { id: 'requestWithdrawal', label: 'Req Unstake' },
                    { id: 'withdraw', label: 'Withdraw' },
                    { id: 'claim', label: 'Claim' },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setStakeTab(t.id)}
                    className={`py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      stakeTab === t.id ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {stakeTab !== 'claim' ? (
                <div className="rounded-lg border border-slate-800 bg-[#0B101B] p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>tAMM Amount (6 decimals)</span>
                    <span className="font-mono tabular-nums">Bal: {wallet.tammBalance} tAMM</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={stakeTammAmount}
                    onChange={(e) => {
                      setStakeTammAmount(e.target.value);
                      setTxFeedback(null);
                    }}
                    aria-label="tAMM Staking amount"
                    className="w-full bg-transparent font-mono text-2xl font-medium tabular-nums text-slate-50 outline-none"
                  />
                </div>
              ) : (
                <div className="rounded-lg border border-slate-800 bg-[#0B101B] p-4 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Claimable Staking Rewards</span>
                  <span className="font-mono text-sm font-semibold tabular-nums text-emerald-400">
                    {season2State ? Number(formatUnits(season2State.userClaimableRewardRaw, 6)).toFixed(4) : '0.0000'}{' '}
                    tAMM
                  </span>
                </div>
              )}
            </>
          )}

          {selectedStrategyId === 'season2-tamm-lp' && (
            <>
              <div className="border-b border-slate-800 pb-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-display text-base font-semibold text-slate-50">tAMM / WETH Add LP</h2>
                  <a
                    href={`${GIWA_EXPLORER_URL}/address/${TAMM_POOL_IMPL_ADDRESS}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 whitespace-nowrap"
                  >
                    <span>ARLCompoundingPoolV4</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                  Menambahkan likuiditas langsung ke kontrak Pool <span className="font-mono text-slate-300">0x1EF9…5BCf8</span>{' '}
                  via <span className="font-mono text-slate-300">addLiquidity(...)</span> dengan rasio live dari{' '}
                  <span className="font-mono text-slate-300">previewAddLiquidity</span>.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-800 bg-[#0B101B] p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Max tAMM</span>
                    <span className="font-mono">{wallet.tammBalance}</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={lpMaxBase}
                    onChange={(e) => setLpMaxBase(e.target.value)}
                    aria-label="Max tAMM for LP"
                    className="w-full bg-transparent font-mono text-lg font-medium tabular-nums text-slate-50 outline-none"
                  />
                </div>
                <div className="rounded-lg border border-slate-800 bg-[#0B101B] p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Max WETH</span>
                    <span className="font-mono">{wallet.wethBalance}</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={lpMaxQuote}
                    onChange={(e) => setLpMaxQuote(e.target.value)}
                    aria-label="Max WETH for LP"
                    className="w-full bg-transparent font-mono text-lg font-medium tabular-nums text-slate-50 outline-none"
                  />
                </div>
              </div>

              <div className="border-t border-slate-800 pt-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Previewed Liquidity Units</span>
                  <span className="font-mono tabular-nums text-emerald-400">
                    {loadingLpPreview ? 'Reading RPC…' : lpPreview ? lpPreview.liquidity.toLocaleString() : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Estimated tAMM Used</span>
                  <span className="font-mono tabular-nums text-slate-200">
                    {lpPreview ? `${Number(formatUnits(lpPreview.baseUsed, 6)).toFixed(6)} tAMM` : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Estimated WETH Used</span>
                  <span className="font-mono tabular-nums text-slate-200">
                    {lpPreview ? `${Number(formatUnits(lpPreview.quoteUsed, 18)).toFixed(6)} WETH` : '—'}
                  </span>
                </div>
              </div>
            </>
          )}

          {!isSeason2Selected && (
            <>
              <div className="border-b border-slate-800 pb-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-display text-base font-semibold text-slate-50">{activeVault.name}</h2>
                  <a
                    href={`${GIWA_EXPLORER_URL}/address/${activeVault.vaultAddress}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 whitespace-nowrap"
                  >
                    <span>Contract</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">{activeVault.strategyDescription}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 border-b border-slate-800 pb-4 text-xs">
                <div>
                  <span className="text-slate-400">Your Staked Balance</span>
                  <div className="mt-1 font-mono text-sm font-semibold tabular-nums text-slate-100">
                    {Number(formatUnits(activeVault.userStakedRaw, userStakeDecimals)).toLocaleString('en-US', {
                      maximumFractionDigits: 4,
                    })}{' '}
                    {activeVault.stakeTokenSymbol}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Reward Stream</span>
                  <div className="mt-1 font-mono text-sm font-semibold tabular-nums text-emerald-400">
                    {activeVault.rewardTokenSymbol}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 rounded-lg bg-[#0B101B] p-1 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setActionTab('deposit')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    actionTab === 'deposit' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {activeVault.protocolKind === 'AYVault' ? 'Deposit' : 'Stake LP'}
                </button>
                <button
                  type="button"
                  onClick={() => setActionTab('withdraw')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    actionTab === 'withdraw' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {activeVault.protocolKind === 'AYVault' ? 'Redeem' : 'Request Unstake'}
                </button>
                {activeVault.protocolKind === 'AStakeV2' && (
                  <button
                    type="button"
                    onClick={() => setActionTab('claim')}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      actionTab === 'claim' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Claim Fees
                  </button>
                )}
              </div>

              {actionTab !== 'claim' ? (
                <div className="rounded-lg border border-slate-800 bg-[#0B101B] p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{actionTab === 'deposit' ? 'Amount to Stake' : 'Shares / Amount to Unstake'}</span>
                    <span className="font-mono tabular-nums">{activeVault.stakeTokenSymbol}</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={amountInput}
                    onChange={(e) => {
                      setAmountInput(e.target.value);
                      setTxFeedback(null);
                    }}
                    aria-label="Vault stake amount"
                    className="w-full bg-transparent font-mono text-2xl font-medium tabular-nums text-slate-50 outline-none"
                  />
                </div>
              ) : (
                <div className="rounded-lg border border-slate-800 bg-[#0B101B] p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Auto-Restaked Stake Fees</span>
                    <span className="font-mono tabular-nums text-emerald-400">
                      {factoryPreview?.claimRestakeStakeFee ?? '0'} {activeVault.stakeTokenSymbol}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Claimable Quote Fee Payout</span>
                    <span className="font-mono tabular-nums text-slate-100">
                      {factoryPreview?.claimQuoteFeeWeth ?? '0'} WETH
                    </span>
                  </div>
                </div>
              )}
            </>
          )}

          {txError && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-950/30 px-3.5 py-2.5 text-xs text-rose-300">
              {txError}
            </div>
          )}

          {/* Submit CTA */}
          {!wallet.connected ? (
            <button
              type="button"
              onClick={onConnectWallet}
              className="w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-400 transition-colors whitespace-nowrap"
            >
              Connect Wallet to Execute
            </button>
          ) : isSeason2Selected ? (
            <button
              type="button"
              disabled={activeSeason2Steps.length === 0 || submitting}
              onClick={handleSeason2Submit}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{execProgress ?? 'Executing Transaction…'}</span>
                </>
              ) : wallet.isSimulated ? (
                <span>Simulate {primarySeason2Step?.label ?? 'Action'}</span>
              ) : (
                <span>{primarySeason2Step?.label ?? 'Execute on GIWA Sepolia'}</span>
              )}
            </button>
          ) : (
            <button
              type="button"
              disabled={!activeFactoryTx || submitting}
              onClick={handleFactoryVaultAction}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Preparing Vault Transaction…</span>
                </>
              ) : wallet.isSimulated ? (
                <span>
                  Simulate{' '}
                  {actionTab === 'deposit' ? 'Stake' : actionTab === 'withdraw' ? 'Unstake' : 'Reward Claim'}
                </span>
              ) : (
                <span>
                  Confirm{' '}
                  {actionTab === 'deposit' ? 'Stake' : actionTab === 'withdraw' ? 'Unstake' : 'Claim'} on GIWA
                </span>
              )}
            </button>
          )}

          {txFeedback && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-3.5 text-xs text-emerald-200 space-y-1.5">
              <div className="flex items-center gap-1.5 font-medium text-emerald-300">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span>{txFeedback.mode === 'sent' ? 'Transaction Sent' : 'Simulation Verified'}</span>
              </div>
              <p className="text-slate-300 leading-relaxed">{txFeedback.note}</p>
              {txFeedback.hash && (
                <a
                  href={`${GIWA_EXPLORER_URL}/tx/${txFeedback.hash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-sky-400 hover:text-sky-300"
                >
                  <span>View Tx {txFeedback.hash.slice(0, 12)}…</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          )}

          {isSeason2Selected && primarySeason2Step && (
            <CalldataDrawer
              title={`Inspect Calldata (${activeSeason2Steps.length} step${activeSeason2Steps.length > 1 ? 's' : ''})`}
              to={primarySeason2Step.to}
              data={primarySeason2Step.data}
              value={primarySeason2Step.value}
            />
          )}

          {!isSeason2Selected && activeFactoryTx && (
            <CalldataDrawer
              title={`Inspect Unsigned ${activeVault.protocolKind} Calldata`}
              to={activeFactoryTx.to}
              data={activeFactoryTx.data}
              value={activeFactoryTx.value}
            />
          )}
        </div>
      </div>
    </div>
  );
};
