import { createConfig, factory } from "ponder";
import { parseAbiItem, http } from "viem";
import { loadBalance, rateLimit } from "ponder";
import { DepositPoolAbi, DistributorAbi, L1SenderV2Abi, L2MessageReceiverAbi, ChainLinkDataConsumerAbi, RewardPoolAbi } from "../../packages/shared-abis/src/index.js";

export default createConfig({
  chains: {
    mainnet: {
      id: 1,
      rpc: loadBalance([
        http(process.env.PONDER_RPC_URL_1!),
        rateLimit(http("https://cloudflare-eth.com"), { 
          requestsPerSecond: 25 
        }),
        rateLimit(http("https://ethereum-rpc.publicnode.com"), { 
          requestsPerSecond: 10 
        }),
      ]),
    },
    arbitrum: {
      id: 42161, 
      rpc: loadBalance([
        http(process.env.PONDER_RPC_URL_42161!),
        rateLimit(http("https://arbitrum-one.public.blastapi.io"), { 
          requestsPerSecond: 25 
        }),
        rateLimit(http("https://arbitrum-one-rpc.publicnode.com"), { 
          requestsPerSecond: 10 
        }),
      ]),
    },
  },
  contracts: {
    // Deposit Pool Contracts - Each token has its own pool
    DepositPoolStETH: {
      abi: DepositPoolAbi,
      chain: "mainnet",
      address: "0x47176B2Af9885dC6C4575d4eFd63895f7Aaa4790",
      startBlock: 19178638,
      includeTransactionReceipts: true,
    },
    DepositPoolWBTC: {
      abi: DepositPoolAbi,
      chain: "mainnet", 
      address: "0xdE283F8309Fd1AA46c95d299f6B8310716277A42",
      startBlock: 23390320,
      includeTransactionReceipts: true,
    },
    DepositPoolWETH: {
      abi: DepositPoolAbi,
      chain: "mainnet",
      address: "0x9380d72aBbD6e0Cc45095A2Ef8c2CA87d77Cb384", 
      startBlock: 23390320,
      includeTransactionReceipts: true,
    },
    DepositPoolUSDC: {
      abi: DepositPoolAbi,
      chain: "mainnet",
      address: "0x6cCE082851Add4c535352f596662521B4De4750E",
      startBlock: 23390320,
      includeTransactionReceipts: true,
    },
    DepositPoolUSDT: {
      abi: DepositPoolAbi,
      chain: "mainnet",
      address: "0x3B51989212BEdaA926794D6bf8e9E991218cf116",
      startBlock: 23390320,
      includeTransactionReceipts: true,
    },
    
    // Core distribution contracts (from deployed contracts documentation)
    Distributor: {
      abi: DistributorAbi,
      chain: "mainnet",
      address: "0xDf1AC1AC255d91F5f4B1E3B4Aef57c5350F64C7A", // Main distributor
      startBlock: 20000000, // TBD - need to find actual deployment block
      includeTransactionReceipts: true,
    },
    
    // ChainLink Data Consumer - Ethereum mainnet
    ChainLinkDataConsumer: {
      abi: ChainLinkDataConsumerAbi,
      chain: "mainnet", 
      address: "0x94e6720a624ea275b44d357a7f21bfcf09ff7e11",
      startBlock: 20000000,
    },

    // Reward Pool contract - Ethereum mainnet
    RewardPool: {
      abi: RewardPoolAbi,
      chain: "mainnet",
      address: "0xe30279b79392aeff7fdf1883c23d52eba9d88a75",
      startBlock: 20000000,
    },
    
    L1SenderV2: {
      abi: L1SenderV2Abi,
      chain: "mainnet", 
      address: "0x50e80ea310269c547b64cc8b8a606be0ec467d1f",
      startBlock: 20000000, // TBD
    },
    
    // L2 components
    L2MessageReceiver: {
      abi: L2MessageReceiverAbi, 
      chain: "arbitrum",
      address: "0xd4a8ECcBe696295e68572A98b1aA70Aa9277d427",
      startBlock: 18000000, // TBD
    },

    // Note: Dynamic Deposit Pools will be handled via DepositPoolAdded events
    // The factory pattern isn't directly applicable since the event doesn't emit the pool address
    // Instead, we'll track pool registrations and dynamically discover new pool addresses
    // from the addDepositPool transaction data in our event handlers
  },
});
