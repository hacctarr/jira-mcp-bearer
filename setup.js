#!/usr/bin/env node

/**
 * Setup script for Jira MCP Server
 * Creates config.json file with user credentials
 */

import { writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as readline from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = join(__dirname, 'config.json');

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log('🔧 Jira MCP Server Setup\n');

  // Check if config already exists
  if (existsSync(configPath)) {
    const overwrite = await question('Config file already exists. Overwrite? (y/N): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('Setup cancelled.');
      rl.close();
      return;
    }
  }

  // Get Jira base URL
  const baseUrl = await question('Enter your Jira base URL (e.g., https://jira.example.com): ');
  if (!baseUrl || !baseUrl.startsWith('http')) {
    console.error('Error: Invalid URL. Must start with http:// or https://');
    rl.close();
    process.exit(1);
  }

  // Get bearer token
  const bearerToken = await question('Enter your Jira bearer token: ');
  if (!bearerToken) {
    console.error('Error: Bearer token is required');
    rl.close();
    process.exit(1);
  }

  // Create config object
  const config = {
    jira: {
      baseUrl: baseUrl.replace(/\/$/, ''), // Remove trailing slash
      bearerToken
    }
  };

  // Write config file
  try {
    await writeFile(configPath, JSON.stringify(config, null, 2));
    console.log(`\n✅ Configuration saved to ${configPath}`);
    console.log('\n📝 Next steps:');
    console.log('1. Add to Claude Code MCP:');
    console.log(`   claude mcp add jira ${join(__dirname, 'index.js')}`);
    console.log('\n2. Verify connection:');
    console.log('   claude mcp list');
    console.log('\n⚠️  Important: config.json is gitignored to keep credentials secure');
  } catch (error) {
    console.error('Error writing config file:', error.message);
    process.exit(1);
  }

  rl.close();
}

main().catch((error) => {
  console.error('Setup failed:', error);
  process.exit(1);
});
