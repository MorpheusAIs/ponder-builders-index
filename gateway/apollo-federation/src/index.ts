import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { ApolloGateway, IntrospectAndCompose } from '@apollo/gateway';

// Configuration for federated services
const gateway = new ApolloGateway({
  supergraphSdl: new IntrospectAndCompose({
    subgraphs: [
      // Ponder Builders Indexer
      {
        name: 'ponder-builders',
        url: process.env.PONDER_BUILDERS_URL || 'http://localhost:42069/graphql',
      },
      // Existing Arbitrum subgraph
      {
        name: 'arbitrum-legacy',
        url: process.env.ARBITRUM_SUBGRAPH_URL || 
             'https://api.studio.thegraph.com/query/73688/lumerin-node/version/latest',
      },
      // Existing Base subgraph  
      {
        name: 'base-legacy',
        url: process.env.BASE_SUBGRAPH_URL ||
             'https://subgraph.satsuma-prod.com/8675f21b07ed/9iqb9f4qcmhosiruyg763--465704/morpheus-mainnet-base/api',
      },
    ],
  }),
  // Enable debugging
  debug: process.env.NODE_ENV === 'development',
});

// Create Apollo Server with the gateway
const server = new ApolloServer({
  gateway,
  // Enable subscription support if needed
  subscriptions: false,
  // Add context function for authentication/logging
  plugins: [
    {
      requestDidStart() {
        return {
          didResolveOperation(requestContext) {
            console.log(`🔍 Operation: ${requestContext.request.operationName}`);
          },
          didEncounterErrors(requestContext) {
            console.error('❌ Errors:', requestContext.errors);
          },
        };
      },
    },
  ],
});

async function startServer() {
  try {
    const { url } = await startStandaloneServer(server, {
      listen: { port: Number(process.env.PORT) || 4000 },
      context: async ({ req }) => {
        // Add authentication context here if needed
        return {
          // Add user context, API keys, etc.
          userAgent: req.headers['user-agent'],
        };
      },
    });

    console.log(`🚀 Apollo Federation Gateway ready at ${url}`);
    console.log(`📊 GraphQL Playground: ${url}`);
    
    // Log federated services
    console.log('\n📡 Federated Services:');
    console.log('  - ponder-builders:', process.env.PONDER_BUILDERS_URL || 'http://localhost:42069/graphql');
    console.log('  - arbitrum-legacy:', process.env.ARBITRUM_SUBGRAPH_URL || 'https://api.studio.thegraph.com/query/73688/lumerin-node/version/latest');
    console.log('  - base-legacy:', process.env.BASE_SUBGRAPH_URL || 'https://subgraph.satsuma-prod.com/8675f21b07ed/9iqb9f4qcmhosiruyg763--465704/morpheus-mainnet-base/api');
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n📴 Shutting down Apollo Federation Gateway...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n📴 Shutting down Apollo Federation Gateway...');
  process.exit(0);
});

startServer();
