import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Load configuration from config.json or environment variables
 * Priority: config.json > environment variables
 * @returns {Promise<{baseUrl: string, bearerToken: string}>} Configuration object
 */
export async function loadConfig() {
  const configPath = join(__dirname, '..', 'config.json');

  // Try to load from config.json first
  if (existsSync(configPath)) {
    try {
      const configData = await readFile(configPath, 'utf8');
      const config = JSON.parse(configData);
      if (config.jira?.baseUrl && config.jira?.bearerToken) {
        return {
          baseUrl: config.jira.baseUrl,
          bearerToken: config.jira.bearerToken
        };
      }
    } catch (error) {
      console.error('Warning: Failed to read config.json:', error.message);
    }
  }

  // Fallback to environment variables
  if (process.env.JIRA_BASE_URL && process.env.JIRA_BEARER_TOKEN) {
    return {
      baseUrl: process.env.JIRA_BASE_URL,
      bearerToken: process.env.JIRA_BEARER_TOKEN
    };
  }

  // No configuration found
  console.error('Error: Jira credentials not configured.');
  console.error('\nPlease either:');
  console.error('1. Run setup: ./setup.js');
  console.error('2. Set environment variables: JIRA_BASE_URL and JIRA_BEARER_TOKEN');
  process.exit(1);
}
