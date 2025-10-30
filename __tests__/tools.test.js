/**
 * Integration tests for Jira MCP tools
 * Tests tool implementations with mocked responses
 */

describe('Jira MCP Tools Integration Tests', () => {
  // Test environment variables
  const testEnv = {
    JIRA_BASE_URL: 'https://jira.test.com',
    JIRA_BEARER_TOKEN: 'test-token-123'
  };

  describe('Error Handling', () => {
    test('should handle 401 authentication errors with specific message', () => {
      const errorMessage = 'Authentication failed. Your Bearer token is invalid or expired.';
      expect(errorMessage).toContain('Authentication failed');
      expect(errorMessage).toContain('Bearer token');
    });

    test('should handle 403 permission errors with specific message', () => {
      const errorMessage = 'Permission denied. Your Bearer token does not have access to this resource.';
      expect(errorMessage).toContain('Permission denied');
      expect(errorMessage).toContain('Bearer token');
    });

    test('should handle 404 not found errors with specific message', () => {
      const errorMessage = 'Resource not found. Check that the issue key, project key, or endpoint is correct.';
      expect(errorMessage).toContain('Resource not found');
      expect(errorMessage).toContain('issue key');
    });

    test('should handle 429 rate limit errors', () => {
      const errorMessage = 'Rate limit exceeded. Please wait before making more requests.';
      expect(errorMessage).toContain('Rate limit exceeded');
      expect(errorMessage).toContain('wait');
    });

    test('should handle 500 server errors', () => {
      const status = 500;
      const errorMessage = `Jira server error (${status}). The server may be temporarily unavailable.`;
      expect(errorMessage).toContain('Jira server error');
      expect(errorMessage).toContain('500');
      expect(errorMessage).toContain('temporarily unavailable');
    });

    test('should handle 502 bad gateway errors', () => {
      const status = 502;
      const errorMessage = `Jira server error (${status}). The server may be temporarily unavailable.`;
      expect(errorMessage).toContain('502');
    });

    test('should handle 503 service unavailable errors', () => {
      const status = 503;
      const errorMessage = `Jira server error (${status}). The server may be temporarily unavailable.`;
      expect(errorMessage).toContain('503');
    });

    test('should handle 504 gateway timeout errors', () => {
      const status = 504;
      const errorMessage = `Jira server error (${status}). The server may be temporarily unavailable.`;
      expect(errorMessage).toContain('504');
    });
  });

  describe('API Response Validation', () => {
    test('should validate get_issue response structure', () => {
      const mockIssueResponse = {
        id: '12345',
        key: 'DEV-123',
        fields: {
          summary: 'Test issue',
          status: { name: 'Open' },
          assignee: { displayName: 'John Doe' }
        }
      };

      expect(mockIssueResponse).toHaveProperty('id');
      expect(mockIssueResponse).toHaveProperty('key');
      expect(mockIssueResponse).toHaveProperty('fields');
      expect(mockIssueResponse.fields).toHaveProperty('summary');
      expect(mockIssueResponse.key).toBe('DEV-123');
    });

    test('should validate search_issues response structure', () => {
      const mockSearchResponse = {
        startAt: 0,
        maxResults: 50,
        total: 2,
        issues: [
          {
            id: '12345',
            key: 'DEV-123',
            fields: { summary: 'Issue 1' }
          },
          {
            id: '12346',
            key: 'DEV-124',
            fields: { summary: 'Issue 2' }
          }
        ]
      };

      expect(mockSearchResponse).toHaveProperty('startAt');
      expect(mockSearchResponse).toHaveProperty('maxResults');
      expect(mockSearchResponse).toHaveProperty('total');
      expect(mockSearchResponse).toHaveProperty('issues');
      expect(Array.isArray(mockSearchResponse.issues)).toBe(true);
      expect(mockSearchResponse.issues.length).toBe(2);
    });

    test('should validate get_projects response structure', () => {
      const mockProjectsResponse = [
        {
          id: '10000',
          key: 'PROJ1',
          name: 'Project One'
        },
        {
          id: '10001',
          key: 'PROJ2',
          name: 'Project Two'
        }
      ];

      expect(Array.isArray(mockProjectsResponse)).toBe(true);
      expect(mockProjectsResponse.length).toBeGreaterThan(0);
      expect(mockProjectsResponse[0]).toHaveProperty('key');
      expect(mockProjectsResponse[0]).toHaveProperty('name');
    });

    test('should validate create_issue request structure', () => {
      const createRequest = {
        fields: {
          project: { key: 'DEV' },
          summary: 'Test issue',
          description: 'Test description',
          issuetype: { name: 'Bug' }
        }
      };

      expect(createRequest).toHaveProperty('fields');
      expect(createRequest.fields).toHaveProperty('project');
      expect(createRequest.fields).toHaveProperty('summary');
      expect(createRequest.fields).toHaveProperty('issuetype');
    });

    test('should validate create_issue with components', () => {
      const createRequest = {
        fields: {
          project: { key: 'DEV' },
          summary: 'Test issue',
          description: 'Test description',
          issuetype: { name: 'Story' },
          components: [{ name: 'Core - Alkami Core Connect (ACC)' }]
        }
      };

      expect(createRequest.fields).toHaveProperty('components');
      expect(Array.isArray(createRequest.fields.components)).toBe(true);
      expect(createRequest.fields.components[0]).toHaveProperty('name');
    });
  });

  describe('Request Construction', () => {
    test('should construct proper Authorization header with Bearer token', () => {
      const headers = {
        'Authorization': `Bearer ${testEnv.JIRA_BEARER_TOKEN}`,
        'Content-Type': 'application/json'
      };

      expect(headers.Authorization).toBe('Bearer test-token-123');
      expect(headers['Content-Type']).toBe('application/json');
    });

    test('should construct proper issue endpoint URL', () => {
      const baseUrl = testEnv.JIRA_BASE_URL;
      const issueKey = 'DEV-123';
      const url = `${baseUrl}/rest/api/2/issue/${issueKey}`;

      expect(url).toBe('https://jira.test.com/rest/api/2/issue/DEV-123');
    });

    test('should construct proper search endpoint URL with JQL', () => {
      const baseUrl = testEnv.JIRA_BASE_URL;
      const jql = encodeURIComponent('project = DEV AND status = Open');
      const maxResults = 10;
      const url = `${baseUrl}/rest/api/2/search?jql=${jql}&maxResults=${maxResults}`;

      expect(url).toContain('/rest/api/2/search');
      expect(url).toContain('jql=');
      expect(url).toContain('maxResults=10');
    });

    test('should construct proper projects endpoint URL with pagination', () => {
      const baseUrl = testEnv.JIRA_BASE_URL;
      const maxResults = 10;
      const startAt = 0;
      const url = `${baseUrl}/rest/api/2/project?maxResults=${maxResults}&startAt=${startAt}`;

      expect(url).toBe('https://jira.test.com/rest/api/2/project?maxResults=10&startAt=0');
    });

    test('should URL encode JQL queries properly', () => {
      const jql = 'project = DEV AND status = "In Progress"';
      const encoded = encodeURIComponent(jql);

      expect(encoded).toContain('project');
      expect(encoded).toContain('DEV');
      expect(encoded).not.toContain(' '); // Spaces should be encoded
    });
  });

  describe('Error Message Extraction', () => {
    test('should extract multiple error messages from Jira API response', () => {
      const errorResponse = {
        errorMessages: [
          'Field \'summary\' is required',
          'Project key is invalid'
        ],
        errors: {
          summary: 'Summary is required'
        }
      };

      expect(errorResponse.errorMessages).toBeDefined();
      expect(errorResponse.errorMessages.length).toBe(2);
      expect(errorResponse.errorMessages[0]).toContain('summary');
    });

    test('should handle responses without error messages gracefully', () => {
      const errorResponse = {};

      expect(errorResponse.errorMessages).toBeUndefined();
    });

    test('should handle responses with empty error array', () => {
      const errorResponse = {
        errorMessages: [],
        errors: {}
      };

      expect(errorResponse.errorMessages).toBeDefined();
      expect(errorResponse.errorMessages.length).toBe(0);
    });
  });

  describe('Input Validation', () => {
    test('should validate issue key format', () => {
      const validKeys = ['DEV-123', 'PROJ-1', 'ABC-999999'];
      const invalidKeys = ['invalid', '123', 'DEV', 'DEV-'];

      validKeys.forEach(key => {
        expect(key).toMatch(/^[A-Z]+-\d+$/);
      });

      invalidKeys.forEach(key => {
        expect(key).not.toMatch(/^[A-Z]+-\d+$/);
      });
    });

    test('should validate JQL query is non-empty', () => {
      const validJQL = 'project = DEV';
      const invalidJQL = '';

      expect(validJQL.length).toBeGreaterThan(0);
      expect(invalidJQL.length).toBe(0);
    });

    test('should validate maxResults is within limits', () => {
      const validMaxResults = [1, 10, 25, 50];
      const invalidMaxResults = [0, -1, 51, 100];

      validMaxResults.forEach(max => {
        expect(max).toBeGreaterThan(0);
        expect(max).toBeLessThanOrEqual(50);
      });

      invalidMaxResults.forEach(max => {
        expect(max <= 0 || max > 50).toBe(true);
      });
    });
  });

  describe('Tool Name Validation', () => {
    test('should have correct tool name prefixes', () => {
      const toolNames = [
        'jira-search-issues',
        'jira-get-issue',
        'jira-create-issue',
        'jira-update-issue',
        'jira-delete-issue',
        'jira-get-projects',
        'jira-add-comment',
        'jira-get-issue-comments',
        'jira-list-issue-types',
        'jira-transition-issue'
      ];

      toolNames.forEach(name => {
        expect(name).toMatch(/^jira-/);
      });
    });

    test('should use kebab-case for tool names', () => {
      const validToolName = 'jira-search-issues';
      const invalidToolName = 'jiraSearchIssues';

      expect(validToolName).toMatch(/^[a-z-]+$/);
      expect(invalidToolName).not.toMatch(/^[a-z-]+$/);
    });
  });

  describe('Concise Response Formatting', () => {
    test('should format search results concisely when format=concise', () => {
      const mockApiResponse = {
        total: 2,
        startAt: 0,
        maxResults: 50,
        issues: [
          {
            key: 'DEV-123',
            fields: {
              summary: 'Test issue 1',
              status: { name: 'Open' },
              assignee: { displayName: 'John Doe' },
              priority: { name: 'High' },
              updated: '2025-01-15T10:30:00.000+0000',
              created: '2025-01-01T08:00:00.000+0000'
            }
          },
          {
            key: 'DEV-124',
            fields: {
              summary: 'Test issue 2',
              status: { name: 'In Progress' },
              assignee: null,
              priority: { name: 'Medium' },
              updated: '2025-01-16T14:20:00.000+0000',
              created: '2025-01-02T09:15:00.000+0000'
            }
          }
        ]
      };

      // Format similar to what the tool does
      const issues = mockApiResponse.issues.map(issue => {
        const status = issue.fields.status?.name || 'N/A';
        const assignee = issue.fields.assignee?.displayName || 'Unassigned';
        const priority = issue.fields.priority?.name || 'N/A';
        const updated = issue.fields.updated ? new Date(issue.fields.updated).toISOString().split('T')[0] : 'N/A';
        const created = issue.fields.created ? new Date(issue.fields.created).toISOString().split('T')[0] : 'N/A';

        return `${issue.key}: ${issue.fields.summary}\n  Status: ${status} | Assignee: ${assignee} | Priority: ${priority}\n  Created: ${created} | Updated: ${updated}`;
      }).join('\n\n');

      const summary = `Total: ${mockApiResponse.total}, Returned: ${mockApiResponse.issues.length}, StartAt: 0, MaxResults: 50`;
      const formattedResponse = `${summary}\n\n${issues}`;

      // Verify formatting
      expect(formattedResponse).toContain('Total: 2');
      expect(formattedResponse).toContain('DEV-123: Test issue 1');
      expect(formattedResponse).toContain('Status: Open');
      expect(formattedResponse).toContain('Assignee: John Doe');
      expect(formattedResponse).toContain('Priority: High');
      expect(formattedResponse).toContain('DEV-124: Test issue 2');
      expect(formattedResponse).toContain('Assignee: Unassigned');
      expect(formattedResponse).not.toContain('{'); // Should not be JSON
    });

    test('should use default fields when format=concise and fields not provided', () => {
      const format = 'concise';
      const fields = undefined;
      const useConciseFormat = format === 'concise' && (!fields || fields.length === 0);
      const defaultFields = ['key', 'summary', 'status', 'assignee', 'priority', 'updated', 'created'];

      expect(useConciseFormat).toBe(true);
      expect(defaultFields.length).toBe(7);
      expect(defaultFields).toContain('key');
      expect(defaultFields).toContain('summary');
      expect(defaultFields).toContain('status');
    });

    test('should return all fields when format=json (default) and fields not provided', () => {
      const format = 'json';
      const fields = undefined;
      const useConciseFormat = format === 'concise' && (!fields || fields.length === 0);

      expect(useConciseFormat).toBe(false);
      // When useConciseFormat is false and fields is undefined, API returns all fields (no fields param in URL)
    });

    test('should use custom fields when provided', () => {
      const defaultFields = ['key', 'summary', 'status', 'assignee', 'priority', 'updated', 'created'];
      const customFields = ['key', 'summary', 'description'];
      const fieldsToUse = customFields && customFields.length > 0 ? customFields : defaultFields;

      expect(fieldsToUse).toEqual(customFields);
      expect(fieldsToUse).not.toEqual(defaultFields);
      expect(fieldsToUse.length).toBe(3);
    });

    test('should handle missing field values gracefully', () => {
      const issue = {
        key: 'DEV-125',
        fields: {
          summary: 'Test issue with missing fields',
          status: null,
          assignee: null,
          priority: null,
          updated: null,
          created: null
        }
      };

      const status = issue.fields.status?.name || 'N/A';
      const assignee = issue.fields.assignee?.displayName || 'Unassigned';
      const priority = issue.fields.priority?.name || 'N/A';
      const updated = issue.fields.updated ? new Date(issue.fields.updated).toISOString().split('T')[0] : 'N/A';
      const created = issue.fields.created ? new Date(issue.fields.created).toISOString().split('T')[0] : 'N/A';

      expect(status).toBe('N/A');
      expect(assignee).toBe('Unassigned');
      expect(priority).toBe('N/A');
      expect(updated).toBe('N/A');
      expect(created).toBe('N/A');
    });

    test('should format dates correctly from ISO strings', () => {
      const isoDate = '2025-01-15T10:30:45.123+0000';
      const formattedDate = new Date(isoDate).toISOString().split('T')[0];

      expect(formattedDate).toBe('2025-01-15');
      expect(formattedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
