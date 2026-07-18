import { getCached } from '../lib/utils.js';

/**
 * Register all metadata-related tools
 * @param {McpServer} mcpServer - MCP server instance
 * @param {Function} jiraRequest - Jira API request function
 * @param {string} baseUrl - Jira base URL
 * @param {string} bearerToken - Bearer token
 */
export function registerMetadataTools(mcpServer, jiraRequest, baseUrl, bearerToken) {
  // Get custom fields
  mcpServer.registerTool('jira-get-custom-fields', {
    description: 'Get all custom field definitions from Jira. Returns field ID, name, and schema information. Cached for 5 minutes.',
    inputSchema: {}
  }, async () => {
    try {
      const data = await getCached('custom-fields', async () => {
        const fields = await jiraRequest(baseUrl, bearerToken, '/rest/api/2/field');
        return fields.filter(field => field.custom);
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

  // List issue types
  mcpServer.registerTool('jira-list-issue-types', {
    description: 'Get list of all available issue types in Jira (Bug, Story, Task, etc.). Cached for 5 minutes.',
    inputSchema: {}
  }, async () => {
    try {
      const data = await getCached('issue-types', async () => {
        return await jiraRequest(baseUrl, bearerToken, '/rest/api/2/issuetype');
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

  // List statuses
  mcpServer.registerTool('jira-list-statuses', {
    description: 'Get list of all available issue statuses in Jira. Cached for 5 minutes.',
    inputSchema: {}
  }, async () => {
    try {
      const data = await getCached('statuses', async () => {
        return await jiraRequest(baseUrl, bearerToken, '/rest/api/2/status');
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

  // List priorities
  mcpServer.registerTool('jira-list-priorities', {
    description: 'Get list of all available issue priorities in Jira (Highest, High, Medium, etc.), each with its id and name. Use the name or id with the "priority" parameter on jira-create-issue / jira-update-issue. Cached for 5 minutes.',
    inputSchema: {}
  }, async () => {
    try {
      const data = await getCached('priorities', async () => {
        return await jiraRequest(baseUrl, bearerToken, '/rest/api/2/priority');
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
