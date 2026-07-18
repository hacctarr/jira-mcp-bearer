/**
 * Behavioral tests for the changelog wiring in tools/issues.js:
 *   - jira-get-issue now supports the `expand` parameter (changelog is an EXPAND)
 *   - jira-get-issue-changelog fetches with expand=changelog and returns a
 *     parsed status timeline.
 *
 * Uses a fake MCP server that captures registered handlers and a mock
 * jiraRequest that records the endpoint each tool hits.
 */

import { jest } from '@jest/globals';
import { registerIssueTools } from '../tools/issues.js';

function makeFakeServer() {
  const handlers = new Map();
  const server = {
    registerTool(name, _config, handler) {
      handlers.set(name, handler);
    }
  };
  return { server, handlers };
}

const BASE_URL = 'https://jira.test.com';
const TOKEN = 'test-token';

const CHANGELOG_ISSUE = {
  key: 'DEV-123',
  fields: {
    summary: 'Timeline test',
    created: '2026-01-01T00:00:00.000+0000',
    status: { name: 'Done' }
  },
  changelog: {
    startAt: 0,
    maxResults: 2,
    total: 2,
    histories: [
      {
        created: '2026-01-02T00:00:00.000+0000',
        author: { name: 'alice', displayName: 'Alice' },
        items: [{ field: 'status', fromString: 'Open', toString: 'Awaiting Review' }]
      },
      {
        created: '2026-01-02T06:00:00.000+0000',
        author: { name: 'bob', displayName: 'Bob' },
        items: [{ field: 'status', fromString: 'Awaiting Review', toString: 'Done' }]
      }
    ]
  }
};

describe('jira-get-issue expand support', () => {
  test('adds expand=changelog to the endpoint when requested', async () => {
    const jiraRequest = jest.fn(async () => CHANGELOG_ISSUE);
    const { server, handlers } = makeFakeServer();
    registerIssueTools(server, jiraRequest, BASE_URL, TOKEN);

    const result = await handlers.get('jira-get-issue')({
      issueKey: 'DEV-123',
      expand: ['changelog']
    });

    const endpoint = jiraRequest.mock.calls[0][2];
    expect(endpoint).toBe('/rest/api/2/issue/DEV-123?expand=changelog');
    expect(result.content[0].text).toContain('"changelog"');
  });

  test('combines fields and expand into one query string', async () => {
    const jiraRequest = jest.fn(async () => CHANGELOG_ISSUE);
    const { server, handlers } = makeFakeServer();
    registerIssueTools(server, jiraRequest, BASE_URL, TOKEN);

    await handlers.get('jira-get-issue')({
      issueKey: 'DEV-123',
      fields: ['summary', 'status'],
      expand: ['changelog']
    });

    const endpoint = jiraRequest.mock.calls[0][2];
    expect(endpoint).toContain('fields=summary%2Cstatus');
    expect(endpoint).toContain('expand=changelog');
  });

  test('omits the query string entirely when neither fields nor expand given', async () => {
    const jiraRequest = jest.fn(async () => CHANGELOG_ISSUE);
    const { server, handlers } = makeFakeServer();
    registerIssueTools(server, jiraRequest, BASE_URL, TOKEN);

    await handlers.get('jira-get-issue')({ issueKey: 'DEV-123' });

    expect(jiraRequest.mock.calls[0][2]).toBe('/rest/api/2/issue/DEV-123');
  });
});

describe('jira-get-issue-changelog tool', () => {
  test('is registered', () => {
    const { server, handlers } = makeFakeServer();
    registerIssueTools(server, jest.fn(), BASE_URL, TOKEN);
    expect(handlers.has('jira-get-issue-changelog')).toBe(true);
  });

  test('fetches with expand=changelog and returns a readable timeline', async () => {
    const jiraRequest = jest.fn(async () => CHANGELOG_ISSUE);
    const { server, handlers } = makeFakeServer();
    registerIssueTools(server, jiraRequest, BASE_URL, TOKEN);

    const result = await handlers.get('jira-get-issue-changelog')({
      issueKey: 'DEV-123',
      format: 'timeline'
    });

    const endpoint = jiraRequest.mock.calls[0][2];
    expect(endpoint).toContain('expand=changelog');

    const text = result.content[0].text;
    expect(text).toContain('DEV-123');
    expect(text).toContain('Awaiting Review');
    expect(text).toContain('6h'); // time in Awaiting Review before Done
    expect(text).toContain('current');
  });

  test('returns the structured object when format=json', async () => {
    const jiraRequest = jest.fn(async () => CHANGELOG_ISSUE);
    const { server, handlers } = makeFakeServer();
    registerIssueTools(server, jiraRequest, BASE_URL, TOKEN);

    const result = await handlers.get('jira-get-issue-changelog')({
      issueKey: 'DEV-123',
      format: 'json'
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.transitions).toHaveLength(2);
    expect(parsed.totalsByStatus['Awaiting Review']).toBe(6 * 60 * 60 * 1000);
  });

  test('surfaces API errors as isError results', async () => {
    const jiraRequest = jest.fn(async () => { throw new Error('Resource not found'); });
    const { server, handlers } = makeFakeServer();
    registerIssueTools(server, jiraRequest, BASE_URL, TOKEN);

    const result = await handlers.get('jira-get-issue-changelog')({ issueKey: 'DEV-000' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Resource not found');
  });
});
