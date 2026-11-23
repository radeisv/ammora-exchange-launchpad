import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  LogOut,
  RefreshCw,
  Shield,
  Wallet,
  X,
} from 'lucide-react';
import {
  GIWA_CHAIN_ID,
  GIWA_EXPLORER_URL,
  discoverWalletProviders,
  requestWalletDiscovery,
  subscribeWalletProviders,
  type WalletProviderOption,
  type WalletState,
} from '../lib/ammora';

interface WalletModalProps {
  open: boolean;
  onClose: () => void;
  wallet: WalletState;
  connectingId: string | null;
  error: string | null;
  onSelectProvider: (option: WalletProviderOption) => Promise<void>;
  onConnectWatchAddress: (address: string) => Promise<void>;
  onSwitchToGiwa: () => Promise<void>;
  onCancelConnect: () => void;
  onDisconnect: () => void;
}

export const WalletModal: React.FC<WalletModalProps> = ({
  open,
  onClose,
  wallet,
  connectingId,
  error,
  onSelectProvider,
  onConnectWatchAddress,
  onSwitchToGiwa,
  onCancelConnect,
  onDisconnect,
}) => {
  const [providers, setProviders] = useState<WalletProviderOption[]>(() => discoverWalletProviders());
  const [copied, setCopied] = useState(false);
  const [watchInput, setWatchInput] = useState('');
  const [switchingChain, setSwitchingChain] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    setProviders(requestWalletDiscovery());
    const unsub = subscribeWalletProviders((list) => {
      setProviders(list);
    });

    // Re-check slightly later for extensions that inject or announce asynchronously
    const delayedCheck = setTimeout(() => {
      setProviders(requestWalletDiscovery());
    }, 350);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      clearTimeout(delayedCheck);
      unsub();
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!open) return null;

  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
  const appUrl = typeof window !== 'undefined' ? window.location.href : '';
  const injectedProviders = providers.filter((p) => !p.isSimulated);
  const simulatedOption = providers.find((p) => p.isSimulated);
  const wrongChain = wallet.connected && !wallet.isSimulated && wallet.chainId !== GIWA_CHAIN_ID;

  const handleCopyAddress = () => {
    if (!wallet.address) return;
    navigator.clipboard?.writeText(wallet.address).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const handleRescan = () => {
    setProviders(requestWalletDiscovery());
  };

  const handleWatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!watchInput.trim()) return;
    await onConnectWatchAddress(watchInput);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-modal-title"
    >
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl border border-slate-800 bg-[#111827] shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-[#111827] px-5 py-4">
          <div>
            <h2 id="wallet-modal-title" className="font-display text-base font-semibold text-slate-50">
              {wallet.connected ? 'Wallet & Session' : 'Connect Wallet'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              {wallet.connected
                ? `Connected via ${wallet.providerName ?? 'Browser Wallet'} · GIWA Sepolia`
                : 'Choose MetaMask, OKX, Rabby, or another EIP-6963 browser wallet'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close wallet dialog"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Active Connected Summary */}
          {wallet.connected && wallet.address && (
            <div className="rounded-lg border border-slate-800 bg-[#0B101B] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-emerald-400">
                  {wallet.isSimulated ? 'Read-Only Preview Active' : `Active · ${wallet.providerName ?? 'Wallet'}`}
                </span>
                <span className={`font-mono text-xs ${wrongChain ? 'text-amber-400' : 'text-slate-400'}`}>
                  Chain {wallet.chainId ?? GIWA_CHAIN_ID}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-medium text-slate-100 truncate">
                  {wallet.address}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleCopyAddress}
                    className="rounded-md border border-slate-800 p-1.5 text-slate-400 hover:border-slate-700 hover:text-slate-100 transition-colors"
                    title="Copy address"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                  <a
                    href={`${GIWA_EXPLORER_URL}/address/${wallet.address}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-slate-800 p-1.5 text-slate-400 hover:border-slate-700 hover:text-slate-100 transition-colors"
                    title="View on GIWA Explorer"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>

              {wrongChain && (
                <button
                  type="button"
                  disabled={switchingChain}
                  onClick={async () => {
                    setSwitchingChain(true);
                    try {
                      await onSwitchToGiwa();
                    } finally {
                      setSwitchingChain(false);
                    }
                  }}
                  className="w-full rounded-lg border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-xs font-medium text-amber-300 hover:bg-amber-950/50 transition-colors"
                >
                  {switchingChain ? 'Switching to GIWA Sepolia…' : 'Switch Network to GIWA Sepolia (91342)'}
                </button>
              )}

              <div className="grid grid-cols-3 gap-2 border-t border-slate-800/80 pt-3 text-xs">
                <div>
                  <div className="text-slate-400">ETH</div>
                  <div className="mt-0.5 font-mono font-medium tabular-nums text-slate-100">{wallet.ethBalance}</div>
                </div>
                <div>
                  <div className="text-slate-400">WETH</div>
                  <div className="mt-0.5 font-mono font-medium tabular-nums text-slate-100">{wallet.wethBalance}</div>
                </div>
                <div>
                  <div className="text-slate-400">tAMM</div>
                  <div className="mt-0.5 font-mono font-medium tabular-nums text-slate-100">{wallet.tammBalance}</div>
                </div>
              </div>

              <button
                type="button"
                onClick={onDisconnect}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-[#151E30] px-3 py-2 text-xs font-medium text-rose-300 hover:border-rose-500/40 hover:bg-rose-950/30 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Disconnect Current Wallet</span>
              </button>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-950/30 px-3.5 py-2.5 text-xs text-rose-300 leading-relaxed">
              {error}
            </div>
          )}

          {/* Pending Connection Cancel Bar */}
          {connectingId && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-3.5 py-2.5 text-xs text-emerald-300">
              <span>Check your browser wallet popup to approve connection…</span>
              <button
                type="button"
                onClick={onCancelConnect}
                className="shrink-0 rounded border border-emerald-500/40 px-2 py-1 text-[11px] font-medium hover:bg-emerald-950/50"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Discovered Wallets List */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs font-medium text-slate-400">
              <span>{wallet.connected ? 'Switch Wallet Provider' : 'Detected Browser Wallets'}</span>
              <div className="flex items-center gap-2">
                <span className="font-mono tabular-nums">{injectedProviders.length} found</span>
                <button
                  type="button"
                  onClick={handleRescan}
                  className="inline-flex items-center gap-1 rounded border border-slate-800 px-2 py-0.5 text-[11px] text-slate-300 hover:border-slate-600 hover:text-slate-100 transition-colors"
                  title="Scan wallet extensions again"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Scan</span>
                </button>
              </div>
            </div>

            {injectedProviders.length === 0 ? (
              <div className="rounded-lg border border-slate-800 bg-[#0B101B] p-4 space-y-3 text-xs text-slate-400 leading-relaxed">
                <p>
                  No browser wallet extension was detected in this view (MetaMask, OKX, Rabby, or Coinbase Wallet).
                </p>
                {isInIframe && appUrl && (
                  <div className="space-y-2">
                    <p className="text-slate-300">
                      Browser extensions like MetaMask often restrict injection inside embedded preview frames.
                    </p>
                    <a
                      href={appUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 transition-colors"
                    >
                      <span>Open App in New Tab</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-0.5">
                {injectedProviders.map((option) => {
                  const isBusy = connectingId === option.id;
                  const isCurrent = wallet.connected && !wallet.isSimulated && wallet.providerId === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      disabled={Boolean(connectingId)}
                      onClick={() => onSelectProvider(option)}
                      className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors ${
                        isCurrent
                          ? 'border-emerald-500/50 bg-emerald-950/20'
                          : 'border-slate-800 bg-[#0B101B] hover:border-slate-600 hover:bg-[#151E30]'
                      } disabled:opacity-60`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {option.icon ? (
                          <img
                            src={option.icon}
                            alt=""
                            className="h-7 w-7 rounded-md object-contain shrink-0"
                          />
                        ) : (
                          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-800 text-slate-300 shrink-0">
                            <Wallet className="h-4 w-4" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-100 truncate">{option.name}</div>
                          <div className="text-[11px] font-mono text-slate-400 truncate">
                            {option.rdns || 'EIP-1193 Provider'}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-medium text-emerald-400 whitespace-nowrap ml-3">
                        {isBusy ? 'Connecting…' : isCurrent ? 'Connected' : 'Connect'}
                      </span>
                    </button>
                  );
                })}
                {isInIframe && appUrl && (
                  <div className="pt-1 text-[11px] text-slate-400 flex items-center justify-between gap-2">
                    <span>Missing MetaMask inside preview frame?</span>
                    <a
                      href={appUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 shrink-0"
                    >
                      <span>Open in New Tab</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Read-Only Watch Address & Preview Fallback */}
          <div className="border-t border-slate-800 pt-4 space-y-3">
            <form onSubmit={handleWatchSubmit} className="flex gap-2">
              <input
                type="text"
                value={watchInput}
                onChange={(e) => setWatchInput(e.target.value)}
                placeholder="Watch 0x… address (read-only)"
                className="min-w-0 flex-1 rounded-lg border border-slate-800 bg-[#0B101B] px-3 py-2 font-mono text-xs text-slate-100 placeholder:text-slate-500 focus:border-slate-600 focus:outline-none"
              />
              <button
                type="submit"
                disabled={Boolean(connectingId) || !watchInput.trim()}
                className="rounded-lg border border-slate-700 bg-[#151E30] px-3 py-2 text-xs font-medium text-slate-200 hover:border-slate-500 disabled:opacity-50 transition-colors shrink-0"
              >
                Watch
              </button>
            </form>

            {simulatedOption && (
              <button
                type="button"
                disabled={Boolean(connectingId)}
                onClick={() => onSelectProvider(simulatedOption)}
                className="flex w-full items-center justify-between rounded-lg border border-slate-800 bg-[#0B101B] px-4 py-2.5 text-left hover:border-slate-600 hover:bg-[#151E30] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-800 text-sky-400 shrink-0">
                    <Shield className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-200">{simulatedOption.name}</div>
                    <div className="text-[11px] text-slate-400">Inspect quotes &amp; dry-run RPC gas without signing</div>
                  </div>
                </div>
                <span className="text-xs font-medium text-sky-400 whitespace-nowrap ml-3">Use Preview</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
