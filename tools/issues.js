import { z } from 'zod';
import { issueKeySchema, projectKeySchema, jqlSchema, summarySchema, maxResultsSchema, isValidFilePath } from '../lib/utils.js';
import { readFile } from 'fs/promises';
import { basename } from 'path';

/**
 * Register all issue-related tools
 * @param {McpServer} mcpServer - MCP server instance
 * @param {Function} jiraRequest - Jira API request function
 * @param {string} baseUrl - Jira base URL
 * @param {string} bearerToken - Bearer token
 */
export function registerIssueTools(mcpServer, jiraRequest, baseUrl, bearerToken) {
  // Get my issues (shorthand for assignee = currentUser())
  mcpServer.registerTool('jira-get-my-issues', {
    description: 'Get issues assigned to the current user. Shorthand for "assignee = currentUser()" JQL query.',
    inputSchema: {
      maxResults: maxResultsSchema.optional().default(50).describe('Maximum number of results to return (max 50)'),
      startAt: z.number().int().min(0).optional().default(0).describe('Starting index for pagination (default: 0)'),
      status: z.string().optional().describe('Optional status filter (e.g., "Open", "In Progress")'),
      project: z.string().optional().describe('Optional project key filter (e.g., "DEV")'),
      fields: z.array(z.string()).optional().describe('Optional array of field names to return (e.g., ["summary", "status", "priority"])')
    }
  }, async ({ maxResults, startAt, status, project, fields }) => {
    try {
      // Build JQL query
      let jql = 'assignee = currentUser()';

      if (status) {
        jql += ` AND status = "${status}"`;
      }

      if (project) {
        jql += ` AND project = ${project}`;
      }

      jql += ' ORDER BY updated DESC';

      let endpoint = `/rest/api/2/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}&startAt=${startAt}`;
      if (fields && fields.length > 0) {
        endpoint += `&fields=${fields.join(',')}`;
      }

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

  // Get recent issues
  mcpServer.registerTool('jira-get-recent-issues', {
    description: 'Get recently updated or viewed issues for the current user',
    inputSchema: {
      maxResults: maxResultsSchema.optional().default(20).describe('Maximum number of results to return (max 50)'),
      type: z.enum(['updated', 'viewed']).optional().default('updated').describe('Type of recency: "updated" (recently updated) or "viewed" (recently viewed by you)'),
      fields: z.array(z.string()).optional().describe('Optional array of field names to return (e.g., ["summary", "status", "updated"])')
    }
  }, async ({ maxResults, type, fields }) => {
    try {
      let jql;

      if (type === 'viewed') {
        // Issues recently viewed by current user
        jql = 'issue in issueHistory() ORDER BY lastViewed DESC';
      } else {
        // Recently updated issues (either assigned to user or watched by user)
        jql = '(assignee = currentUser() OR watcher = currentUser()) ORDER BY updated DESC';
      }

      let endpoint = `/rest/api/2/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}`;
      if (fields && fields.length > 0) {
        endpoint += `&fields=${fields.join(',')}`;
      }

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

  // Search issues
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

  // Get issue
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

  // Create issue
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
      // Start with required fields
      const issueData = {
        fields: {
          project: { key: projectKey },
          issuetype: { name: issueType },
          summary
        }
      };

      // Add description if provided
      if (description) {
        issueData.fields.description = description;
      }

      // Merge additional fields after core fields are set
      // This allows custom fields and components to be added
      Object.assign(issueData.fields, fields);

      const data = await jiraRequest(baseUrl, bearerToken, '/rest/api/2/issue', {
        method: 'POST',
        body: JSON.stringify(issueData)
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

  // Update issue
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

      await jiraRequest(baseUrl, bearerToken, `/rest/api/2/issue/${encodeURIComponent(issueKey)}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });

      return {
        content: [{
          type: 'text',
          text: `Issue ${issueKey} updated successfully`
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

  // Delete issue
  mcpServer.registerTool('jira-delete-issue', {
    description: 'Delete a Jira issue permanently',
    inputSchema: {
      issueKey: z.string().describe('Issue key to delete (e.g., "DEV-123")')
    }
  }, async ({ issueKey }) => {
    try {
      await jiraRequest(baseUrl, bearerToken, `/rest/api/2/issue/${encodeURIComponent(issueKey)}`, {
        method: 'DELETE'
      });

      return {
        content: [{
          type: 'text',
          text: `Issue ${issueKey} deleted successfully`
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

  // Get issue transitions
  mcpServer.registerTool('jira-get-issue-transitions', {
    description: 'Get available transitions for a Jira issue (to see what status changes are possible)',
    inputSchema: {
      issueKey: z.string().describe('Issue key (e.g., "DEV-123")')
    }
  }, async ({ issueKey }) => {
    try {
      const data = await jiraRequest(baseUrl, bearerToken, `/rest/api/2/issue/${encodeURIComponent(issueKey)}/transitions`);
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

  // Transition issue
  mcpServer.registerTool('jira-transition-issue', {
    description: 'Transition a Jira issue to a new status. Use get_issue_transitions first to see available transitions.',
    inputSchema: {
      issueKey: z.string().describe('Issue key (e.g., "DEV-123")'),
      transitionId: z.string().describe('Transition ID (get from get_issue_transitions)')
    }
  }, async ({ issueKey, transitionId }) => {
    try {
      await jiraRequest(baseUrl, bearerToken, `/rest/api/2/issue/${encodeURIComponent(issueKey)}/transitions`, {
        method: 'POST',
        body: JSON.stringify({ transition: { id: transitionId } })
      });

      return {
        content: [{
          type: 'text',
          text: `Issue ${issueKey} transitioned successfully`
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

  // Assign issue
  mcpServer.registerTool('jira-assign-issue', {
    description: 'Assign a Jira issue to a user, or unassign it',
    inputSchema: {
      issueKey: z.string().describe('Issue key (e.g., "DEV-123")'),
      username: z.string().optional().describe('Username to assign (omit or use "-1" to unassign)')
    }
  }, async ({ issueKey, username }) => {
    try {
      const assignData = { name: username === '-1' ? null : username };

      await jiraRequest(baseUrl, bearerToken, `/rest/api/2/issue/${encodeURIComponent(issueKey)}/assignee`, {
        method: 'PUT',
        body: JSON.stringify(assignData)
      });

      const action = username && username !== '-1' ? `assigned to ${username}` : 'unassigned';
      return {
        content: [{
          type: 'text',
          text: `Issue ${issueKey} ${action} successfully`
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

  // Add watcher
  mcpServer.registerTool('jira-add-watcher', {
    description: 'Add a user as a watcher to a Jira issue',
    inputSchema: {
      issueKey: z.string().describe('Issue key (e.g., "DEV-123")'),
      username: z.string().describe('Username to add as watcher')
    }
  }, async ({ issueKey, username }) => {
    try {
      await jiraRequest(baseUrl, bearerToken, `/rest/api/2/issue/${encodeURIComponent(issueKey)}/watchers`, {
        method: 'POST',
        body: JSON.stringify(username)
      });

      return {
        content: [{
          type: 'text',
          text: `User ${username} added as watcher to issue ${issueKey}`
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

  // Remove watcher
  mcpServer.registerTool('jira-remove-watcher', {
    description: 'Remove a user as a watcher from a Jira issue',
    inputSchema: {
      issueKey: z.string().describe('Issue key (e.g., "DEV-123")'),
      username: z.string().describe('Username to remove as watcher')
    }
  }, async ({ issueKey, username }) => {
    try {
      await jiraRequest(baseUrl, bearerToken, `/rest/api/2/issue/${encodeURIComponent(issueKey)}/watchers?username=${encodeURIComponent(username)}`, {
        method: 'DELETE'
      });

      return {
        content: [{
          type: 'text',
          text: `User ${username} removed as watcher from issue ${issueKey}`
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

  // Link issues
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

      await jiraRequest(baseUrl, bearerToken, '/rest/api/2/issueLink', {
        method: 'POST',
        body: JSON.stringify(linkData)
      });

      return {
        content: [{
          type: 'text',
          text: `Successfully created ${type} link between ${inwardIssue} and ${outwardIssue}`
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

  // Upload attachment
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

      const url = `${baseUrl}/rest/api/2/issue/${encodeURIComponent(issueKey)}/attachments`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${bearerToken}`,
          'X-Atlassian-Token': 'no-check'
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Jira API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
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
