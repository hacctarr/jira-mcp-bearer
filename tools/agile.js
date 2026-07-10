import { z } from 'zod';
import { maxResultsSchema, getCached } from '../lib/utils.js';

/**
 * Register Jira Agile (GreenHopper) tools.
 *
 * These use the /rest/agile/1.0 API (not /rest/api/2) to discover boards and
 * their sprints. The primary use case is resolving the numeric sprint id needed
 * to set an issue's Sprint field (customfield_10404) via jira-update-issue —
 * that field does not accept a sprint name, only the id.
 *
 * @param {McpServer} mcpServer - MCP server instance
 * @param {Function} jiraRequest - Jira API request function
 * @param {string} baseUrl - Jira base URL
 * @param {string} bearerToken - Bearer token
 */
export function registerAgileTools(mcpServer, jiraRequest, baseUrl, bearerToken) {
  // List boards
  mcpServer.registerTool('jira-list-boards', {
    description: 'List Jira Agile boards (scrum/kanban). Optionally filter by project or board name. Use the returned board id with jira-list-sprints. Cached for 5 minutes.',
    inputSchema: {
      projectKeyOrId: z.string().optional().describe('Filter boards to those associated with a project (e.g., "DEV")'),
      name: z.string().optional().describe('Filter boards by name (substring match)'),
      maxResults: maxResultsSchema.optional().default(50).describe('Maximum number of boards to return (default: 50, max: 50)'),
      startAt: z.number().int().min(0).optional().default(0).describe('Starting index for pagination (default: 0)')
    }
  }, async ({ projectKeyOrId, name, maxResults = 50, startAt = 0 }) => {
    try {
      const params = new URLSearchParams();
      params.append('maxResults', Math.min(maxResults, 50).toString());
      params.append('startAt', startAt.toString());
      if (projectKeyOrId !== undefined) {
        params.append('projectKeyOrId', projectKeyOrId);
      }
      if (name !== undefined) {
        params.append('name', name);
      }

      const endpoint = `/rest/agile/1.0/board?${params.toString()}`;
      const cacheKey = `boards-${params.toString()}`;
      const data = await getCached(cacheKey, async () => jiraRequest(baseUrl, bearerToken, endpoint));

      const values = data?.values || [];
      const boards = values.map(b => ({
        id: b.id,
        name: b.name,
        type: b.type,
        projectKey: b.location?.projectKey
      }));

      const summary = `Returned: ${boards.length}, StartAt: ${startAt}, IsLast: ${data?.isLast ?? true}`;

      return {
        content: [{
          type: 'text',
          text: `${summary}\n\n${JSON.stringify(boards, null, 2)}`
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

  // List sprints on a board
  mcpServer.registerTool('jira-list-sprints', {
    description: 'List sprints for an Agile board. Returns each sprint\'s id, name, and state (active/future/closed). Use the sprint id to set an issue\'s Sprint field (customfield_10404) via jira-update-issue. Find the boardId with jira-list-boards.',
    inputSchema: {
      boardId: z.number().int().positive().describe('Board id (from jira-list-boards)'),
      state: z.enum(['active', 'future', 'closed']).optional().describe('Filter by sprint state; omit for all states'),
      maxResults: maxResultsSchema.optional().default(50).describe('Maximum number of sprints to return (default: 50, max: 50)'),
      startAt: z.number().int().min(0).optional().default(0).describe('Starting index for pagination (default: 0)')
    }
  }, async ({ boardId, state, maxResults = 50, startAt = 0 }) => {
    try {
      const params = new URLSearchParams();
      params.append('maxResults', Math.min(maxResults, 50).toString());
      params.append('startAt', startAt.toString());
      if (state !== undefined) {
        params.append('state', state);
      }

      const endpoint = `/rest/agile/1.0/board/${encodeURIComponent(boardId)}/sprint?${params.toString()}`;
      const data = await jiraRequest(baseUrl, bearerToken, endpoint);

      const values = data?.values || [];
      const sprints = values.map(s => ({
        id: s.id,
        name: s.name,
        state: s.state,
        startDate: s.startDate,
        endDate: s.endDate
      }));

      const summary = `Returned: ${sprints.length}, StartAt: ${startAt}, IsLast: ${data?.isLast ?? true}`;

      return {
        content: [{
          type: 'text',
          text: `${summary}\n\n${JSON.stringify(sprints, null, 2)}`
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
