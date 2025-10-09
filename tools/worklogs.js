import { z } from 'zod';

/**
 * Register all worklog-related tools
 * @param {McpServer} mcpServer - MCP server instance
 * @param {Function} jiraRequest - Jira API request function
 * @param {string} baseUrl - Jira base URL
 * @param {string} bearerToken - Bearer token
 */
export function registerWorklogTools(mcpServer, jiraRequest, baseUrl, bearerToken) {
  // Get issue worklogs
  mcpServer.registerTool('jira-get-issue-worklogs', {
    description: 'Get all worklogs (time tracking entries) for a specific Jira issue',
    inputSchema: {
      issueKey: z.string().describe('Issue key (e.g., "DEV-123")')
    }
  }, async ({ issueKey }) => {
    try {
      const data = await jiraRequest(baseUrl, bearerToken, `/rest/api/2/issue/${encodeURIComponent(issueKey)}/worklog`);
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

  // Add worklog
  mcpServer.registerTool('jira-add-worklog', {
    description: 'Add a worklog entry (time tracking) to a Jira issue',
    inputSchema: {
      issueKey: z.string().describe('Issue key (e.g., "DEV-123")'),
      timeSpent: z.string().describe('Time spent in Jira format (e.g., "3h 30m", "1d", "2w 3d 4h")'),
      comment: z.string().optional().describe('Optional comment for the worklog entry'),
      started: z.string().optional().describe('Optional start date/time in ISO 8601 format (e.g., "2025-10-08T14:30:00.000+0000"). Defaults to now.')
    }
  }, async ({ issueKey, timeSpent, comment, started }) => {
    try {
      const worklogData = {
        timeSpent
      };

      if (comment) {
        worklogData.comment = comment;
      }

      if (started) {
        worklogData.started = started;
      }

      const data = await jiraRequest(baseUrl, bearerToken, `/rest/api/2/issue/${encodeURIComponent(issueKey)}/worklog`, {
        method: 'POST',
        body: JSON.stringify(worklogData)
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
