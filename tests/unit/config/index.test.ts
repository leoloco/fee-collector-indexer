import { loadConfig, getConfig, resetConfig } from '../../../src/config'

describe('Configuration Loader', () => {
  const originalEnv = process.env

  beforeEach(() => {
    // Reset environment and config before each test
    jest.resetModules()
    // Start with a clean environment with required minimum env vars
    process.env = {
      MONGODB_URI: 'mongodb://localhost:27017/test',
      ENABLED_CHAINS: 'polygon,mockChain',
      POLYGON_RPC: 'https://polygon-rpc.com',
      MOCKCHAIN_RPC: 'http://localhost:8545',
      PORT: '3000',
      API_ENABLED: 'true',
      LOG_LEVEL: 'info',
    }
    resetConfig()
  })

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv
  })

  describe('loadConfig', () => {
    it('should load valid configuration', () => {
      const config = loadConfig()

      expect(config.mongodbUri).toBe('mongodb://localhost:27017/test')
      expect(config.enabledChains).toEqual(['polygon', 'mockChain'])

      // Chain config comes from JSON file
      const mockChainConfig = config.chains.get('mockChain')
      expect(mockChainConfig).toBeDefined()
      expect(mockChainConfig?.chainId).toBe(137)
      expect(mockChainConfig?.contractAddress).toBe('0xbd6c7b0d2f68c2b7805d88388319cfb6ecb50ea9')
      expect(mockChainConfig?.startBlock).toBe(77000000)
      expect(mockChainConfig?.chunkSize).toBe(10)
      expect(mockChainConfig?.finalityDepth).toBe(50)

      // RPC URL comes from env
      const mockChainRpc = config.rpcUrls.get('mockChain')
      expect(mockChainRpc).toBe('http://localhost:8545')

      expect(config.api.port).toBe(3000)
      expect(config.api.enabled).toBe(true)
      expect(config.logLevel).toBe('info')
    })

    it('should normalize addresses to lowercase from JSON', () => {
      // Addresses in config JSON are normalized to lowercase
      const config = loadConfig()
      const mockChainConfig = config.chains.get('mockChain')

      expect(mockChainConfig?.contractAddress).toBe('0xbd6c7b0d2f68c2b7805d88388319cfb6ecb50ea9')
      expect(mockChainConfig?.contractAddress).toMatch(/^0x[0-9a-f]{40}$/)
    })
  })

  describe('Required Fields Validation', () => {
    it('should throw error when MONGODB_URI is missing', () => {
      delete process.env.MONGODB_URI

      expect(() => loadConfig()).toThrow('Missing required environment variable: MONGODB_URI')
    })

    it('should throw error when ENABLED_CHAINS is missing', () => {
      delete process.env.ENABLED_CHAINS

      expect(() => loadConfig()).toThrow('Missing required environment variable: ENABLED_CHAINS')
    })

    it('should throw error when ENABLED_CHAINS is empty', () => {
      process.env.ENABLED_CHAINS = ''

      expect(() => loadConfig()).toThrow('Missing required environment variable: ENABLED_CHAINS')
    })

    it('should throw error when ENABLED_CHAINS contains only whitespace', () => {
      process.env.ENABLED_CHAINS = '   '

      expect(() => loadConfig()).toThrow('ENABLED_CHAINS must contain at least one chain')
    })

    it('should throw error when MOCKCHAIN_RPC is missing', () => {
      delete process.env.MOCKCHAIN_RPC

      expect(() => loadConfig()).toThrow('Missing required environment variable: MOCKCHAIN_RPC')
    })

    it('should throw error when PORT is missing', () => {
      delete process.env.PORT

      expect(() => loadConfig()).toThrow('Missing required environment variable: PORT')
    })

    it('should throw error when API_ENABLED is missing', () => {
      delete process.env.API_ENABLED

      expect(() => loadConfig()).toThrow('Missing required environment variable: API_ENABLED')
    })

    it('should throw error when LOG_LEVEL is missing', () => {
      delete process.env.LOG_LEVEL

      expect(() => loadConfig()).toThrow('Missing required environment variable: LOG_LEVEL')
    })
  })

  describe('Integer Parsing', () => {
    it('should parse integer PORT correctly', () => {
      process.env.PORT = '8080'

      const config = loadConfig()
      expect(config.api.port).toBe(8080)
    })
  })

  describe('Port Validation', () => {
    it('should reject port below valid range', () => {
      process.env.PORT = '0'

      expect(() => loadConfig()).toThrow('PORT must be between 1 and 65535')
    })

    it('should reject port above valid range', () => {
      process.env.PORT = '65536'

      expect(() => loadConfig()).toThrow('PORT must be between 1 and 65535')
    })

    it('should accept port 1', () => {
      process.env.PORT = '1'

      const config = loadConfig()
      expect(config.api.port).toBe(1)
    })

    it('should accept port 65535', () => {
      process.env.PORT = '65535'

      const config = loadConfig()
      expect(config.api.port).toBe(65535)
    })
  })

  describe('Boolean Parsing', () => {
    it('should parse "true" as true', () => {
      process.env.API_ENABLED = 'true'

      const config = loadConfig()
      expect(config.api.enabled).toBe(true)
    })

    it('should parse "TRUE" as true (case insensitive)', () => {
      process.env.API_ENABLED = 'TRUE'

      const config = loadConfig()
      expect(config.api.enabled).toBe(true)
    })

    it('should parse "1" as true', () => {
      process.env.API_ENABLED = '1'

      const config = loadConfig()
      expect(config.api.enabled).toBe(true)
    })

    it('should parse "false" as false', () => {
      process.env.API_ENABLED = 'false'

      const config = loadConfig()
      expect(config.api.enabled).toBe(false)
    })

    it('should parse "FALSE" as false (case insensitive)', () => {
      process.env.API_ENABLED = 'FALSE'

      const config = loadConfig()
      expect(config.api.enabled).toBe(false)
    })

    it('should parse "0" as false', () => {
      process.env.API_ENABLED = '0'

      const config = loadConfig()
      expect(config.api.enabled).toBe(false)
    })

    it('should reject invalid boolean values', () => {
      process.env.API_ENABLED = 'yes'

      expect(() => loadConfig()).toThrow("API_ENABLED must be 'true' or 'false'")
    })
  })

  describe('Log Level Validation', () => {
    it('should accept valid log levels', () => {
      const validLevels = ['error', 'warn', 'info', 'debug']

      validLevels.forEach(level => {
        process.env.LOG_LEVEL = level
        const config = loadConfig()
        expect(config.logLevel).toBe(level)
        resetConfig()
      })
    })

    it('should normalize log level to lowercase', () => {
      process.env.LOG_LEVEL = 'DEBUG'

      const config = loadConfig()
      expect(config.logLevel).toBe('debug')
    })

    it('should reject invalid log level', () => {
      process.env.LOG_LEVEL = 'invalid'

      expect(() => loadConfig()).toThrow('LOG_LEVEL must be one of: error, warn, info, debug')
    })
  })

  describe('getConfig Singleton', () => {
    it('should return the same instance on multiple calls', () => {
      const config1 = getConfig()
      const config2 = getConfig()

      expect(config1).toBe(config2)
    })

    it('should return new instance after resetConfig', () => {
      const config1 = getConfig()
      resetConfig()
      const config2 = getConfig()

      expect(config1).not.toBe(config2)
      expect(config1).toEqual(config2) // Same values, different objects
    })
  })
})
