import dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'
import { ethers } from 'ethers'

// Load environment variables from .env file
dotenv.config()

/**
 * Chain-specific configuration (loaded from config/<chain>/config.json)
 */
export interface ChainConfig {
  chainId: number
  contractAddress: string
  startBlock: number
  chunkSize: number
  finalityDepth: number
}

/**
 * Configuration interface for the fee collector indexer
 */
export interface Config {
  // MongoDB configuration
  mongodbUri: string

  // Enabled chains
  enabledChains: string[]

  // Chain configurations (loaded from config/*.json)
  chains: Map<string, ChainConfig>

  // RPC URLs per chain (from environment variables)
  rpcUrls: Map<string, string>

  // API configuration
  api: {
    port: number
    enabled: boolean
  }

  // Logging configuration
  logLevel: string
}

/**
 * Validates that a required environment variable is present
 */
function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

/**
 * Parses a required integer from an environment variable with validation
 */
function requireIntEnv(key: string): number {
  const value = requireEnv(key)
  const parsed = parseInt(value, 10)
  if (isNaN(parsed)) {
    throw new Error(`${key} must be a valid integer`)
  }
  return parsed
}

/**
 * Parses a required boolean from an environment variable
 */
function requireBoolEnv(key: string): boolean {
  const value = requireEnv(key)
  const normalized = value.toLowerCase()
  if (normalized === 'true' || normalized === '1') {
    return true
  }
  if (normalized === 'false' || normalized === '0') {
    return false
  }
  throw new Error(`${key} must be 'true' or 'false'`)
}

/**
 * Validates Ethereum address format using ethers.js
 */
function validateAddress(address: string, fieldName: string): string {
  if (!ethers.utils.isAddress(address)) {
    throw new Error(
      `${fieldName} must be a valid Ethereum address (0x + 40 hex chars), got: ${address}`
    )
  }
  return address.toLowerCase()
}

/**
 * Loads chain configuration from JSON file
 */
function loadChainConfig(chainName: string): ChainConfig {
  const configPath = path.join(process.cwd(), 'config', chainName, 'config.json')

  if (!fs.existsSync(configPath)) {
    throw new Error(`Chain configuration file not found: ${configPath}`)
  }

  try {
    const fileContent = fs.readFileSync(configPath, 'utf-8')
    const config = JSON.parse(fileContent) as ChainConfig

    // Validate required fields
    if (typeof config.chainId !== 'number') {
      throw new Error(`${chainName}: chainId must be a number`)
    }
    if (typeof config.contractAddress !== 'string') {
      throw new Error(`${chainName}: contractAddress must be a string`)
    }
    if (typeof config.startBlock !== 'number') {
      throw new Error(`${chainName}: startBlock must be a number`)
    }
    if (typeof config.chunkSize !== 'number') {
      throw new Error(`${chainName}: chunkSize must be a number`)
    }
    if (typeof config.finalityDepth !== 'number') {
      throw new Error(`${chainName}: finalityDepth must be a number`)
    }

    // Validate and normalize contract address
    config.contractAddress = validateAddress(config.contractAddress, `${chainName}.contractAddress`)

    // Validate start block
    if (config.startBlock < 0) {
      throw new Error(`${chainName}: startBlock must be non-negative`)
    }

    // Validate chunk size
    if (config.chunkSize <= 0) {
      throw new Error(`${chainName}: chunkSize must be greater than 0`)
    }

    // Validate finality depth
    if (config.finalityDepth < 0) {
      throw new Error(`${chainName}: finalityDepth must be non-negative`)
    }

    return config
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`${chainName}: Invalid JSON in config file`)
    }
    throw error
  }
}

/**
 * Constructs MongoDB URI from individual components
 * This ensures consistent configuration across all deployment modes (local, Docker, production)
 */
function getMongoDbUri(): string {
  const username = requireEnv('MONGO_ROOT_USERNAME')
  const password = requireEnv('MONGO_ROOT_PASSWORD')
  const host = process.env.MONGO_HOST || 'localhost'
  const port = process.env.MONGO_PORT || '27017'
  const database = process.env.MONGO_DATABASE || 'fee-collector'

  // Construct MongoDB URI with authentication
  return `mongodb://${username}:${password}@${host}:${port}/${database}?authSource=admin`
}

export function loadConfig(): Config {
  try {
    // MongoDB configuration - construct from components
    const mongodbUri = getMongoDbUri()

    // Enabled chains
    const enabledChainsStr = requireEnv('ENABLED_CHAINS')
    const enabledChains = enabledChainsStr
      .split(',')
      .map(c => c.trim())
      .filter(c => c.length > 0)

    if (enabledChains.length === 0) {
      throw new Error('ENABLED_CHAINS must contain at least one chain')
    }

    // Load chain configurations from JSON files
    const chains = new Map<string, ChainConfig>()
    const rpcUrls = new Map<string, string>()

    for (const chainName of enabledChains) {
      // Load chain config from JSON
      const chainConfig = loadChainConfig(chainName)
      chains.set(chainName, chainConfig)

      // Load RPC URL from environment variable
      const rpcEnvVar = `${chainName.toUpperCase()}_RPC`
      const rpcUrl = requireEnv(rpcEnvVar)
      rpcUrls.set(chainName, rpcUrl)
    }

    // API configuration
    const port = requireIntEnv('PORT')
    if (port < 1 || port > 65535) {
      throw new Error('PORT must be between 1 and 65535')
    }

    const apiEnabled = requireBoolEnv('API_ENABLED')

    // Logging configuration
    const logLevel = requireEnv('LOG_LEVEL')
    const validLogLevels = ['error', 'warn', 'info', 'debug']
    if (!validLogLevels.includes(logLevel.toLowerCase())) {
      throw new Error(`LOG_LEVEL must be one of: ${validLogLevels.join(', ')}`)
    }

    return {
      mongodbUri,
      enabledChains,
      chains,
      rpcUrls,
      api: {
        port,
        enabled: apiEnabled,
      },
      logLevel: logLevel.toLowerCase(),
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Configuration error: ${error.message}`)
    }
    throw error
  }
}

/**
 * Singleton configuration instance
 * Loaded once when the module is first imported
 */
let configInstance: Config | null = null

/**
 * Gets the configuration instance
 * Loads configuration on first call
 */
export function getConfig(): Config {
  if (!configInstance) {
    configInstance = loadConfig()
  }
  return configInstance
}

/**
 * Resets the configuration instance (useful for testing)
 */
export function resetConfig(): void {
  configInstance = null
}

/**
 * Helper function to get chain configuration by name
 * Throws error if chain is not enabled or configured
 */
export function getChainConfig(chainName: string): ChainConfig & { rpcUrl: string } {
  const config = getConfig()
  const chainConfig = config.chains.get(chainName)
  const rpcUrl = config.rpcUrls.get(chainName)

  if (!chainConfig) {
    throw new Error(
      `Chain '${chainName}' is not configured. Available chains: ${Array.from(config.chains.keys()).join(', ')}`
    )
  }

  if (!rpcUrl) {
    throw new Error(`RPC URL for chain '${chainName}' is not configured`)
  }

  return {
    ...chainConfig,
    rpcUrl,
  }
}
