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

  // Update comment
  mcpServer.registerTool('jira-update-comment', {
    description: 'Edit the body of an existing comment on a Jira issue. Get the comment id from jira-get-issue-comments.',
    inputSchema: {
      issueKey: z.string().describe('Issue key (e.g., "DEV-123")'),
      commentId: z.string().describe('Comment id to edit (from jira-get-issue-comments)'),
      body: z.string().describe('New comment text (replaces the existing body)')
    }
  }, async ({ issueKey, commentId, body }) => {
    try {
      const data = await jiraRequest(baseUrl, bearerToken, `/rest/api/2/issue/${encodeURIComponent(issueKey)}/comment/${encodeURIComponent(commentId)}`, {
        method: 'PUT',
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

  // Delete comment
  mcpServer.registerTool('jira-delete-comment', {
    description: 'Delete a comment from a Jira issue permanently. Get the comment id from jira-get-issue-comments.',
    inputSchema: {
      issueKey: z.string().describe('Issue key (e.g., "DEV-123")'),
      commentId: z.string().describe('Comment id to delete (from jira-get-issue-comments)')
    }
  }, async ({ issueKey, commentId }) => {
    try {
      await jiraRequest(baseUrl, bearerToken, `/rest/api/2/issue/${encodeURIComponent(issueKey)}/comment/${encodeURIComponent(commentId)}`, {
        method: 'DELETE'
      });

      return {
        content: [{
          type: 'text',
          text: `Comment ${commentId} deleted from ${issueKey}`
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
