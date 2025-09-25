#!/usr/bin/env node

/**
 * Subgraph Migration Utility
 * 
 * This script helps with migrating queries from existing subgraphs to Ponder
 * by analyzing GraphQL queries and suggesting equivalent Ponder queries.
 */

import fs from 'fs';
import path from 'path';

// Mapping from subgraph entities to Ponder entities
const ENTITY_MAPPING = {
  'BuildersProject': 'buildersProject',
  'BuildersUser': 'buildersUser', 
  'counters': 'counters',
};

// Field mappings where names differ
const FIELD_MAPPING = {
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
}

// Example usage
function runExample() {
  const exampleQuery = `
query GetBuildersProjects {
  BuildersProject(
    first: 10,
    orderBy: totalStaked,
    orderDirection: desc,
    where: { totalUsers_gt: 0 }
  ) {
    id
    name
    totalStaked
    totalUsers
    admin
    users(first: 5) {
      address
      staked
      claimed
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
  console.log('Usage: node migrate-subgraph.js <query-file.graphql>');
  console.log('   or: node migrate-subgraph.js (for example)\n');
  
  console.log('Running example analysis...\n');
  runExample();
}

console.log('\n🔗 Useful Resources:');
console.log('• Ponder GraphQL API: http://localhost:42069/graphql');
console.log('• Ponder SQL API: http://localhost:42069/sql');  
console.log('• Documentation: https://ponder.sh/docs');
console.log('• Existing subgraphs:');
console.log('  - Arbitrum: https://api.studio.thegraph.com/query/73688/morpheus-mainnet-arbitrum/version/latest');
console.log('  - Base: https://subgraph.satsuma-prod.com/8675f21b07ed/9iqb9f4qcmhosiruyg763--465704/morpheus-mainnet-base/api');
