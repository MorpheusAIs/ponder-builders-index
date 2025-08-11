// Subnet Factory contract ABI - Creates subnet instances on Arbitrum
export const SubnetFactoryAbi = [
  {
    inputs: [
      { internalType: "string", name: "name", type: "string" },
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "bytes", name: "initData", type: "bytes" }
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
    name: "getSubnetInfo",
    outputs: [
      { internalType: "string", name: "name", type: "string" },
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "uint256", name: "createdAt", type: "uint256" }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "getSubnetCount",
    outputs: [
      { internalType: "uint256", name: "", type: "uint256" }
    ],
    stateMutability: "view",
    type: "function"
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "subnet", type: "address" },
      { indexed: false, internalType: "string", name: "name", type: "string" },
      { indexed: true, internalType: "address", name: "owner", type: "address" }
    ],
    name: "SubnetCreated",
    type: "event"
  }
] as const;
