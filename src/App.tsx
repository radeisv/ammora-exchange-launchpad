import { useCallback, useEffect, useRef, useState } from 'react';
import type { Address } from 'viem';
import {
  CANARY_V4_CURVE,
  GIWA_EXPLORER_URL,
  connectWalletOption,
  connectWatchAddress,
  disconnectBrowserWallet,
  fetchLiveNetworkSnapshot,
  fetchWalletBalances,
  formatWalletError,
  getActiveEip1193Provider,
  switchToGiwaChain,
  type NetworkSnapshot,
  type WalletProviderOption,
  type WalletState,
} from './lib/ammora';
import { LaunchpadWorkspace } from './components/LaunchpadWorkspace';
import { MarketsWorkspace } from './components/MarketsWorkspace';
import { SwapWorkspace } from './components/SwapWorkspace';
import { VaultsWorkspace } from './components/VaultsWorkspace';
import { WalletModal } from './components/WalletModal';

type WorkspaceTab = 'swap' | 'launchpad' | 'vaults' | 'markets';

const INITIAL_WALLET: WalletState = {
  connected: false,
  address: null,
  chainId: null,
  ethBalance: '0.0000',
  wethBalance: '0.0000',
  tammBalance: '0.00',
  isSimulated: false,
};

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('swap');
  const [wallet, setWallet] = useState<WalletState>(INITIAL_WALLET);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [connectingProviderId, setConnectingProviderId] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [network, setNetwork] = useState<NetworkSnapshot | null>(null);
  const [selectedCurveAddress, setSelectedCurveAddress] = useState<Address>(CANARY_V4_CURVE);
  const connectAttemptRef = useRef(0);

  useEffect(() => {
    let active = true;
    fetchLiveNetworkSnapshot().then((snap) => {
      if (active) setNetwork(snap);
    });
    const interval = setInterval(() => {
      fetchLiveNetworkSnapshot().then((snap) => {
        if (active) setNetwork(snap);
      });
    }, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const refreshWalletBalances = useCallback(async () => {
    if (!wallet.connected || !wallet.address) return;
    const [ethBalance, wethBalance, tammBalance] = await fetchWalletBalances(wallet.address);
    setWallet((prev) =>
      prev.address?.toLowerCase() === wallet.address?.toLowerCase()
        ? { ...prev, ethBalance, wethBalance, tammBalance }
        : prev,
    );
  }, [wallet.connected, wallet.address]);

  // Listen to account & chain switches on the active chosen EIP-1193 provider (MetaMask, OKX, etc.)
  useEffect(() => {
    const provider = getActiveEip1193Provider();
    if (!provider?.on || !wallet.connected || wallet.isSimulated) return;

    const handleAccountsChanged = async (accountsArg: unknown) => {
      const accounts = Array.isArray(accountsArg) ? (accountsArg as Address[]) : [];
      if (accounts.length === 0) {
        disconnectBrowserWallet();
        setWallet(INITIAL_WALLET);
        return;
      }
      const nextAddr = accounts[0];
      const [ethBalance, wethBalance, tammBalance] = await fetchWalletBalances(nextAddr);
      setWallet((prev) => ({
        ...prev,
        address: nextAddr,
        ethBalance,
        wethBalance,
        tammBalance,
      }));
    };

    const handleChainChanged = (chainHexArg: unknown) => {
      if (typeof chainHexArg === 'string') {
        const parsed = chainHexArg.startsWith('0x') ? parseInt(chainHexArg, 16) : Number(chainHexArg);
        if (!Number.isNaN(parsed)) {
          setWallet((prev) => ({ ...prev, chainId: parsed }));
        }
      }
    };

    provider.on('accountsChanged', handleAccountsChanged);
    provider.on('chainChanged', handleChainChanged);
    return () => {
      provider.removeListener?.('accountsChanged', handleAccountsChanged);
      provider.removeListener?.('chainChanged', handleChainChanged);
    };
  }, [wallet.connected, wallet.isSimulated, wallet.providerId]);

  const handleOpenWalletModal = useCallback(() => {
    setWalletError(null);
    setWalletModalOpen(true);
  }, []);

  const handleCloseWalletModal = useCallback(() => {
    connectAttemptRef.current += 1;
    setWalletModalOpen(false);
    setConnectingProviderId(null);
  }, []);

  const handleCancelConnect = useCallback(() => {
    connectAttemptRef.current += 1;
    setConnectingProviderId(null);
    setWalletError('Connection attempt cancelled.');
  }, []);

  const handleSelectWalletProvider = async (option: WalletProviderOption) => {
    const attemptId = ++connectAttemptRef.current;
    setConnectingProviderId(option.id);
    setWalletError(null);
    try {
      const next = await connectWalletOption(option);
      if (attemptId !== connectAttemptRef.current) return;
      setWallet(next);
      setWalletModalOpen(false);
      // Refresh full balances asynchronously in case quick connect timed out RPC balance fetch
      if (next.address) {
        fetchWalletBalances(next.address).then(([ethBalance, wethBalance, tammBalance]) => {
          setWallet((prev) =>
            prev.address?.toLowerCase() === next.address?.toLowerCase()
              ? { ...prev, ethBalance, wethBalance, tammBalance }
              : prev,
          );
        });
      }
    } catch (err) {
      if (attemptId !== connectAttemptRef.current) return;
      setWalletError(formatWalletError(err, `Unable to connect ${option.name}.`));
    } finally {
      if (attemptId === connectAttemptRef.current) {
        setConnectingProviderId(null);
      }
    }
  };

  const handleConnectWatchAddress = async (address: string) => {
    setConnectingProviderId('watch-address');
    setWalletError(null);
    try {
      const next = await connectWatchAddress(address);
      setWallet(next);
      setWalletModalOpen(false);
    } catch (err) {
      setWalletError(formatWalletError(err, 'Invalid EVM address.'));
    } finally {
      setConnectingProviderId(null);
    }
  };

  const handleSwitchToGiwa = async () => {
    setWalletError(null);
    try {
      const newChain = await switchToGiwaChain();
      if (newChain) {
        setWallet((prev) => ({ ...prev, chainId: newChain }));
      }
    } catch (err) {
      setWalletError(formatWalletError(err, 'Unable to switch to GIWA Sepolia.'));
    }
  };

  const handleDisconnectWallet = () => {
    disconnectBrowserWallet();
    setWallet(INITIAL_WALLET);
    setWalletError(null);
  };

  const handleTradeCurve = (curveAddress: Address) => {
    setSelectedCurveAddress(curveAddress);
    setActiveTab('swap');
  };

  const navItems: Array<{ id: WorkspaceTab; label: string }> = [
    { id: 'swap', label: 'Swap' },
    { id: 'launchpad', label: 'Launchpad' },
    { id: 'vaults', label: 'Vaults' },
    { id: 'markets', label: 'Markets' },
  ];

  const walletLabel = connectingProviderId
    ? 'Connecting…'
    : wallet.connected && wallet.address
      ? `${wallet.providerName ? `${wallet.providerName.replace(/\s*Wallet$/i, '')} · ` : ''}${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}`
      : 'Connect Wallet';

  return (
    <div className="min-h-screen flex flex-col bg-[#0B101B] text-slate-100">
      {/* Strict 3-Zone Top Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#0B101B]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-6 py-4">
          {/* Zone 1: Single-Element Brand Wordmark */}
          <a
            href="#swap"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('swap');
            }}
            className="font-display text-xl font-bold tracking-tight text-slate-50 whitespace-nowrap shrink-0"
          >
            Ammora
          </a>

          {/* Zone 2: 4 Single-Line Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium" aria-label="Primary">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                    isActive
                      ? 'border-emerald-400 text-slate-50'
                      : 'border-transparent text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={handleOpenWalletModal}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 transition-colors whitespace-nowrap shrink-0 font-mono"
            >
              {walletLabel}
            </button>
          </div>
        </div>

        {/* Compact Mobile Navigation Row (<md only) */}
        <nav
          className="flex md:hidden items-center justify-around border-t border-slate-800/70 px-4 py-2 text-xs font-medium"
          aria-label="Mobile navigation"
        >
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`px-3 py-1.5 rounded-md whitespace-nowrap transition-colors ${
                  isActive ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Main Content Viewport */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 md:py-10">
        {activeTab === 'swap' && (
          <SwapWorkspace
            wallet={wallet}
            initialCurveBundle={network?.canaryCurve ?? null}
            selectedCurveAddress={selectedCurveAddress}
            onSelectCurveAddress={setSelectedCurveAddress}
            onConnectWallet={handleOpenWalletModal}
            onRefreshBalances={refreshWalletBalances}
          />
        )}

        {activeTab === 'launchpad' && (
          <LaunchpadWorkspace
            wallet={wallet}
            nextConfigId={network?.nextConfigId ?? 82n}
            onConnectWallet={handleOpenWalletModal}
          />
        )}

        {activeTab === 'vaults' && (
          <VaultsWorkspace
            wallet={wallet}
            vaultFactoriesActive={
              network?.vaultFactoriesActive ?? {
                yieldFactory: true,
                genesisFactory: true,
                executionRegistry: true,
              }
            }
            onConnectWallet={handleOpenWalletModal}
            onRefreshBalances={refreshWalletBalances}
          />
        )}

        {activeTab === 'markets' && (
          <MarketsWorkspace network={network} wallet={wallet} onTradeCurve={handleTradeCurve} />
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-800/80 py-6">
        <div className="mx-auto flex max-w-6xl flex-col sm:flex-row items-center justify-between gap-4 px-6 text-xs text-slate-500">
          <div>
            Ammora Protocol Exchange &amp; Launchpad · Built on GIWA Sepolia (Chain 91342)
          </div>
          <div className="flex items-center gap-5">
            <a
              href={GIWA_EXPLORER_URL}
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-300 transition-colors whitespace-nowrap"
            >
              GIWA Explorer
            </a>
            <a
              href="https://www.npmjs.com/package/@ammora-protocol/sdk"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-300 transition-colors whitespace-nowrap"
            >
              @ammora-protocol/sdk
            </a>
            <a
              href="https://ammora.org/waitlist#mission"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-300 transition-colors whitespace-nowrap"
            >
              Builder Mission
            </a>
          </div>
        </div>
      </footer>
      <WalletModal
        open={walletModalOpen}
        onClose={handleCloseWalletModal}
        wallet={wallet}
        connectingId={connectingProviderId}
        error={walletError}
        onSelectProvider={handleSelectWalletProvider}
        onConnectWatchAddress={handleConnectWatchAddress}
        onSwitchToGiwa={handleSwitchToGiwa}
        onCancelConnect={handleCancelConnect}
        onDisconnect={handleDisconnectWallet}
      />
    </div>
  );
}
