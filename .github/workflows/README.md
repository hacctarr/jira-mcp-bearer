# GitHub Actions Workflows

## Workflows

### 1. Tests (`test.yml`)
Runs on every push and pull request to `main` branch.

**What it does:**
- Tests on Node.js 18, 20, and 22
- Runs full test suite
- Generates coverage report (Node 22 only)
- Uploads coverage to Codecov (optional)

**Status:** Runs automatically, no setup needed

### 2. Publish to npm (`publish.yml`)
Runs when you create a GitHub release.

**What it does:**
- Runs tests before publishing
- Publishes to npm with provenance
- Only runs on release (manual trigger)

**Setup Required:** Add npm token to GitHub secrets

---

## Setup: npm Publishing

To enable automatic npm publishing, you need to add your npm token to GitHub:

### Step 1: Create npm Access Token

1. Login to npm: https://www.npmjs.com/login
2. Go to Access Tokens: https://www.npmjs.com/settings/YOUR_USERNAME/tokens
3. Click "Generate New Token" → "Classic Token"
4. Select type: **"Automation"**
5. Copy the token (starts with `npm_...`)

### Step 2: Add Token to GitHub Secrets

1. Go to your repository: https://github.com/hacctarr/jira-mcp-bearer
2. Go to Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Name: `NPM_TOKEN`
5. Value: Paste your npm token
6. Click "Add secret"

### Step 3: Test the Workflow

1. Make sure your code is committed and pushed
2. Create a new release:
   ```bash
   # Option 1: Using GitHub CLI
   gh release create v1.0.2 --title "v1.0.2 - Feature updates" --notes "See CHANGELOG.md"

   # Option 2: Via GitHub web UI
   # Go to: https://github.com/hacctarr/jira-mcp-bearer/releases/new
   # Tag: v1.0.2
   # Title: v1.0.2 - Feature updates
   # Description: Copy from CHANGELOG.md
   ```

3. The workflow will automatically:
   - Run tests
   - Publish to npm
   - Show results in Actions tab

---

## Workflow: Publishing a New Version

### Manual Process (Current)

```bash
# 1. Update version
npm version patch   # or minor/major

# 2. Push to GitHub
git push && git push --tags

# 3. Publish to npm
npm publish

# 4. Create GitHub release manually
```

### Automated Process (After Setup)

```bash
# 1. Update version
npm version patch   # or minor/major

# 2. Push to GitHub
git push && git push --tags

# 3. Create GitHub release (triggers auto-publish)
gh release create v1.0.2 --generate-notes

# That's it! GitHub Actions publishes to npm automatically
```

---

## Optional: Codecov Setup

To enable coverage reports on PRs:

1. Go to https://codecov.io
2. Sign in with GitHub
3. Add repository: `hacctarr/jira-mcp-bearer`
4. Copy the upload token
5. Add to GitHub secrets as `CODECOV_TOKEN`

Coverage badges will appear on PRs automatically.

---

## Troubleshooting

### Publish workflow fails with 403

**Problem:** npm token is invalid or expired

**Solution:**
1. Generate new npm token (Automation type)
2. Update `NPM_TOKEN` secret in GitHub
3. Re-run the workflow

### Tests fail in CI but pass locally

**Problem:** Different Node.js version or missing dependencies

**Solution:**
1. Check which Node version failed in Actions tab
2. Test locally with that version: `nvm use 18 && npm test`
3. Fix compatibility issues

### Workflow doesn't trigger

**Problem:** Release tag format incorrect

**Solution:**
- Use `v1.0.2` format (with v prefix)
- Create release from Tags page, not manually
- Or use `gh release create` command

---

## Security Notes

- ✅ Uses `npm publish --provenance` for supply chain security
- ✅ npm token scoped to Automation (read/write packages only)
- ✅ Token stored in GitHub encrypted secrets
- ✅ Tests run before publishing (prevents bad releases)
- ⚠️ Rotate npm token every 90 days (good practice)
