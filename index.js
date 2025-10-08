#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load configuration from config.json or environment variables
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

// Helper function for API requests
async function jiraRequest(endpoint, options = {}) {
  const url = `${JIRA_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${JIRA_BEARER_TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Jira API error: ${response.status} ${response.statusText}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

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
        jql: z.string().describe('JQL query string (e.g., "project = CORE AND status = Open")'),
        maxResults: z.number().optional().default(50).describe('Maximum number of results to return')
      }
    }, async ({ jql, maxResults }) => {
      try {
        const data = await jiraRequest(
          `/rest/api/2/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}`
        );
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
        issueKey: z.string().describe('Issue key (e.g., "CORE-123")')
      }
    }, async ({ issueKey }) => {
      try {
        const data = await jiraRequest(`/rest/api/2/issue/${issueKey}`);
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
      description: 'Get all custom field definitions from Jira. Returns field ID, name, and schema information.',
      inputSchema: {}
    }, async () => {
      try {
        const data = await jiraRequest('/rest/api/2/field');
        const customFields = data.filter(field => field.custom);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(customFields, null, 2)
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
      description: 'Get list of all available issue types in Jira (Bug, Story, Task, etc.)',
      inputSchema: {}
    }, async () => {
      try {
        const data = await jiraRequest('/rest/api/2/issuetype');
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
        projectKey: z.string().describe('Project key (e.g., "DEV")'),
        issueType: z.string().describe('Issue type name (e.g., "Bug", "Story", "Task")'),
        summary: z.string().describe('Issue summary/title'),
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
      description: 'Get list of all available issue statuses in Jira',
      inputSchema: {}
    }, async () => {
      try {
        const data = await jiraRequest('/rest/api/2/status');
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
        issueKey: z.string().describe('Issue key (e.g., "DEV-123")'),
        filePath: z.string().describe('Absolute file path to upload')
      }
    }, async ({ issueKey, filePath }) => {
      try {
        const fileContent = await readFile(filePath);
        const fileName = filePath.split('/').pop();

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
      description: 'Get list of all accessible Jira projects with pagination. Returns key and name for each project.',
      inputSchema: {
        maxResults: z.number().optional().default(10).describe('Maximum number of projects to return (default: 10, max: 50)'),
        startAt: z.number().optional().default(0).describe('Starting index for pagination (default: 0)')
      }
    }, async ({ maxResults = 10, startAt = 0 }) => {
      try {
        const params = new URLSearchParams();
        params.append('maxResults', Math.min(maxResults, 50).toString());
        params.append('startAt', startAt.toString());

        const endpoint = `/rest/api/2/project?${params.toString()}`;
        const data = await jiraRequest(endpoint);

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
process.on('SIGINT', () => {
  console.error('Shutting down Jira MCP Server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('Shutting down Jira MCP Server...');
  process.exit(0);
});

// Start the server
main().catch((error) => {
  console.error('Unhandled error in main:', error);
  process.exit(1);
});
