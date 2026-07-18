/**
 * Behavioral tests for the priority wiring in tools/issues.js:
 *   - jira-create-issue and jira-update-issue accept a `priority` param
 *   - the dedicated param normalizes name/id and wins over a `fields` passthrough
 */

import { jest } from '@jest/globals';
import { registerIssueTools } from '../tools/issues.js';

function makeFakeServer() {
  const handlers = new Map();
  const server = { registerTool(name, _config, handler) { handlers.set(name, handler); } };
  return { server, handlers };
}

const BASE_URL = 'https://jira.test.com';
const TOKEN = 'test-token';

function bodyOf(jiraRequest) {
  return JSON.parse(jiraRequest.mock.calls[0][3].body);
}

describe('jira-create-issue priority param', () => {
  test('sets fields.priority from a name', async () => {
    const jiraRequest = jest.fn(async () => ({ key: 'DEV-1' }));
    const { server, handlers } = makeFakeServer();
    registerIssueTools(server, jiraRequest, BASE_URL, TOKEN);

    await handlers.get('jira-create-issue')({
      projectKey: 'DEV', issueType: 'Bug', summary: 'x', priority: 'High'
    });

    expect(bodyOf(jiraRequest).fields.priority).toEqual({ name: 'High' });
  });

  test('sets fields.priority from a numeric id', async () => {
    const jiraRequest = jest.fn(async () => ({ key: 'DEV-1' }));
    const { server, handlers } = makeFakeServer();
    registerIssueTools(server, jiraRequest, BASE_URL, TOKEN);

    await handlers.get('jira-create-issue')({
      projectKey: 'DEV', issueType: 'Bug', summary: 'x', priority: '2'
    });

    expect(bodyOf(jiraRequest).fields.priority).toEqual({ id: '2' });
  });

  test('dedicated priority param wins over a fields passthrough', async () => {
    const jiraRequest = jest.fn(async () => ({ key: 'DEV-1' }));
    const { server, handlers } = makeFakeServer();
    registerIssueTools(server, jiraRequest, BASE_URL, TOKEN);

    await handlers.get('jira-create-issue')({
      projectKey: 'DEV', issueType: 'Bug', summary: 'x',
      priority: 'High',
      fields: { priority: { name: 'Low' } }
    });

    expect(bodyOf(jiraRequest).fields.priority).toEqual({ name: 'High' });
  });

  test('omits priority when not provided', async () => {
    const jiraRequest = jest.fn(async () => ({ key: 'DEV-1' }));
    const { server, handlers } = makeFakeServer();
    registerIssueTools(server, jiraRequest, BASE_URL, TOKEN);

    await handlers.get('jira-create-issue')({ projectKey: 'DEV', issueType: 'Bug', summary: 'x' });

    expect(bodyOf(jiraRequest).fields.priority).toBeUndefined();
  });
});

describe('jira-update-issue priority param', () => {
  test('sets fields.priority on update from a name', async () => {
    const jiraRequest = jest.fn(async () => null);
    const { server, handlers } = makeFakeServer();
    registerIssueTools(server, jiraRequest, BASE_URL, TOKEN);

    await handlers.get('jira-update-issue')({ issueKey: 'DEV-1', priority: 'Critical' });

    expect(bodyOf(jiraRequest).fields.priority).toEqual({ name: 'Critical' });
  });

  test('dedicated priority param wins over a fields passthrough on update', async () => {
    const jiraRequest = jest.fn(async () => null);
    const { server, handlers } = makeFakeServer();
    registerIssueTools(server, jiraRequest, BASE_URL, TOKEN);

    await handlers.get('jira-update-issue')({
      issueKey: 'DEV-1',
      priority: 'High',
      fields: { priority: { name: 'Low' } }
    });

    expect(bodyOf(jiraRequest).fields.priority).toEqual({ name: 'High' });
  });

  test('does not touch priority when not provided', async () => {
    const jiraRequest = jest.fn(async () => null);
    const { server, handlers } = makeFakeServer();
    registerIssueTools(server, jiraRequest, BASE_URL, TOKEN);

    await handlers.get('jira-update-issue')({ issueKey: 'DEV-1', summary: 'renamed' });

    expect(bodyOf(jiraRequest).fields.priority).toBeUndefined();
  });
});
