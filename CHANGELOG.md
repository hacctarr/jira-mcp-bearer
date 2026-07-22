# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.0.0] - 2026-07-22

### Changed

- **BREAKING**: credentials are now read from environment variables only
  (`JIRA_BASE_URL`, `JIRA_BEARER_TOKEN`). `config.json` in the package
  directory is no longer read. Previously a config file took precedence over
  the environment, so a stale file could silently override the active token,
  and it kept a plaintext credential on disk outside the MCP client's own
  configuration. Migrate by passing both variables in the MCP server
  registration's `env` block. With neither variable set the server now exits
  at startup with an error on stderr instead of falling back to a file.

### Removed

- `setup.js` interactive setup and `config.json.example` (both existed only
  to produce the now-unsupported config file).

## [1.6.0] - 2026-07-18

### Added

- Status-transition history / changelog support. Previously the server exposed
  no way to read an issue's status history, so "how long did this sit in a
  status before another" could only be approximated from `created`/`updated`
  and comment timestamps.
  - `jira-get-issue-changelog`: fetches the issue with `expand=changelog` and
    returns a parsed status timeline with the exact wall-clock duration spent in
    each status (segments, per-status totals, and the current open status).
    Defaults to a compact readable timeline (`format: "timeline"`); pass
    `format: "json"` for the structured object. Cheaper on tokens than dumping
    the raw changelog. Surfaces a truncation warning if the server returned
    fewer history entries than `changelog.total`.
  - `jira-get-issue` gained an `expand` parameter (array), so callers can
    request `["changelog"]`, `["renderedFields"]`, etc. `changelog` is a Jira
    EXPAND, not a field: requesting it via `fields` returns nothing useful,
    which is why the history was previously unreachable.
  - New pure module `lib/changelog.js` (`parseStatusTimeline`, `formatDuration`,
    `formatStatusTimeline`) with unit tests covering multi-transition timelines,
    status revisits, out-of-order histories, truncation, and never-transitioned
    issues.
- Priority support:
  - `jira-list-priorities`: lists the instance's priorities (id + name) from
    `/rest/api/2/priority`, cached 5 minutes — mirrors `jira-list-statuses`.
    Previously there was no way to discover valid priority values through the
    MCP.
  - `jira-create-issue` and `jira-update-issue` gained a `priority` param that
    accepts a name ("High") or numeric id ("2") and normalizes it to the shape
    Jira expects. Priority was already settable via the generic `fields`
    passthrough; the dedicated param is discoverable and applied last so it
    wins over any `fields.priority`. Note: setting priority still depends on the
    project's screen/field configuration allowing it.
  - New pure helper `normalizePriority` in `lib/utils.js`, unit-tested for
    name/id/object/empty inputs.
- Comment editing/deletion, completing CRUD over comments (previously only
  `jira-get-issue-comments` and `jira-add-comment` existed):
  - `jira-update-comment`: edit the body of an existing comment
    (`PUT /rest/api/2/issue/{key}/comment/{id}`).
  - `jira-delete-comment`: delete a comment permanently
    (`DELETE /rest/api/2/issue/{key}/comment/{id}`).
  - Both take the comment id from `jira-get-issue-comments`.

## [1.5.0] - 2026-07-10

### Added

- Worklog mutation tools, completing CRUD over time entries:
  - `jira-delete-worklog`: delete a worklog by id. Defaults to
    `adjustEstimate="leave"` so removing a duplicate/mistaken entry does NOT
    silently inflate the remaining estimate (pass `"auto"` for Jira's native
    estimate-adjusting behaviour).
  - `jira-update-worklog`: edit an existing worklog's `timeSpent`, `comment`,
    and/or `started` in place; only the provided fields change.
  - Motivation: previously only `jira-get-issue-worklogs` and `jira-add-worklog`
    existed, so a duplicate worklog could be added but not removed or corrected
    through the MCP.

## [1.4.0] - 2026-07-10

### Added

- Agile (GreenHopper) tools for sprint discovery, using the `/rest/agile/1.0` API:
  - `jira-list-boards`: list Agile boards, optionally filtered by `projectKeyOrId`
    or `name`. Returns each board's numeric id.
  - `jira-list-sprints`: list sprints on a board (`boardId`), optionally filtered
    by `state` (active/future/closed). Returns each sprint's id, name, and state.
  - Purpose: the issue Sprint field (`customfield_10404`) only accepts a numeric
    sprint id, not a name. These tools resolve that id so `jira-update-issue` can
    set the Sprint field. Previously there was no way to discover the id.

### Fixed

- Version reported by the MCP server (handshake) and the outbound `User-Agent`
  header now track `package.json` instead of a hard-coded `1.0.0`. They had
  silently stayed `1.0.0` across every prior release, masking the real version
  from telemetry. A new `lib/version.js` reads the version once at load.

## [1.3.0] - 2026-07-10

### Added

- `jira-create-remote-link`: create a remote web link on an issue, pointing to an
  external URL (e.g. a GitLab merge request). Renders in the issue's Links section.
  Fills the gap where `jira-link-issues` only handles issue-to-issue links and there
  was no way to attach an MR/URL as a structured link (only as a comment).
  - Required: `issueKey`, `url`, `title`. Optional: `summary`, `relationship`.

### Fixed

- `jiraRequest` no longer surfaces a successful write as an error when Jira returns
  a 2xx with an empty body. Endpoints like `POST /issueLink` return `201` with no
  body; calling `response.json()` threw "Unexpected end of JSON input", causing
  `jira-link-issues` to report failure on links that were actually created. Empty/
  unparseable 2xx bodies now resolve to `null`.

## [1.2.0] - 2026-06-24

### Added

- `jira-transition-issue`: optional `comment` and `fields` parameters.
  - `comment` is sent via the transition's `update.comment`, satisfying workflow
    transition screens that require a comment (previously these failed with
    "Please provide a comment for this transition" and could only be worked
    around by calling the REST API directly).
  - `fields` sets fields during the transition (e.g. `{"resolution": {"name": "Done"}}`)
    for screens that require a resolution or other fields.
  - Both are optional and additive — existing no-argument transitions are unchanged.

## [1.1.1] - 2025-10-30

### Fixed

- **Critical:** Fixed npm package missing `lib/` and `tools/` directories
  - Added `lib/` and `tools/` to package.json `files` array
  - v1.1.0 was published with missing dependencies and was broken
  - This patch fixes the installation issue

## [1.1.0] - 2025-10-30

### Added

- **Concise format option** for search tools to prevent token limit errors:
  - New `format` parameter with values `"json"` (default) or `"concise"`
  - `format: "concise"` returns readable text with 7 essential fields (key, summary, status, assignee, priority, updated, created)
  - Reduces token usage by ~95% (10 results: 48,000 tokens → 2,000 tokens)
  - Available on: `jira-search-issues`, `jira-get-my-issues`, `jira-get-recent-issues`
  - Completely opt-in - default behavior unchanged
- Test coverage for concise formatting behavior (6 new tests)
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

- Updated documentation with concise format examples and token limit troubleshooting strategies
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
- Enhanced error message formatting with bullet points and clear sections:
  - Separate "Error details" and "Field validation errors" sections
  - Each error on its own line for better readability
  - Helps users quickly identify missing required fields

### Fixed

- **Critical:** Fixed MCP server URL doubling bug where baseUrl was concatenated twice
  - Removed unnecessary `boundJiraRequest` binding that caused `https://jira.alkami.comhttps://jira.alkami.com`
  - All MCP tool calls now construct correct URLs
- Fixed `jira-create-issue` field ordering issue
  - Use `Object.assign()` to merge additional fields after core fields are set
  - Ensures custom fields and components are properly added without conflicts
  - Prevents 400 Bad Request errors from incorrect field ordering

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
