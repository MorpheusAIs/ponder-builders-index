// Export all contract ABIs for use across Ponder apps
export { BuildersAbi } from './Builders.js';
export { ERC20Abi } from './ERC20.js';
export { L2FactoryAbi } from './L2Factory.js';
export { SubnetFactoryAbi } from './SubnetFactory.js';

// Contract addresses by chain
export const CONTRACT_ADDRESSES = {
  arbitrum: {
    chainId: 42161,
    contracts: {
      builders: '0xC0eD68f163d44B6e9985F0041fDf6f67c6BCFF3f' as const,
      morToken: '0x092bAaDB7DEf4C3981454dD9c0A0D7FF07bCFc86' as const,
      l2Factory: '0x890bfa255e6ee8db5c67ab32dc600b14ebc4546c' as const,
      subnetFactory: '0x37b94bd80b6012fb214bb6790b31a5c40d6eb7a5' as const,
    }
  },
  base: {
    chainId: 8453,
    contracts: {
      builders: '0x42BB446eAE6dca7723a9eBdb81EA88aFe77eF4B9' as const,
      morToken: '0x7431ADA8A591C955A994A21710752ef9b882b8e3' as const,
    }
  }
} as const;

// GraphQL endpoint configuration for existing subgraphs
export const SUBGRAPH_ENDPOINTS = {
  arbitrum: 'https://api.studio.thegraph.com/query/73688/lumerin-node/version/latest',
  base: 'https://subgraph.satsuma-prod.com/8675f21b07ed/9iqb9f4qcmhosiruyg763--465704/morpheus-mainnet-base/api',
} as const;

// Type helpers for contract addresses
export type ChainConfig = typeof CONTRACT_ADDRESSES[keyof typeof CONTRACT_ADDRESSES];
export type ContractAddress<T extends keyof typeof CONTRACT_ADDRESSES> = typeof CONTRACT_ADDRESSES[T]['contracts'];

// Helper function to get contract addresses for a specific chain
export function getContractAddresses(chainId: number) {
  const chain = Object.values(CONTRACT_ADDRESSES).find(c => c.chainId === chainId);
  if (!chain) {
    throw new Error(`No contract addresses configured for chain ID: ${chainId}`);
  }
  return chain.contracts;
}
