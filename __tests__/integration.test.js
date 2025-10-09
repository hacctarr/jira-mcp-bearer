/**
 * Integration tests that actually import and test exported functions
 */

import { jest } from '@jest/globals';

describe('Exported Functions Integration Tests', () => {
  // Set NODE_ENV and mock environment before importing
  process.env.NODE_ENV = 'test';
  process.env.JIRA_BASE_URL = 'https://jira.test.com';
  process.env.JIRA_BEARER_TOKEN = 'test-token-123';

  let loadConfig, jiraRequest, isValidFilePath, getCached, sleep, HTTP_STATUS, REQUEST_TIMEOUT_MS, CACHE_TTL_MS, MAX_RETRIES, RETRY_DELAY_BASE_MS;

  // Mock fetch globally
  global.fetch = jest.fn();

  beforeAll(async () => {
    // Dynamically import the module
    const module = await import('../index.js');
    loadConfig = module.loadConfig;
    jiraRequest = module.jiraRequest;
    isValidFilePath = module.isValidFilePath;
    getCached = module.getCached;
    sleep = module.sleep;
    HTTP_STATUS = module.HTTP_STATUS;
    REQUEST_TIMEOUT_MS = module.REQUEST_TIMEOUT_MS;
    CACHE_TTL_MS = module.CACHE_TTL_MS;
    MAX_RETRIES = module.MAX_RETRIES;
    RETRY_DELAY_BASE_MS = module.RETRY_DELAY_BASE_MS;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('loadConfig', () => {
    test('should load config successfully', async () => {
      const config = await loadConfig();

      expect(config).toHaveProperty('baseUrl');
      expect(config).toHaveProperty('bearerToken');
      expect(typeof config.baseUrl).toBe('string');
      expect(typeof config.bearerToken).toBe('string');
      expect(config.baseUrl).toMatch(/^https?:\/\//);
    });

    test('should return config object with correct structure', async () => {
      const config = await loadConfig();

      expect(typeof config.baseUrl).toBe('string');
      expect(typeof config.bearerToken).toBe('string');
      expect(config.baseUrl.length).toBeGreaterThan(0);
      expect(config.bearerToken.length).toBeGreaterThan(0);
    });
  });

  describe('isValidFilePath', () => {
    test('should accept relative paths within current directory', () => {
      expect(isValidFilePath('./test.txt')).toBe(true);
      expect(isValidFilePath('test.txt')).toBe(true);
      expect(isValidFilePath('./subfolder/test.txt')).toBe(true);
    });

    test('should reject path traversal attempts', () => {
      expect(isValidFilePath('../outside.txt')).toBe(false);
      expect(isValidFilePath('../../etc/passwd')).toBe(false);
      expect(isValidFilePath('/etc/passwd')).toBe(false);
    });

    test('should accept absolute paths within current directory', () => {
      const cwd = process.cwd();
      expect(isValidFilePath(`${cwd}/test.txt`)).toBe(true);
      expect(isValidFilePath(`${cwd}/subfolder/test.txt`)).toBe(true);
    });
  });

  describe('HTTP_STATUS constants', () => {
    test('should have correct HTTP status codes', () => {
      expect(HTTP_STATUS.UNAUTHORIZED).toBe(401);
      expect(HTTP_STATUS.FORBIDDEN).toBe(403);
      expect(HTTP_STATUS.NOT_FOUND).toBe(404);
      expect(HTTP_STATUS.TOO_MANY_REQUESTS).toBe(429);
      expect(HTTP_STATUS.INTERNAL_SERVER_ERROR).toBe(500);
      expect(HTTP_STATUS.BAD_GATEWAY).toBe(502);
      expect(HTTP_STATUS.SERVICE_UNAVAILABLE).toBe(503);
      expect(HTTP_STATUS.GATEWAY_TIMEOUT).toBe(504);
    });

    test('should export all expected status codes', () => {
      expect(Object.keys(HTTP_STATUS)).toEqual([
        'UNAUTHORIZED',
        'FORBIDDEN',
        'NOT_FOUND',
        'TOO_MANY_REQUESTS',
        'INTERNAL_SERVER_ERROR',
        'BAD_GATEWAY',
        'SERVICE_UNAVAILABLE',
        'GATEWAY_TIMEOUT'
      ]);
    });
  });

  describe('REQUEST_TIMEOUT_MS constant', () => {
    test('should be 30 seconds', () => {
      expect(REQUEST_TIMEOUT_MS).toBe(30000);
    });

    test('should be a positive number', () => {
      expect(typeof REQUEST_TIMEOUT_MS).toBe('number');
      expect(REQUEST_TIMEOUT_MS).toBeGreaterThan(0);
    });
  });

  describe('jiraRequest', () => {
    test('should make successful API request', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: '123', key: 'DEV-123' })
      });

      const result = await jiraRequest('/rest/api/2/issue/DEV-123');

      expect(result).toEqual({ id: '123', key: 'DEV-123' });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/rest/api/2/issue/DEV-123'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': expect.stringContaining('Bearer'),
            'Content-Type': 'application/json',
            'User-Agent': 'jira-mcp-bearer/1.0.0'
          })
        })
      );
    });

    test('should handle 204 No Content response', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 204
      });

      const result = await jiraRequest('/rest/api/2/issue/DEV-123');

      expect(result).toBeNull();
    });

    test('should throw error on 401 Unauthorized', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({})
      });

      await expect(jiraRequest('/rest/api/2/issue/DEV-123'))
        .rejects.toThrow('Authentication failed');
    });

    test('should throw error on 403 Forbidden', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({})
      });

      await expect(jiraRequest('/rest/api/2/issue/DEV-123'))
        .rejects.toThrow('Permission denied');
    });

    test('should throw error on 404 Not Found', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({})
      });

      await expect(jiraRequest('/rest/api/2/issue/DEV-999'))
        .rejects.toThrow('Resource not found');
    });

    test('should throw error on 429 Rate Limit', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({})
      });

      await expect(jiraRequest('/rest/api/2/search'))
        .rejects.toThrow('Rate limit exceeded');
    });

    test('should throw error on 500 Internal Server Error', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({})
      });

      await expect(jiraRequest('/rest/api/2/issue'))
        .rejects.toThrow('Jira server error (500)');
    });

    test('should throw error on 502 Bad Gateway after retries', async () => {
      // Mock 4 failures (initial + 3 retries)
      for (let i = 0; i < 4; i++) {
        global.fetch.mockResolvedValueOnce({
          ok: false,
          status: 502,
          json: async () => ({})
        });
      }

      await expect(jiraRequest('/rest/api/2/issue'))
        .rejects.toThrow('Jira server error (502)');
    }, 10000);

    test('should throw error on 503 Service Unavailable after retries', async () => {
      // Mock 4 failures (initial + 3 retries)
      for (let i = 0; i < 4; i++) {
        global.fetch.mockResolvedValueOnce({
          ok: false,
          status: 503,
          json: async () => ({})
        });
      }

      await expect(jiraRequest('/rest/api/2/issue'))
        .rejects.toThrow('Jira server error (503)');
    }, 10000);

    test('should throw error on 504 Gateway Timeout after retries', async () => {
      // Mock 4 failures (initial + 3 retries)
      for (let i = 0; i < 4; i++) {
        global.fetch.mockResolvedValueOnce({
          ok: false,
          status: 504,
          json: async () => ({})
        });
      }

      await expect(jiraRequest('/rest/api/2/issue'))
        .rejects.toThrow('Jira server error (504)');
    }, 10000);

    test('should include Jira error details in error message', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          errorMessages: ['Field summary is required', 'Invalid project key']
        })
      });

      await expect(jiraRequest('/rest/api/2/issue'))
        .rejects.toThrow('Field summary is required, Invalid project key');
    });

    test('should handle timeout with AbortError', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';

      global.fetch.mockRejectedValueOnce(abortError);

      await expect(jiraRequest('/rest/api/2/issue/DEV-123'))
        .rejects.toThrow('Request timeout');
    });

    test('should pass through other errors', async () => {
      const networkError = new Error('Network failure');

      global.fetch.mockRejectedValueOnce(networkError);

      await expect(jiraRequest('/rest/api/2/issue/DEV-123'))
        .rejects.toThrow('Network failure');
    });

    test('should retry on 502 Bad Gateway', async () => {
      // First attempt fails with 502, second succeeds
      global.fetch
        .mockResolvedValueOnce({
          ok: false,
          status: 502,
          json: async () => ({})
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ id: '123', key: 'DEV-123' })
        });

      const result = await jiraRequest('/rest/api/2/issue/DEV-123');

      expect(result).toEqual({ id: '123', key: 'DEV-123' });
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    test('should retry on 503 Service Unavailable', async () => {
      // First attempt fails with 503, second succeeds
      global.fetch
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          json: async () => ({})
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ id: '123', key: 'DEV-123' })
        });

      const result = await jiraRequest('/rest/api/2/issue/DEV-123');

      expect(result).toEqual({ id: '123', key: 'DEV-123' });
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    test('should retry on 504 Gateway Timeout', async () => {
      // First attempt fails with 504, second succeeds
      global.fetch
        .mockResolvedValueOnce({
          ok: false,
          status: 504,
          json: async () => ({})
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ id: '123', key: 'DEV-123' })
        });

      const result = await jiraRequest('/rest/api/2/issue/DEV-123');

      expect(result).toEqual({ id: '123', key: 'DEV-123' });
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    test('should exhaust retries and throw error', async () => {
      // All 4 attempts (initial + 3 retries) fail with 502
      for (let i = 0; i < 4; i++) {
        global.fetch.mockResolvedValueOnce({
          ok: false,
          status: 502,
          json: async () => ({})
        });
      }

      await expect(jiraRequest('/rest/api/2/issue/DEV-123'))
        .rejects.toThrow('Jira server error (502)');

      expect(global.fetch).toHaveBeenCalledTimes(4); // Initial + 3 retries
    }, 10000); // Increase timeout for retries with delays

    test('should not retry on 404 Not Found', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({})
      });

      await expect(jiraRequest('/rest/api/2/issue/DEV-999'))
        .rejects.toThrow('Resource not found');

      expect(global.fetch).toHaveBeenCalledTimes(1); // No retry
    });
  });

  describe('sleep utility', () => {
    test('should wait for specified milliseconds', async () => {
      const start = Date.now();
      await sleep(100);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(90); // Allow some timing variance
      expect(elapsed).toBeLessThan(150);
    });
  });

  describe('getCached utility', () => {
    test('should cache data and return from cache on second call', async () => {
      let callCount = 0;
      const fetchFn = jest.fn(async () => {
        callCount++;
        return { data: `call-${callCount}` };
      });

      const result1 = await getCached('test-key', fetchFn, 1000);
      const result2 = await getCached('test-key', fetchFn, 1000);

      expect(result1).toEqual({ data: 'call-1' });
      expect(result2).toEqual({ data: 'call-1' }); // Same data from cache
      expect(fetchFn).toHaveBeenCalledTimes(1); // Only called once
    });

    test('should re-fetch data after TTL expires', async () => {
      let callCount = 0;
      const fetchFn = jest.fn(async () => {
        callCount++;
        return { data: `call-${callCount}` };
      });

      const result1 = await getCached('test-key-ttl', fetchFn, 50);
      await sleep(60); // Wait for TTL to expire
      const result2 = await getCached('test-key-ttl', fetchFn, 50);

      expect(result1).toEqual({ data: 'call-1' });
      expect(result2).toEqual({ data: 'call-2' }); // Fresh data after TTL
      expect(fetchFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('New constants', () => {
    test('should have CACHE_TTL_MS constant', () => {
      expect(CACHE_TTL_MS).toBe(5 * 60 * 1000); // 5 minutes
      expect(typeof CACHE_TTL_MS).toBe('number');
    });

    test('should have MAX_RETRIES constant', () => {
      expect(MAX_RETRIES).toBe(3);
      expect(typeof MAX_RETRIES).toBe('number');
    });

    test('should have RETRY_DELAY_BASE_MS constant', () => {
      expect(RETRY_DELAY_BASE_MS).toBe(1000);
      expect(typeof RETRY_DELAY_BASE_MS).toBe('number');
    });
  });

  describe('DEBUG mode logging', () => {
    let originalDebug;

    beforeEach(() => {
      originalDebug = process.env.DEBUG;
      process.env.DEBUG = 'true';
    });

    afterEach(() => {
      if (originalDebug) {
        process.env.DEBUG = originalDebug;
      } else {
        delete process.env.DEBUG;
      }
    });

    test('should log debug info for cache hit', async () => {
      const fetchFn = jest.fn(async () => ({ data: 'test' }));

      await getCached('debug-test', fetchFn, 1000);
      const result2 = await getCached('debug-test', fetchFn, 1000);

      expect(result2).toEqual({ data: 'test' });
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    test('should log debug info for API requests', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: '123', key: 'DEV-123' })
      });

      const result = await jiraRequest('/rest/api/2/issue/DEV-123');

      expect(result).toEqual({ id: '123', key: 'DEV-123' });
    });

    test('should log debug info for retries', async () => {
      global.fetch
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          json: async () => ({})
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ id: '123' })
        });

      const result = await jiraRequest('/rest/api/2/issue/DEV-123');

      expect(result).toEqual({ id: '123' });
    });

    test('should log debug info with request body', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: '123', key: 'DEV-123' })
      });

      const result = await jiraRequest('/rest/api/2/issue', {
        method: 'POST',
        body: JSON.stringify({ summary: 'Test' })
      });

      expect(result).toEqual({ id: '123', key: 'DEV-123' });
    });
  });
});
