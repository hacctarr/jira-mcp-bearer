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
- Publishes to npm with provenance using OIDC
- Only runs on release (manual trigger)

**Setup Required:** Configure npm for OIDC authentication

---

## Setup: npm Publishing with OIDC

The publish workflow uses **OpenID Connect (OIDC)** for secure, tokenless authentication with npm.

### Step 1: Configure npm for OIDC

1. Login to npm: https://www.npmjs.com/login
2. Go to package settings: https://www.npmjs.com/package/jira-mcp-bearer/access
3. Scroll to "Publishing Access"
4. Enable "Require two-factor authentication or automation tokens"
5. Under "GitHub Actions", click "Add"
6. Add subject: `repo:hacctarr/jira-mcp-bearer:ref:refs/tags/*`
7. Save changes

### Step 2: Test the Workflow

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

**Problem:** npm OIDC not configured or subject mismatch

**Solution:**
1. Verify OIDC is enabled on npm package settings
2. Check subject matches: `repo:hacctarr/jira-mcp-bearer:ref:refs/tags/*`
3. Ensure release tag format is correct (e.g., v1.0.2)
4. Re-run the workflow

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

- ✅ Uses OIDC for tokenless authentication (no secrets to rotate)
- ✅ Uses `npm publish --provenance` for supply chain security
- ✅ GitHub Actions automatically handles authentication
- ✅ Tests run before publishing (prevents bad releases)
- ✅ Subject-based authorization restricts publish to specific tags only
