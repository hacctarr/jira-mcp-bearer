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

  // Delete worklog
  mcpServer.registerTool('jira-delete-worklog', {
    description: 'Delete a worklog entry from a Jira issue by its id (get the id from jira-get-issue-worklogs). Useful for removing a duplicate or mistaken time entry. Defaults to adjustEstimate="leave" so the remaining estimate is NOT changed — pass "auto" for standard Jira behaviour (increase remaining estimate by the deleted time).',
    inputSchema: {
      issueKey: z.string().describe('Issue key (e.g., "DEV-123")'),
      worklogId: z.string().describe('Worklog id to delete (from jira-get-issue-worklogs)'),
      adjustEstimate: z.enum(['leave', 'auto']).optional().default('leave').describe('How to adjust the remaining estimate: "leave" (default, do not change) or "auto" (increase by the deleted time)')
    }
  }, async ({ issueKey, worklogId, adjustEstimate = 'leave' }) => {
    try {
      const params = new URLSearchParams();
      params.append('adjustEstimate', adjustEstimate);

      await jiraRequest(baseUrl, bearerToken, `/rest/api/2/issue/${encodeURIComponent(issueKey)}/worklog/${encodeURIComponent(worklogId)}?${params.toString()}`, {
        method: 'DELETE'
      });

      return {
        content: [{
          type: 'text',
          text: `Successfully deleted worklog ${worklogId} from ${issueKey} (adjustEstimate=${adjustEstimate})`
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

  // Update worklog
  mcpServer.registerTool('jira-update-worklog', {
    description: 'Update an existing worklog entry on a Jira issue. Only the provided fields are changed. Get the worklog id from jira-get-issue-worklogs.',
    inputSchema: {
      issueKey: z.string().describe('Issue key (e.g., "DEV-123")'),
      worklogId: z.string().describe('Worklog id to update (from jira-get-issue-worklogs)'),
      timeSpent: z.string().optional().describe('New time spent in Jira format (e.g., "3h 30m", "1d")'),
      comment: z.string().optional().describe('New comment for the worklog entry'),
      started: z.string().optional().describe('New start date/time in ISO 8601 format (e.g., "2025-10-08T14:30:00.000+0000")')
    }
  }, async ({ issueKey, worklogId, timeSpent, comment, started }) => {
    try {
      const worklogData = {};

      if (timeSpent !== undefined) {
        worklogData.timeSpent = timeSpent;
      }
      if (comment !== undefined) {
        worklogData.comment = comment;
      }
      if (started !== undefined) {
        worklogData.started = started;
      }

      const data = await jiraRequest(baseUrl, bearerToken, `/rest/api/2/issue/${encodeURIComponent(issueKey)}/worklog/${encodeURIComponent(worklogId)}`, {
        method: 'PUT',
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
