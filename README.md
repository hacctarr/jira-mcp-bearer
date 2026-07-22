# Jira MCP Server (Bearer Token Authentication)

[![npm version](https://img.shields.io/npm/v/jira-mcp-bearer.svg)](https://www.npmjs.com/package/jira-mcp-bearer)
[![npm downloads](https://img.shields.io/npm/dm/jira-mcp-bearer.svg)](https://www.npmjs.com/package/jira-mcp-bearer)
[![GitHub stars](https://img.shields.io/github/stars/hacctarr/jira-mcp-bearer.svg)](https://github.com/hacctarr/jira-mcp-bearer/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Test Coverage](https://img.shields.io/badge/coverage-90%25-brightgreen.svg)](https://github.com/hacctarr/jira-mcp-bearer)

A Model Context Protocol (MCP) server that provides integration with Jira Server and Data Center using Bearer token authentication. Built for enterprise Jira instances that require Bearer token authentication instead of the Basic Auth used by Jira Cloud.

## Quick Start

```bash
# 1. Install from npm
npm install -g jira-mcp-bearer

# 2. Add to Claude Code with credentials as environment variables
claude mcp add jira jira-mcp-bearer \
  -e JIRA_BASE_URL=https://your-jira.com \
  -e JIRA_BEARER_TOKEN=your-token

# 3. Restart Claude Code to load the MCP

# 4. Use in Claude naturally:
# "Show me issue DEV-123"
# "Search for open issues in the DEV project"
# "Create a bug in project CORE with summary 'Login broken'"
```

That's it! Claude calls the MCP tools directly.

## Why This Exists

All existing Jira MCP packages are designed for Jira Cloud and use Basic Authentication (email + API token). Many Jira Server and Data Center instances require Bearer token authentication, which none of the npm packages support. This custom MCP server bridges that gap.

## Features

### Production Enhancements

- **Response Caching** - Metadata endpoints (projects, issue types, statuses, custom fields) cached for 5 minutes
- **Retry Logic** - Automatic retry with exponential backoff for transient server errors (502, 503, 504)
- **Concise Format Option** - Search tools support `format: "concise"` parameter for readable text output with minimal fields (key, summary, status, assignee, priority, updated, created) to prevent token limit issues
- **Field Filtering** - Optional `fields` parameter on search and get-issue to reduce response size
- **Pagination** - `startAt` parameter on search-issues for fetching beyond first 50 results
- **Request Timeouts** - 30-second timeout prevents hung connections
- **Debug Logging** - Enable with `DEBUG=true` environment variable

### Available Tools (35 total)

#### Issue Operations
1. **`jira-get-my-issues`** - Get issues assigned to current user (with optional filters)
2. **`jira-get-recent-issues`** - Get recently updated or viewed issues
3. **`jira-search-issues`** - Search issues using JQL queries
4. **`jira-get-issue`** - Get detailed information about a specific issue (supports `expand`, e.g. `["changelog"]`, to inflate the response with the transition history)
5. **`jira-get-issue-changelog`** - Get the exact status-transition history with the wall-clock duration spent in each status (answers "how long did this sit in a status before another")
6. **`jira-create-issue`** - Create a new issue (supports a `priority` param by name or id)
7. **`jira-update-issue`** - Update an existing issue (supports a `priority` param by name or id)
8. **`jira-delete-issue`** - Delete an issue permanently
9. **`jira-transition-issue`** - Change issue status/workflow state
10. **`jira-assign-issue`** - Assign or unassign an issue

#### Comment Operations
11. **`jira-get-issue-comments`** - Get all comments for an issue
12. **`jira-add-comment`** - Add a comment to an issue
13. **`jira-update-comment`** - Edit the body of an existing comment (by comment id)
14. **`jira-delete-comment`** - Delete a comment permanently (by comment id)

#### Project Operations
15. **`jira-get-projects`** - List accessible projects with pagination
16. **`jira-get-project-details`** - Get detailed project information
17. **`jira-get-project-versions`** - Get all versions/releases for a project
18. **`jira-get-project-components`** - Get all components for a project

#### Worklog Operations (Time Tracking)
19. **`jira-get-issue-worklogs`** - Get all worklog entries for an issue
20. **`jira-add-worklog`** - Add time tracking entry to an issue
21. **`jira-update-worklog`** - Update an existing worklog entry (time/comment/started)
22. **`jira-delete-worklog`** - Delete a worklog entry by id (defaults to leaving the remaining estimate unchanged)

#### User Operations
23. **`jira-get-user`** - Get user details (omit username for current user)

#### Metadata Operations
24. **`jira-list-issue-types`** - Get all available issue types (Bug, Story, Task, etc.)
25. **`jira-list-statuses`** - Get all available issue statuses
26. **`jira-list-priorities`** - Get all available issue priorities (Highest, High, Medium, etc.) with id and name
27. **`jira-get-issue-transitions`** - Get available transitions for an issue
28. **`jira-get-custom-fields`** - Get all custom field definitions

#### Link and Watch Operations
29. **`jira-link-issues`** - Create a link between two issues
30. **`jira-create-remote-link`** - Create a remote web link on an issue (e.g. to a GitLab merge request or external URL)
31. **`jira-add-watcher`** - Add a watcher to an issue
32. **`jira-remove-watcher`** - Remove a watcher from an issue

#### Attachment Operations
33. **`jira-upload-attachment`** - Upload a file attachment to an issue

#### Agile Operations
34. **`jira-list-boards`** - List Agile boards (optionally filtered by project or name)
35. **`jira-list-sprints`** - List sprints on a board with id/name/state (use the sprint id to set an issue's Sprint field)

## Installation

### Prerequisites
- Node.js 18+ (uses native `fetch`)
- npm or yarn
- Jira Server or Data Center with REST API v2

### Quick Install (from npm)

```bash
# Install globally
npm install -g jira-mcp-bearer

# Or use npx (no installation needed)
npx jira-mcp-bearer
```

### Install from Source

```bash
# Clone the repository
git clone https://github.com/hacctarr/jira-mcp-bearer.git
cd jira-mcp-bearer

# Install dependencies
npm install

# Make executable
chmod +x index.js
```

## Configuration

Credentials are read from environment variables only: `JIRA_BASE_URL` and `JIRA_BEARER_TOKEN`. There is no config file; this keeps the token in exactly one place (your MCP client's server registration).

```bash
claude mcp add jira $(pwd)/index.js \
  -e JIRA_BASE_URL=https://your-jira-server.com \
  -e JIRA_BEARER_TOKEN=<your-token-here>
```

For Jira Data Center, use a Personal Access Token (Profile → Personal Access Tokens) as the bearer token so it can be revoked and expired independently of your login session.

### Verify Installation

```bash
claude mcp list
```

Should show:
```
jira: /path/to/jira-mcp-bearer/index.js - ✓ Connected
```

## Usage Examples

### Search for Issues

```javascript
// Default: Returns full JSON with all fields
mcp__jira__jira-search-issues({
  jql: "project = DEV AND status = Open",
  maxResults: 10
})

// Concise format: Returns readable text with essential fields (avoids token limits)
mcp__jira__jira-search-issues({
  jql: "project = DEV AND status = Open",
  maxResults: 10,
  format: "concise"
})
// Output:
// Total: 15, Returned: 10, StartAt: 0, MaxResults: 10
//
// DEV-123: Login page not loading
//   Status: Open | Assignee: John Doe | Priority: High
//   Created: 2025-01-01 | Updated: 2025-01-15
//
// DEV-124: Dashboard showing wrong data
//   Status: In Progress | Assignee: Jane Smith | Priority: Medium
//   Created: 2025-01-02 | Updated: 2025-01-16

// Custom fields: Returns JSON with specific fields
mcp__jira__jira-search-issues({
  jql: "project = DEV AND status = Open",
  maxResults: 10,
  fields: ["key", "summary", "description", "status"]
})
```

### Get Specific Issue

```javascript
mcp__jira__jira-get-issue({
  issueKey: "DEV-123"
})
```

### Create an Issue

```javascript
mcp__jira__jira-create-issue({
  projectKey: "DEV",
  issueType: "Bug",
  summary: "Login page not loading",
  description: "Users report the login page returns a 500 error"
})
```

### Add a Comment

```javascript
mcp__jira__jira-add-comment({
  issueKey: "DEV-123",
  body: "This has been fixed in the latest deployment"
})
```

### List Projects

```javascript
mcp__jira__jira-get-projects({
  maxResults: 20,
  startAt: 0
})
```

### Transition an Issue

```javascript
// First, get available transitions
mcp__jira__jira-get-issue-transitions({
  issueKey: "DEV-123"
})

// Then transition using the transition ID
mcp__jira__jira-transition-issue({
  issueKey: "DEV-123",
  transitionId: "31"
})
```

## Development

### Project Structure

```
jira-mcp-bearer/
├── index.js               # Main MCP server (imports and registers tools)
├── lib/                   # Core libraries
│   ├── config.js          # Configuration loading
│   ├── jira-client.js     # Jira API request handler with retry logic
│   └── utils.js           # Utilities, validation schemas, caching
├── tools/                 # Tool modules organized by category
│   ├── issues.js          # Issue operations including filtering helpers (15 tools)
│   ├── projects.js        # Project operations (4 tools)
│   ├── worklogs.js        # Time tracking operations (2 tools)
│   ├── comments.js        # Comment operations (2 tools)
│   ├── users.js           # User operations (1 tool)
│   └── metadata.js        # Issue types, statuses, fields (3 tools)
├── package.json           # Project dependencies
├── jest.config.js         # Test configuration
├── __tests__/             # Test suite
│   └── auth.test.js       # Authentication and API tests
├── .github/workflows/     # CI/CD pipeline
│   └── ci.yml             # GitHub Actions workflow
├── README.md              # This file
├── QUICKSTART.md          # Fast setup guide
├── EXAMPLES.md            # Real output examples
├── START_HERE.md          # AI assistant guide
└── CHANGELOG.md           # Version history
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

### Adding New Tools

Tools are organized by category in the `tools/` directory. To add a new tool:

1. Choose the appropriate category file (e.g., `tools/issues.js` for issue-related tools)
2. Add your tool registration using this template:

```javascript
// In tools/issues.js (or appropriate category file)
mcpServer.registerTool('jira-tool-name', {
  description: 'Tool description',
  inputSchema: {
    param: z.string().describe('Parameter description')
  }
}, async ({ param }) => {
  try {
    const data = await jiraRequest(baseUrl, bearerToken, '/rest/api/2/endpoint');
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
```

3. If creating a new category, create a new file in `tools/` and register it in `index.js`:

```javascript
import { registerYourTools } from './tools/your-category.js';
// ...
registerYourTools(mcpServer, boundJiraRequest, JIRA_BASE_URL, JIRA_BEARER_TOKEN);
```

### Testing the MCP Server

Test the server directly with stdio:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | \
  JIRA_BASE_URL=https://your-jira-server.com \
  JIRA_BEARER_TOKEN=<token> \
  node index.js
```

Test API endpoint directly:

```bash
curl -H "Authorization: Bearer <token>" \
  https://your-jira-server.com/rest/api/2/issue/DEV-123
```

## Troubleshooting

### 401 Unauthorized Error

Check that:
1. Bearer token is valid and not expired
2. Token has appropriate permissions
3. Jira base URL is correct (no trailing slash)

### MCP Server Not Connecting

1. Verify installation: `claude mcp list`
2. Check `JIRA_BASE_URL` and `JIRA_BEARER_TOKEN` are set in the server registration's `env` block
3. Restart Claude Code after configuration changes
4. Check logs: MCP servers log to stderr

### Tool Not Available

1. Restart Claude Code (type `/exit` then restart)
2. Check MCP connection: `claude mcp list` should show "✓ Connected"
3. Verify tool name uses the `jira-` prefix (e.g., `jira-get-issue` not `get-issue`)

### Token Limit Exceeded

If search responses exceed token limits, use the `format: "concise"` parameter:
```javascript
mcp__jira__jira-search-issues({
  jql: "project = DEV",
  format: "concise"  // Returns readable text with 7 essential fields instead of 100+ fields
})
```

This reduces token usage by ~95% (10 results: 48,000 tokens → 2,000 tokens).

Additional strategies:
- Reduce `maxResults` parameter (default: 50, try 10-20)
- Narrow your JQL query to return fewer results
- Use pagination with `startAt` to process results in batches
- Use `fields` parameter to select specific fields as JSON

## Jira API Reference

This server uses Jira REST API v2:
- **Compatible with**: Jira Server, Jira Data Center (REST API v2)
- **Tested against**: Jira Server 9.17.5
- **API Docs**: https://docs.atlassian.com/software/jira/docs/api/REST/latest/

### Key Endpoints Used

- `/rest/api/2/search` - Search issues with JQL
- `/rest/api/2/issue/{issueKey}` - Get/update/delete issue
- `/rest/api/2/issue` - Create issue
- `/rest/api/2/issue/{issueKey}/worklog` - Get/add worklogs (time tracking)
- `/rest/api/2/project` - List projects
- `/rest/api/2/project/{projectKey}/versions` - Get project versions
- `/rest/api/2/project/{projectKey}/components` - Get project components
- `/rest/api/2/user` - Get user details
- `/rest/api/2/field` - Get custom fields
- `/rest/api/2/issuetype` - List issue types
- `/rest/api/2/status` - List statuses

## Security

- Credentials live only in environment variables supplied by your MCP client; no config file is read or written
- Bearer tokens should be treated as passwords
- Prefer a Personal Access Token with an expiry date over a session token
- The token is never logged, even with `DEBUG=true`

## License

MIT

## Author

hacctarr (triblegroup@gmail.com)

## Version History

See [CHANGELOG.md](CHANGELOG.md) for detailed version history.
