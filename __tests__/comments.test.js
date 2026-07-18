/**
 * Handler tests for the comment mutation tools (jira-update-comment,
 * jira-delete-comment). Registers the real tools against a real McpServer with
 * a mocked jiraRequest, then invokes the captured callbacks directly.
 */
import { jest } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const BASE_URL = 'https://jira.test.com';
const TOKEN = 'test-token-123';

let registerCommentTools;

beforeAll(async () => {
  const mod = await import('../tools/comments.js');
  registerCommentTools = mod.registerCommentTools;
});

function setup(mockJiraRequest) {
  const server = new McpServer({ name: 'test', version: '0.0.0' }, { capabilities: { tools: {} } });
  registerCommentTools(server, mockJiraRequest, BASE_URL, TOKEN);
  return server._registeredTools;
}

describe('jira-update-comment', () => {
  test('is registered', () => {
    const tools = setup(jest.fn());
    expect(tools['jira-update-comment']).toBeDefined();
  });

  test('issues PUT to the comment endpoint with the new body', async () => {
    const mockJiraRequest = jest.fn(async () => ({ id: '10001', body: 'corrected text' }));
    const tools = setup(mockJiraRequest);

    const result = await tools['jira-update-comment'].callback({
      issueKey: 'DEV-123',
      commentId: '10001',
      body: 'corrected text'
    });

    expect(mockJiraRequest).toHaveBeenCalledTimes(1);
    const [, , endpoint, options] = mockJiraRequest.mock.calls[0];
    expect(endpoint).toBe('/rest/api/2/issue/DEV-123/comment/10001');
    expect(options.method).toBe('PUT');
    expect(JSON.parse(options.body)).toEqual({ body: 'corrected text' });
    expect(result.isError).toBeFalsy();
  });

  test('surfaces errors from jiraRequest', async () => {
    const mockJiraRequest = jest.fn(async () => { throw new Error('update failed'); });
    const tools = setup(mockJiraRequest);

    const result = await tools['jira-update-comment'].callback({ issueKey: 'DEV-123', commentId: '1', body: 'x' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('update failed');
  });
});

describe('jira-delete-comment', () => {
  test('is registered', () => {
    const tools = setup(jest.fn());
    expect(tools['jira-delete-comment']).toBeDefined();
  });

  test('issues DELETE to the comment endpoint', async () => {
    const mockJiraRequest = jest.fn(async () => null); // 204 No Content
    const tools = setup(mockJiraRequest);

    const result = await tools['jira-delete-comment'].callback({ issueKey: 'DEV-123', commentId: '10001' });

    expect(mockJiraRequest).toHaveBeenCalledTimes(1);
    const [, , endpoint, options] = mockJiraRequest.mock.calls[0];
    expect(endpoint).toBe('/rest/api/2/issue/DEV-123/comment/10001');
    expect(options.method).toBe('DELETE');
    expect(result.isError).toBeFalsy();
  });

  test('surfaces errors from jiraRequest', async () => {
    const mockJiraRequest = jest.fn(async () => { throw new Error('gone wrong'); });
    const tools = setup(mockJiraRequest);

    const result = await tools['jira-delete-comment'].callback({ issueKey: 'DEV-123', commentId: '1' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('gone wrong');
  });
});
