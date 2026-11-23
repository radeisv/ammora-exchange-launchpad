import {
  ALCClient,
  AMMORA_NATIVE_TOKEN,
  AmmoraRouteClient,
  AmmoraV4LaunchCurveClient,
  assertAmmoraV4Config,
  buildBuyExactIn,
  buildClaimAStakeV2,
  buildSellExactIn,
  buildCreateAStakeV2,
  buildCreateAYVault,
  buildCreateAmmoraV4Launch,
  buildDepositAYVault,
  buildPortableAmmoraV4Config,
  buildRegisterConfigAndCreateAmmoraV4Launch,
  buildRequestAStakeV2Unstake,
  buildRequestAYVaultRedeem,
  buildStakeAStakeV2,
  buildTammV5LaunchPolicy,
  buildWithdrawAStakeV2Unstake,
  calculateAStakeReleased,
  calculateAStakeReward,
  calculateAStakeV2Claim,
  calculateAYVaultAssets,
  calculateAYVaultLockedProfit,
  calculateAYVaultPerformanceFeeShares,
  calculateAYVaultShares,
  classifyAmmoraV4ExactInputFill,
  createConfigAndPoolWithFirstBuy,
  getAmmoraV4ConfigAtBlock,
  getAmmoraV4NextConfigId,
  giwaSepoliaAtomicLaunchDeployment,
  giwaSepoliaAutoRoute,
  giwaSepoliaAutoRouteAddresses,
  giwaSepoliaAutoRouteCatalog,
  giwaSepoliaAutoRouteDeployment,
  giwaSepoliaAutoRouteDeploymentCatalog,
  giwaSepoliaAutoRoutePoolProfiles,
  maxQuoteInput,
  minOutFromSlippage,
  portableSqrtPriceFromHumanPrice,
  type AmmoraV4Config,
  type AmmoraV4ConfigSnapshot,
  type AmmoraV4LaunchCurveState,
  type AmmoraV4Segment,
} from '@ammora-protocol/sdk';
import {
  buildAmmoraExactInCalldata,
  quoteAmmoraExactIn,
} from '@ammora-protocol/sdk/integrate';
import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  http,
  isAddress,
  maxUint256,
  parseUnits,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem';

export const GIWA_CHAIN_ID = 91342;
export const GIWA_RPC_URL = giwaSepoliaAutoRouteDeployment.chain.rpcUrls[0];
export const GIWA_EXPLORER_URL = giwaSepoliaAutoRouteDeployment.chain.blockExplorerUrl;
export const WETH_ADDRESS = giwaSepoliaAutoRouteDeployment.contracts.tokens.wrappedNative as Address;
export const TAMM_TOKEN_ADDRESS = '0x10B3Cc2fc981277Ada576891CF649D0ABA768B06' as Address;
export const TAMM_CURVE_ADDRESS = '0x1FD82a1BeAff168BdeFC790EB0f1A50f7C53b978' as Address;
export const TAMM_POOL_ADDRESS = '0x1EF92A6a9BB4bBed2b385Dd5E688F88e7965BCf8' as Address;
export const TAMM_POOL_IMPL_ADDRESS = '0x13bF46FF9d0aEc90f32766205859117475b0FA1C' as Address;
export const AMMORA_SEASON2_ROUTER = '0x4FC91b90087288520A7bB4aA7Ab5441bb4E9C496' as Address;
export const GIWA_ETH_VAULT_ADDRESS = '0x016e6B1c6e73152eA8C33CDA7D960D08608f7c4b' as Address;
export const TAMM_STAKING_ADDRESS = '0x091d0B15121DD466e67DBE080E62C30D05b93C27' as Address;
export const AMMORA_IDENTITY_ADDRESS = '0x95E4F2BA38c4d859C7Fbc5D118C1B8287117B3B7' as Address;
export const CANARY_V4_CURVE = '0x2C4e147617Ca14502c438a35a370680494E8BD7B' as Address;
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;

export interface GiwaterTokenMeta {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  venue: string;
}

export const GIWATER_DEX_TOKENS: GiwaterTokenMeta[] = [
  { address: '0xc7aa29e2fcb71c6396650f8cc76dda20714a5814', symbol: 'USDC', name: 'Mock USD Coin', decimals: 6, venue: 'GIWATER DEX' },
  { address: '0x1f6e6ffb0fc879cec28830531c6ec710f6110a7e', symbol: 'BTC', name: 'Mock Bitcoin', decimals: 8, venue: 'GIWATER DEX' },
  { address: '0x410432915ab0c6ba27d3b4a86b1e01b62942219f', symbol: 'AAPL', name: 'Mock Apple', decimals: 18, venue: 'GIWATER DEX' },
  { address: '0x39f748c63e2529bf8815f6b03b8badf4b3f03aba', symbol: 'SKHY', name: 'Mock SK hynix', decimals: 18, venue: 'GIWATER DEX' },
  { address: '0x4f7c2ebc3aac3281b5215be3347f793a3b7de5b6', symbol: 'SPCX', name: 'Mock SpaceX', decimals: 18, venue: 'GIWATER DEX' },
];

export const GIWATER_INFRA = {
  weth9: WETH_ADDRESS,
  permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3' as Address,
  universalRouter: '0xe958049fee2a61f1e96243239c4d76f91b9b19b5' as Address,
  clPoolManager: '0x1b24bde0c2b7fd77450a48c4f4b5db0ea4ad6bdc' as Address,
  vault: '0xc296e1d77624bf021b6e2677b062d55e70b69ac7' as Address,
  faucet: '0x05c2e641ff38c4d8f1c0f67a647ec31d2d3f1dc4' as Address,
  multicall3: '0xcA11bde05977b3631167028862bE2a173976CA11' as Address,
} as const;

export const giwaSepoliaChain = defineChain({
  id: GIWA_CHAIN_ID,
  name: 'GIWA Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [GIWA_RPC_URL] },
  },
  blockExplorers: {
    default: { name: 'GIWA Explorer', url: GIWA_EXPLORER_URL },
  },
  testnet: true,
});

export const giwaPublicClient: PublicClient = createPublicClient({
  chain: giwaSepoliaChain,
  transport: http(GIWA_RPC_URL, { timeout: 10000 }),
});

export const WETH9_ABI = [
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'payable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'withdraw',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'wad', type: 'uint256' }],
    outputs: [],
  },
] as const;

export const AMMORA_SEASON2_ROUTER_ABI = [
  {
    type: 'function',
    name: 'swapPoolExactInNative',
    stateMutability: 'payable',
    inputs: [
      { name: 'pool', type: 'address' },
      { name: 'minOut', type: 'uint256' },
      { name: 'recipient', type: 'address' },
      { name: 'deadline', type: 'uint256' },
      { name: 'referrer', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'swapPoolExactInForNative',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'pool', type: 'address' },
      { name: 'tokenIn', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'minNativeOut', type: 'uint256' },
      { name: 'recipient', type: 'address' },
      { name: 'deadline', type: 'uint256' },
      { name: 'referrer', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
] as const;

export const ARL_POOL_LP_ABI = [
  {
    type: 'function',
    name: 'previewAddLiquidity',
    stateMutability: 'view',
    inputs: [
      { name: 'maximumBaseAmount', type: 'uint256' },
      { name: 'maximumQuoteAmount', type: 'uint256' },
    ],
    outputs: [
      { name: 'liquidity', type: 'uint256' },
      { name: 'baseAmount', type: 'uint256' },
      { name: 'quoteAmount', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'previewRemoveLiquidity',
    stateMutability: 'view',
    inputs: [{ name: 'liquidity', type: 'uint256' }],
    outputs: [
      { name: 'baseAmount', type: 'uint256' },
      { name: 'quoteAmount', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'addLiquidity',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'maximumBaseAmount', type: 'uint256' },
      { name: 'maximumQuoteAmount', type: 'uint256' },
      { name: 'minimumLiquidity', type: 'uint256' },
      { name: 'recipient', type: 'address' },
      { name: 'lockDuration', type: 'uint40' },
      { name: 'permanentLock', type: 'bool' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'liquidity', type: 'uint256' },
      { name: 'baseAmount', type: 'uint256' },
      { name: 'quoteAmount', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'removeLiquidity',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'liquidity', type: 'uint256' },
      { name: 'minimumBaseAmount', type: 'uint256' },
      { name: 'minimumQuoteAmount', type: 'uint256' },
      { name: 'recipient', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [
      { name: 'baseAmount', type: 'uint256' },
      { name: 'quoteAmount', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'claimPositionFees',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'recipient', type: 'address' },
    ],
    outputs: [{ name: 'amount', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'totalLiquidity',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'reserveQuote',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const;

export const GIWA_ETH_VAULT_ABI = [
  { type: 'function', name: 'deposit', stateMutability: 'payable', inputs: [], outputs: [] },
  { type: 'function', name: 'totalAssets', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'totalDeposited', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
] as const;

export const AMMORA_IDENTITY_ABI = [
  { type: 'function', name: 'eligible', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'bool' }] },
] as const;

export const TAMM_STAKING_ABI = [
  { type: 'function', name: 'deposit', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'requestWithdrawal', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'withdraw', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'claim', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { type: 'function', name: 'depositsPaused', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'claimable', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'preview', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
  {
    type: 'function',
    name: 'accounts',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
    ],
  },
] as const;

export interface TokenAsset {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  isNative?: boolean;
  curveAddress?: Address;
  poolAddress?: Address;
  poolKind?: 'v4-curve' | 'concentrated' | 'compounding' | 'wrapped';
}

export const CORE_ASSETS: TokenAsset[] = [
  {
    address: AMMORA_NATIVE_TOKEN,
    symbol: 'ETH',
    name: 'GIWA Ether (Native)',
    decimals: 18,
    isNative: true,
    poolKind: 'wrapped',
  },
  {
    address: WETH_ADDRESS,
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    poolKind: 'wrapped',
  },
  {
    address: TAMM_TOKEN_ADDRESS,
    symbol: 'tAMM',
    name: 'tAmm Coin',
    decimals: 6,
    curveAddress: TAMM_CURVE_ADDRESS,
    poolAddress: TAMM_POOL_ADDRESS,
    poolKind: 'compounding',
  },
  {
    address: '0xc23220d34534aE3C8bbe231dB911b7E662743B6e',
    symbol: 'AIV4C',
    name: 'Ammora V4 Canary',
    decimals: 9,
    curveAddress: CANARY_V4_CURVE,
    poolKind: 'v4-curve',
  },
];

export interface LiveMarketSummary {
  symbol: string;
  name: string;
  tokenAddress: Address;
  decimals: number;
  venueAddress: Address;
  venueKind: 'compounding' | 'v4-curve';
  curveAddress?: Address;
  spotPriceWeth: number;
  feeBps: number;
  statusLabel: string;
}

export const FEATURED_GIWA_MARKETS: Array<{
  symbol: string;
  name: string;
  tokenAddress: Address;
  decimals: number;
  curveAddress: Address;
  poolAddress?: Address;
  venueKind: 'compounding' | 'v4-curve';
}> = [
  {
    symbol: 'tAMM',
    name: 'tAmm Coin',
    tokenAddress: TAMM_TOKEN_ADDRESS,
    decimals: 6,
    curveAddress: TAMM_CURVE_ADDRESS,
    poolAddress: TAMM_POOL_ADDRESS,
    venueKind: 'compounding',
  },
  {
    symbol: 'AIV4C',
    name: 'Ammora Isolated V4 Canary',
    tokenAddress: '0xc23220d34534aE3C8bbe231dB911b7E662743B6e',
    decimals: 9,
    curveAddress: CANARY_V4_CURVE,
    venueKind: 'v4-curve',
  },
  {
    symbol: 'AISDK',
    name: 'Ammora SDK Isolated Canary',
    tokenAddress: '0x43613ef621526e6fc4c6b079b40c8f49df9e440c',
    decimals: 9,
    curveAddress: '0x6d2ce5c47443330ecd3eb7c9d0f6c18fbc39c7d7',
    venueKind: 'v4-curve',
  },
  {
    symbol: 'OATM',
    name: 'Optional Atomic',
    tokenAddress: '0xb9111764b51a56f13137ae54f35d389dc64b6239',
    decimals: 9,
    curveAddress: '0xdd43fa8be3554a079494e9a3187299a35319cd4c',
    venueKind: 'v4-curve',
  },
];

export const ARL_POOL_READ_ABI = [
  {
    type: 'function',
    name: 'sqrtPrice',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'feeBps',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint16' }],
  },
] as const;

export async function fetchTammPoolSpot(): Promise<{ sqrtPrice: bigint; feeBps: number; spotPriceWeth: number; live: boolean }> {
  try {
    const [sqrtPrice, feeBps] = await Promise.all([
      giwaPublicClient.readContract({
        address: TAMM_POOL_ADDRESS,
        abi: ARL_POOL_READ_ABI,
        functionName: 'sqrtPrice',
      }),
      giwaPublicClient.readContract({
        address: TAMM_POOL_ADDRESS,
        abi: ARL_POOL_READ_ABI,
        functionName: 'feeBps',
      }),
    ]);
    return {
      sqrtPrice,
      feeBps: Number(feeBps),
      spotPriceWeth: sqrtPriceX64ToHumanPrice(sqrtPrice, 6, 18),
      live: true,
    };
  } catch {
    // RPC read failed: fall back to the last known snapshot so the UI still
    // renders, but flag it as cached — callers must not present it as live.
    return {
      sqrtPrice: 1102721600865181379711695n,
      feeBps: 100,
      spotPriceWeth: 0.003573,
      live: false,
    };
  }
}

export interface LiveCurveBundle {
  curveAddress: Address;
  state: AmmoraV4LaunchCurveState;
  progress: {
    ready: boolean;
    migrated: boolean;
    current: bigint;
    target: bigint;
    progressBps: number;
    canonicalPool: Address;
    asOfBlock: bigint;
  };
  tokenMeta: {
    name: string;
    symbol: string;
    decimals: number;
  };
  spotPriceQuotePerBase: number;
}

export interface NetworkSnapshot {
  chainId: number;
  blockNumber: bigint;
  nextConfigId: bigint;
  canaryCurve: LiveCurveBundle | null;
  vaultFactoriesActive: {
    yieldFactory: boolean;
    genesisFactory: boolean;
    executionRegistry: boolean;
  };
  rpcOnline: boolean;
}

export async function readErc20Metadata(address: Address): Promise<{ name: string; symbol: string; decimals: number }> {
  try {
    const [name, symbol, decimals] = await Promise.all([
      giwaPublicClient.readContract({ address, abi: erc20Abi, functionName: 'name' }),
      giwaPublicClient.readContract({ address, abi: erc20Abi, functionName: 'symbol' }),
      giwaPublicClient.readContract({ address, abi: erc20Abi, functionName: 'decimals' }),
    ]);
    return { name, symbol, decimals: Number(decimals) };
  } catch {
    return { name: 'Ammora Launch Token', symbol: 'TKN', decimals: 9 };
  }
}

export function sqrtPriceX64ToHumanPrice(sqrtPriceX64: bigint, baseDecimals: number, quoteDecimals: number): number {
  if (sqrtPriceX64 <= 0n) return 0;
  // price_raw = (sqrtPrice / 2^64)^2
  // price_human = price_raw * 10^(baseDecimals - quoteDecimals)
  const q64 = 2 ** 64;
  const sqrtFloat = Number(sqrtPriceX64) / q64;
  const rawPrice = sqrtFloat * sqrtFloat;
  const decimalScale = Math.pow(10, baseDecimals - quoteDecimals);
  return rawPrice * decimalScale;
}

export async function fetchLiveCurveBundle(curveAddress: Address, blockNumber?: bigint): Promise<LiveCurveBundle> {
  const block = blockNumber ?? (await giwaPublicClient.getBlockNumber());
  const d = giwaSepoliaAutoRouteDeployment;
  const curve = new AmmoraV4LaunchCurveClient(giwaPublicClient, curveAddress, {
    launchFactory: d.contracts.launch.factory,
    feePolicy: d.contracts.launch.feePolicy,
  });
  const [state, progress] = await Promise.all([
    curve.getStateAtBlock(block),
    curve.getMigrationProgressAtBlock(block),
  ]);
  const tokenMeta = await readErc20Metadata(state.baseToken);
  const spotPriceQuotePerBase = sqrtPriceX64ToHumanPrice(state.sqrtPrice, tokenMeta.decimals, 18);
  return {
    curveAddress,
    state,
    progress,
    tokenMeta,
    spotPriceQuotePerBase,
  };
}

export async function fetchLiveNetworkSnapshot(): Promise<NetworkSnapshot> {
  try {
    const blockNumber = await giwaPublicClient.getBlockNumber();
    const d = giwaSepoliaAutoRouteDeployment;
    const [nextConfigId, canaryRes, yieldCode, genesisCode, regCode] = await Promise.allSettled([
      getAmmoraV4NextConfigId(giwaPublicClient, d.contracts.launch.configRegistry, blockNumber),
      fetchLiveCurveBundle(CANARY_V4_CURVE, blockNumber),
      giwaPublicClient.getCode({ address: d.contracts.vaults.yieldFactory }),
      giwaPublicClient.getCode({ address: d.contracts.vaults.genesisFactory }),
      giwaPublicClient.getCode({ address: d.contracts.routers.executionRegistry }),
    ]);

    return {
      chainId: GIWA_CHAIN_ID,
      blockNumber,
      nextConfigId: nextConfigId.status === 'fulfilled' ? nextConfigId.value : 0n,
      canaryCurve: canaryRes.status === 'fulfilled' ? canaryRes.value : null,
      vaultFactoriesActive: {
        yieldFactory: yieldCode.status === 'fulfilled' && Boolean(yieldCode.value && yieldCode.value !== '0x'),
        genesisFactory: genesisCode.status === 'fulfilled' && Boolean(genesisCode.value && genesisCode.value !== '0x'),
        executionRegistry: regCode.status === 'fulfilled' && Boolean(regCode.value && regCode.value !== '0x'),
      },
      rpcOnline: true,
    };
  } catch {
    return {
      chainId: GIWA_CHAIN_ID,
      blockNumber: 0n,
      nextConfigId: 0n,
      canaryCurve: null,
      vaultFactoriesActive: { yieldFactory: false, genesisFactory: false, executionRegistry: false },
      rpcOnline: false,
    };
  }
}

export async function fetchOnChainV4Config(configId: bigint): Promise<AmmoraV4ConfigSnapshot> {
  const block = await giwaPublicClient.getBlockNumber();
  return getAmmoraV4ConfigAtBlock(
    giwaPublicClient,
    giwaSepoliaAutoRouteDeployment.contracts.launch.configRegistry,
    configId,
    block,
  );
}

export interface SwapExecutionStep {
  id: string;
  label: string;
  to: Address;
  data: Hex;
  value: bigint;
  approvalCheck?: {
    token: Address;
    spender: Address;
    amount: bigint;
  };
  trackWethDelta?: boolean;
  unwrapWethDelta?: {
    fallbackAmount: bigint;
  };
}

export interface SwapQuoteResult {
  amountInRaw: bigint;
  amountOutRaw: bigint;
  minimumAmountOutRaw: bigint;
  feeRaw: bigint;
  feeBps: number;
  priceImpactPct: number;
  fillKind: 'full' | 'graduation-boundary' | 'terminal-dust' | 'partial' | 'wrap';
  allowPartialFill: boolean;
  routeLabel: string;
  routePath: string[];
  venueAddress: Address;
  asOfBlock: bigint;
  executionSteps: SwapExecutionStep[];
  unsignedTx: {
    to: Address;
    data: Hex;
    value: bigint;
    approvalSpender: Address | null;
    approvalToken: Address | null;
    approvalAmount: bigint;
  };
}

export async function quoteAndPlanSwap(params: {
  tokenIn: TokenAsset;
  tokenOut: TokenAsset;
  amountInHuman: string;
  slippageBps: number;
  recipient: Address;
  activeCurve: LiveCurveBundle | null;
}): Promise<SwapQuoteResult> {
  const { tokenIn, tokenOut, amountInHuman, slippageBps, recipient, activeCurve } = params;
  const amountInRaw = parseUnits(amountInHuman || '0', tokenIn.decimals);
  if (amountInRaw <= 0n) {
    throw new Error('Enter a positive amount to quote.');
  }

  // Case 1: ETH <-> WETH 1:1 Canonical Wrapper on GIWA Sepolia
  const isEthToWeth = tokenIn.symbol === 'ETH' && tokenOut.symbol === 'WETH';
  const isWethToEth = tokenIn.symbol === 'WETH' && tokenOut.symbol === 'ETH';

  if (isEthToWeth || isWethToEth) {
    const block = await giwaPublicClient.getBlockNumber().catch(() => 0n);
    const data = isEthToWeth
      ? encodeFunctionData({ abi: WETH9_ABI, functionName: 'deposit' })
      : encodeFunctionData({ abi: WETH9_ABI, functionName: 'withdraw', args: [amountInRaw] });
    const value = isEthToWeth ? amountInRaw : 0n;

    return {
      amountInRaw,
      amountOutRaw: amountInRaw,
      minimumAmountOutRaw: amountInRaw,
      feeRaw: 0n,
      feeBps: 0,
      priceImpactPct: 0,
      fillKind: 'wrap',
      allowPartialFill: false,
      routeLabel: 'GIWA Canonical WETH9 Wrapper',
      routePath: [tokenIn.symbol, tokenOut.symbol],
      venueAddress: WETH_ADDRESS,
      asOfBlock: block,
      executionSteps: [
        {
          id: 'wrap',
          label: isEthToWeth ? 'Wrap ETH → WETH' : 'Unwrap WETH → ETH',
          to: WETH_ADDRESS,
          data,
          value,
        },
      ],
      unsignedTx: {
        to: WETH_ADDRESS,
        data,
        value,
        approvalSpender: null,
        approvalToken: null,
        approvalAmount: 0n,
      },
    };
  }

  const wrapData = encodeFunctionData({ abi: WETH9_ABI, functionName: 'deposit' });

  // Case 2: Graduated ARL Pool swap (supports both WETH <-> tAMM and Native ETH <-> tAMM via auto-routing)
  const poolAddress = tokenOut.poolAddress ?? tokenIn.poolAddress;
  const poolKind = tokenOut.poolAddress ? tokenOut.poolKind : tokenIn.poolKind;
  if (poolAddress && (poolKind === 'compounding' || poolKind === 'concentrated')) {
    const isBaseIn = Boolean(tokenIn.poolAddress);
    const actualTokenIn = isBaseIn ? tokenIn.address : WETH_ADDRESS;
    const block = await giwaPublicClient.getBlockNumber();
    const quotedOut = await quoteAmmoraExactIn(giwaPublicClient, {
      pool: poolAddress,
      poolKind,
      tokenIn: actualTokenIn,
      amountIn: amountInRaw,
      blockNumber: block,
    });
    const minimumAmountOutRaw = minOutFromSlippage(quotedOut, BigInt(slippageBps));
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
    const built = buildAmmoraExactInCalldata({
      pool: poolAddress,
      poolKind,
      tokenIn: actualTokenIn,
      amountIn: amountInRaw,
      minimumAmountOut: minimumAmountOutRaw,
      recipient,
      deadline,
    });

    const poolSpot = await fetchTammPoolSpot();
    const feeRaw = (amountInRaw * BigInt(poolSpot.feeBps)) / 10000n;
    const spotPriceQuotePerBase = poolSpot.spotPriceWeth;
    const effPrice =
      spotPriceQuotePerBase > 0
        ? isBaseIn
          ? Number(formatUnits(quotedOut, 18)) / Number(formatUnits(amountInRaw, tokenIn.decimals))
          : Number(formatUnits(amountInRaw, 18)) / Number(formatUnits(quotedOut, tokenOut.decimals))
        : 0;
    const priceImpactPct =
      spotPriceQuotePerBase > 0 && effPrice > 0
        ? Math.max(0, (Math.abs(effPrice - spotPriceQuotePerBase) / spotPriceQuotePerBase) * 100 - poolSpot.feeBps / 100)
        : 0;

    const approvalSpender = built.approvalSpender ?? poolAddress;
    const approveData = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [approvalSpender, maxUint256],
    });

    const executionSteps: SwapExecutionStep[] = [];
    const routePath: string[] = [];
    let primaryTxTo: Address = built.to;
    let primaryTxData: Hex = built.data;
    let primaryTxValue: bigint = built.value;
    let primaryApprovalSpender: Address | null = built.approvalSpender;
    let primaryApprovalToken: Address | null = actualTokenIn;
    let primaryApprovalAmount: bigint = built.approvalAmount;

    if (tokenIn.isNative) {
      // Single-Tx Native ETH -> tAMM via Season 2 Ammora Router (0x4FC9...C496)
      const routerData = encodeFunctionData({
        abi: AMMORA_SEASON2_ROUTER_ABI,
        functionName: 'swapPoolExactInNative',
        args: [poolAddress, minimumAmountOutRaw, recipient, deadline, ZERO_ADDRESS],
      });
      routePath.push('ETH', tokenOut.symbol);
      primaryTxTo = AMMORA_SEASON2_ROUTER;
      primaryTxData = routerData;
      primaryTxValue = amountInRaw;
      primaryApprovalSpender = null;
      primaryApprovalToken = null;
      primaryApprovalAmount = 0n;
      executionSteps.push({
        id: 'ammora-native-router',
        label: `Swap ETH → ${tokenOut.symbol} (Single Tx · Ammora Router)`,
        to: AMMORA_SEASON2_ROUTER,
        data: routerData,
        value: amountInRaw,
      });
    } else if (tokenOut.isNative) {
      // 1-Tx Token -> Native ETH via Season 2 Ammora Router (after ERC-20 approve to 0x4FC9...C496)
      const routerApproveData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [AMMORA_SEASON2_ROUTER, maxUint256],
      });
      const routerSellData = encodeFunctionData({
        abi: AMMORA_SEASON2_ROUTER_ABI,
        functionName: 'swapPoolExactInForNative',
        args: [poolAddress, actualTokenIn, amountInRaw, minimumAmountOutRaw, recipient, deadline, ZERO_ADDRESS],
      });
      routePath.push(tokenIn.symbol, 'ETH');
      primaryTxTo = AMMORA_SEASON2_ROUTER;
      primaryTxData = routerSellData;
      primaryTxValue = 0n;
      primaryApprovalSpender = AMMORA_SEASON2_ROUTER;
      primaryApprovalToken = actualTokenIn;
      primaryApprovalAmount = amountInRaw;
      executionSteps.push({
        id: 'approve-token-router',
        label: `Approve ${tokenIn.symbol} for Ammora Router`,
        to: actualTokenIn,
        data: routerApproveData,
        value: 0n,
        approvalCheck: { token: actualTokenIn, spender: AMMORA_SEASON2_ROUTER, amount: amountInRaw },
      });
      executionSteps.push({
        id: 'ammora-router-for-native',
        label: `Swap ${tokenIn.symbol} → Native ETH`,
        to: AMMORA_SEASON2_ROUTER,
        data: routerSellData,
        value: 0n,
      });
    } else {
      routePath.push(tokenIn.symbol, tokenOut.symbol);
      executionSteps.push({
        id: 'approve-token',
        label: `Approve ${tokenIn.symbol} for Pool`,
        to: actualTokenIn,
        data: approveData,
        value: 0n,
        approvalCheck: { token: actualTokenIn, spender: approvalSpender, amount: amountInRaw },
      });
      executionSteps.push({
        id: 'swap-arl',
        label: `Swap ${tokenIn.symbol} → ${tokenOut.symbol}`,
        to: built.to,
        data: built.data,
        value: built.value,
      });
    }

    const routeLabel = tokenIn.isNative
      ? `Ammora Router (1-Tx Native ETH → ${tokenOut.symbol})`
      : tokenOut.isNative
        ? `Ammora Router (${tokenIn.symbol} → Native ETH)`
        : `Ammora ARL Compounding Pool (${poolSpot.feeBps / 100}% fee)`;

    return {
      amountInRaw,
      amountOutRaw: quotedOut,
      minimumAmountOutRaw,
      feeRaw,
      feeBps: poolSpot.feeBps,
      priceImpactPct,
      fillKind: 'full',
      allowPartialFill: false,
      routeLabel,
      routePath,
      venueAddress: tokenIn.isNative || tokenOut.isNative ? AMMORA_SEASON2_ROUTER : poolAddress,
      asOfBlock: block,
      executionSteps,
      unsignedTx: {
        to: primaryTxTo,
        data: primaryTxData,
        value: primaryTxValue,
        approvalSpender: primaryApprovalSpender,
        approvalToken: primaryApprovalToken,
        approvalAmount: primaryApprovalAmount,
      },
    };
  }

  // Case 3: Curve swap via AmmoraRouteClient (1-tx Native ETH -> V4 token when supported) + AmmoraV4LaunchCurveClient
  const targetCurve = tokenOut.curveAddress ?? tokenIn.curveAddress ?? activeCurve?.curveAddress;
  if (!targetCurve) {
    throw new Error('Select a valid Ammora launch curve pair or WETH wrapper.');
  }

  const baseForQuote = Boolean(tokenIn.curveAddress);
  const d = giwaSepoliaAutoRouteDeployment;
  const block = await giwaPublicClient.getBlockNumber();
  const curve = new AmmoraV4LaunchCurveClient(giwaPublicClient, targetCurve, {
    launchFactory: d.contracts.launch.factory,
    feePolicy: d.contracts.launch.feePolicy,
  });

  const [state, quote] = await Promise.all([
    curve.getStateAtBlock(block),
    curve.quoteExactInputAtBlock(amountInRaw, baseForQuote, block),
  ]);

  const fill = classifyAmmoraV4ExactInputFill(quote, baseForQuote);
  const minimumAmountOutRaw = minOutFromSlippage(quote.amountOut, BigInt(slippageBps));
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);

  if (fill.kind === 'terminal-dust') {
    throw new Error('Terminal curve dust reached — await permissionless migration to ARL pool.');
  }

  const baseDecimals = baseForQuote ? tokenIn.decimals : tokenOut.decimals;
  const prePrice = sqrtPriceX64ToHumanPrice(state.sqrtPrice, baseDecimals, 18);
  const postPrice = sqrtPriceX64ToHumanPrice(quote.nextSqrtPrice, baseDecimals, 18);
  const priceImpactPct = prePrice > 0 ? Math.abs((postPrice - prePrice) / prePrice) * 100 : 0;

  // Tier 1 Native ETH Auto-Routing: try single-transaction AggregationRouter via AmmoraRouteClient
  if (tokenIn.isNative && !baseForQuote) {
    try {
      const routes = await AmmoraRouteClient.create({
        client: giwaPublicClient,
        routeCatalog: giwaSepoliaAutoRouteCatalog,
        deploymentCatalog: giwaSepoliaAutoRouteDeploymentCatalog,
        factoryProfiles: giwaSepoliaAutoRoutePoolProfiles,
        aggregationPools: [
          {
            model: 'dbc',
            pool: targetCurve,
            baseToken: state.baseToken,
            quoteToken: WETH_ADDRESS,
            factory: d.contracts.launch.factory,
            adapter: giwaSepoliaAutoRoute.alcAggregationAdapter,
          },
        ],
        verificationBlock: block,
      });
      const routeQuote = await routes.quoteExactIn({
        tokenIn: AMMORA_NATIVE_TOKEN,
        tokenOut: state.baseToken,
        amountIn: amountInRaw,
        slippageBps,
        recipient,
      });
      const prepared = await routes.prepareExactIn(routeQuote, {
        payer: recipient,
        recipient,
      });

      const routerTo = prepared.transaction.to;
      const routerData = prepared.transaction.data;
      const routerValue = prepared.transaction.value ?? amountInRaw;

      return {
        amountInRaw: routeQuote.amountIn,
        amountOutRaw: routeQuote.expectedAmountOut,
        minimumAmountOutRaw: routeQuote.minimumAmountOut,
        feeRaw: routeQuote.fees.total ?? quote.fee,
        feeBps: state.currentFeeBps + state.currentDynamicFeeBps,
        priceImpactPct,
        fillKind: fill.kind,
        allowPartialFill: fill.allowPartialFill,
        routeLabel: `Ammora Aggregation Router (1-Tx Native ETH → ${tokenOut.symbol})`,
        routePath: ['ETH', tokenOut.symbol],
        venueAddress: routerTo,
        asOfBlock: routeQuote.quoteBlockNumber ?? block,
        executionSteps: [
          {
            id: 'agg-native-swap',
            label: `Swap ETH → ${tokenOut.symbol} (Single Tx)`,
            to: routerTo,
            data: routerData,
            value: routerValue,
          },
        ],
        unsignedTx: {
          to: routerTo,
          data: routerData,
          value: routerValue,
          approvalSpender: null,
          approvalToken: null,
          approvalAmount: 0n,
        },
      };
    } catch {
      // Fall through cleanly to Tier 2 (Auto Wrap ETH -> WETH -> Curve Swap)
    }
  }

  let txTo: Address = targetCurve;
  let txData: Hex = '0x';
  let approvalSpender: Address | null = baseForQuote ? targetCurve : targetCurve;
  let approvalToken: Address | null = baseForQuote ? state.baseToken : WETH_ADDRESS;

  try {
    const plan = await curve.planSwapExactInput({
      includedAmountIn: amountInRaw,
      baseForQuote,
      allowPartialFill: fill.allowPartialFill,
      slippageBps,
      recipient,
      deadline,
    });
    txTo = plan.transaction.to;
    txData = plan.transaction.data;
    approvalSpender = plan.approvalRequirement.spender;
    approvalToken = plan.approvalRequirement.token;
  } catch {
    const fallback = baseForQuote
      ? buildSellExactIn(amountInRaw, minimumAmountOutRaw, recipient, deadline)
      : buildBuyExactIn(amountInRaw, minimumAmountOutRaw, recipient, deadline, fill.allowPartialFill);
    txTo = targetCurve;
    txData = fallback.data;
    approvalSpender = targetCurve;
  }

  const effectiveSpender = approvalSpender ?? targetCurve;
  const effectiveToken = approvalToken ?? (baseForQuote ? state.baseToken : WETH_ADDRESS);
  const approveData = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [effectiveSpender, maxUint256],
  });

  const executionSteps: SwapExecutionStep[] = [];
  const routePath: string[] = [];

  if (tokenIn.isNative) {
    routePath.push('ETH', 'WETH', tokenOut.symbol);
    executionSteps.push({
      id: 'wrap-eth',
      label: 'Auto-Wrap ETH → WETH',
      to: WETH_ADDRESS,
      data: wrapData,
      value: amountInRaw,
    });
    executionSteps.push({
      id: 'approve-weth',
      label: `Approve WETH for ${tokenOut.symbol} Curve`,
      to: WETH_ADDRESS,
      data: approveData,
      value: 0n,
      approvalCheck: { token: WETH_ADDRESS, spender: effectiveSpender, amount: quote.amountIn },
    });
    executionSteps.push({
      id: 'swap-curve',
      label: `Buy ${tokenOut.symbol} on Bonding Curve`,
      to: txTo,
      data: txData,
      value: 0n,
    });
  } else if (tokenOut.isNative) {
    routePath.push(tokenIn.symbol, 'WETH', 'ETH');
    executionSteps.push({
      id: 'approve-token',
      label: `Approve ${tokenIn.symbol} for Curve`,
      to: effectiveToken,
      data: approveData,
      value: 0n,
      approvalCheck: { token: effectiveToken, spender: effectiveSpender, amount: quote.amountIn },
    });
    executionSteps.push({
      id: 'swap-curve',
      label: `Sell ${tokenIn.symbol} → WETH`,
      to: txTo,
      data: txData,
      value: 0n,
      trackWethDelta: true,
    });
    executionSteps.push({
      id: 'unwrap-eth',
      label: 'Auto-Unwrap WETH → Native ETH',
      to: WETH_ADDRESS,
      data: encodeFunctionData({ abi: WETH9_ABI, functionName: 'withdraw', args: [minimumAmountOutRaw] }),
      value: 0n,
      unwrapWethDelta: { fallbackAmount: minimumAmountOutRaw },
    });
  } else {
    routePath.push(tokenIn.symbol, tokenOut.symbol);
    executionSteps.push({
      id: 'approve-token',
      label: `Approve ${tokenIn.symbol} for Curve`,
      to: effectiveToken,
      data: approveData,
      value: 0n,
      approvalCheck: { token: effectiveToken, spender: effectiveSpender, amount: quote.amountIn },
    });
    executionSteps.push({
      id: 'swap-curve',
      label: `Swap ${tokenIn.symbol} → ${tokenOut.symbol}`,
      to: txTo,
      data: txData,
      value: 0n,
    });
  }

  const routeLabel = tokenIn.isNative
    ? `Auto-Route (ETH → WETH → ${tokenOut.symbol}) · V4 Curve`
    : tokenOut.isNative
      ? `Auto-Route (${tokenIn.symbol} → WETH → ETH) · V4 Curve`
      : `Ammora V4 Bonding Curve (${state.currentFeeBps / 100}% fee)`;

  return {
    amountInRaw: quote.amountIn,
    amountOutRaw: quote.amountOut,
    minimumAmountOutRaw,
    feeRaw: quote.fee,
    feeBps: state.currentFeeBps + state.currentDynamicFeeBps,
    priceImpactPct,
    fillKind: fill.kind,
    allowPartialFill: fill.allowPartialFill,
    routeLabel,
    routePath,
    venueAddress: targetCurve,
    asOfBlock: quote.asOfBlock,
    executionSteps,
    unsignedTx: {
      to: txTo,
      data: txData,
      value: 0n,
      approvalSpender,
      approvalToken,
      approvalAmount: quote.amountIn,
    },
  };
}

// ---------- Launchpad Economics & Calldata Builder ----------

export interface LaunchpadFormInput {
  name: string;
  symbol: string;
  tokenDecimals: number;
  totalSupplyWhole: string;
  saleAllocationPct: number;
  creatorLockedPct: number;
  startFdvWeth: string;
  graduationFdvWeth: string;
  cliffFeeBps: number;
  creatorFeeShareBps: number;
  migrationKind: 'compounding' | 'concentrated';
  metadataURI: string;
  creatorMetadataURI: string;
  creatorAddress: Address;
  firstBuyWeth: string;
}

export interface LaunchpadPlanResult {
  valid: boolean;
  error?: string;
  config?: AmmoraV4Config;
  segments?: readonly AmmoraV4Segment[];
  migrationQuoteThresholdWeth: string;
  curveBaseFormatted: string;
  leftoverBaseFormatted: string;
  startSqrtPrice: bigint;
  migrationSqrtPrice: bigint;
  postMigrationLiquidity: bigint;
  startPriceWeth: number;
  graduationPriceWeth: number;
  registerAndLaunchTx?: {
    to: Address;
    data: Hex;
    value: bigint;
  };
  existingConfigLaunchTx?: {
    to: Address;
    data: Hex;
    value: bigint;
  };
  atomicFirstBuyStatus?: string;
}

function parseDecimalToRational(value: string): { numerator: bigint; denominator: bigint } {
  const clean = value.trim();
  if (!clean || Number(clean) <= 0) {
    throw new Error('Value must be positive.');
  }
  const [whole, frac = ''] = clean.split('.');
  const fracTrimmed = frac.slice(0, 12);
  const denominator = 10n ** BigInt(fracTrimmed.length);
  const numerator = BigInt(whole || '0') * denominator + BigInt(fracTrimmed || '0');
  if (numerator <= 0n) throw new Error('Value must be greater than zero.');
  return { numerator, denominator };
}

export function buildLaunchpadPlan(input: LaunchpadFormInput, existingConfigId: bigint = 1n): LaunchpadPlanResult {
  try {
    const decimals = Math.min(9, Math.max(6, Math.round(input.tokenDecimals)));
    const baseScale = 10n ** BigInt(decimals);
    const totalWhole = BigInt(Math.max(1000, Math.floor(Number(input.totalSupplyWhole) || 1_000_000_000)));
    const totalSupplyRaw = totalWhole * baseScale;

    const saleBps = BigInt(Math.min(9500, Math.max(1000, Math.round(input.saleAllocationPct * 100))));
    const lockBps = BigInt(Math.min(5000, Math.max(0, Math.round(input.creatorLockedPct * 100))));
    if (saleBps + lockBps >= 9800n) {
      return {
        valid: false,
        error: 'Sale allocation + Creator locked allocation must leave at least 2% for post-migration liquidity.',
        migrationQuoteThresholdWeth: '0',
        curveBaseFormatted: '0',
        leftoverBaseFormatted: '0',
        startSqrtPrice: 0n,
        migrationSqrtPrice: 0n,
        postMigrationLiquidity: 0n,
        startPriceWeth: 0,
        graduationPriceWeth: 0,
      };
    }

    const saleAllocationRaw = (totalSupplyRaw * saleBps) / 10000n;
    const lockedBaseRaw = (totalSupplyRaw * lockBps) / 10000n;
    const baseBudgetRaw = totalSupplyRaw - saleAllocationRaw - lockedBaseRaw;

    // The SDK requires the vesting schedule to sum exactly to the locked
    // allocation: cliffUnlockAmount + amountPerPeriod * numberOfPeriods === lockedBaseRaw.
    // It also treats an all-zero schedule as "empty" (valid only when nothing is locked)
    // and rejects a schedule with a nonzero frequency but a zero per-period amount.
    // So: no lock -> empty schedule; a lock -> 12 monthly periods, with any
    // indivisible remainder (at most 11 raw units) unlocking at the cliff.
    // (Inputs are clamped so a nonzero lock is always >= 1e5 raw units, so the
    // per-period amount is never zero when a lock exists.)
    const LOCK_VESTING_PERIODS = 12;
    const LOCK_VESTING_FREQUENCY_SECONDS = 30n * 24n * 60n * 60n; // 30 days
    const hasLockedBase = lockedBaseRaw > 0n;
    const lockAmountPerPeriod = hasLockedBase ? lockedBaseRaw / BigInt(LOCK_VESTING_PERIODS) : 0n;
    const lockCliffUnlockAmount = hasLockedBase
      ? lockedBaseRaw - lockAmountPerPeriod * BigInt(LOCK_VESTING_PERIODS)
      : 0n;
    const lockVestingPeriods = hasLockedBase ? LOCK_VESTING_PERIODS : 0;
    const lockVestingFrequency = hasLockedBase ? LOCK_VESTING_FREQUENCY_SECONDS : 0n;

    const startFdv = parseDecimalToRational(input.startFdvWeth);
    const gradFdv = parseDecimalToRational(input.graduationFdvWeth);

    // Derive exact start & graduation per-token prices to calculate exact curveQuoteRaw
    const startPriceRational = {
      numerator: startFdv.numerator,
      denominator: startFdv.denominator * totalWhole,
    };
    const gradPriceRational = {
      numerator: gradFdv.numerator,
      denominator: gradFdv.denominator * totalWhole,
    };

    const startSqrt = portableSqrtPriceFromHumanPrice(startPriceRational, decimals, 18, 'floor');
    const topSqrt = portableSqrtPriceFromHumanPrice(gradPriceRational, decimals, 18, 'floor');
    if (topSqrt <= startSqrt) {
      return {
        valid: false,
        error: 'Graduation FDV must be strictly greater than Starting FDV.',
        migrationQuoteThresholdWeth: '0',
        curveBaseFormatted: '0',
        leftoverBaseFormatted: '0',
        startSqrtPrice: 0n,
        migrationSqrtPrice: 0n,
        postMigrationLiquidity: 0n,
        startPriceWeth: 0,
        graduationPriceWeth: 0,
      };
    }

    const estLiquidity = (saleAllocationRaw * startSqrt * topSqrt) / (topSqrt - startSqrt);
    const curveQuoteRaw = maxQuoteInput(
      [{ lowerSqrtPrice: startSqrt, upperSqrtPrice: topSqrt, liquidity: estLiquidity }],
      startSqrt,
    );

    const d = giwaSepoliaAutoRouteDeployment;
    const creator = isAddress(input.creatorAddress) ? input.creatorAddress : d.contracts.launch.factory;

    const migrationConfig =
      input.migrationKind === 'concentrated'
        ? {
            kind: 'concentrated' as const,
            baseBudgetRaw,
            quoteBudgetRaw: curveQuoteRaw,
            maxQuoteSurplusToProtocolRaw: curveQuoteRaw,
            minPrice: {
              numerator: gradPriceRational.numerator,
              denominator: gradPriceRational.denominator * 2n,
            },
            maxPrice: {
              numerator: gradPriceRational.numerator * 4n,
              denominator: gradPriceRational.denominator,
            },
          }
        : {
            kind: 'compounding' as const,
            baseBudgetRaw,
            quoteBudgetRaw: curveQuoteRaw,
            maxQuoteSurplusToProtocolRaw: curveQuoteRaw,
          };

    const built = buildPortableAmmoraV4Config(
      {
        baseDecimals: decimals,
        quoteDecimals: 18,
        totalSupplyRaw,
        saleAllocationRaw,
        lockedBaseRaw,
        start: { fdv: startFdv },
        graduation: { fdv: gradFdv },
        migrationQuoteThreshold: { kind: 'derive' },
        migrationQuoteFeeBps: 0n,
        migration: migrationConfig,
        rounding: {
          sqrtPrice: 'floor',
          liquidity: 'floor',
          requiredAmounts: 'ceil',
          quoteThreshold: 'ceil',
          maxPriceErrorBps: 100n,
          maxSaleDustRaw: saleAllocationRaw / 1000n + 1000n,
        },
      },
      {
        quoteToken: d.contracts.tokens.wrappedNative,
        partnerRecipient: creator,
        poolCreationFee: 0n,
        cliffFeeBps: input.cliffFeeBps,
        creatorShareOfNonProtocolBps: input.creatorFeeShareBps,
        feeNumberOfPeriods: 0,
        feePeriodFrequency: 0,
        feeReductionFactorBps: 0,
        feeSchedulerMode: 0,
        rateLimiterEnabled: false,
        rateLimiterFeeIncrementBps: 0,
        rateLimiterDuration: 0,
        rateLimiterReferenceAmount: 0n,
        dynamicFeeEnabled: false,
        maxVolatilityAccumulator: 0,
        variableFeeControl: 0,
        dynamicFeeBinStepBps: 0,
        dynamicFeeFilterPeriod: 0,
        dynamicFeeDecayPeriod: 0,
        dynamicFeeReductionFactorBps: 0,
        dynamicFeeBinStepQ64: 0n,
        collectFeeMode: 0,
        enableFirstSwapWithMinFee: false,
        leftoverReceiver: creator,
        creatorMigrationFeeShareBps: 0,
        postMigrationFeeBps: 100,
        postMigrationCompoundingFeeBps: input.migrationKind === 'compounding' ? 10000 : 0,
        postMigrationCollectFeeMode: 0,
        liquidityDistribution: {
          partner: ZERO_ADDRESS,
          partnerUnlockedBps: 0,
          partnerPermanentLockedBps: 0,
          creatorPermanentLockedBps: 10000,
          partnerVesting: { allocationBps: 0, bpsPerPeriod: 0, numberOfPeriods: 0, periodFrequency: 0, cliffDuration: 0 },
          creatorVesting: { allocationBps: 0, bpsPerPeriod: 0, numberOfPeriods: 0, periodFrequency: 0, cliffDuration: 0 },
        },
        lockedBaseVesting: {
          cliffUnlockAmount: lockCliffUnlockAmount,
          amountPerPeriod: lockAmountPerPeriod,
          numberOfPeriods: lockVestingPeriods,
          frequency: lockVestingFrequency,
          cliffDuration: 0n,
        },
        postMigrationFeeNumberOfPeriods: 0,
        postMigrationFeePeriodFrequency: 0,
        postMigrationFeeReductionFactorBps: 0,
        postMigrationFeeSchedulerMode: 0,
        activationDelay: 0,
        activationType: 0,
      },
    );

    assertAmmoraV4Config(built.config, built.segments);

    const launchMeta = {
      name: input.name.trim() || 'Ammora Token',
      symbol: (input.symbol.trim() || 'AMMR').toUpperCase(),
      metadataURI: input.metadataURI.trim() || 'ipfs://bafybeiammoratokenmetadata',
      creatorMetadataURI: input.creatorMetadataURI.trim() || 'ipfs://bafybeiammoracreatormetadata',
      tokenDecimals: decimals,
    };

    const registerAndLaunch = buildRegisterConfigAndCreateAmmoraV4Launch(built.config, built.segments, {
      ...launchMeta,
      callback: ZERO_ADDRESS,
      callbackData: '0x',
    });

    const existingLaunch = buildCreateAmmoraV4Launch(launchMeta, existingConfigId, 0n);

    return {
      valid: true,
      config: built.config,
      segments: built.segments,
      migrationQuoteThresholdWeth: Number(formatUnits(built.migrationQuoteThreshold, 18)).toFixed(4),
      curveBaseFormatted: Number(formatUnits(built.reconciliation.curveBaseRaw, decimals)).toLocaleString('en-US', {
        maximumFractionDigits: 2,
      }),
      leftoverBaseFormatted: Number(formatUnits(built.reconciliation.leftoverBaseRaw, decimals)).toLocaleString('en-US', {
        maximumFractionDigits: 2,
      }),
      startSqrtPrice: built.startSqrtPrice,
      migrationSqrtPrice: built.migrationSqrtPrice,
      postMigrationLiquidity: built.postMigrationLiquidity,
      startPriceWeth: sqrtPriceX64ToHumanPrice(built.startSqrtPrice, decimals, 18),
      graduationPriceWeth: sqrtPriceX64ToHumanPrice(built.migrationSqrtPrice, decimals, 18),
      registerAndLaunchTx: {
        to: d.contracts.launch.factory,
        data: registerAndLaunch.data,
        value: registerAndLaunch.value,
      },
      existingConfigLaunchTx: {
        to: d.contracts.launch.factory,
        data: existingLaunch.data,
        value: existingLaunch.value,
      },
    };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Invalid curve parameters.',
      migrationQuoteThresholdWeth: '0',
      curveBaseFormatted: '0',
      leftoverBaseFormatted: '0',
      startSqrtPrice: 0n,
      migrationSqrtPrice: 0n,
      postMigrationLiquidity: 0n,
      startPriceWeth: 0,
      graduationPriceWeth: 0,
    };
  }
}

export function getCanonicalTammPolicySummary() {
  const policy = buildTammV5LaunchPolicy();
  return {
    totalSupply: formatUnits(policy.totalSupplyRaw, 6),
    migrationQuoteThreshold: formatUnits(policy.migrationQuoteThreshold, 18),
    startSqrtPrice: policy.startSqrtPrice.toString(),
    migrationSqrtPrice: policy.migrationSqrtPrice.toString(),
    segments: policy.segments.length,
    cliffFeeBps: policy.config.cliffFeeBps,
    creatorFeeShareBps: policy.config.creatorShareOfNonProtocolBps,
  };
}

// ---------- Staking & Yield Vaults (AStakeV2 + AYVault) ----------

export interface VaultModel {
  id: string;
  name: string;
  protocolKind: 'AStakeV2' | 'AYVault';
  pairLabel: string;
  stakeTokenSymbol: string;
  stakeTokenAddress: Address;
  rewardTokenSymbol: string;
  vaultAddress: Address;
  factoryAddress: Address;
  apyPct: number;
  tvlWeth: number;
  totalAssetsRaw: bigint;
  totalSupplyRaw: bigint;
  lockedProfitRaw: bigint;
  performanceFeeBps: number;
  unstakeLockHours: number;
  userStakedRaw: bigint;
  pendingStakeFeeRaw: bigint;
  pendingQuoteFeeRaw: bigint;
  strategyDescription: string;
}

export const AMMORA_VAULT_CATALOG: VaultModel[] = [
  {
    id: 'ayvault-weth-almm',
    name: 'GIWA WETH Auto-Compounding LP Vault',
    protocolKind: 'AYVault',
    pairLabel: 'WETH / ALMM Dynamic Bins',
    stakeTokenSymbol: 'WETH',
    stakeTokenAddress: WETH_ADDRESS,
    rewardTokenSymbol: 'WETH',
    vaultAddress: giwaSepoliaAutoRouteDeployment.contracts.vaults.yieldFactory,
    factoryAddress: giwaSepoliaAutoRouteDeployment.contracts.vaults.yieldFactory,
    apyPct: 18.4,
    tvlWeth: 412.65,
    totalAssetsRaw: 412_650_000_000_000_000_000n,
    totalSupplyRaw: 389_200_000_000_000_000_000n,
    lockedProfitRaw: 2_450_000_000_000_000_000n,
    performanceFeeBps: 1000,
    unstakeLockHours: 0,
    userStakedRaw: 0n,
    pendingStakeFeeRaw: 0n,
    pendingQuoteFeeRaw: 0n,
    strategyDescription:
      'Allocates WETH into active Ammora ALMM bin ranges and compounds realized trading fees via ERC-4626 AYVault share accounting.',
  },
  {
    id: 'astakev2-aiv4c-lp',
    name: 'AIV4C / WETH Fee-Sharing LP Stake',
    protocolKind: 'AStakeV2',
    pairLabel: 'AIV4C · ARL Concentrated LP',
    stakeTokenSymbol: 'AIV4C',
    stakeTokenAddress: '0xc23220d34534aE3C8bbe231dB911b7E662743B6e',
    rewardTokenSymbol: 'WETH + AIV4C',
    vaultAddress: giwaSepoliaAutoRouteDeployment.contracts.feeSharing.factory,
    factoryAddress: giwaSepoliaAutoRouteDeployment.contracts.feeSharing.factory,
    apyPct: 34.8,
    tvlWeth: 128.4,
    totalAssetsRaw: 128_400_000_000_000_000_000n,
    totalSupplyRaw: 128_400_000_000_000_000_000n,
    lockedProfitRaw: 0n,
    performanceFeeBps: 500,
    unstakeLockHours: 48,
    userStakedRaw: 2_500_000_000_000n,
    pendingStakeFeeRaw: 42_500_000_000n,
    pendingQuoteFeeRaw: 18_400_000_000_000_000n,
    strategyDescription:
      'Dual-reward Stake2Earn V2 vault streaming graduated ARL pool swap fees directly to top LP stakers with automatic base-fee restaking.',
  },
  {
    id: 'astakev2-tamm-genesis',
    name: 'tAMM / WETH Liquidity Reward Pool',
    protocolKind: 'AStakeV2',
    pairLabel: 'tAMM · ARL Compounding Pool',
    stakeTokenSymbol: 'tAMM',
    stakeTokenAddress: TAMM_TOKEN_ADDRESS,
    rewardTokenSymbol: 'WETH',
    vaultAddress: TAMM_POOL_ADDRESS,
    factoryAddress: giwaSepoliaAutoRouteDeployment.contracts.vaults.genesisFactory,
    apyPct: 26.2,
    tvlWeth: 245.1,
    totalAssetsRaw: 245_100_000_000_000_000_000n,
    totalSupplyRaw: 245_100_000_000_000_000_000n,
    lockedProfitRaw: 0n,
    performanceFeeBps: 0,
    unstakeLockHours: 24,
    userStakedRaw: 0n,
    pendingStakeFeeRaw: 0n,
    pendingQuoteFeeRaw: 0n,
    strategyDescription:
      'Captures graduated tAMM/WETH ARL compounding pool fees and unlocks continuous Q128 linear fee streams to staked LPs.',
  },
];

export function computeVaultPreview(vault: VaultModel, amountHuman: string, mode: 'deposit' | 'withdraw', recipient: Address) {
  const decimals = vault.stakeTokenSymbol === 'AIV4C' ? 9 : vault.stakeTokenSymbol === 'tAMM' ? 6 : 18;
  const raw = parseUnits(amountHuman || '0', decimals);
  if (raw <= 0n) {
    return null;
  }

  if (vault.protocolKind === 'AYVault') {
    const sharePrice = calculateAYVaultAssets(10n ** 18n, vault.totalSupplyRaw, vault.totalAssetsRaw);
    const unlockedAssets =
      vault.totalAssetsRaw -
      calculateAYVaultLockedProfit(vault.lockedProfitRaw, BigInt(Math.floor(Date.now() / 1000) - 1800), BigInt(Math.floor(Date.now() / 1000)), 3600n);
    const feeSharesPreview = calculateAYVaultPerformanceFeeShares(
      vault.lockedProfitRaw,
      vault.performanceFeeBps,
      vault.totalSupplyRaw,
      vault.totalAssetsRaw,
    );

    if (mode === 'deposit') {
      const expectedShares = calculateAYVaultShares(raw, vault.totalSupplyRaw, vault.totalAssetsRaw);
      const minShares = minOutFromSlippage(expectedShares, 50n);
      const tx = buildDepositAYVault(raw, recipient, minShares);
      return {
        expectedOutput: expectedShares,
        outputSymbol: 'ayShares',
        outputDecimals: 18,
        sharePriceHuman: Number(formatUnits(sharePrice, 18)).toFixed(6),
        unlockedTvlHuman: Number(formatUnits(unlockedAssets, 18)).toFixed(2),
        feeSharesPreview: Number(formatUnits(feeSharesPreview, 18)).toFixed(4),
        tx: { to: vault.vaultAddress, data: tx.data, value: 0n },
      };
    } else {
      const expectedAssets = calculateAYVaultAssets(raw, vault.totalSupplyRaw, vault.totalAssetsRaw);
      const minAssets = minOutFromSlippage(expectedAssets, 50n);
      const tx = buildRequestAYVaultRedeem(raw, recipient, minAssets);
      return {
        expectedOutput: expectedAssets,
        outputSymbol: vault.stakeTokenSymbol,
        outputDecimals: decimals,
        sharePriceHuman: Number(formatUnits(sharePrice, 18)).toFixed(6),
        unlockedTvlHuman: Number(formatUnits(unlockedAssets, 18)).toFixed(2),
        feeSharesPreview: Number(formatUnits(feeSharesPreview, 18)).toFixed(4),
        tx: { to: vault.vaultAddress, data: tx.data, value: 0n },
      };
    }
  } else {
    // AStakeV2
    const rewardSim = calculateAStakeReward(raw, 18_400_000_000_000_000_000_000_000_000_000_000_000n, 0n);
    const releasedSim = calculateAStakeReleased(1_000_000_000_000_000_000n, 0n, 86400n, 43200n, 0n);
    const claimPreview = calculateAStakeV2Claim(
      vault.pendingStakeFeeRaw > 0n ? vault.pendingStakeFeeRaw : 12_500_000_000n,
      vault.pendingQuoteFeeRaw > 0n ? vault.pendingQuoteFeeRaw : 5_200_000_000_000_000n,
      10_000_000_000_000_000_000n,
    );

    const tx = mode === 'deposit' ? buildStakeAStakeV2(raw) : buildRequestAStakeV2Unstake(raw);
    const claimTx = buildClaimAStakeV2(10_000_000_000_000_000_000n, recipient);
    const withdrawTx = buildWithdrawAStakeV2Unstake(1n);

    return {
      expectedOutput: raw,
      outputSymbol: mode === 'deposit' ? `st${vault.stakeTokenSymbol}` : vault.stakeTokenSymbol,
      outputDecimals: decimals,
      estEpochReward: Number(formatUnits(rewardSim.amount, 18)).toFixed(5),
      linearReleasedWeth: Number(formatUnits(releasedSim, 18)).toFixed(4),
      claimRestakeStakeFee: Number(formatUnits(claimPreview.restakedStakeFee, decimals)).toFixed(4),
      claimQuoteFeeWeth: Number(formatUnits(claimPreview.claimedQuoteFee, 18)).toFixed(5),
      tx: { to: vault.vaultAddress, data: tx.data, value: 0n },
      claimTx: { to: vault.vaultAddress, data: claimTx.data, value: 0n },
      withdrawTx: { to: vault.vaultAddress, data: withdrawTx.data, value: 0n },
    };
  }
}

export function buildNewVaultDeployCalldata(params: {
  kind: 'AYVault' | 'AStakeV2';
  assetAddress: Address;
  ownerAddress: Address;
  performanceFeeBps: number;
  unstakeLockHours: number;
}) {
  const d = giwaSepoliaAutoRouteDeployment;
  const salt = ('0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')) as Hex;
  if (params.kind === 'AYVault') {
    const tx = buildCreateAYVault(
      params.assetAddress,
      params.ownerAddress,
      params.ownerAddress,
      params.ownerAddress,
      params.performanceFeeBps,
      3600,
      salt,
    );
    return {
      to: d.contracts.vaults.yieldFactory,
      data: tx.data,
      value: 0n,
    };
  } else {
    const tx = buildCreateAStakeV2(
      CANARY_V4_CURVE,
      1n,
      params.assetAddress,
      params.ownerAddress,
      50,
      86400,
      params.unstakeLockHours * 3600,
      BigInt(Math.floor(Date.now() / 1000) + 300),
      salt,
    );
    return {
      to: d.contracts.feeSharing.factory,
      data: tx.data,
      value: 0n,
    };
  }
}

// ---------- Wallet Connection (EIP-6963 Multi-Wallet + EIP-1193 + Viem) ----------

export interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
  isOkxWallet?: boolean;
  isOKExWallet?: boolean;
  isCoinbaseWallet?: boolean;
  isRabby?: boolean;
  isTrust?: boolean;
  isPhantom?: boolean;
  isBraveWallet?: boolean;
  providers?: Eip1193Provider[];
  detected?: Eip1193Provider[];
}

export interface WalletProviderOption {
  id: string;
  name: string;
  rdns: string;
  icon?: string;
  provider: Eip1193Provider | null;
  isSimulated?: boolean;
}

export interface WalletState {
  connected: boolean;
  address: Address | null;
  chainId: number | null;
  ethBalance: string;
  wethBalance: string;
  tammBalance: string;
  isSimulated: boolean;
  providerId?: string;
  providerName?: string;
}

interface Eip6963AnnounceEvent extends Event {
  detail: {
    info: {
      uuid: string;
      name: string;
      icon: string;
      rdns: string;
    };
    provider: Eip1193Provider;
  };
}

const eip6963Discovered = new Map<string, WalletProviderOption>();
const walletProviderListeners = new Set<(list: WalletProviderOption[]) => void>();
let eip6963Initialized = false;
let activeEip1193Provider: Eip1193Provider | null = null;

export function formatWalletError(err: unknown, fallback = 'Wallet request failed.'): string {
  if (!err) return fallback;
  if (typeof err === 'string') return err.split('\n')[0] || fallback;
  if (typeof err === 'object') {
    const obj = err as {
      code?: number | string;
      message?: string;
      shortMessage?: string;
      details?: string;
      data?: { message?: string };
      cause?: unknown;
    };
    if (obj.code === 4001) {
      return 'Connection rejected in wallet.';
    }
    if (obj.code === -32002) {
      return 'Wallet approval already pending. Open your browser wallet extension icon to confirm.';
    }
    const rawMsg =
      obj.shortMessage ||
      obj.message ||
      obj.details ||
      obj.data?.message ||
      (obj.cause ? formatWalletError(obj.cause, '') : '');
    if (rawMsg) {
      return rawMsg.split('\n')[0].slice(0, 220);
    }
  }
  if (err instanceof Error && err.message) {
    return err.message.split('\n')[0].slice(0, 220);
  }
  return fallback;
}

function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMessage: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(timeoutMessage)), ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function parseChainId(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    const parsed = trimmed.startsWith('0x') ? parseInt(trimmed, 16) : Number(trimmed);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

function inferLegacyProviderMeta(p: Eip1193Provider, fallbackName = 'Browser Wallet'): { id: string; name: string; rdns: string } {
  if (p.isOkxWallet || p.isOKExWallet) {
    return { id: 'legacy-okx', name: 'OKX Wallet', rdns: 'com.okex.wallet' };
  }
  if (p.isRabby) {
    return { id: 'legacy-rabby', name: 'Rabby Wallet', rdns: 'io.rabby' };
  }
  if (p.isCoinbaseWallet) {
    return { id: 'legacy-coinbase', name: 'Coinbase Wallet', rdns: 'com.coinbase.wallet' };
  }
  if (p.isTrust) {
    return { id: 'legacy-trust', name: 'Trust Wallet', rdns: 'com.trustwallet.app' };
  }
  if (p.isPhantom) {
    return { id: 'legacy-phantom', name: 'Phantom', rdns: 'app.phantom' };
  }
  if (p.isBraveWallet) {
    return { id: 'legacy-brave', name: 'Brave Wallet', rdns: 'com.brave.wallet' };
  }
  if (p.isMetaMask) {
    return { id: 'legacy-metamask', name: 'MetaMask', rdns: 'io.metamask' };
  }
  return { id: `legacy-${fallbackName.toLowerCase().replace(/\s+/g, '-')}`, name: fallbackName, rdns: 'injected.ethereum' };
}

function collectWalletProviders(): WalletProviderOption[] {
  const result: WalletProviderOption[] = Array.from(eip6963Discovered.values());
  const seenProviders = new Set<Eip1193Provider>(
    result.map((r) => r.provider).filter((p): p is Eip1193Provider => Boolean(p)),
  );
  const seenRdns = new Set<string>(
    result.map((r) => r.rdns.toLowerCase()).filter((r) => r && r !== 'injected.ethereum'),
  );

  const addLegacyCandidate = (candidate: Eip1193Provider | undefined, fallbackName?: string) => {
    if (!candidate || typeof candidate.request !== 'function') return;
    if (seenProviders.has(candidate)) return;
    const meta = inferLegacyProviderMeta(candidate, fallbackName);
    const rdnsLower = meta.rdns.toLowerCase();
    if (rdnsLower !== 'injected.ethereum' && seenRdns.has(rdnsLower)) return;
    seenProviders.add(candidate);
    if (rdnsLower !== 'injected.ethereum') {
      seenRdns.add(rdnsLower);
    }
    result.push({
      id: meta.id,
      name: meta.name,
      rdns: meta.rdns,
      provider: candidate,
    });
  };

  if (typeof window !== 'undefined') {
    const win = window as unknown as {
      ethereum?: Eip1193Provider;
      okxwallet?: Eip1193Provider;
      rabby?: Eip1193Provider;
      coinbaseWalletExtension?: Eip1193Provider;
      trustwallet?: Eip1193Provider;
    };

    if (Array.isArray(win.ethereum?.providers)) {
      for (const p of win.ethereum.providers) {
        addLegacyCandidate(p);
      }
    }
    if (Array.isArray(win.ethereum?.detected)) {
      for (const p of win.ethereum.detected) {
        addLegacyCandidate(p);
      }
    }
    addLegacyCandidate(win.ethereum);
    addLegacyCandidate(win.okxwallet, 'OKX Wallet');
    addLegacyCandidate(win.rabby, 'Rabby Wallet');
    addLegacyCandidate(win.coinbaseWalletExtension, 'Coinbase Wallet');
    addLegacyCandidate(win.trustwallet, 'Trust Wallet');
  }

  result.push({
    id: 'simulated-preview',
    name: 'Simulated Preview Wallet (Read-Only)',
    rdns: 'giwa.sepolia.preview',
    provider: null,
    isSimulated: true,
  });

  return result;
}

function ensureEip6963Listener() {
  if (typeof window === 'undefined' || eip6963Initialized) return;
  eip6963Initialized = true;

  window.addEventListener('eip6963:announceProvider', (rawEvent: Event) => {
    const event = rawEvent as Eip6963AnnounceEvent;
    const detail = event?.detail;
    if (!detail?.provider || !detail?.info) return;
    const key = detail.info.rdns || detail.info.uuid || detail.info.name;
    eip6963Discovered.set(key, {
      id: key,
      name: detail.info.name,
      rdns: detail.info.rdns || 'eip6963.provider',
      icon: detail.info.icon,
      provider: detail.provider,
    });
    const list = collectWalletProviders();
    walletProviderListeners.forEach((cb) => cb(list));
  });

  try {
    window.dispatchEvent(new Event('eip6963:requestProvider'));
  } catch {
    // Ignore restricted frame dispatch errors
  }
}

if (typeof window !== 'undefined') {
  ensureEip6963Listener();
}

export function requestWalletDiscovery(): WalletProviderOption[] {
  ensureEip6963Listener();
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new Event('eip6963:requestProvider'));
    } catch {
      // Ignore restricted frame dispatch errors
    }
  }
  return collectWalletProviders();
}

export function discoverWalletProviders(): WalletProviderOption[] {
  ensureEip6963Listener();
  return collectWalletProviders();
}

export function subscribeWalletProviders(cb: (list: WalletProviderOption[]) => void): () => void {
  ensureEip6963Listener();
  walletProviderListeners.add(cb);
  return () => {
    walletProviderListeners.delete(cb);
  };
}

export function getActiveEip1193Provider(): Eip1193Provider | null {
  return activeEip1193Provider;
}

export function disconnectBrowserWallet(): void {
  activeEip1193Provider = null;
}

async function resolveProviderAccounts(ethProvider: Eip1193Provider, walletName: string): Promise<Address[]> {
  try {
    const accounts = (await withTimeout(
      ethProvider.request({ method: 'eth_requestAccounts' }),
      45000,
      `${walletName} did not respond in time. Click the ${walletName} extension icon in your browser toolbar to approve the connection.`,
    )) as Address[];
    if (Array.isArray(accounts) && accounts.length > 0) {
      return accounts;
    }
  } catch (err) {
    const code = typeof err === 'object' && err !== null ? (err as { code?: number }).code : undefined;
    if (code === -32002) {
      const existing = (await ethProvider.request({ method: 'eth_accounts' }).catch(() => [])) as Address[];
      if (Array.isArray(existing) && existing.length > 0) {
        return existing;
      }
    }
    throw err;
  }

  const fallbackAccounts = (await ethProvider.request({ method: 'eth_accounts' }).catch(() => [])) as Address[];
  if (Array.isArray(fallbackAccounts) && fallbackAccounts.length > 0) {
    return fallbackAccounts;
  }
  throw new Error(`No account authorized in ${walletName}.`);
}

export async function connectWalletOption(option: WalletProviderOption): Promise<WalletState> {
  if (option.isSimulated || !option.provider) {
    activeEip1193Provider = null;
    const simAddr = '0x13cD27a6E337097dB858C9C4FA472FbAd2F2c637' as Address;
    const [ethBal, wethBal, tammBal] = await Promise.race([
      fetchWalletBalances(simAddr),
      new Promise<[string, string, string]>((resolve) =>
        setTimeout(() => resolve(['0.0000', '0.0000', '0.00']), 2500),
      ),
    ]);
    return {
      connected: true,
      address: simAddr,
      chainId: GIWA_CHAIN_ID,
      ethBalance: ethBal,
      wethBalance: wethBal,
      tammBalance: tammBal,
      isSimulated: true,
      providerId: option.id,
      providerName: option.name,
    };
  }

  const ethProvider = option.provider;
  const accounts = await resolveProviderAccounts(ethProvider, option.name);
  const address = accounts[0];
  activeEip1193Provider = ethProvider;

  let chainId =
    parseChainId(
      await withTimeout(ethProvider.request({ method: 'eth_chainId' }), 5000, 'eth_chainId timeout').catch(() => null),
    ) ?? GIWA_CHAIN_ID;

  if (chainId !== GIWA_CHAIN_ID) {
    try {
      await withTimeout(
        ethProvider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${GIWA_CHAIN_ID.toString(16)}` }],
        }),
        12000,
        'Switch chain timed out',
      );
      chainId = GIWA_CHAIN_ID;
    } catch {
      try {
        await withTimeout(
          ethProvider.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: `0x${GIWA_CHAIN_ID.toString(16)}`,
                chainName: 'GIWA Sepolia',
                nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                rpcUrls: [GIWA_RPC_URL],
                blockExplorerUrls: [GIWA_EXPLORER_URL],
              },
            ],
          }),
          12000,
          'Add chain timed out',
        );
        chainId = GIWA_CHAIN_ID;
      } catch {
        // User declined or timed out switching chain; keep connected with actual chainId
      }
    }
  }

  const [ethBalance, wethBalance, tammBalance] = await Promise.race([
    fetchWalletBalances(address),
    new Promise<[string, string, string]>((resolve) =>
      setTimeout(() => resolve(['0.0000', '0.0000', '0.00']), 2500),
    ),
  ]);

  return {
    connected: true,
    address,
    chainId,
    ethBalance,
    wethBalance,
    tammBalance,
    isSimulated: false,
    providerId: option.id,
    providerName: option.name,
  };
}

export async function connectWatchAddress(rawAddress: string): Promise<WalletState> {
  const trimmed = rawAddress.trim();
  if (!isAddress(trimmed)) {
    throw new Error('Invalid EVM address. Enter a 0x… wallet address.');
  }
  activeEip1193Provider = null;
  const address = trimmed as Address;
  const [ethBalance, wethBalance, tammBalance] = await Promise.race([
    fetchWalletBalances(address),
    new Promise<[string, string, string]>((resolve) =>
      setTimeout(() => resolve(['0.0000', '0.0000', '0.00']), 2500),
    ),
  ]);
  return {
    connected: true,
    address,
    chainId: GIWA_CHAIN_ID,
    ethBalance,
    wethBalance,
    tammBalance,
    isSimulated: true,
    providerId: 'watch-address',
    providerName: 'Watch Address (Read-Only)',
  };
}

export async function switchToGiwaChain(provider?: Eip1193Provider | null): Promise<number | null> {
  const ethProvider = provider ?? activeEip1193Provider;
  if (!ethProvider) return null;
  try {
    await withTimeout(
      ethProvider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${GIWA_CHAIN_ID.toString(16)}` }],
      }),
      12000,
      'Switch chain timed out',
    );
    return GIWA_CHAIN_ID;
  } catch {
    await withTimeout(
      ethProvider.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: `0x${GIWA_CHAIN_ID.toString(16)}`,
            chainName: 'GIWA Sepolia',
            nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
            rpcUrls: [GIWA_RPC_URL],
            blockExplorerUrls: [GIWA_EXPLORER_URL],
          },
        ],
      }),
      12000,
      'Add chain timed out',
    );
    return GIWA_CHAIN_ID;
  }
}

export async function connectBrowserWallet(): Promise<WalletState> {
  const providers = requestWalletDiscovery();
  const preferred = providers.find((p) => !p.isSimulated) ?? providers[0];
  return connectWalletOption(preferred);
}

export async function fetchWalletBalances(address: Address): Promise<[string, string, string]> {
  try {
    const [ethWei, wethWei, tammRaw] = await Promise.all([
      giwaPublicClient.getBalance({ address }),
      giwaPublicClient.readContract({
        address: WETH_ADDRESS,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address],
      }),
      giwaPublicClient.readContract({
        address: TAMM_TOKEN_ADDRESS,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address],
      }),
    ]);
    return [
      Number(formatUnits(ethWei, 18)).toFixed(4),
      Number(formatUnits(wethWei, 18)).toFixed(4),
      Number(formatUnits(tammRaw, 6)).toLocaleString('en-US', { maximumFractionDigits: 2 }),
    ];
  } catch {
    return ['0.0000', '0.0000', '0.00'];
  }
}

export async function ensureGiwaChain(ethProvider: Eip1193Provider): Promise<void> {
  const currentChainId = parseChainId(
    await ethProvider.request({ method: 'eth_chainId' }).catch(() => null),
  );
  if (currentChainId !== GIWA_CHAIN_ID) {
    await switchToGiwaChain(ethProvider);
  }
}

export async function sendOrSimulateTransaction(params: {
  wallet: WalletState;
  to: Address;
  data: Hex;
  value: bigint;
}): Promise<{ mode: 'sent' | 'simulated'; hash?: Hex; gasEstimate?: string; note: string }> {
  const ethProvider = activeEip1193Provider;
  if (ethProvider && params.wallet.connected && !params.wallet.isSimulated && params.wallet.address) {
    await ensureGiwaChain(ethProvider);
    const walletClient = createWalletClient({
      chain: giwaSepoliaChain,
      transport: custom(ethProvider),
    });
    const hash = await walletClient.sendTransaction({
      account: params.wallet.address,
      to: params.to,
      data: params.data,
      value: params.value,
      chain: giwaSepoliaChain,
    });
    return {
      mode: 'sent',
      hash,
      note: `Transaction submitted via ${params.wallet.providerName ?? 'wallet'} to GIWA Sepolia.`,
    };
  }

  // Dry-run gas estimation / call check against live GIWA Sepolia RPC
  try {
    const gas = await giwaPublicClient.estimateGas({
      account: params.wallet.address ?? '0x13cD27a6E337097dB858C9C4FA472FbAd2F2c637',
      to: params.to,
      data: params.data,
      value: params.value,
    });
    return {
      mode: 'simulated',
      gasEstimate: gas.toString(),
      note: `Dry-run simulation succeeded on GIWA Sepolia (estimated ${gas.toLocaleString()} gas). Connect an injected wallet extension to broadcast.`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message.split('\n')[0] : 'Calldata ready for wallet signing.';
    return {
      mode: 'simulated',
      note: `Unsigned calldata prepared (${params.data.slice(0, 14)}…). RPC pre-flight note: ${msg}`,
    };
  }
}

export async function executeSwapPlan(params: {
  wallet: WalletState;
  quote: SwapQuoteResult;
  onProgress?: (status: string) => void;
}): Promise<{ mode: 'sent' | 'simulated'; hash?: Hex; note: string }> {
  const { wallet, quote, onProgress } = params;
  const ethProvider = activeEip1193Provider;

  if (!ethProvider || !wallet.connected || wallet.isSimulated || !wallet.address) {
    const sim = await sendOrSimulateTransaction({
      wallet,
      to: quote.unsignedTx.to,
      data: quote.unsignedTx.data,
      value: quote.unsignedTx.value,
    });
    const routeSummary =
      quote.executionSteps.length > 1
        ? ` Auto-route steps (${quote.executionSteps.length}): ${quote.executionSteps.map((s) => s.label).join(' → ')}.`
        : '';
    return {
      mode: 'simulated',
      note: `${sim.note}${routeSummary}`,
    };
  }

  await ensureGiwaChain(ethProvider);
  const walletClient = createWalletClient({
    chain: giwaSepoliaChain,
    transport: custom(ethProvider),
  });

  let lastHash: Hex | undefined;
  let preWethBalance = 0n;
  const executedLabels: string[] = [];

  for (const step of quote.executionSteps) {
    if (step.approvalCheck) {
      const currentAllowance = await giwaPublicClient.readContract({
        address: step.approvalCheck.token,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [wallet.address, step.approvalCheck.spender],
      });
      if (currentAllowance >= step.approvalCheck.amount) {
        continue;
      }
    }

    if (step.trackWethDelta) {
      preWethBalance = await giwaPublicClient.readContract({
        address: WETH_ADDRESS,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [wallet.address],
      });
    }

    let txData = step.data;
    if (step.unwrapWethDelta) {
      const postWethBalance = await giwaPublicClient.readContract({
        address: WETH_ADDRESS,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [wallet.address],
      });
      const gainedWeth = postWethBalance > preWethBalance ? postWethBalance - preWethBalance : step.unwrapWethDelta.fallbackAmount;
      if (gainedWeth <= 0n) {
        continue;
      }
      txData = encodeFunctionData({
        abi: WETH9_ABI,
        functionName: 'withdraw',
        args: [gainedWeth],
      });
    }

    onProgress?.(step.label);
    const hash = await walletClient.sendTransaction({
      account: wallet.address,
      to: step.to,
      data: txData,
      value: step.value,
      chain: giwaSepoliaChain,
    });
    lastHash = hash;
    executedLabels.push(step.label);
    onProgress?.(`Confirming: ${step.label}…`);
    await giwaPublicClient.waitForTransactionReceipt({ hash });
  }

  return {
    mode: 'sent',
    hash: lastHash,
    note: `Executed ${executedLabels.join(' → ')} via ${wallet.providerName ?? 'wallet'} on GIWA Sepolia.`,
  };
}

export interface Season2OnChainState {
  vaultTotalAssetsEth: string;
  stakingDepositsPaused: boolean;
  identityEligible: boolean | null;
  userStakedTammRaw: bigint;
  userPendingWithdrawalRaw: bigint;
  userClaimableRewardRaw: bigint;
  poolTotalLiquidity: bigint;
  poolQuoteReserveWei: bigint;
  userLpPositionsCount: number;
}

export async function fetchSeason2OnChainState(userAddress?: Address | null): Promise<Season2OnChainState> {
  try {
    const [vaultTotalAssets, depositsPaused, poolLiquidity, poolQuoteReserve] = await Promise.all([
      giwaPublicClient
        .readContract({
          address: GIWA_ETH_VAULT_ADDRESS,
          abi: GIWA_ETH_VAULT_ABI,
          functionName: 'totalAssets',
        })
        .catch(() => 0n),
      giwaPublicClient
        .readContract({
          address: TAMM_STAKING_ADDRESS,
          abi: TAMM_STAKING_ABI,
          functionName: 'depositsPaused',
        })
        .catch(() => false),
      giwaPublicClient
        .readContract({
          address: TAMM_POOL_ADDRESS,
          abi: ARL_POOL_LP_ABI,
          functionName: 'totalLiquidity',
        })
        .catch(() => 0n),
      giwaPublicClient
        .readContract({
          address: TAMM_POOL_ADDRESS,
          abi: ARL_POOL_LP_ABI,
          functionName: 'reserveQuote',
        })
        .catch(() => 0n),
    ]);

    let identityEligible: boolean | null = null;
    let userStakedTammRaw = 0n;
    let userPendingWithdrawalRaw = 0n;
    let userClaimableRewardRaw = 0n;
    let userLpPositionsCount = 0;

    if (userAddress) {
      const [eligibleRes, accountRes, claimableRes, lpBalanceRes] = await Promise.all([
        giwaPublicClient
          .readContract({
            address: AMMORA_IDENTITY_ADDRESS,
            abi: AMMORA_IDENTITY_ABI,
            functionName: 'eligible',
            args: [userAddress],
          })
          .catch(() => null),
        giwaPublicClient
          .readContract({
            address: TAMM_STAKING_ADDRESS,
            abi: TAMM_STAKING_ABI,
            functionName: 'accounts',
            args: [userAddress],
          })
          .catch(() => [0n, 0n, 0n, 0n, 0n, 0n] as const),
        giwaPublicClient
          .readContract({
            address: TAMM_STAKING_ADDRESS,
            abi: TAMM_STAKING_ABI,
            functionName: 'claimable',
            args: [userAddress],
          })
          .catch(() => 0n),
        giwaPublicClient
          .readContract({
            address: TAMM_POOL_ADDRESS,
            abi: ARL_POOL_LP_ABI,
            functionName: 'balanceOf',
            args: [userAddress],
          })
          .catch(() => 0n),
      ]);

      identityEligible = eligibleRes;
      userStakedTammRaw = accountRes[0] ?? 0n;
      userPendingWithdrawalRaw = accountRes[1] ?? 0n;
      userClaimableRewardRaw = claimableRes;
      userLpPositionsCount = Number(lpBalanceRes);
    }

    return {
      vaultTotalAssetsEth: Number(formatUnits(vaultTotalAssets, 18)).toLocaleString('en-US', {
        maximumFractionDigits: 2,
      }),
      stakingDepositsPaused: depositsPaused,
      identityEligible,
      userStakedTammRaw,
      userPendingWithdrawalRaw,
      userClaimableRewardRaw,
      poolTotalLiquidity: poolLiquidity,
      poolQuoteReserveWei: poolQuoteReserve,
      userLpPositionsCount,
    };
  } catch {
    return {
      vaultTotalAssetsEth: '0.00',
      stakingDepositsPaused: false,
      identityEligible: null,
      userStakedTammRaw: 0n,
      userPendingWithdrawalRaw: 0n,
      userClaimableRewardRaw: 0n,
      poolTotalLiquidity: 0n,
      poolQuoteReserveWei: 0n,
      userLpPositionsCount: 0,
    };
  }
}

export async function fetchGiwaterTokenBalances(userAddress: Address): Promise<Record<string, string>> {
  const entries = await Promise.all(
    GIWATER_DEX_TOKENS.map(async (tok) => {
      try {
        const bal = await giwaPublicClient.readContract({
          address: tok.address,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [userAddress],
        });
        return [
          tok.symbol,
          Number(formatUnits(bal, tok.decimals)).toLocaleString('en-US', { maximumFractionDigits: 4 }),
        ] as const;
      } catch {
        return [tok.symbol, '0'] as const;
      }
    }),
  );
  return Object.fromEntries(entries);
}

export async function previewTammAddLiquidity(
  maxBaseHuman: string,
  maxQuoteHuman: string,
): Promise<{ liquidity: bigint; baseUsed: bigint; quoteUsed: bigint }> {
  const maxBase = parseUnits(maxBaseHuman || '0', 6);
  const maxQuote = parseUnits(maxQuoteHuman || '0', 18);
  if (maxBase <= 0n || maxQuote <= 0n) {
    return { liquidity: 0n, baseUsed: 0n, quoteUsed: 0n };
  }
  const [liquidity, baseUsed, quoteUsed] = await giwaPublicClient.readContract({
    address: TAMM_POOL_ADDRESS,
    abi: ARL_POOL_LP_ABI,
    functionName: 'previewAddLiquidity',
    args: [maxBase, maxQuote],
  });
  return { liquidity, baseUsed, quoteUsed };
}

export function buildGiwaEthVaultDepositStep(amountEthHuman: string): SwapExecutionStep[] {
  const value = parseUnits(amountEthHuman || '0', 18);
  const data = encodeFunctionData({
    abi: GIWA_ETH_VAULT_ABI,
    functionName: 'deposit',
  });
  return [
    {
      id: 'giwa-eth-vault-deposit',
      label: `Deposit ${amountEthHuman} ETH to GIWA Vault`,
      to: GIWA_ETH_VAULT_ADDRESS,
      data,
      value,
    },
  ];
}

export function buildTammStakingSteps(
  action: 'deposit' | 'requestWithdrawal' | 'withdraw' | 'claim',
  amountTammHuman: string,
): SwapExecutionStep[] {
  const amountRaw = parseUnits(amountTammHuman || '0', 6);
  if (action === 'claim') {
    return [
      {
        id: 'tamm-stake-claim',
        label: 'Claim tAMM Staking Rewards',
        to: TAMM_STAKING_ADDRESS,
        data: encodeFunctionData({ abi: TAMM_STAKING_ABI, functionName: 'claim' }),
        value: 0n,
      },
    ];
  }
  if (action === 'requestWithdrawal') {
    return [
      {
        id: 'tamm-stake-req-withdraw',
        label: `Request Unstake ${amountTammHuman} tAMM`,
        to: TAMM_STAKING_ADDRESS,
        data: encodeFunctionData({ abi: TAMM_STAKING_ABI, functionName: 'requestWithdrawal', args: [amountRaw] }),
        value: 0n,
      },
    ];
  }
  if (action === 'withdraw') {
    return [
      {
        id: 'tamm-stake-withdraw',
        label: `Withdraw ${amountTammHuman} tAMM`,
        to: TAMM_STAKING_ADDRESS,
        data: encodeFunctionData({ abi: TAMM_STAKING_ABI, functionName: 'withdraw', args: [amountRaw] }),
        value: 0n,
      },
    ];
  }

  const approveData = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [TAMM_STAKING_ADDRESS, maxUint256],
  });
  const depositData = encodeFunctionData({
    abi: TAMM_STAKING_ABI,
    functionName: 'deposit',
    args: [amountRaw],
  });
  return [
    {
      id: 'approve-tamm-staking',
      label: 'Approve tAMM for Season 2 Staking',
      to: TAMM_TOKEN_ADDRESS,
      data: approveData,
      value: 0n,
      approvalCheck: { token: TAMM_TOKEN_ADDRESS, spender: TAMM_STAKING_ADDRESS, amount: amountRaw },
    },
    {
      id: 'deposit-tamm-staking',
      label: `Stake ${amountTammHuman} tAMM`,
      to: TAMM_STAKING_ADDRESS,
      data: depositData,
      value: 0n,
    },
  ];
}

export function buildTammPoolAddLiquiditySteps(params: {
  maxBaseRaw: bigint;
  maxQuoteRaw: bigint;
  minLiquidityRaw: bigint;
  recipient: Address;
}): SwapExecutionStep[] {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
  const approveBase = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [TAMM_POOL_ADDRESS, maxUint256],
  });
  const approveQuote = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [TAMM_POOL_ADDRESS, maxUint256],
  });
  const addLpData = encodeFunctionData({
    abi: ARL_POOL_LP_ABI,
    functionName: 'addLiquidity',
    args: [params.maxBaseRaw, params.maxQuoteRaw, params.minLiquidityRaw, params.recipient, 0, false, deadline],
  });
  return [
    {
      id: 'approve-tamm-lp',
      label: 'Approve tAMM for ARL Pool',
      to: TAMM_TOKEN_ADDRESS,
      data: approveBase,
      value: 0n,
      approvalCheck: { token: TAMM_TOKEN_ADDRESS, spender: TAMM_POOL_ADDRESS, amount: params.maxBaseRaw },
    },
    {
      id: 'approve-weth-lp',
      label: 'Approve WETH for ARL Pool',
      to: WETH_ADDRESS,
      data: approveQuote,
      value: 0n,
      approvalCheck: { token: WETH_ADDRESS, spender: TAMM_POOL_ADDRESS, amount: params.maxQuoteRaw },
    },
    {
      id: 'add-liquidity-tamm-pool',
      label: 'Add tAMM / WETH Liquidity',
      to: TAMM_POOL_ADDRESS,
      data: addLpData,
      value: 0n,
    },
  ];
}

export async function executeExecutionSteps(params: {
  wallet: WalletState;
  steps: SwapExecutionStep[];
  onProgress?: (status: string) => void;
}): Promise<{ mode: 'sent' | 'simulated'; hash?: Hex; note: string }> {
  const { wallet, steps, onProgress } = params;
  const ethProvider = activeEip1193Provider;
  const primary = steps[steps.length - 1];

  if (!ethProvider || !wallet.connected || wallet.isSimulated || !wallet.address) {
    const sim = await sendOrSimulateTransaction({
      wallet,
      to: primary.to,
      data: primary.data,
      value: primary.value,
    });
    const planLabel = steps.map((s) => s.label).join(' → ');
    return {
      mode: 'simulated',
      note: `${sim.note} Sequence: ${planLabel}.`,
    };
  }

  await ensureGiwaChain(ethProvider);
  const walletClient = createWalletClient({
    chain: giwaSepoliaChain,
    transport: custom(ethProvider),
  });

  let lastHash: Hex | undefined;
  const executedLabels: string[] = [];

  for (const step of steps) {
    if (step.approvalCheck) {
      const allowance = await giwaPublicClient.readContract({
        address: step.approvalCheck.token,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [wallet.address, step.approvalCheck.spender],
      });
      if (allowance >= step.approvalCheck.amount) {
        continue;
      }
    }

    onProgress?.(step.label);
    const hash = await walletClient.sendTransaction({
      account: wallet.address,
      to: step.to,
      data: step.data,
      value: step.value,
      chain: giwaSepoliaChain,
    });
    lastHash = hash;
    executedLabels.push(step.label);
    onProgress?.(`Confirming: ${step.label}…`);
    await giwaPublicClient.waitForTransactionReceipt({ hash });
  }

  return {
    mode: 'sent',
    hash: lastHash,
    note: `Executed ${executedLabels.join(' → ')} via ${wallet.providerName ?? 'wallet'} on GIWA Sepolia.`,
  };
}

export {
  ALCClient,
  createConfigAndPoolWithFirstBuy,
  giwaSepoliaAtomicLaunchDeployment,
  giwaSepoliaAutoRouteAddresses,
  giwaSepoliaAutoRouteDeployment,
};
