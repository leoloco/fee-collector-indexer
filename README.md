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

**For Docker deployment:**
- Docker and Docker Compose
- A blockchain RPC endpoint (Alchemy, Infura, QuickNode, etc.)

**For local development:**
- Node.js 20.x or higher
- MongoDB 4.4 or higher (or Docker to run MongoDB)
- npm or yarn package manager
- A blockchain RPC endpoint (Alchemy, Infura, QuickNode, etc.)

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/leoloco/fee-collector-indexer
cd fee-collector-indexer
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your configuration (all variables are **REQUIRED**):

```bash
# MongoDB Configuration
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=<GENERATE_STRONG_PASSWORD>
MONGO_HOST=localhost              # Use 'localhost' for local, Docker handles this automatically
MONGO_PORT=27017
MONGO_DATABASE=fee-collector

# Chain Configuration (comma separated values of enabled chains)
ENABLED_CHAINS=polygon

# RPC Endpoint 
# CRITICAL 1: Replace with your API key
# CRITICAL 2: Each comma separated value of ENABLED_CHAINS MUST have a corresponding RPC
POLYGON_RPC=https://polygon-mainnet.g.alchemy.com/v2/YOUR_API_KEY

# API Configuration
PORT=3000
API_ENABLED=true

# Logging
LOG_LEVEL=info
```

**Chain Configuration**: Polygon is pre-configured in `config/polygon/config.json`. To add more chains, create similar config files and add them to `ENABLED_CHAINS` in `.env`. Don't forget to add a corresponding RPC for each enabled chain.

## Running the Application

Choose your deployment path:

---

## Path A: Docker Deployment (Recommended)

**Best for**: Production, quick setup, isolated environment

**Includes**: MongoDB + Application in containers

### Steps

After completing the Quick Start steps above, simply run:

```bash
# Build and start all services (MongoDB + App)
docker compose up -d

# View application logs
docker compose logs -f app

# Check service status
docker compose ps
```

**That's it!** Docker Compose automatically sets up MongoDB (with authentication and persistent storage) and the application.

### Stop the Services

```bash
# Stop and remove containers (preserves data in volumes)
docker compose down

# Stop and remove containers + volumes (deletes all data)
docker compose down -v
```

---

## Path B: Local Development

**Best for**: Development, testing, debugging

**Requires**: Node.js, npm, manual MongoDB setup

### Steps

#### 1. Install Dependencies

After completing the Quick Start steps, install npm dependencies:

```bash
npm install
```

#### 2. Set Up MongoDB

You need to set up MongoDB.

**MongoDB with Docker**

```bash
# Load environment variables from .env
source .env

# Start MongoDB container with authentication
docker run -d \
  --name fee-collector-mongodb \
  -p ${MONGO_PORT}:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=$MONGO_ROOT_USERNAME \
  -e MONGO_INITDB_ROOT_PASSWORD=$MONGO_ROOT_PASSWORD \
  -e MONGO_INITDB_DATABASE=$MONGO_DATABASE \
  mongo:7-jammy

# Subsequent times: Start the existing container
docker start fee-collector-mongodb

# To stop: 
docker stop fee-collector-mongodb
```

**Note**: For other MongoDB configurations (Atlas, local installation, etc.), refer to the [official MongoDB installation guide](https://docs.mongodb.com/manual/installation/) and update your `.env` accordingly.

#### 3. Build and Run

```bash
# Build TypeScript
npm run build

# Start the indexer
npm start
```

### Stop the services

The application handles graceful shutdown on `SIGINT` (Ctrl+C) and `SIGTERM` signals:

```bash
# Stop the indexer
Ctrl+C
```

This will:
- Stop all running indexers
- Disconnect from MongoDB cleanly
- Save the last processed block state

---

## Common Operations

### Run unit and integration tests

If you haven't done so make sure to install:

```bash
npm install
```

And then to run the test suite:
```bash
npm test
```

This runs both unit and integration tests using mongodb-memory-server (no external MongoDB required).


### Using the API

```bash
# Health check
curl http://localhost:3000/health

# Query events by integrator address
curl -s "http://localhost:3000/api/events?integrator=0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE" | jq
```

### Monitoring

#### Check Indexer Status

Connect to MongoDB and check the indexer state:

```bash
# For Docker deployment
docker compose exec mongodb mongosh -u admin -p YOUR_PASSWORD --authenticationDatabase admin fee-collector

# For local deployment
mongosh mongodb://admin:YOUR_PASSWORD@localhost:27017/fee-collector --authenticationDatabase admin
```

Once connected, run these commands:

```javascript
// Check last processed block for each chain
db.indexer_states.find()

// Count indexed events
db.fee_collected_events.countDocuments()

// View recent events
db.fee_collected_events.find().sort({blockNumber: -1}).limit(10)
```

#### Logs

The application uses structured logging with configurable levels:

- `error`: Critical errors and circuit breaker alerts
- `warn`: Warning conditions (e.g., MongoDB disconnected)
- `info`: General operational messages (default)
- `debug`: Detailed debugging information

Set the `LOG_LEVEL` environment variable to control verbosity.

## Architecture

### How the Indexer Works

When the indexer starts (via Docker or local deployment), it will:
1. Connect to MongoDB
2. Initialize indexers for all enabled chains
3. Start processing blocks from the configured start block (or resume from last processed block)
4. Run continuously, polling for new blocks every 10 seconds
5. Start the API server (if `API_ENABLED=true`)

### Project Structure

```
/src
  /api             # Express API server, routes, and middleware
  /config          # Configuration loading and validation
  /models          # Typegoose MongoDB models
  /services        # Business logic (EventFetcher, EventStorage, IndexerOrchestrator)
  /types           # TypeScript type definitions
  /utils           # Helper utilities (logger)
  db.ts            # MongoDB connection management
  main.ts          # Main entry point

/tests
  /integration     # Integration tests with real blockchain and in-memory MongoDB
  /unit            # Unit tests with mocked dependencies
  /setup           # Test database setup utilities

/config
  /<chainname>     # Chain-specific configuration files (e.g., /polygon)
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
