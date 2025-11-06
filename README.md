# Fee Collector Indexer

A production-ready blockchain indexer that scrapes `FeesCollected` events from LI.FI's FeeCollector smart contract on EVM chains and stores them in MongoDB.

## Purpose

This application indexes blockchain events from the FeeCollector contract across multiple EVM chains (starting with Polygon). It:

- Scans blockchain events using configurable block chunk sizes
- Tracks indexing state to avoid re-scanning
- Handles blockchain reorganizations with configurable finality depth
- Stores events in MongoDB using type-safe Typegoose models
- Supports multiple chains running simultaneously
- Provides robust error handling with circuit breaker pattern for RPC failures

## Prerequisites

- Node.js 20.x or higher
- MongoDB 4.4 or higher
- npm or yarn package manager

## Installation

1. Clone the repository:
```bash
git clone https://github.com/leoloco/fee-collector-indexer
cd fee-collector-indexer
```

2. Install dependencies:
```bash
npm install
```

## Setup

### 1. Configure MongoDB

You can run MongoDB locally using Docker:

```bash
# First time: Create and start the container
docker run -d -p 27017:27017 --name fee-collector-mongodb mongo:latest

# Subsequent times: Start the existing container
docker start fee-collector-mongodb

# To stop the container
docker stop fee-collector-mongodb

# To remove the container (if needed)
docker rm fee-collector-mongodb
```

Or use a MongoDB Atlas instance or any other MongoDB deployment.

### 2. Configure Environment Variables

Copy the example environment file and edit it with your configuration:

```bash
cp .env.example .env
```

Edit `.env` with your desired settings. 

**Important**: Each enabled chain requires:
- An RPC URL environment variable: `<CHAINNAME>_RPC`
- A configuration file in: `config/<chainname>/config.json`

### 3. Chain Configuration

Chain-specific settings are stored in `config/<chainname>/config.json`:

```json
{
  "chainId": 137,
  "contractAddress": "0xbD6C7B0d2f68c2b7805d88388319cfB6EcB50eA9",
  "startBlock": 77000000,
  "chunkSize": 10000,
  "finalityDepth": 128
}
```

Polygon configuration is included by default. To add more chains, create similar config files.

## Testing

### Run All Tests

```bash
npm test
```

This runs both unit and integration tests using mongodb-memory-server (no external MongoDB required).

## Running the Application

Build and run the indexer:

```bash
# Build TypeScript
npm run build

# Start the indexer
npm start
```

The indexer will:
1. Connect to MongoDB
2. Initialize indexers for all enabled chains
3. Start processing blocks from the configured start block (or resume from last processed block)
4. Run continuously, polling for new blocks every 10 seconds
5. Start the API server (if `API_ENABLED=true`)


### Graceful Shutdown

The application handles graceful shutdown on `SIGINT` (Ctrl+C) and `SIGTERM` signals:

```bash
# Stop the indexer
Ctrl+C
```

This will:
- Stop all running indexers
- Disconnect from MongoDB cleanly
- Save the last processed block state

## Using the API

Query events by integrator address:

```bash
curl -s "http://localhost:3000/api/events?integrator=0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE" | jq
```

## Monitoring

### Check Indexer Status

Connect to MongoDB and check the indexer state:

```javascript
// Connect to MongoDB
mongosh mongodb://localhost:27017/fee-collector

// Check last processed block for each chain
db.indexer_states.find()

// Count indexed events
db.fee_collected_events.countDocuments()

// View recent events
db.fee_collected_events.find().sort({blockNumber: -1}).limit(10)
```

### Logs

The application uses structured logging with configurable levels:

- `error`: Critical errors and circuit breaker alerts
- `warn`: Warning conditions (e.g., MongoDB disconnected)
- `info`: General operational messages (default)
- `debug`: Detailed debugging information

Set the `LOG_LEVEL` environment variable to control verbosity.

## Architecture

### Project Structure

```
/src
  /config          # Configuration loading and validation
  /models          # Typegoose MongoDB models
  /services        # Business logic (EventFetcher, EventStorage, IndexerOrchestrator)
  /types           # TypeScript type definitions
  /utils           # Helper utilities (logger)
  db.ts            # MongoDB connection management
  main.ts          # Main entry point

/tests
  /unit            # Unit tests with mocked dependencies
  /integration     # Integration tests with real blockchain/DB
  /setup           # Test configuration and setup utilities

/config
  /<chainname>     # Chain-specific configuration files
```

### Key Components

- **EventFetcher**: Fetches and parses events from blockchain using ethers.js
- **EventStorage**: Stores events in MongoDB with deduplication
- **IndexerOrchestrator**: Orchestrates the indexing process with retry logic and state management
- **Database Models**: Type-safe Typegoose models for events and indexer state
- **API**: REST endpoint to query events by integrator address 

## Troubleshooting

### RPC Rate Limiting

If you encounter RPC rate limiting:
1. Reduce `chunkSize` in the chain config file
2. Increase `pollInterval` in `src/main.ts`
3. Use a premium RPC endpoint with higher rate limits

### Circuit Breaker Alerts

When you see `[CIRCUIT_BREAKER_ALERT]` logs:
1. Check your RPC endpoint connectivity
2. Verify the block range mentioned in the alert
3. Manually backfill missed blocks if needed using a separate indexer instance with specific `startBlock` and `endBlock`
