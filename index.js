#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './lib/config.js';
import { jiraRequest } from './lib/jira-client.js';
import { registerIssueTools } from './tools/issues.js';
import { registerProjectTools } from './tools/projects.js';
import { registerWorklogTools } from './tools/worklogs.js';
import { registerCommentTools } from './tools/comments.js';
import { registerUserTools } from './tools/users.js';
import { registerMetadataTools } from './tools/metadata.js';

/* istanbul ignore next */
async function main() {
  try {
    // Load configuration
    const config = await loadConfig();
    const JIRA_BASE_URL = config.baseUrl;
    const JIRA_BEARER_TOKEN = config.bearerToken;

    // Create MCP server
    const mcpServer = new McpServer({
      name: 'jira-bearer-auth',
      version: '1.0.0'
    }, {
      capabilities: {
        tools: {}
      }
    });

    // Register all tools by category
    registerIssueTools(mcpServer, jiraRequest, JIRA_BASE_URL, JIRA_BEARER_TOKEN);
    registerProjectTools(mcpServer, jiraRequest, JIRA_BASE_URL, JIRA_BEARER_TOKEN);
    registerWorklogTools(mcpServer, jiraRequest, JIRA_BASE_URL, JIRA_BEARER_TOKEN);
    registerCommentTools(mcpServer, jiraRequest, JIRA_BASE_URL, JIRA_BEARER_TOKEN);
    registerUserTools(mcpServer, jiraRequest, JIRA_BASE_URL, JIRA_BEARER_TOKEN);
    registerMetadataTools(mcpServer, jiraRequest, JIRA_BASE_URL, JIRA_BEARER_TOKEN);

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
  jiraRequest
};
