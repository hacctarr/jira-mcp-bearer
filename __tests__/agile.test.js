/**
 * Handler tests for the Jira Agile tools (jira-list-boards, jira-list-sprints).
 *
 * These register the real tools against a real McpServer with a mocked
 * jiraRequest, then invoke the captured tool callbacks directly. This exercises
 * endpoint construction, the Agile { values, isLast } envelope unwrapping, and
 * the error path.
 */
import { jest } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const BASE_URL = 'https://jira.test.com';
const TOKEN = 'test-token-123';

let registerAgileTools;

beforeAll(async () => {
  const mod = await import('../tools/agile.js');
  registerAgileTools = mod.registerAgileTools;
});

/**
 * Register the agile tools against a fresh server with a supplied mock
 * jiraRequest, and return the map of registered tool callbacks.
 */
function setup(mockJiraRequest) {
  const server = new McpServer({ name: 'test', version: '0.0.0' }, { capabilities: { tools: {} } });
  registerAgileTools(server, mockJiraRequest, BASE_URL, TOKEN);
  return server._registeredTools;
}

describe('jira-list-boards', () => {
  test('is registered', () => {
    const tools = setup(jest.fn());
    expect(tools['jira-list-boards']).toBeDefined();
  });

  test('calls the agile board endpoint and lists boards', async () => {
    const mockJiraRequest = jest.fn(async () => ({
      isLast: true,
      values: [
        { id: 42, name: 'DEV board', type: 'scrum' },
        { id: 43, name: 'CORE board', type: 'kanban' }
      ]
    }));
    const tools = setup(mockJiraRequest);

    const result = await tools['jira-list-boards'].callback({});

    expect(mockJiraRequest).toHaveBeenCalledWith(
      BASE_URL,
      TOKEN,
      expect.stringContaining('/rest/agile/1.0/board')
    );
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('42');
    expect(result.content[0].text).toContain('DEV board');
  });

  test('passes projectKeyOrId as a query filter when provided', async () => {
    const mockJiraRequest = jest.fn(async () => ({ isLast: true, values: [] }));
    const tools = setup(mockJiraRequest);

    await tools['jira-list-boards'].callback({ projectKeyOrId: 'DEV' });

    expect(mockJiraRequest).toHaveBeenCalledWith(
      BASE_URL,
      TOKEN,
      expect.stringContaining('projectKeyOrId=DEV')
    );
  });

  test('surfaces errors from jiraRequest', async () => {
    const mockJiraRequest = jest.fn(async () => { throw new Error('boom'); });
    const tools = setup(mockJiraRequest);

    // Use a unique filter so this call cannot hit a cached success from an
    // earlier test — jira-list-boards caches on its query params (getCached).
    const result = await tools['jira-list-boards'].callback({ projectKeyOrId: 'ERRCASE' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('boom');
  });
});

describe('jira-list-sprints', () => {
  test('is registered', () => {
    const tools = setup(jest.fn());
    expect(tools['jira-list-sprints']).toBeDefined();
  });

  test('calls the board sprint endpoint with the boardId and returns sprint ids', async () => {
    const mockJiraRequest = jest.fn(async () => ({
      isLast: true,
      values: [
        { id: 1001, name: 'Sprint 24', state: 'active' },
        { id: 1002, name: 'Sprint 25', state: 'future' }
      ]
    }));
    const tools = setup(mockJiraRequest);

    const result = await tools['jira-list-sprints'].callback({ boardId: 42 });

    expect(mockJiraRequest).toHaveBeenCalledWith(
      BASE_URL,
      TOKEN,
      expect.stringContaining('/rest/agile/1.0/board/42/sprint')
    );
    expect(result.isError).toBeFalsy();
    // The sprint id is what gets written to customfield_10404, so it must be visible.
    expect(result.content[0].text).toContain('1001');
    expect(result.content[0].text).toContain('active');
  });

  test('filters by state when provided', async () => {
    const mockJiraRequest = jest.fn(async () => ({ isLast: true, values: [] }));
    const tools = setup(mockJiraRequest);

    await tools['jira-list-sprints'].callback({ boardId: 42, state: 'active' });

    expect(mockJiraRequest).toHaveBeenCalledWith(
      BASE_URL,
      TOKEN,
      expect.stringContaining('state=active')
    );
  });

  test('surfaces errors from jiraRequest', async () => {
    const mockJiraRequest = jest.fn(async () => { throw new Error('nope'); });
    const tools = setup(mockJiraRequest);

    const result = await tools['jira-list-sprints'].callback({ boardId: 42 });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('nope');
  });
});
