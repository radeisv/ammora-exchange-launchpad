# Ammora Exchange & Launchpad

Token launchpad, low-slippage swap router, and LP staking vaults built with
[`@ammora-protocol/sdk`](https://www.npmjs.com/package/@ammora-protocol/sdk)
on **GIWA Sepolia (Chain 91342)** — a testnet deployment.

## Features

- **Swap** — exact-input quotes via `AmmoraRouteClient` and
  `AmmoraV4LaunchCurveClient`, native ETH auto-routing, slippage protection,
  and inspectable unsigned calldata before signing.
- **Launchpad** — configure tokenomics and validate the bonding curve with
  `buildPortableAmmoraV4Config`, then register + launch via
  `buildRegisterConfigAndCreateAmmoraV4Launch`, or launch from an existing
  registered config.
- **Vaults** — live Season 2 GIWA ETH Vault, tAMM staking, and tAMM/WETH ARL
  pool liquidity, plus AYVault / AStakeV2 factory vaults.
- **Markets** — live RPC inspection of V4 launch curves, the Config Registry,
  and the GIWA Sepolia contract directory.
- **Wallet** — EIP-6963 multi-wallet discovery (MetaMask, OKX, Rabby, …),
  watch-address mode, and a read-only simulated preview that dry-runs gas
  without signing.

## Run locally

Prerequisites: Node.js 20+.

```bash
npm install
npm run dev   # http://localhost:3000
```

No API keys or environment variables are required. All data comes from the
GIWA Sepolia RPC endpoint bundled in the SDK deployment manifest.

## Build & deploy

```bash
npm run build   # outputs static files to dist/
npm run lint    # tsc --noEmit
```

The app is a static Vite SPA — deploy `dist/` to any static host (e.g. Vercel).

## Notes

- Testnet only. The Ammora SDK is beta testnet software: the qualified GIWA
  release is live on GIWA Sepolia, Ammora has not announced a mainnet
  deployment or completed an independent security audit. Do not use with
  real funds.
- Factory vault APY/TVL figures are reference values; Season 2 strategies
  read live on-chain state.
