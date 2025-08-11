// L2 Factory contract ABI - Creates new builder subnets on Arbitrum
export const L2FactoryAbi = [
  {
    inputs: [
      { internalType: "bytes32", name: "salt", type: "bytes32" },
      { internalType: "bytes", name: "data", type: "bytes" }
    ],
    name: "createSubnet",
    outputs: [
      { internalType: "address", name: "subnet", type: "address" }
    ],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { internalType: "address", name: "subnet", type: "address" }
    ],
    name: "isValidSubnet",
    outputs: [
      { internalType: "bool", name: "", type: "bool" }
    ],
    stateMutability: "view",
    type: "function"
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "subnet", type: "address" },
      { indexed: true, internalType: "address", name: "creator", type: "address" },
      { indexed: false, internalType: "bytes32", name: "salt", type: "bytes32" }
    ],
    name: "SubnetCreated",
    type: "event"
  }
] as const;
