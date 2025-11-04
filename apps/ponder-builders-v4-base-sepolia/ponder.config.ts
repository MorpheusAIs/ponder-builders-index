import { createConfig } from "ponder";
import { http } from "viem";
import { loadBalance, rateLimit } from "ponder";

// Import ABIs from shared package
import { BuildersAbi, ERC20Abi } from "../../packages/shared-abis/src/index.js";

export default createConfig({
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
      abi: BuildersAbi,
      chain: "baseSepolia",
      // TODO: Update with actual contract address from https://gitbook.mor.org/smart-contracts/documentation/builders-protocol/deployed-contracts
      address: process.env.BUILDERS_V4_CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000000",
      // TODO: Update with actual deployment block number
      startBlock: Number(process.env.BUILDERS_V4_START_BLOCK || "0"),
      includeTransactionReceipts: true,
    },

    // MOR Token contract - for tracking transfers and approvals
    MorToken: {
      abi: ERC20Abi,
      chain: "baseSepolia",
      // TODO: Update with actual MOR token address on Base Sepolia
      address: process.env.MOR_TOKEN_ADDRESS_BASE_SEPOLIA || "0x0000000000000000000000000000000000000000",
      // TODO: Update with actual deployment block number
      startBlock: Number(process.env.MOR_TOKEN_START_BLOCK_BASE_SEPOLIA || "0"),
    },
  },
});
