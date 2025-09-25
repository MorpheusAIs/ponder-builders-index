#!/usr/bin/env node

/**
 * Subgraph Migration Utility
 * 
 * This script helps with migrating queries from existing subgraphs to Ponder
 * by analyzing GraphQL queries and suggesting equivalent Ponder queries.
 * 
 * Supports:
 * - Builders entities (BuildersProject, BuildersUser, etc.)
 * - Capital entities (DepositPool, User, PoolInteraction, Referral, etc.)
 * - Proxy contract events (AdminChanged, BeaconUpgraded, etc.)
 * 
 * Usage:
 *   node migrate-subgraph.js <query-file.graphql>  # Analyze specific file
 *   node migrate-subgraph.js                       # Run example analysis
 */

import fs from 'fs';
import path from 'path';

// Mapping from subgraph entities to Ponder entities
const ENTITY_MAPPING = {
  // Builders entities (existing)
  'BuildersProject': 'buildersProject',
  'BuildersUser': 'buildersUser', 
  'counters': 'counters',
  
  // Capital entities - matching subgraph schema exactly
  'DepositPool': 'depositPool',
  'User': 'user',
  'PoolInteraction': 'poolInteraction',
  'InteractionCount': 'interactionCount',
  'Referral': 'referral',
  'Referrer': 'referrer',
  
  // Proxy contract events (immutable)
  'AdminChanged': 'adminChanged',
  'BeaconUpgraded': 'beaconUpgraded',
  'Initialized': 'initialized',
  'Upgraded': 'upgraded',
  'OwnershipTransferred': 'ownershipTransferred',
};

// Field mappings where names differ
const FIELD_MAPPING = {
  // Builders entities (existing)
  'BuildersProject': {
    'id': 'id',
    'name': 'name',
    'totalStaked': 'totalStaked',
    'totalUsers': 'totalUsers',
    'minimalDeposit': 'minimalDeposit',
    'withdrawLockPeriodAfterDeposit': 'withdrawLockPeriodAfterDeposit',
    'admin': 'admin',
    'claimLockEnd': 'claimLockEnd',
    'startsAt': 'startsAt',
    'totalClaimed': 'totalClaimed'
  },
  'BuildersUser': {
    'id': 'id',
    'address': 'address', 
    'staked': 'staked',
    'claimed': 'claimed',
    'lastStake': 'lastStake',
    'claimLockEnd': 'claimLockEnd',
    'buildersProject': 'project' // Relationship name
  },
  
  // Capital entities - exact field mappings (designed for compatibility)
  'DepositPool': {
    'id': 'id',
    'rewardPoolId': 'rewardPoolId',
    'depositPool': 'depositPool',
    'totalStaked': 'totalStaked'
  },
  'User': {
    'id': 'id',
    'address': 'address',
    'rewardPoolId': 'rewardPoolId', 
    'depositPool': 'depositPool',
    'staked': 'staked',
    'claimed': 'claimed',
    'interactions': 'interactions' // Relationship to PoolInteraction
  },
  'PoolInteraction': {
    'id': 'id',
    'blockNumber': 'blockNumber',
    'blockTimestamp': 'blockTimestamp',
    'transactionHash': 'transactionHash',
    'user': 'user', // FIXED: Direct relationship field (GraphQL compatible)
    'type': 'type',
    'amount': 'amount', 
    'depositPool': 'depositPool',
    'totalStaked': 'totalStaked',
    'rate': 'rate'
  },
  'InteractionCount': {
    'id': 'id',
    'count': 'count'
  },
  'Referral': {
    'id': 'id',
    'referral': 'referral', // FIXED: Direct relationship field (GraphQL compatible)
    'referrer': 'referrer', // FIXED: Direct relationship field (GraphQL compatible)
    'referralAddress': 'referralAddress',
    'referrerAddress': 'referrerAddress', 
    'amount': 'amount'
  },
  'Referrer': {
    'id': 'id',
    'user': 'userId', // Foreign key relationship
    'referrerAddress': 'referrerAddress',
    'claimed': 'claimed',
    'referrals': 'referrals' // Reverse relationship
  },
  
  // Proxy contract events (immutable) - exact field mappings
  'AdminChanged': {
    'id': 'id',
    'blockNumber': 'blockNumber',
    'blockTimestamp': 'blockTimestamp',
    'transactionHash': 'transactionHash',
    'previousAdmin': 'previousAdmin',
    'newAdmin': 'newAdmin',
    'depositPool': 'depositPool'
  },
  'BeaconUpgraded': {
    'id': 'id',
    'blockNumber': 'blockNumber',
    'blockTimestamp': 'blockTimestamp', 
    'transactionHash': 'transactionHash',
    'beacon': 'beacon',
    'depositPool': 'depositPool'
  },
  'Initialized': {
    'id': 'id',
    'blockNumber': 'blockNumber',
    'blockTimestamp': 'blockTimestamp',
    'transactionHash': 'transactionHash',
    'version': 'version',
    'depositPool': 'depositPool'
  },
  'Upgraded': {
    'id': 'id',
    'blockNumber': 'blockNumber', 
    'blockTimestamp': 'blockTimestamp',
    'transactionHash': 'transactionHash',
    'implementation': 'implementation',
    'depositPool': 'depositPool'
  },
  'OwnershipTransferred': {
    'id': 'id',
    'blockNumber': 'blockNumber',
    'blockTimestamp': 'blockTimestamp',
    'transactionHash': 'transactionHash', 
    'previousOwner': 'previousOwner',
    'newOwner': 'newOwner',
    'depositPool': 'depositPool'
  }
};

function analyzeQuery(queryString) {
  console.log('🔍 Analyzing GraphQL query...\n');
  console.log('Original query:');
  console.log(queryString);
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Simple regex-based analysis (for demo purposes)
  // In practice, you'd want to use a proper GraphQL parser
  
  const entityMatches = queryString.match(/(\w+)\s*\(/g);
  const suggestions = [];
  
  if (entityMatches) {
    entityMatches.forEach(match => {
      const entityName = match.replace(/\s*\(/, '');
      if (ENTITY_MAPPING[entityName]) {
        suggestions.push({
          original: entityName,
          ponder: ENTITY_MAPPING[entityName],
          type: 'entity'
        });
      }
    });
  }
  
  // Check for common patterns
  if (queryString.includes('orderBy')) {
    suggestions.push({
      type: 'feature',
      message: 'Ponder supports orderBy with similar syntax'
    });
  }
  
  if (queryString.includes('where')) {
    suggestions.push({
      type: 'feature', 
      message: 'Ponder supports filtering with where clauses'
    });
  }
  
  if (queryString.includes('first:') || queryString.includes('skip:')) {
    suggestions.push({
      type: 'feature',
      message: 'Use limit and offset in Ponder for pagination'
    });
  }
  
  return suggestions;
}

function generatePonderQuery(originalQuery, suggestions) {
  let ponderQuery = originalQuery;
  
  // Apply entity mappings
  suggestions.forEach(suggestion => {
    if (suggestion.type === 'entity') {
      ponderQuery = ponderQuery.replace(
        new RegExp(suggestion.original, 'g'), 
        suggestion.ponder
      );
    }
  });
  
  // Convert pagination syntax
  ponderQuery = ponderQuery.replace(/first:\s*(\d+)/, 'limit: $1');
  ponderQuery = ponderQuery.replace(/skip:\s*(\d+)/, 'offset: $1');
  
  return ponderQuery;
}

function printMigrationReport(suggestions, originalQuery, ponderQuery) {
  console.log('📊 Migration Analysis Report');
  console.log('='.repeat(30));
  
  console.log('\n🔄 Entity Mappings:');
  suggestions.filter(s => s.type === 'entity').forEach(s => {
    console.log(`  ${s.original} → ${s.ponder}`);
  });
  
  console.log('\n✅ Features Supported:');
  suggestions.filter(s => s.type === 'feature').forEach(s => {
    console.log(`  • ${s.message}`);
  });
  
  console.log('\n📝 Suggested Ponder Query:');
  console.log(ponderQuery);
  
  console.log('\n⚠️  Manual Review Needed:');
  console.log('  • Verify field names match your Ponder schema');
  console.log('  • Check that relationships are properly defined'); 
  console.log('  • Test the query against your Ponder GraphQL endpoint');
  console.log('  • Consider using SQL over HTTP for complex analytics');
  console.log('\n💡 Migration Tips:');
  console.log('  • Capital entities: Use port 42070 for GraphQL/SQL APIs');
  console.log('  • Builders entities: Use port 42069 for GraphQL/SQL APIs'); 
  console.log('  • Relationships: user.interactions, referrer.referrals work the same');
  console.log('  • Immutable entities: AdminChanged, PoolInteraction are append-only');
  console.log('  • Real rates: PoolInteraction.rate now contains actual contract data');
}

// Example usage
function runExample() {
  const exampleQuery = `
query GetCapitalDepositPools {
  DepositPool(
    first: 10,
    orderBy: totalStaked,
    orderDirection: desc,
    where: { totalStaked_gt: 0 }
  ) {
    id
    rewardPoolId
    depositPool
    totalStaked
  }
  
  User(
    first: 20,
    where: { staked_gt: 0 }
  ) {
    id
    address
    rewardPoolId
    depositPool
    staked
    claimed
    interactions(first: 5, orderBy: blockTimestamp, orderDirection: desc) {
      id
      type
      amount
      rate
      blockTimestamp
    }
  }
  
  PoolInteraction(
    first: 50,
    orderBy: blockTimestamp,
    orderDirection: desc,
    where: { type: 0 }
  ) {
    id
    blockTimestamp
    type
    amount
    depositPool
    totalStaked
    rate
    user {
      address
    }
  }
}`;
  
  const suggestions = analyzeQuery(exampleQuery);
  const ponderQuery = generatePonderQuery(exampleQuery, suggestions);
  printMigrationReport(suggestions, exampleQuery, ponderQuery);
}

// CLI interface
if (process.argv.length > 2) {
  const queryFile = process.argv[2];
  
  if (!fs.existsSync(queryFile)) {
    console.error('❌ Query file not found:', queryFile);
    process.exit(1);
  }
  
  const queryString = fs.readFileSync(queryFile, 'utf8');
  const suggestions = analyzeQuery(queryString);
  const ponderQuery = generatePonderQuery(queryString, suggestions);
  printMigrationReport(suggestions, queryString, ponderQuery);
  
} else {
  console.log('🔧 Subgraph Migration Utility\n');
  console.log('Supports migration from MorpheusAI subgraphs to Ponder indexers:');
  console.log('• Builders entities (Arbitrum, Base)');
  console.log('• Capital entities (Ethereum deposit pools)');
  console.log('• All proxy contract events\n');
  console.log('Usage: node migrate-subgraph.js <query-file.graphql>');
  console.log('   or: node migrate-subgraph.js (for example)\n');
  
  console.log('Running capital entities example analysis...\n');
  runExample();
}

console.log('\n🔗 Useful Resources:');
console.log('• Ponder APIs:');
console.log('  - Builders GraphQL: http://localhost:42069/graphql');
console.log('  - Builders SQL: http://localhost:42069/sql'); 
console.log('  - Capital GraphQL: http://localhost:42070/graphql');
console.log('  - Capital SQL: http://localhost:42070/sql'); 
console.log('• Documentation: https://ponder.sh/docs');
console.log('• Existing subgraphs:');
console.log('  - Arbitrum (builders): https://api.studio.thegraph.com/query/73688/morpheus-mainnet-arbitrum/version/latest');
console.log('  - Base (builders): https://subgraph.satsuma-prod.com/8675f21b07ed/9iqb9f4qcmhosiruyg763--465704/morpheus-mainnet-base/api');
console.log('  - Capital (deposit pools): https://api.studio.thegraph.com/query/73688/morpheus-mainnet-v-2/version/latest');
