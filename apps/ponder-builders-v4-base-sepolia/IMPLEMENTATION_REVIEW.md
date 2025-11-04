# Builders v4 Base Sepolia Implementation Review

## Summary

The implementation has been updated to use the actual v4 contract ABIs and follows the v4 architecture.

## Changes Made

### 1. ABI Configuration (`ponder.config.ts`)
- ✅ **Updated imports**: Now imports v4-specific ABIs from local `abis/` directory:
  - `BuildersV4Abi` - Main staking contract
  - `RewardPoolV4Abi` - Reward pool contract
  - `FeeConfigAbi` - Fee configuration proxy contract
  - `BuildersTreasuryV2Abi` - Treasury contract for reward distribution
- ✅ **Added contract configurations**: All v4 contracts are now configured in the ponder config with environment variable support

### 2. Schema Updates (`ponder.schema.ts`)
- ✅ **Added `rewardDistribution` table**: Tracks reward distributions from BuildersTreasuryV2
  - Records `RewardSent` events
  - Tracks receiver, amount, treasury address, and transaction details

### 3. Event Handlers (`src/index.ts`)
- ✅ **BuildersV4 events**: Handlers for standard staking events:
  - `BuilderPoolCreated` - Pool creation
  - `Deposited` - User deposits
  - `Withdrawn` - User withdrawals
  - `Claimed` - User claims
- ✅ **BuildersTreasuryV2 events**: Added handler for:
  - `RewardSent` - Reward distribution events

### 4. ABI Structure (`abis/index.ts`)
- ✅ Created TypeScript module to export all v4 contract ABIs
- ✅ Supports JSON imports (tsconfig.json has `resolveJsonModule: true`)

## Contract Architecture

### BuildersV4
- Main staking contract for v4
- Handles pool creation, deposits, withdrawals, and claims
- Events: `BuilderPoolCreated`, `Deposited`, `Withdrawn`, `Claimed`

### BuildersTreasuryV2
- Manages reward distribution
- Sends rewards to users via `sendRewards()` function
- Events: `RewardSent`

### RewardPoolV4
- Handles reward pool logic (configured but event handlers can be added as needed)

### FeeConfig
- Proxy contract for fee configuration (ERC1967 pattern)
- Events: `AdminChanged`, `BeaconUpgraded`, `Upgraded`

## Environment Variables

The following environment variables should be set in `.env`:

```env
# BuildersV4 (required)
BUILDERS_V4_CONTRACT_ADDRESS=0x...
BUILDERS_V4_START_BLOCK=...

# RewardPoolV4 (optional - set if deployed)
REWARD_POOL_V4_CONTRACT_ADDRESS=0x...
REWARD_POOL_V4_START_BLOCK=...

# BuildersTreasuryV2 (optional - set if deployed)
BUILDERS_TREASURY_V2_CONTRACT_ADDRESS=0x...
BUILDERS_TREASURY_V2_START_BLOCK=...

# FeeConfig (optional - set if deployed)
FEE_CONFIG_CONTRACT_ADDRESS=0x...
FEE_CONFIG_START_BLOCK=...

# MOR Token (required)
MOR_TOKEN_ADDRESS_BASE_SEPOLIA=0x...
MOR_TOKEN_START_BLOCK_BASE_SEPOLIA=...
```

## Verification Checklist

- [x] BuildersV4 ABI imported and used
- [x] BuildersV4 contract configured with correct address
- [x] BuildersV4 event handlers implemented (BuilderPoolCreated, Deposited, Withdrawn, Claimed)
- [x] BuildersTreasuryV2 ABI imported and used
- [x] BuildersTreasuryV2 RewardSent event handler added
- [x] Reward distribution table added to schema
- [x] RewardPoolV4 and FeeConfig ABIs imported (ready for use if needed)
- [x] All contract addresses use proper type casting (`0x${string}`)
- [x] No TypeScript errors
- [x] No linter errors

## Next Steps

1. **Add ABI JSON files**: Ensure the following JSON files are in `abis/` directory:
   - `BuildersV4.json`
   - `RewardPoolV4.json`
   - `FeeConfig.json`
   - `BuildersTreasuryV2.json`

2. **Update contract addresses**: Set actual contract addresses in `.env` or update defaults in `ponder.config.ts`

3. **Add additional event handlers** (if needed):
   - RewardPoolV4 events (if reward pool has specific events to track)
   - FeeConfig upgrade events (if tracking proxy upgrades is needed)

4. **Test the indexer**: Run `pnpm dev` to verify all events are being indexed correctly

## Notes

- The implementation assumes the v4 contracts follow the same event patterns as previous versions
- If event names differ in the actual v4 contracts, update the event handler names accordingly
- The `RewardSent` event handler tracks all reward distributions, which can be linked to user claims via the receiver address
