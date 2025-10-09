import { z } from 'zod';
import { maxResultsSchema, getCached } from '../lib/utils.js';

/**
 * Register all project-related tools
 * @param {McpServer} mcpServer - MCP server instance
 * @param {Function} jiraRequest - Jira API request function
 * @param {string} baseUrl - Jira base URL
 * @param {string} bearerToken - Bearer token
 */
export function registerProjectTools(mcpServer, jiraRequest, baseUrl, bearerToken) {
  // Get projects
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
        return await jiraRequest(baseUrl, bearerToken, endpoint);
      });

      // Extract just key and name to minimize response size
      const projects = data.map(p => `${p.key}: ${p.name}`).join('\n');

      // Add pagination info
      const summary = `Returned: ${data.length}, StartAt: ${startAt}, HasMore: ${data.length === maxResults}`;

      return {
        content: [{
          type: 'text',
          text: `${summary}\n\n${projects}`
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

  // Get project details
  mcpServer.registerTool('jira-get-project-details', {
    description: 'Get detailed information about a specific Jira project',
    inputSchema: {
      projectKey: z.string().describe('Project key (e.g., "DEV", "CORE")')
    }
  }, async ({ projectKey }) => {
    try {
      const data = await jiraRequest(baseUrl, bearerToken, `/rest/api/2/project/${encodeURIComponent(projectKey)}`);

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
        content: [{
          type: 'text',
          text: JSON.stringify(summary, null, 2)
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

  // Get project versions
  mcpServer.registerTool('jira-get-project-versions', {
    description: 'Get all versions (releases) for a specific Jira project. Useful for creating issues with fix versions.',
    inputSchema: {
      projectKey: z.string().describe('Project key (e.g., "DEV", "CORE")')
    }
  }, async ({ projectKey }) => {
    try {
      const data = await jiraRequest(baseUrl, bearerToken, `/rest/api/2/project/${encodeURIComponent(projectKey)}/versions`);

      // Format for easy reading: show key info for each version
      const versions = data.map(v => ({
        id: v.id,
        name: v.name,
        archived: v.archived || false,
        released: v.released || false,
        releaseDate: v.releaseDate,
        description: v.description
      }));

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(versions, null, 2)
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

  // Get project components
  mcpServer.registerTool('jira-get-project-components', {
    description: 'Get all components for a specific Jira project. Useful for creating issues with components.',
    inputSchema: {
      projectKey: z.string().describe('Project key (e.g., "DEV", "CORE")')
    }
  }, async ({ projectKey }) => {
    try {
      const data = await jiraRequest(baseUrl, bearerToken, `/rest/api/2/project/${encodeURIComponent(projectKey)}/components`);

      // Format for easy reading: show key info for each component
      const components = data.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
        lead: c.lead?.displayName || c.lead?.name
      }));

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(components, null, 2)
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
