import { createConfig, factory } from "ponder";
import { parseAbiItem } from "viem";

// Import ABIs from shared package
import { BuildersAbi, ERC20Abi, L2FactoryAbi, SubnetFactoryAbi } from "../../packages/shared-abis/src/index.js";

export default createConfig({
  chains: {
    arbitrum: {
      id: 42161,
      rpc: process.env.PONDER_RPC_URL_42161!,
    },
    base: {
      id: 8453,
      rpc: process.env.PONDER_RPC_URL_8453!,
    },
  },
  contracts: {
    // Main Builders staking contract - deployed on both chains
    Builders: {
      abi: BuildersAbi,
      chain: {
        arbitrum: {
          address: "0xC0eD68f163d44B6e9985F0041fDf6f67c6BCFF3f",
          startBlock: 18000000, // Approximate deployment block
        },
        base: {
          address: "0x42BB446eAE6dca7723a9eBdb81EA88aFe77eF4B9",
          startBlock: 8000000, // Approximate deployment block
        },
      },
      includeTransactionReceipts: true,
    },

    // MOR Token contract - for tracking transfers and approvals
    MorToken: {
      abi: ERC20Abi,
      chain: {
        arbitrum: {
          address: "0x092bAaDB7DEf4C3981454dD9c0A0D7FF07bCFc86",
          startBlock: 17500000,
        },
        base: {
          address: "0x7431ADA8A591C955A994A21710752ef9b882b8e3",
          startBlock: 7500000,
        },
      },
    },

    // L2 Factory - Arbitrum only, creates builder subnets
    L2Factory: {
      abi: L2FactoryAbi,
      chain: "arbitrum",
      address: "0x890bfa255e6ee8db5c67ab32dc600b14ebc4546c",
      startBlock: 18000000,
    },

    // Subnet Factory - Arbitrum only, creates subnet instances
    SubnetFactory: {
      abi: SubnetFactoryAbi,
      chain: "arbitrum",
      address: "0x37b94bd80b6012fb214bb6790b31a5c40d6eb7a5",
      startBlock: 18000000,
    },

    // Dynamic contracts created by L2Factory
    DynamicSubnet: {
      abi: BuildersAbi, // Assuming subnets use similar interface
      chain: "arbitrum",
      address: factory({
        address: "0x890bfa255e6ee8db5c67ab32dc600b14ebc4546c",
        event: parseAbiItem("event SubnetCreated(address indexed subnet, address indexed creator, bytes32 salt)"),
        parameter: "subnet",
      }),
    },
  },
});
