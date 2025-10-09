import { z } from 'zod';
import { resolve } from 'path';

// Constants
export const HTTP_STATUS = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504
};

export const REQUEST_TIMEOUT_MS = 30000; // 30 seconds
export const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes for static data
export const MAX_RETRIES = 3;
export const RETRY_DELAY_BASE_MS = 1000; // Exponential backoff base delay

// Simple in-memory cache for static data
const cache = new Map();

/**
 * Cache wrapper with TTL support
 * @param {string} key - Cache key
 * @param {Function} fetchFn - Function to fetch data if not cached
 * @param {number} ttl - Time to live in milliseconds
 * @returns {Promise<any>} Cached or fresh data
 */
export async function getCached(key, fetchFn, ttl = CACHE_TTL_MS) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < ttl) {
    if (process.env.DEBUG === 'true') {
      console.error(`[CACHE HIT] ${key}`);
    }
    return cached.data;
  }

  if (process.env.DEBUG === 'true') {
    console.error(`[CACHE MISS] ${key}`);
  }

  const data = await fetchFn();
  cache.set(key, { data, timestamp: Date.now() });
  return data;
}

/**
 * Sleep utility for retry delays
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Validation schemas
export const issueKeySchema = z.string().regex(
  /^[A-Z]+-\d+$/,
  'Invalid issue key format. Must be uppercase letters, hyphen, then numbers (e.g., DEV-123)'
);

export const projectKeySchema = z.string().regex(
  /^[A-Z]+$/,
  'Invalid project key format. Must be uppercase letters only (e.g., DEV, PROJ)'
);

export const jqlSchema = z.string().min(1, 'JQL query cannot be empty');

export const summarySchema = z.string().min(1, 'Summary cannot be empty').max(255, 'Summary too long (max 255 characters)');

export const maxResultsSchema = z.number().int().min(1).max(50, 'Maximum 50 results allowed');

/**
 * Validates file path to prevent path traversal attacks
 * @param {string} filePath - Path to validate
 * @returns {boolean} True if path is safe
 */
export function isValidFilePath(filePath) {
  const resolved = resolve(filePath);
  const cwd = resolve(process.cwd());
  return resolved.startsWith(cwd);
}
