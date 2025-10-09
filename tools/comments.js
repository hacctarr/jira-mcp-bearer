import { z } from 'zod';

/**
 * Register all comment-related tools
 * @param {McpServer} mcpServer - MCP server instance
 * @param {Function} jiraRequest - Jira API request function
 * @param {string} baseUrl - Jira base URL
 * @param {string} bearerToken - Bearer token
 */
export function registerCommentTools(mcpServer, jiraRequest, baseUrl, bearerToken) {
  // Get issue comments
  mcpServer.registerTool('jira-get-issue-comments', {
    description: 'Get all comments for a specific Jira issue',
    inputSchema: {
      issueKey: z.string().describe('Issue key (e.g., "DEV-123")')
    }
  }, async ({ issueKey }) => {
    try {
      const data = await jiraRequest(baseUrl, bearerToken, `/rest/api/2/issue/${encodeURIComponent(issueKey)}/comment`);
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

  // Add comment
  mcpServer.registerTool('jira-add-comment', {
    description: 'Add a comment to a Jira issue',
    inputSchema: {
      issueKey: z.string().describe('Issue key (e.g., "DEV-123")'),
      body: z.string().describe('Comment text')
    }
  }, async ({ issueKey, body }) => {
    try {
      const data = await jiraRequest(baseUrl, bearerToken, `/rest/api/2/issue/${encodeURIComponent(issueKey)}/comment`, {
        method: 'POST',
        body: JSON.stringify({ body })
      });

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
