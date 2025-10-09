# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Issue filtering helper tools:
  - `jira-get-my-issues` - Get issues assigned to current user with optional status/project filters
  - `jira-get-recent-issues` - Get recently updated or viewed issues
- Worklog (time tracking) support:
  - `jira-get-issue-worklogs` - Get all worklog entries for an issue
  - `jira-add-worklog` - Add time tracking entries with time spent, comment, and start date
- Project metadata tools for issue creation:
  - `jira-get-project-versions` - Get all versions/releases for a project
  - `jira-get-project-components` - Get all components for a project
- GitHub Actions workflows:
  - CI testing on Node.js 18, 20, and 22
  - Automated npm publishing on release with OIDC
  - Test coverage reporting

### Changed

- Updated GitHub Actions publish workflow to use OIDC for tokenless npm authentication
- Improved workflow documentation with OIDC setup instructions
- Refactored codebase into modular structure for better maintainability:
  - Extracted utilities to `lib/utils.js`
  - Extracted config loading to `lib/config.js`
  - Extracted Jira API client to `lib/jira-client.js`
  - Organized tools by category:
    - `tools/issues.js` - Issue CRUD, transitions, assignments, watchers, links, attachments
    - `tools/projects.js` - Project listing, details, versions, components
    - `tools/worklogs.js` - Time tracking operations
    - `tools/comments.js` - Comment operations
    - `tools/users.js` - User operations
    - `tools/metadata.js` - Issue types, statuses, custom fields
  - Reduced main `index.js` from 1200+ lines to ~80 lines

## [1.0.1] - 2025-10-08

### Added

- npm badges in README (version, downloads, stars, license, coverage)
- Production Enhancements section in README documentation

### Changed

- Updated README with accurate production features documentation

### Fixed

- Removed redundant Authentication Verification section from README

## [1.0.0] - 2025-10-08

### Added

- Initial release of Jira MCP Server with Bearer token authentication
- 20 tools covering full CRUD operations for Jira:
  - Issue operations: search, get, create, update, delete, transition, assign
  - Comment operations: get comments, add comment
  - Project operations: list projects, get project details
  - User operations: get user details
  - Metadata operations: list issue types, statuses, transitions, custom fields
  - Link and watch operations: link issues, add/remove watchers
  - Attachment operations: upload attachments
- Production-grade enhancements:
  - Response caching with 5-minute TTL for metadata endpoints (projects, issue types, statuses, custom fields)
  - Retry logic with exponential backoff for transient server errors (502, 503, 504)
  - Field filtering support via optional `fields` parameter on search and get-issue
  - Pagination support with `startAt` parameter on search-issues
  - Request timeouts (30 seconds) to prevent hung connections
  - Debug logging (enable with `DEBUG=true` environment variable)
- Support for Jira Server and Data Center (REST API v2)
- Bearer token authentication via Authorization header
- Enhanced error handling with specific HTTP status messages
- Interactive setup script
- Comprehensive test suite with Jest (90%+ coverage)
- Complete documentation (README, QUICKSTART, EXAMPLES)
- npm package publication setup with .npmignore and package.json metadata
- Package-lock.json for CI/CD reproducibility

### Technical Implementation

- @modelcontextprotocol/sdk v1.19.1
- Zod for schema validation
- ES modules (type: "module")
- Optimized pagination (max 50 results, default 10)
- Plain text project list format to avoid token limits

### Tested Against

- Jira Server 9.17.5
- REST API v2
- Compatible with any Jira Server/Data Center instance supporting Bearer token authentication
