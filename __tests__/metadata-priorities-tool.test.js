/**
 * Behavioral test for the jira-list-priorities metadata tool.
 * Mirrors jira-list-statuses: cached GET of /rest/api/2/priority.
 */

import { jest } from '@jest/globals';
import { registerMetadataTools } from '../tools/metadata.js';

function makeFakeServer() {
  const handlers = new Map();
  const server = { registerTool(name, _config, handler) { handlers.set(name, handler); } };
  return { server, handlers };
}

const BASE_URL = 'https://jira.test.com';
const TOKEN = 'test-token';

describe('jira-list-priorities tool', () => {
  test('is registered', () => {
    const { server, handlers } = makeFakeServer();
    registerMetadataTools(server, jest.fn(), BASE_URL, TOKEN);
    expect(handlers.has('jira-list-priorities')).toBe(true);
  });

  test('fetches /rest/api/2/priority and returns the priorities', async () => {
    const priorities = [
      { id: '1', name: 'Highest' },
      { id: '2', name: 'High' },
      { id: '3', name: 'Medium' }
    ];
    const jiraRequest = jest.fn(async () => priorities);
    const { server, handlers } = makeFakeServer();
    registerMetadataTools(server, jiraRequest, BASE_URL, TOKEN);

    const result = await handlers.get('jira-list-priorities')({});

    expect(jiraRequest.mock.calls[0][2]).toBe('/rest/api/2/priority');
    expect(result.content[0].text).toContain('Highest');
    expect(result.content[0].text).toContain('Medium');
  });
});
