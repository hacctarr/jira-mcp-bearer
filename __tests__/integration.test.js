/**
 * Integration tests that actually import and test exported functions
 */

import { jest } from '@jest/globals';

describe('Exported Functions Integration Tests', () => {
  // Set NODE_ENV and mock environment before importing
  process.env.NODE_ENV = 'test';
  process.env.JIRA_BASE_URL = 'https://jira.test.com';
  process.env.JIRA_BEARER_TOKEN = 'test-token-123';

  let loadConfig, jiraRequest, isValidFilePath, HTTP_STATUS, REQUEST_TIMEOUT_MS;

  // Mock fetch globally
  global.fetch = jest.fn();

  beforeAll(async () => {
    // Dynamically import the module
    const module = await import('../index.js');
    loadConfig = module.loadConfig;
    jiraRequest = module.jiraRequest;
    isValidFilePath = module.isValidFilePath;
    HTTP_STATUS = module.HTTP_STATUS;
    REQUEST_TIMEOUT_MS = module.REQUEST_TIMEOUT_MS;
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

    test('should throw error on 502 Bad Gateway', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => ({})
      });

      await expect(jiraRequest('/rest/api/2/issue'))
        .rejects.toThrow('Jira server error (502)');
    });

    test('should throw error on 503 Service Unavailable', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({})
      });

      await expect(jiraRequest('/rest/api/2/issue'))
        .rejects.toThrow('Jira server error (503)');
    });

    test('should throw error on 504 Gateway Timeout', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 504,
        json: async () => ({})
      });

      await expect(jiraRequest('/rest/api/2/issue'))
        .rejects.toThrow('Jira server error (504)');
    });

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
  });
});
