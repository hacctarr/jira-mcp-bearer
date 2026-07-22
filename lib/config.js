/**
 * Load configuration from environment variables.
 * Credentials come from JIRA_BASE_URL and JIRA_BEARER_TOKEN only; a
 * config.json in the package directory is deliberately not read, so a
 * stale file can never silently override the environment.
 * @returns {Promise<{baseUrl: string, bearerToken: string}>} Configuration object
 */
export async function loadConfig() {
  if (process.env.JIRA_BASE_URL && process.env.JIRA_BEARER_TOKEN) {
    return {
      baseUrl: process.env.JIRA_BASE_URL,
      bearerToken: process.env.JIRA_BEARER_TOKEN
    };
  }

  console.error('Error: Jira credentials not configured.');
  console.error('\nSet environment variables: JIRA_BASE_URL and JIRA_BEARER_TOKEN');
  console.error('(e.g. in the "env" block of your MCP server registration)');
  process.exit(1);
}
