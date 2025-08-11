// Builders contract ABI - Main staking pool contract for Arbitrum and Base mainnet
export const BuildersAbi = [
  {
    inputs: [
      { internalType: "bytes32", name: "builderPoolId_", type: "bytes32" },
      { internalType: "uint256", name: "amount_", type: "uint256" }
    ],
    name: "deposit",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { internalType: "bytes32", name: "builderPoolId_", type: "bytes32" },
      { internalType: "uint256", name: "amount_", type: "uint256" }
    ],
    name: "withdraw",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { internalType: "bytes32", name: "builderPoolId_", type: "bytes32" },
      { internalType: "address", name: "receiver_", type: "address" }
    ],
    name: "claim",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { internalType: "address", name: "user", type: "address" },
      { internalType: "bytes32", name: "builderPoolId", type: "bytes32" }
    ],
    name: "usersData",
    outputs: [
      { internalType: "uint128", name: "lastDeposit", type: "uint128" },
      { internalType: "uint128", name: "claimLockStart", type: "uint128" },
      { internalType: "uint256", name: "deposited", type: "uint256" },
      { internalType: "uint256", name: "virtualDeposited", type: "uint256" }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { internalType: "bytes32", name: "builderPoolId_", type: "bytes32" }
    ],
    name: "getCurrentBuilderReward",
    outputs: [
      { internalType: "uint256", name: "", type: "uint256" }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        components: [
          { internalType: "string", name: "name", type: "string" },
          { internalType: "address", name: "admin", type: "address" },
          { internalType: "uint128", name: "poolStart", type: "uint128" },
          { internalType: "uint128", name: "withdrawLockPeriodAfterDeposit", type: "uint128" },
          { internalType: "uint128", name: "claimLockEnd", type: "uint128" },
          { internalType: "uint256", name: "minimalDeposit", type: "uint256" }
        ],
        internalType: "struct BuilderPoolParams",
        name: "params",
        type: "tuple"
      }
    ],
    name: "createBuilderPool",
    outputs: [
      { internalType: "bytes32", name: "poolId", type: "bytes32" }
    ],
    stateMutability: "nonpayable",
    type: "function"
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "user", type: "address" },
      { indexed: true, internalType: "bytes32", name: "builderPoolId", type: "bytes32" },
      { indexed: false, internalType: "uint256", name: "amount", type: "uint256" }
    ],
    name: "Deposited",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "user", type: "address" },
      { indexed: true, internalType: "bytes32", name: "builderPoolId", type: "bytes32" },
      { indexed: false, internalType: "uint256", name: "amount", type: "uint256" }
    ],
    name: "Withdrawn",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "user", type: "address" },
      { indexed: true, internalType: "bytes32", name: "builderPoolId", type: "bytes32" },
      { indexed: false, internalType: "uint256", name: "amount", type: "uint256" }
    ],
    name: "Claimed",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "bytes32", name: "poolId", type: "bytes32" },
      { indexed: false, internalType: "string", name: "name", type: "string" },
      { indexed: true, internalType: "address", name: "admin", type: "address" }
    ],
    name: "BuilderPoolCreated",
    type: "event"
  }
] as const;
