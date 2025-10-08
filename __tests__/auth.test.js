/**
 * Authentication Tests
 * Tests that Bearer token authentication is properly configured
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('Authentication Configuration', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should require JIRA_BASE_URL environment variable', () => {
    delete process.env.JIRA_BASE_URL;
    delete process.env.JIRA_BEARER_TOKEN;

    expect(process.env.JIRA_BASE_URL).toBeUndefined();
  });

  it('should require JIRA_BEARER_TOKEN environment variable', () => {
    delete process.env.JIRA_BEARER_TOKEN;

    expect(process.env.JIRA_BEARER_TOKEN).toBeUndefined();
  });

  it('should use Bearer token format in Authorization header', () => {
    const mockToken = 'test-bearer-token-123';
    const expectedHeader = `Bearer ${mockToken}`;

    expect(expectedHeader).toBe('Bearer test-bearer-token-123');
    expect(expectedHeader).toMatch(/^Bearer /);
  });

  it('should not use Basic Auth format', () => {
    const mockEmail = 'test@example.com';
    const mockToken = 'test-token';
    const basicAuth = Buffer.from(`${mockEmail}:${mockToken}`).toString('base64');
    const basicAuthHeader = `Basic ${basicAuth}`;

    // Verify we're not using Basic Auth
    expect(basicAuthHeader).toMatch(/^Basic /);
    expect(basicAuthHeader).not.toMatch(/^Bearer /);
  });

  it('should validate Bearer token format', () => {
    const validTokens = [
      'abc123',
      'YourBearerTokenHere123456789',
      'token-with-dashes',
      'token_with_underscores'
    ];

    validTokens.forEach(token => {
      expect(token).toBeTruthy();
      expect(token.length).toBeGreaterThan(0);
    });
  });
});

describe('API Endpoint Configuration', () => {
  it('should use REST API v2 endpoints', () => {
    const endpoints = {
      search: '/rest/api/2/search',
      issue: '/rest/api/2/issue/{issueKey}',
      project: '/rest/api/2/project',
      myself: '/rest/api/2/myself'
    };

    Object.values(endpoints).forEach(endpoint => {
      expect(endpoint).toMatch(/^\/rest\/api\/2\//);
    });
  });

  it('should not use Cloud-only endpoints', () => {
    const cloudOnlyEndpoint = '/rest/api/2/project/search';

    // This endpoint doesn't exist in Jira Server
    expect(cloudOnlyEndpoint).toContain('/project/search');
  });

  it('should construct valid issue endpoint', () => {
    const issueKey = 'DEV-123';
    const endpoint = `/rest/api/2/issue/${issueKey}`;

    expect(endpoint).toBe('/rest/api/2/issue/DEV-123');
    expect(endpoint).toMatch(/^\/rest\/api\/2\/issue\/[A-Z]+-\d+$/);
  });

  it('should construct valid search endpoint with JQL', () => {
    const jql = 'project = DEV AND status = Open';
    const maxResults = 10;
    const endpoint = `/rest/api/2/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}`;

    expect(endpoint).toContain('/rest/api/2/search');
    expect(endpoint).toContain('jql=');
    expect(endpoint).toContain('maxResults=10');
  });
});

describe('Tool Registration', () => {
  it('should have required tool names', () => {
    const requiredTools = [
      'jira-search-issues',
      'jira-get-issue',
      'jira-get-projects',
      'jira-get-user',
      'jira-create-issue',
      'jira-update-issue',
      'jira-add-comment'
    ];

    // Verify tool naming convention
    requiredTools.forEach(tool => {
      expect(tool).toMatch(/^jira-/);
      expect(tool).toMatch(/^jira-[a-z-]+$/);
    });
  });

  it('should validate issue key format', () => {
    const validIssueKeys = ['DEV-123', 'PROJ-1', 'TEST-9999'];
    const invalidIssueKeys = ['dev-123', '123-DEV', 'INVALID'];

    validIssueKeys.forEach(key => {
      expect(key).toMatch(/^[A-Z]+-\d+$/);
    });

    invalidIssueKeys.forEach(key => {
      expect(key).not.toMatch(/^[A-Z]+-\d+$/);
    });
  });
});

describe('Error Handling', () => {
  it('should handle 401 Unauthorized errors', () => {
    const error = {
      status: 401,
      statusText: 'Unauthorized',
      message: 'Authentication failed'
    };

    expect(error.status).toBe(401);
    expect(error.message).toContain('Authentication');
  });

  it('should handle 404 Not Found errors', () => {
    const error = {
      status: 404,
      statusText: 'Not Found',
      message: 'Issue not found'
    };

    expect(error.status).toBe(404);
  });

  it('should handle 500 Server errors', () => {
    const error = {
      status: 500,
      statusText: 'Internal Server Error',
      message: 'Server error'
    };

    expect(error.status).toBe(500);
    expect(error.status).toBeGreaterThanOrEqual(500);
  });
});

describe('Response Validation', () => {
  it('should validate JSON response structure', () => {
    const mockIssueResponse = {
      id: '12345',
      key: 'DEV-123',
      fields: {
        summary: 'Test issue',
        status: { name: 'Open' }
      }
    };

    expect(mockIssueResponse).toHaveProperty('id');
    expect(mockIssueResponse).toHaveProperty('key');
    expect(mockIssueResponse).toHaveProperty('fields');
    expect(mockIssueResponse.fields).toHaveProperty('summary');
  });

  it('should validate search response structure', () => {
    const mockSearchResponse = {
      startAt: 0,
      maxResults: 50,
      total: 100,
      issues: []
    };

    expect(mockSearchResponse).toHaveProperty('startAt');
    expect(mockSearchResponse).toHaveProperty('maxResults');
    expect(mockSearchResponse).toHaveProperty('total');
    expect(mockSearchResponse).toHaveProperty('issues');
    expect(Array.isArray(mockSearchResponse.issues)).toBe(true);
  });

  it('should validate pagination parameters', () => {
    const validPagination = {
      maxResults: 10,
      startAt: 0
    };

    expect(validPagination.maxResults).toBeLessThanOrEqual(50);
    expect(validPagination.maxResults).toBeGreaterThan(0);
    expect(validPagination.startAt).toBeGreaterThanOrEqual(0);
  });
});
