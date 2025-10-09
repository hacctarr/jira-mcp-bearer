import { HTTP_STATUS, REQUEST_TIMEOUT_MS, MAX_RETRIES, RETRY_DELAY_BASE_MS, sleep } from './utils.js';

/**
 * Makes authenticated request to Jira REST API with timeout and retry logic
 * @param {string} baseUrl - Jira base URL
 * @param {string} bearerToken - Bearer authentication token
 * @param {string} endpoint - API endpoint path (e.g., '/rest/api/2/issue/DEV-123')
 * @param {Object} options - Fetch options
 * @param {number} retries - Number of retries remaining (default: MAX_RETRIES)
 * @returns {Promise<Object|null>} Parsed JSON response or null for 204 responses
 * @throws {Error} On HTTP errors with specific messages or timeout
 */
export async function jiraRequest(baseUrl, bearerToken, endpoint, options = {}, retries = MAX_RETRIES) {
  const url = `${baseUrl}${endpoint}`;

  // Debug logging
  if (process.env.DEBUG === 'true') {
    console.error(`[${options.method || 'GET'}] ${url}`);
    if (options.body) {
      console.error(`[BODY] ${options.body}`);
    }
  }

  // Set up abort controller for timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'jira-mcp-bearer/1.0.0',
        ...options.headers,
      },
    });

    if (!response.ok) {
      // Specific error messages based on status code
      let errorMessage;
      const isRetryable = [
        HTTP_STATUS.BAD_GATEWAY,
        HTTP_STATUS.SERVICE_UNAVAILABLE,
        HTTP_STATUS.GATEWAY_TIMEOUT
      ].includes(response.status);

      switch (response.status) {
        case HTTP_STATUS.UNAUTHORIZED:
          errorMessage = 'Authentication failed. Your Bearer token is invalid or expired.';
          break;
        case HTTP_STATUS.FORBIDDEN:
          errorMessage = 'Permission denied. Your Bearer token does not have access to this resource.';
          break;
        case HTTP_STATUS.NOT_FOUND:
          errorMessage = 'Resource not found. Check that the issue key, project key, or endpoint is correct.';
          break;
        case HTTP_STATUS.TOO_MANY_REQUESTS:
          errorMessage = 'Rate limit exceeded. Please wait before making more requests.';
          break;
        case HTTP_STATUS.INTERNAL_SERVER_ERROR:
        case HTTP_STATUS.BAD_GATEWAY:
        case HTTP_STATUS.SERVICE_UNAVAILABLE:
        case HTTP_STATUS.GATEWAY_TIMEOUT:
          errorMessage = `Jira server error (${response.status}). The server may be temporarily unavailable.`;
          break;
        default:
          errorMessage = `Jira API error: ${response.status} ${response.statusText}`;
      }

      // Try to get more details from response body
      try {
        const errorBody = await response.json();
        if (errorBody.errorMessages && errorBody.errorMessages.length > 0) {
          errorMessage += `\nDetails: ${errorBody.errorMessages.join(', ')}`;
        }
      } catch {
        // Ignore JSON parse errors
      }

      // Retry logic for transient errors
      if (isRetryable && retries > 0) {
        const delay = RETRY_DELAY_BASE_MS * (MAX_RETRIES - retries + 1);
        if (process.env.DEBUG === 'true') {
          console.error(`[RETRY] ${response.status} error, retrying in ${delay}ms (${retries} retries left)`);
        }
        await sleep(delay);
        return jiraRequest(baseUrl, bearerToken, endpoint, options, retries - 1);
      }

      console.error(`Jira API error for ${endpoint}:`, errorMessage);
      const error = new Error(errorMessage);
      error.status = response.status;
      throw error;
    }

    if (response.status === 204) {
      return null;
    }

    const data = await response.json();

    if (process.env.DEBUG === 'true') {
      console.error(`[RESPONSE] ${response.status} - ${JSON.stringify(data).length} bytes`);
    }

    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error(`Request timeout for ${endpoint} after ${REQUEST_TIMEOUT_MS}ms`);
      throw new Error(`Request timeout: The request took longer than ${REQUEST_TIMEOUT_MS / 1000} seconds`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
