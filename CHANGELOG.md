# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0]

### Added

- Initial release of Jira MCP Server with Bearer token authentication
- 20 tools covering full CRUD operations for Jira
- Issue operations: search, get, create, update, delete, transition, assign
- Comment operations: get comments, add comment
- Project operations: list projects, get project details
- User operations: get user details
- Metadata operations: list issue types, statuses, transitions, custom fields
- Link and watch operations: link issues, add/remove watchers
- Attachment operations: upload attachments
- Support for Jira Server and Data Center (REST API v2)
- Plain text project list format to avoid token limits
- Comprehensive documentation (README.md)
- Interactive setup script
- Test suite with Jest
- GitHub Actions CI/CD pipeline
- Git repository setup with .gitignore

### Technical Details

- Uses @modelcontextprotocol/sdk v1.19.1
- Uses Zod for schema validation
- ES modules (type: "module")
- Bearer token authentication via Authorization header
- Optimized pagination (max 50 results, default 10)

### Known Limitations

- No field filtering on responses
- No caching
- Basic error handling
- No retry logic

### Authentication Discovery

- **Basic Auth**: Failed with 401 "AUTHENTICATED_FAILED"
- **Bearer Token**: Success with 200 OK
- Root cause: Jira Server requires Bearer token, not Basic Auth

### Tested Against

- **Platform**: Jira Server 9.17.5
- **API**: REST API v2
- **Compatibility**: Should work with any Jira Server/Data Center instance supporting Bearer token auth
- **Verification**: Multiple projects listed, issue retrieval, JQL searches all working

## [Unreleased]

### Planned Features

- Field filtering to reduce token usage
- Better error handling with retry logic
- Caching for frequently accessed data

### Under Consideration

- Rate limit handling
- Batch operations
- JQL validation before API calls
- Webhook support
