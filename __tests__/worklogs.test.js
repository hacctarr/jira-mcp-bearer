/**
 * Handler tests for the worklog mutation tools (jira-delete-worklog,
 * jira-update-worklog). Registers the real tools against a real McpServer with
 * a mocked jiraRequest, then invokes the captured callbacks directly.
 */
import { jest } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const BASE_URL = 'https://jira.test.com';
const TOKEN = 'test-token-123';

let registerWorklogTools;

beforeAll(async () => {
  const mod = await import('../tools/worklogs.js');
  registerWorklogTools = mod.registerWorklogTools;
});

function setup(mockJiraRequest) {
  const server = new McpServer({ name: 'test', version: '0.0.0' }, { capabilities: { tools: {} } });
  registerWorklogTools(server, mockJiraRequest, BASE_URL, TOKEN);
  return server._registeredTools;
}

describe('jira-delete-worklog', () => {
  test('is registered', () => {
    const tools = setup(jest.fn());
    expect(tools['jira-delete-worklog']).toBeDefined();
  });

  test('issues DELETE to the worklog endpoint and defaults adjustEstimate=leave', async () => {
    const mockJiraRequest = jest.fn(async () => null); // 204 No Content
    const tools = setup(mockJiraRequest);

    const result = await tools['jira-delete-worklog'].callback({ issueKey: 'DEV-123', worklogId: '98765' });

    expect(mockJiraRequest).toHaveBeenCalledTimes(1);
    const [, , endpoint, options] = mockJiraRequest.mock.calls[0];
    expect(endpoint).toContain('/rest/api/2/issue/DEV-123/worklog/98765');
    // Removing a duplicate must not silently inflate the remaining estimate.
    expect(endpoint).toContain('adjustEstimate=leave');
    expect(options.method).toBe('DELETE');
    expect(result.isError).toBeFalsy();
  });

  test('honors an explicit adjustEstimate override', async () => {
    const mockJiraRequest = jest.fn(async () => null);
    const tools = setup(mockJiraRequest);

    await tools['jira-delete-worklog'].callback({ issueKey: 'DEV-123', worklogId: '98765', adjustEstimate: 'auto' });

    const [, , endpoint] = mockJiraRequest.mock.calls[0];
    expect(endpoint).toContain('adjustEstimate=auto');
  });

  test('surfaces errors from jiraRequest', async () => {
    const mockJiraRequest = jest.fn(async () => { throw new Error('gone wrong'); });
    const tools = setup(mockJiraRequest);

    const result = await tools['jira-delete-worklog'].callback({ issueKey: 'DEV-123', worklogId: '1' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('gone wrong');
  });
});

describe('jira-update-worklog', () => {
  test('is registered', () => {
    const tools = setup(jest.fn());
    expect(tools['jira-update-worklog']).toBeDefined();
  });

  test('issues PUT with only the provided fields', async () => {
    const mockJiraRequest = jest.fn(async () => ({ id: '98765', timeSpent: '2h' }));
    const tools = setup(mockJiraRequest);

    const result = await tools['jira-update-worklog'].callback({
      issueKey: 'DEV-123',
      worklogId: '98765',
      timeSpent: '2h'
    });

    expect(mockJiraRequest).toHaveBeenCalledTimes(1);
    const [, , endpoint, options] = mockJiraRequest.mock.calls[0];
    expect(endpoint).toContain('/rest/api/2/issue/DEV-123/worklog/98765');
    expect(options.method).toBe('PUT');
    const body = JSON.parse(options.body);
    expect(body).toEqual({ timeSpent: '2h' });
    expect(result.isError).toBeFalsy();
  });

  test('includes comment and started when provided', async () => {
    const mockJiraRequest = jest.fn(async () => ({ id: '98765' }));
    const tools = setup(mockJiraRequest);

    await tools['jira-update-worklog'].callback({
      issueKey: 'DEV-123',
      worklogId: '98765',
      comment: 'corrected',
      started: '2026-07-10T09:00:00.000+0000'
    });

    const body = JSON.parse(mockJiraRequest.mock.calls[0][3].body);
    expect(body.comment).toBe('corrected');
    expect(body.started).toBe('2026-07-10T09:00:00.000+0000');
    expect(body.timeSpent).toBeUndefined();
  });

  test('surfaces errors from jiraRequest', async () => {
    const mockJiraRequest = jest.fn(async () => { throw new Error('update failed'); });
    const tools = setup(mockJiraRequest);

    const result = await tools['jira-update-worklog'].callback({ issueKey: 'DEV-123', worklogId: '1', timeSpent: '1h' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('update failed');
  });
});
