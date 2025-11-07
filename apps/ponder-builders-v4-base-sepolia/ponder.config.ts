import { createConfig } from "ponder";
import { http, type Abi } from "viem";
import { loadBalance, rateLimit } from "ponder";

// Import v4 contract ABIs
import { BuildersV4Abi, RewardPoolV4Abi, FeeConfigAbi, BuildersTreasuryV2Abi } from "./abis/index.js";
// Import ERC20 ABI from shared package for MOR token
import { ERC20Abi } from "../../packages/shared-abis/src/index.js";

export default createConfig({
  // Database configuration: Use Postgres if DATABASE_URL is provided, otherwise use PGlite for local dev
  ...(process.env.DATABASE_URL
    ? {
        database: {
          kind: "postgres",
          connectionString: process.env.DATABASE_URL,
          poolConfig: {
            max: 30,
          },
        },
      }
    : {}),
  chains: {
    baseSepolia: {
      id: 84532,
      rpc: loadBalance([
        http(process.env.PONDER_RPC_URL_84532 || "https://sepolia.base.org"),
        rateLimit(http("https://base-sepolia-rpc.publicnode.com"), { 
          requestsPerSecond: 10 
        }),
      ]),
    },
  },
  contracts: {
    // Builders v4 staking contract - deployed on Base Sepolia
    BuildersV4: {
      abi: BuildersV4Abi as Abi,
      chain: "baseSepolia",
      address: (process.env.BUILDERS_V4_CONTRACT_ADDRESS || "0x6C3401D71CEd4b4fEFD1033EA5F83e9B3E7e4381") as `0x${string}`,
      startBlock: Number(process.env.BUILDERS_V4_START_BLOCK || "29016947"),
      includeTransactionReceipts: true,
    },

    // Reward Pool v4 - handles reward distribution
    RewardPoolV4: {
      abi: RewardPoolV4Abi as Abi,
      chain: "baseSepolia",
      address: (process.env.REWARD_POOL_V4_CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`,
      startBlock: Number(process.env.REWARD_POOL_V4_START_BLOCK || "0"),
    },

    // Builders Treasury V2 - handles reward distribution to users
    BuildersTreasuryV2: {
      abi: BuildersTreasuryV2Abi as Abi,
      chain: "baseSepolia",
      address: (process.env.BUILDERS_TREASURY_V2_CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`,
      startBlock: Number(process.env.BUILDERS_TREASURY_V2_START_BLOCK || "0"),
    },

    // Fee Config - proxy contract for fee configuration
    FeeConfig: {
      abi: FeeConfigAbi as Abi,
      chain: "baseSepolia",
      address: (process.env.FEE_CONFIG_CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`,
      startBlock: Number(process.env.FEE_CONFIG_START_BLOCK || "0"),
    },

    // MOR Token contract - for tracking transfers and approvals
    MorToken: {
      abi: ERC20Abi,
      chain: "baseSepolia",
      // TODO: Update with actual MOR token address on Base Sepolia
      address: (process.env.MOR_TOKEN_ADDRESS_BASE_SEPOLIA || "0x5C80Ddd187054E1E4aBBfFCD750498e81d34FfA3") as `0x${string}`,
      // TODO: Update with actual deployment block number
      startBlock: Number(process.env.MOR_TOKEN_START_BLOCK_BASE_SEPOLIA || "24869176"),
    },
  },
});
