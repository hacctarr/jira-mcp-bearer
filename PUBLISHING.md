# Publishing Guide

This document outlines the three main ways to distribute the Jira MCP Bearer server.

## Option 1: npm Registry (Recommended)

### Why npm?
- ✅ Users install with one command: `npm install -g jira-mcp-bearer`
- ✅ Automatic updates with `npm update`
- ✅ Version management built-in
- ✅ Discoverable on npmjs.com
- ✅ Works with `npx` (no installation needed)

### Prerequisites
1. npm account (create at https://www.npmjs.com/signup)
2. Email verification completed
3. Two-factor authentication enabled (recommended)

### Publishing Steps

```bash
# 1. Login to npm
npm login
# Username: hactar (or your username)
# Password: (your npm password)
# Email: (your npm email)

# 2. Verify you're logged in
npm whoami

# 3. Test package build (dry run)
npm pack --dry-run

# 4. Run tests to ensure quality
npm test

# 5. Publish to npm
npm publish

# 6. Verify publication
npm info jira-mcp-bearer
```

### After Publishing

**Users can install with:**

```bash
# Global installation
npm install -g jira-mcp-bearer

# Run setup
jira-mcp-bearer setup.js

# Or use npx (no installation)
npx jira-mcp-bearer setup.js
```

**Update to Claude Code:**

```bash
# Find installed location
npm root -g

# Add to Claude Code
claude mcp add jira $(npm root -g)/jira-mcp-bearer/index.js \
  -e JIRA_BASE_URL=https://your-jira.com \
  -e JIRA_BEARER_TOKEN=your-token
```

### Publishing Updates

```bash
# 1. Update version in package.json
npm version patch  # 1.0.0 -> 1.0.1
# or
npm version minor  # 1.0.0 -> 1.1.0
# or
npm version major  # 1.0.0 -> 2.0.0

# 2. Update CHANGELOG.md with changes

# 3. Commit changes
git add .
git commit -m "Release v1.0.1"
git push

# 4. Publish to npm
npm publish

# 5. Create GitHub release (optional)
gh release create v1.0.1 --notes "See CHANGELOG.md"
```

---

## Option 2: GitHub Releases

### Why GitHub Releases?
- ✅ No npm account needed
- ✅ Users can download pre-packaged releases
- ✅ Integrated with Git tags
- ✅ Release notes included

### Creating a Release

```bash
# 1. Create and push a tag
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0

# 2. Create GitHub release with CLI
gh release create v1.0.0 \
  --title "v1.0.0 - Initial Release" \
  --notes-file CHANGELOG.md

# Or create manually at:
# https://github.com/hacctarr/jira-mcp-bearer/releases/new
```

**Users install from GitHub:**

```bash
# 1. Download and extract release
wget https://github.com/hacctarr/jira-mcp-bearer/archive/refs/tags/v1.0.0.tar.gz
tar -xzf v1.0.0.tar.gz
cd jira-mcp-bearer-1.0.0

# 2. Install dependencies
npm install

# 3. Run setup
./setup.js

# 4. Add to Claude Code
claude mcp add jira $(pwd)/index.js
```

---

## Option 3: Direct Git Clone (Development)

### Why Git Clone?
- ✅ Always latest version
- ✅ Easy to contribute changes
- ✅ Good for development/testing

**Users install from Git:**

```bash
# 1. Clone repository
git clone https://github.com/hacctarr/jira-mcp-bearer.git
cd jira-mcp-bearer

# 2. Install dependencies
npm install

# 3. Run setup
./setup.js

# 4. Add to Claude Code
claude mcp add jira $(pwd)/index.js
```

**Updating:**

```bash
cd jira-mcp-bearer
git pull
npm install
```

---

## Comparison Table

| Method | Ease of Install | Auto Updates | Discovery | Best For |
|--------|----------------|--------------|-----------|----------|
| **npm** | ⭐⭐⭐⭐⭐ | ✅ Yes | ✅ Yes | General users |
| **GitHub Release** | ⭐⭐⭐ | ❌ Manual | ⚠️ Limited | Enterprise |
| **Git Clone** | ⭐⭐ | ⚠️ Manual pull | ❌ No | Developers |

---

## Recommended: Publish to npm

**For maximum reach and ease of use, publish to npm.**

The package.json is already configured with:
- ✅ Correct entry points (`main`, `bin`)
- ✅ Files whitelist (only ships necessary files)
- ✅ Dependencies properly declared
- ✅ Keywords for discoverability
- ✅ prepublishOnly script (runs tests before publish)
- ✅ Node.js version requirement (>=18.0.0)

---

## Verification Checklist

Before publishing to npm:

- [ ] All tests pass (`npm test`)
- [ ] Coverage meets thresholds (90%+)
- [ ] README.md is up to date
- [ ] CHANGELOG.md documents changes
- [ ] package.json version is correct
- [ ] LICENSE file exists
- [ ] .npmignore excludes test files
- [ ] Dry run successful (`npm pack --dry-run`)
- [ ] Logged into npm (`npm whoami`)

---

## Post-Publication

1. **Add npm badge to README:**
   ```markdown
   [![npm version](https://badge.fury.io/js/jira-mcp-bearer.svg)](https://www.npmjs.com/package/jira-mcp-bearer)
   [![npm downloads](https://img.shields.io/npm/dm/jira-mcp-bearer.svg)](https://www.npmjs.com/package/jira-mcp-bearer)
   ```

2. **Submit to MCP Registry:**
   - Visit: https://github.com/modelcontextprotocol/servers
   - Create PR to add your server to the registry

3. **Announce:**
   - Share on GitHub Discussions
   - Share on relevant Discord/Slack channels
   - Tweet about it (if applicable)

4. **Monitor:**
   - Watch npm download stats
   - Monitor GitHub issues
   - Respond to user feedback

---

## Troubleshooting

### "npm publish" fails with 403
- Check if package name is available: `npm info jira-mcp-bearer`
- Verify you're logged in: `npm whoami`
- Check if you have publish rights

### Package size too large
- Check what's included: `npm pack --dry-run`
- Add files to `.npmignore`
- Remove unnecessary dependencies

### Tests fail on publish
- Ensure `prepublishOnly` script passes locally
- Check Node.js version matches requirements
- Verify all dependencies are in package.json

---

## Maintenance

### Regular Updates
1. Monitor for dependency updates: `npm outdated`
2. Update dependencies: `npm update`
3. Run tests after updates
4. Publish patch releases for fixes

### Security
1. Enable npm 2FA for publishing
2. Use `npm audit` to check for vulnerabilities
3. Keep dependencies up to date
4. Never commit secrets to Git

### Support
- Monitor GitHub issues
- Respond to npm support requests
- Keep documentation current
- Address security reports promptly
