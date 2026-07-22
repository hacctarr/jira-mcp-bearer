/**
 * Configuration Loading Tests
 * loadConfig reads credentials from environment variables ONLY.
 * A config.json in the package directory must be ignored, so a stale
 * file can never silently override the environment (v2.0.0 hardening).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, jest } from '@jest/globals';
import { existsSync, renameSync, writeFileSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { loadConfig } from '../lib/config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = join(__dirname, '..', 'config.json');
const backupPath = join(__dirname, '..', 'config.json.test-backup');

describe('loadConfig', () => {
  let originalEnv;
  let hadRealConfig = false;

  beforeAll(() => {
    // Move any developer-local config.json out of the way for the suite
    if (existsSync(configPath)) {
      hadRealConfig = true;
      renameSync(configPath, backupPath);
    }
  });

  afterAll(() => {
    if (existsSync(configPath)) {
      unlinkSync(configPath);
    }
    if (hadRealConfig) {
      renameSync(backupPath, configPath);
    }
  });

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
    if (existsSync(configPath)) {
      unlinkSync(configPath);
    }
    jest.restoreAllMocks();
  });

  it('returns baseUrl and bearerToken from environment variables', async () => {
    process.env.JIRA_BASE_URL = 'https://jira.env.example.com';
    process.env.JIRA_BEARER_TOKEN = 'env-token';

    const config = await loadConfig();

    expect(config).toEqual({
      baseUrl: 'https://jira.env.example.com',
      bearerToken: 'env-token'
    });
  });

  it('ignores config.json in the package directory even when present', async () => {
    writeFileSync(configPath, JSON.stringify({
      jira: {
        baseUrl: 'https://jira.file.example.com',
        bearerToken: 'stale-file-token'
      }
    }));
    process.env.JIRA_BASE_URL = 'https://jira.env.example.com';
    process.env.JIRA_BEARER_TOKEN = 'env-token';

    const config = await loadConfig();

    expect(config.baseUrl).toBe('https://jira.env.example.com');
    expect(config.bearerToken).toBe('env-token');
  });

  it('does not fall back to config.json when environment variables are missing', async () => {
    writeFileSync(configPath, JSON.stringify({
      jira: {
        baseUrl: 'https://jira.file.example.com',
        bearerToken: 'stale-file-token'
      }
    }));
    delete process.env.JIRA_BASE_URL;
    delete process.env.JIRA_BEARER_TOKEN;
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(loadConfig()).rejects.toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits with an error when no environment variables are set', async () => {
    delete process.env.JIRA_BASE_URL;
    delete process.env.JIRA_BEARER_TOKEN;
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(loadConfig()).rejects.toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
