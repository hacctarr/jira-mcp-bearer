#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve, basename } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Constants
const HTTP_STATUS = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504
};

const REQUEST_TIMEOUT_MS = 30000; // 30 seconds
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes for static data
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE_MS = 1000; // Exponential backoff base delay

// Simple in-memory cache for static data
const cache = new Map();

/**
 * Cache wrapper with TTL support
 * @param {string} key - Cache key
 * @param {Function} fetchFn - Function to fetch data if not cached
 * @param {number} ttl - Time to live in milliseconds
 * @returns {Promise<any>} Cached or fresh data
 */
async function getCached(key, fetchFn, ttl = CACHE_TTL_MS) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < ttl) {
    if (process.env.DEBUG === 'true') {
      console.error(`[CACHE HIT] ${key}`);
    }
    return cached.data;
  }

  if (process.env.DEBUG === 'true') {
    console.error(`[CACHE MISS] ${key}`);
  }

  const data = await fetchFn();
  cache.set(key, { data, timestamp: Date.now() });
  return data;
}

/**
 * Sleep utility for retry delays
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Validation schemas
const issueKeySchema = z.string().regex(
  /^[A-Z]+-\d+$/,
  'Invalid issue key format. Must be uppercase letters, hyphen, then numbers (e.g., DEV-123)'
);

const projectKeySchema = z.string().regex(
  /^[A-Z]+$/,
  'Invalid project key format. Must be uppercase letters only (e.g., DEV, PROJ)'
);

const jqlSchema = z.string().min(1, 'JQL query cannot be empty');

const summarySchema = z.string().min(1, 'Summary cannot be empty').max(255, 'Summary too long (max 255 characters)');

const maxResultsSchema = z.number().int().min(1).max(50, 'Maximum 50 results allowed');

/**
 * Validates file path to prevent path traversal attacks
 * @param {string} filePath - Path to validate
 * @returns {boolean} True if path is safe
 */
function isValidFilePath(filePath) {
  const resolved = resolve(filePath);
  const cwd = resolve(process.cwd());
  return resolved.startsWith(cwd);
}

/**
 * Load configuration from config.json or environment variables
 * Priority: config.json > environment variables
 * @returns {Promise<{baseUrl: string, bearerToken: string}>} Configuration object
 */
async function loadConfig() {
  const configPath = join(__dirname, 'config.json');

  // Try to load from config.json first
  if (existsSync(configPath)) {
    try {
      const configData = await readFile(configPath, 'utf8');
      const config = JSON.parse(configData);
      if (config.jira?.baseUrl && config.jira?.bearerToken) {
        return {
          baseUrl: config.jira.baseUrl,
          bearerToken: config.jira.bearerToken
        };
      }
    } catch (error) {
      console.error('Warning: Failed to read config.json:', error.message);
    }
  }

  // Fallback to environment variables
  if (process.env.JIRA_BASE_URL && process.env.JIRA_BEARER_TOKEN) {
    return {
      baseUrl: process.env.JIRA_BASE_URL,
      bearerToken: process.env.JIRA_BEARER_TOKEN
    };
  }

  // No configuration found
  console.error('Error: Jira credentials not configured.');
  console.error('\nPlease either:');
  console.error('1. Run setup: ./setup.js');
  console.error('2. Set environment variables: JIRA_BASE_URL and JIRA_BEARER_TOKEN');
  process.exit(1);
}

const config = await loadConfig();
const JIRA_BASE_URL = config.baseUrl;
const JIRA_BEARER_TOKEN = config.bearerToken;

/**
 * Makes authenticated request to Jira REST API with timeout and retry logic
 * @param {string} endpoint - API endpoint path (e.g., '/rest/api/2/issue/DEV-123')
 * @param {Object} options - Fetch options
 * @param {number} retries - Number of retries remaining (default: MAX_RETRIES)
 * @returns {Promise<Object|null>} Parsed JSON response or null for 204 responses
 * @throws {Error} On HTTP errors with specific messages or timeout
 */
async function jiraRequest(endpoint, options = {}, retries = MAX_RETRIES) {
  const url = `${JIRA_BASE_URL}${endpoint}`;

  // Debug logging
  if (process.env.DEBUG === 'true') {
    console.error(`[${options.method || 'GET'}] ${url}`);
    if (options.body) {
      console.error(`[BODY] ${options.body}`);
    }
  }

  // Set up abort controller for timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${JIRA_BEARER_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'jira-mcp-bearer/1.0.0',
        ...options.headers,
      },
    });

    if (!response.ok) {
      // Specific error messages based on status code
      let errorMessage;
      const isRetryable = [
        HTTP_STATUS.BAD_GATEWAY,
        HTTP_STATUS.SERVICE_UNAVAILABLE,
        HTTP_STATUS.GATEWAY_TIMEOUT
      ].includes(response.status);

      switch (response.status) {
        case HTTP_STATUS.UNAUTHORIZED:
          errorMessage = 'Authentication failed. Your Bearer token is invalid or expired.';
          break;
        case HTTP_STATUS.FORBIDDEN:
          errorMessage = 'Permission denied. Your Bearer token does not have access to this resource.';
          break;
        case HTTP_STATUS.NOT_FOUND:
          errorMessage = 'Resource not found. Check that the issue key, project key, or endpoint is correct.';
          break;
        case HTTP_STATUS.TOO_MANY_REQUESTS:
          errorMessage = 'Rate limit exceeded. Please wait before making more requests.';
          break;
        case HTTP_STATUS.INTERNAL_SERVER_ERROR:
        case HTTP_STATUS.BAD_GATEWAY:
        case HTTP_STATUS.SERVICE_UNAVAILABLE:
        case HTTP_STATUS.GATEWAY_TIMEOUT:
          errorMessage = `Jira server error (${response.status}). The server may be temporarily unavailable.`;
          break;
        default:
          errorMessage = `Jira API error: ${response.status} ${response.statusText}`;
      }

      // Try to get more details from response body
      try {
        const errorBody = await response.json();
        if (errorBody.errorMessages && errorBody.errorMessages.length > 0) {
          errorMessage += `\nDetails: ${errorBody.errorMessages.join(', ')}`;
        }
      } catch {
        // Ignore JSON parse errors
      }

      // Retry logic for transient errors
      if (isRetryable && retries > 0) {
        const delay = RETRY_DELAY_BASE_MS * (MAX_RETRIES - retries + 1);
        if (process.env.DEBUG === 'true') {
          console.error(`[RETRY] ${response.status} error, retrying in ${delay}ms (${retries} retries left)`);
        }
        await sleep(delay);
        return jiraRequest(endpoint, options, retries - 1);
      }

      console.error(`Jira API error for ${endpoint}:`, errorMessage);
      const error = new Error(errorMessage);
      error.status = response.status;
      throw error;
    }

    if (response.status === 204) {
      return null;
    }

    const data = await response.json();

    if (process.env.DEBUG === 'true') {
      console.error(`[RESPONSE] ${response.status} - ${JSON.stringify(data).length} bytes`);
    }

    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error(`Request timeout for ${endpoint} after ${REQUEST_TIMEOUT_MS}ms`);
      throw new Error(`Request timeout: The request took longer than ${REQUEST_TIMEOUT_MS / 1000} seconds`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/* istanbul ignore next */
async function main() {
  try {
    // Create MCP server
    const mcpServer = new McpServer({
      name: 'jira-bearer-auth',
      version: '1.0.0'
    }, {
      capabilities: {
        tools: {}
      }
    });

    // Register search-issues tool
    mcpServer.registerTool('jira-search-issues', {
      description: 'Search for Jira issues using JQL (Jira Query Language)',
      inputSchema: {
        jql: jqlSchema.describe('JQL query string (e.g., "project = CORE AND status = Open")'),
        maxResults: maxResultsSchema.optional().default(50).describe('Maximum number of results to return (max 50)'),
        startAt: z.number().int().min(0).optional().default(0).describe('Starting index for pagination (default: 0)'),
        fields: z.array(z.string()).optional().describe('Optional array of field names to return (e.g., ["summary", "status", "assignee"]). If omitted, returns all fields.')
      }
    }, async ({ jql, maxResults, startAt, fields }) => {
      try {
        let endpoint = `/rest/api/2/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}&startAt=${startAt}`;
        if (fields && fields.length > 0) {
          endpoint += `&fields=${fields.join(',')}`;
        }
        const data = await jiraRequest(endpoint);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`
            }
          ],
          isError: true
        };
      }
    });

    // Register get-issue tool
    mcpServer.registerTool('jira-get-issue', {
      description: 'Get details of a specific Jira issue',
      inputSchema: {
        issueKey: issueKeySchema.describe('Issue key (e.g., "DEV-123")'),
        fields: z.array(z.string()).optional().describe('Optional array of field names to return (e.g., ["summary", "status", "assignee"]). If omitted, returns all fields.')
      }
    }, async ({ issueKey, fields }) => {
      try {
        let endpoint = `/rest/api/2/issue/${issueKey}`;
        if (fields && fields.length > 0) {
          endpoint += `?fields=${fields.join(',')}`;
        }
        const data = await jiraRequest(endpoint);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`
            }
          ],
          isError: true
        };
      }
    });

    // Register get-user tool
    mcpServer.registerTool('jira-get-user', {
      description: 'Get details of a Jira user. Omit username to get current authenticated user.',
      inputSchema: {
        username: z.string().optional().describe('Username to lookup (omit for current user)')
      }
    }, async ({ username }) => {
      try {
        const endpoint = username
          ? `/rest/api/2/user?username=${encodeURIComponent(username)}`
          : '/rest/api/2/myself';

        const data = await jiraRequest(endpoint);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`
            }
          ],
          isError: true
        };
      }
    });

    // Register get-custom-fields tool
    mcpServer.registerTool('jira-get-custom-fields', {
      description: 'Get all custom field definitions from Jira. Returns field ID, name, and schema information. Cached for 5 minutes.',
      inputSchema: {}
    }, async () => {
      try {
        const data = await getCached('custom-fields', async () => {
          const fields = await jiraRequest('/rest/api/2/field');
          return fields.filter(field => field.custom);
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`
            }
          ],
          isError: true
        };
      }
    });

    // Register get-project-details tool
    mcpServer.registerTool('jira-get-project-details', {
      description: 'Get detailed information about a specific Jira project',
      inputSchema: {
        projectKey: z.string().describe('Project key (e.g., "DEV", "CORE")')
      }
    }, async ({ projectKey }) => {
      try {
        const data = await jiraRequest(`/rest/api/2/project/${encodeURIComponent(projectKey)}`);

        // Extract only essential fields to minimize response size
        const summary = {
          key: data.key,
          name: data.name,
          description: data.description,
          lead: data.lead?.displayName || data.lead?.name,
          projectTypeKey: data.projectTypeKey,
          archived: data.archived,
          componentCount: data.components?.length || 0,
          versionCount: data.versions?.length || 0,
          issueTypeCount: data.issueTypes?.length || 0,
          components: data.components?.slice(0, 10).map(c => `${c.name}${c.description ? ': ' + c.description : ''}`),
          issueTypes: data.issueTypes?.map(t => t.name)
        };

        if (data.components?.length > 10) {
          summary.components.push(`... and ${data.components.length - 10} more components`);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(summary, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`
            }
          ],
          isError: true
        };
      }
    });

    // Register get-issue-comments tool
    mcpServer.registerTool('jira-get-issue-comments', {
      description: 'Get all comments for a specific Jira issue',
      inputSchema: {
        issueKey: z.string().describe('Issue key (e.g., "DEV-123")')
      }
    }, async ({ issueKey }) => {
      try {
        const data = await jiraRequest(`/rest/api/2/issue/${encodeURIComponent(issueKey)}/comment`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`
            }
          ],
          isError: true
        };
      }
    });

    // Register list-issue-types tool
    mcpServer.registerTool('jira-list-issue-types', {
      description: 'Get list of all available issue types in Jira (Bug, Story, Task, etc.). Cached for 5 minutes.',
      inputSchema: {}
    }, async () => {
      try {
        const data = await getCached('issue-types', async () => {
          return await jiraRequest('/rest/api/2/issuetype');
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`
            }
          ],
          isError: true
        };
      }
    });

    // Register create-issue tool
    mcpServer.registerTool('jira-create-issue', {
      description: 'Create a new Jira issue',
      inputSchema: {
        projectKey: projectKeySchema.describe('Project key (e.g., "DEV")'),
        issueType: z.string().min(1).describe('Issue type name (e.g., "Bug", "Story", "Task")'),
        summary: summarySchema.describe('Issue summary/title (max 255 characters)'),
        description: z.string().optional().describe('Issue description'),
        fields: z.record(z.any()).optional().describe('Additional custom fields as JSON object')
      }
    }, async ({ projectKey, issueType, summary, description, fields = {} }) => {
      try {
        const issueData = {
          fields: {
            project: { key: projectKey },
            issuetype: { name: issueType },
            summary,
            ...fields
          }
        };

        if (description) {
          issueData.fields.description = description;
        }

        const data = await jiraRequest('/rest/api/2/issue', {
          method: 'POST',
          body: JSON.stringify(issueData)
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`
            }
          ],
          isError: true
        };
      }
    });

    // Register update-issue tool
    mcpServer.registerTool('jira-update-issue', {
      description: 'Update an existing Jira issue',
      inputSchema: {
        issueKey: z.string().describe('Issue key (e.g., "DEV-123")'),
        summary: z.string().optional().describe('Updated summary/title'),
        description: z.string().optional().describe('Updated description'),
        fields: z.record(z.any()).optional().describe('Additional fields to update as JSON object')
      }
    }, async ({ issueKey, summary, description, fields = {} }) => {
      try {
        const updateData = { fields: { ...fields } };

        if (summary) {
          updateData.fields.summary = summary;
        }

        if (description) {
          updateData.fields.description = description;
        }

        await jiraRequest(`/rest/api/2/issue/${encodeURIComponent(issueKey)}`, {
          method: 'PUT',
          body: JSON.stringify(updateData)
        });

        return {
          content: [
            {
              type: 'text',
              text: `Issue ${issueKey} updated successfully`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`
            }
          ],
          isError: true
        };
      }
    });

    // Register add-comment tool
    mcpServer.registerTool('jira-add-comment', {
      description: 'Add a comment to a Jira issue',
      inputSchema: {
        issueKey: z.string().describe('Issue key (e.g., "DEV-123")'),
        body: z.string().describe('Comment text')
      }
    }, async ({ issueKey, body }) => {
      try {
        const data = await jiraRequest(`/rest/api/2/issue/${encodeURIComponent(issueKey)}/comment`, {
          method: 'POST',
          body: JSON.stringify({ body })
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`
            }
          ],
          isError: true
        };
      }
    });

    // Register list-statuses tool
    mcpServer.registerTool('jira-list-statuses', {
      description: 'Get list of all available issue statuses in Jira. Cached for 5 minutes.',
      inputSchema: {}
    }, async () => {
      try {
        const data = await getCached('statuses', async () => {
          return await jiraRequest('/rest/api/2/status');
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`
            }
          ],
          isError: true
        };
      }
    });

    // Register get-issue-transitions tool
    mcpServer.registerTool('jira-get-issue-transitions', {
      description: 'Get available transitions for a Jira issue (to see what status changes are possible)',
      inputSchema: {
        issueKey: z.string().describe('Issue key (e.g., "DEV-123")')
      }
    }, async ({ issueKey }) => {
      try {
        const data = await jiraRequest(`/rest/api/2/issue/${encodeURIComponent(issueKey)}/transitions`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`
            }
          ],
          isError: true
        };
      }
    });

    // Register transition-issue tool
    mcpServer.registerTool('jira-transition-issue', {
      description: 'Transition a Jira issue to a new status. Use get_issue_transitions first to see available transitions.',
      inputSchema: {
        issueKey: z.string().describe('Issue key (e.g., "DEV-123")'),
        transitionId: z.string().describe('Transition ID (get from get_issue_transitions)')
      }
    }, async ({ issueKey, transitionId }) => {
      try {
        await jiraRequest(`/rest/api/2/issue/${encodeURIComponent(issueKey)}/transitions`, {
          method: 'POST',
          body: JSON.stringify({ transition: { id: transitionId } })
        });

        return {
          content: [
            {
              type: 'text',
              text: `Issue ${issueKey} transitioned successfully`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`
            }
          ],
          isError: true
        };
      }
    });

    // Register assign-issue tool
    mcpServer.registerTool('jira-assign-issue', {
      description: 'Assign a Jira issue to a user, or unassign it',
      inputSchema: {
        issueKey: z.string().describe('Issue key (e.g., "DEV-123")'),
        username: z.string().optional().describe('Username to assign (omit or use "-1" to unassign)')
      }
    }, async ({ issueKey, username }) => {
      try {
        const assignData = { name: username === '-1' ? null : username };

        await jiraRequest(`/rest/api/2/issue/${encodeURIComponent(issueKey)}/assignee`, {
          method: 'PUT',
          body: JSON.stringify(assignData)
        });

        const action = username && username !== '-1' ? `assigned to ${username}` : 'unassigned';
        return {
          content: [
            {
              type: 'text',
              text: `Issue ${issueKey} ${action} successfully`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`
            }
          ],
          isError: true
        };
      }
    });

    // Register add-watcher tool
    mcpServer.registerTool('jira-add-watcher', {
      description: 'Add a user as a watcher to a Jira issue',
      inputSchema: {
        issueKey: z.string().describe('Issue key (e.g., "DEV-123")'),
        username: z.string().describe('Username to add as watcher')
      }
    }, async ({ issueKey, username }) => {
      try {
        await jiraRequest(`/rest/api/2/issue/${encodeURIComponent(issueKey)}/watchers`, {
          method: 'POST',
          body: JSON.stringify(username)
        });

        return {
          content: [
            {
              type: 'text',
              text: `User ${username} added as watcher to issue ${issueKey}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`
            }
          ],
          isError: true
        };
      }
    });

    // Register remove-watcher tool
    mcpServer.registerTool('jira-remove-watcher', {
      description: 'Remove a user as a watcher from a Jira issue',
      inputSchema: {
        issueKey: z.string().describe('Issue key (e.g., "DEV-123")'),
        username: z.string().describe('Username to remove as watcher')
      }
    }, async ({ issueKey, username }) => {
      try {
        await jiraRequest(`/rest/api/2/issue/${encodeURIComponent(issueKey)}/watchers?username=${encodeURIComponent(username)}`, {
          method: 'DELETE'
        });

        return {
          content: [
            {
              type: 'text',
              text: `User ${username} removed as watcher from issue ${issueKey}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`
            }
          ],
          isError: true
        };
      }
    });

    // Register link-issues tool
    mcpServer.registerTool('jira-link-issues', {
      description: 'Create a link between two Jira issues',
      inputSchema: {
        type: z.string().describe('Link type name (e.g., "Blocks", "Relates", "Duplicates")'),
        inwardIssue: z.string().describe('Inward issue key (e.g., "DEV-123")'),
        outwardIssue: z.string().describe('Outward issue key (e.g., "DEV-456")')
      }
    }, async ({ type, inwardIssue, outwardIssue }) => {
      try {
        const linkData = {
          type: { name: type },
          inwardIssue: { key: inwardIssue },
          outwardIssue: { key: outwardIssue }
        };

        await jiraRequest('/rest/api/2/issueLink', {
          method: 'POST',
          body: JSON.stringify(linkData)
        });

        return {
          content: [
            {
              type: 'text',
              text: `Successfully created ${type} link between ${inwardIssue} and ${outwardIssue}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`
            }
          ],
          isError: true
        };
      }
    });

    // Register upload-attachment tool
    mcpServer.registerTool('jira-upload-attachment', {
      description: 'Upload a file attachment to a Jira issue',
      inputSchema: {
        issueKey: issueKeySchema.describe('Issue key (e.g., "DEV-123")'),
        filePath: z.string().refine(isValidFilePath, {
          message: 'File path must be within the current working directory to prevent path traversal attacks'
        }).describe('File path to upload (must be within current directory)')
      }
    }, async ({ issueKey, filePath }) => {
      try {
        const fileContent = await readFile(filePath);
        const fileName = basename(filePath);

        const formData = new FormData();
        const blob = new Blob([fileContent]);
        formData.append('file', blob, fileName);

        const url = `${JIRA_BASE_URL}/rest/api/2/issue/${encodeURIComponent(issueKey)}/attachments`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${JIRA_BEARER_TOKEN}`,
            'X-Atlassian-Token': 'no-check'
          },
          body: formData
        });

        if (!response.ok) {
          throw new Error(`Jira API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`
            }
          ],
          isError: true
        };
      }
    });

    // Register delete-issue tool
    mcpServer.registerTool('jira-delete-issue', {
      description: 'Delete a Jira issue permanently',
      inputSchema: {
        issueKey: z.string().describe('Issue key to delete (e.g., "DEV-123")')
      }
    }, async ({ issueKey }) => {
      try {
        await jiraRequest(`/rest/api/2/issue/${encodeURIComponent(issueKey)}`, {
          method: 'DELETE'
        });

        return {
          content: [
            {
              type: 'text',
              text: `Issue ${issueKey} deleted successfully`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`
            }
          ],
          isError: true
        };
      }
    });

    // Register get-projects tool
    mcpServer.registerTool('jira-get-projects', {
      description: 'Get list of all accessible Jira projects with pagination. Returns key and name for each project. Cached for 5 minutes.',
      inputSchema: {
        maxResults: maxResultsSchema.optional().default(10).describe('Maximum number of projects to return (default: 10, max: 50)'),
        startAt: z.number().int().min(0).optional().default(0).describe('Starting index for pagination (default: 0)')
      }
    }, async ({ maxResults = 10, startAt = 0 }) => {
      try {
        const cacheKey = `projects-${maxResults}-${startAt}`;
        const data = await getCached(cacheKey, async () => {
          const params = new URLSearchParams();
          params.append('maxResults', Math.min(maxResults, 50).toString());
          params.append('startAt', startAt.toString());

          const endpoint = `/rest/api/2/project?${params.toString()}`;
          return await jiraRequest(endpoint);
        });

        // Extract just key and name to minimize response size
        const projects = data.map(p => `${p.key}: ${p.name}`).join('\n');

        // Add pagination info
        const summary = `Returned: ${data.length}, StartAt: ${startAt}, HasMore: ${data.length === maxResults}`;

        return {
          content: [
            {
              type: 'text',
              text: `${summary}\n\n${projects}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`
            }
          ],
          isError: true
        };
      }
    });

    // Set up stdio transport
    const transport = new StdioServerTransport();

    // Connect server to transport
    await mcpServer.connect(transport);

    console.error('Jira MCP Server (Bearer Auth) running on stdio transport');
    console.error(`Connected to Jira instance: ${JIRA_BASE_URL}`);
  } catch (error) {
    console.error('Failed to start Jira MCP Server:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Handle process termination
/* istanbul ignore next */
process.on('SIGINT', () => {
  console.error('Shutting down Jira MCP Server...');
  process.exit(0);
});

/* istanbul ignore next */
process.on('SIGTERM', () => {
  console.error('Shutting down Jira MCP Server...');
  process.exit(0);
});

// Start the server (only if not in test environment)
/* istanbul ignore next */
if (process.env.NODE_ENV !== 'test') {
  main().catch((error) => {
    console.error('Unhandled error in main:', error);
    process.exit(1);
  });
}

// Export for testing
export {
  loadConfig,
  jiraRequest,
  isValidFilePath,
  getCached,
  sleep,
  HTTP_STATUS,
  REQUEST_TIMEOUT_MS,
  CACHE_TTL_MS,
  MAX_RETRIES,
  RETRY_DELAY_BASE_MS
};
