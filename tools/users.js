import { z } from 'zod';

/**
 * Register all user-related tools
 * @param {McpServer} mcpServer - MCP server instance
 * @param {Function} jiraRequest - Jira API request function
 * @param {string} baseUrl - Jira base URL
 * @param {string} bearerToken - Bearer token
 */
export function registerUserTools(mcpServer, jiraRequest, baseUrl, bearerToken) {
  // Get user
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

      const data = await jiraRequest(baseUrl, bearerToken, endpoint);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(data, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error: ${error.message}`
        }],
        isError: true
      };
    }
  });
}
