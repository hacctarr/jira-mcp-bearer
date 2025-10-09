# Package Promotion & Tracking Guide

Your package is now live at: https://www.npmjs.com/package/jira-mcp-bearer

## 📊 How to Track Usage

### 1. npm Download Statistics

**Check download stats:**
```bash
# View in browser
open https://www.npmjs.com/package/jira-mcp-bearer

# Or use npm-stat CLI
npx npm-stat jira-mcp-bearer

# Or check via API
curl https://api.npmjs.org/downloads/point/last-week/jira-mcp-bearer
```

**npm Stats Websites:**
- https://npm-stat.com/charts.html?package=jira-mcp-bearer
- https://npmtrends.com/jira-mcp-bearer
- https://npmcharts.com/compare/jira-mcp-bearer

### 2. GitHub Statistics

**Track GitHub activity:**
```bash
# Stars
gh repo view hacctarr/jira-mcp-bearer --json stargazerCount

# Forks
gh repo view hacctarr/jira-mcp-bearer --json forkCount

# Traffic (requires repo admin)
gh api repos/hacctarr/jira-mcp-bearer/traffic/views

# Clones
gh api repos/hacctarr/jira-mcp-bearer/traffic/clones
```

**Monitor:**
- Stars: https://github.com/hacctarr/jira-mcp-bearer/stargazers
- Watchers: https://github.com/hacctarr/jira-mcp-bearer/watchers
- Forks: https://github.com/hacctarr/jira-mcp-bearer/network/members
- Issues: https://github.com/hacctarr/jira-mcp-bearer/issues

### 3. Set Up Notifications

**GitHub:**
- Settings → Notifications → Watch repository
- Get notified for issues, PRs, discussions

**npm:**
- No direct notifications, but you'll get emails when people:
  - Report security issues
  - Contact you via npm profile

---

## 🎯 How People Find Your Package

### 1. npm Search ✅ Already Works

People searching for these terms will find you:
- "jira mcp"
- "bearer auth jira"
- "jira server mcp"
- "claude jira"
- "model context protocol jira"

**Your keywords (already configured):**
- mcp
- jira
- bearer-auth
- jira-server
- jira-data-center
- model-context-protocol
- claude-code
- anthropic
- ai-integration

### 2. MCP Server Registry (Submit Now!)

**Submit to official registry:**
1. Visit: https://github.com/modelcontextprotocol/servers
2. Fork the repository
3. Add your server to the README or registry file
4. Submit pull request

**Template for submission:**
```markdown
### jira-mcp-bearer
Bearer token authentication for Jira Server/Data Center

- npm: https://www.npmjs.com/package/jira-mcp-bearer
- GitHub: https://github.com/hacctarr/jira-mcp-bearer
- Features: 20 tools, caching, retry logic, field filtering
```

### 3. Google Search (Takes 1-2 weeks)

Your package will appear in Google for:
- "jira bearer token mcp"
- "jira server model context protocol"
- "claude jira integration"

**Accelerate indexing:**
- Submit sitemap to Google Search Console
- Share links on social media
- Get backlinks from blogs/forums

---

## 🚀 Promotion Strategies

### Immediate Actions (Do Now)

#### 1. Add npm Badges to README

Add to top of README.md after title:
```markdown
[![npm version](https://img.shields.io/npm/v/jira-mcp-bearer.svg)](https://www.npmjs.com/package/jira-mcp-bearer)
[![npm downloads](https://img.shields.io/npm/dm/jira-mcp-bearer.svg)](https://www.npmjs.com/package/jira-mcp-bearer)
[![GitHub stars](https://img.shields.io/github/stars/hacctarr/jira-mcp-bearer.svg)](https://github.com/hacctarr/jira-mcp-bearer/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
```

#### 2. Submit to MCP Registry

**Create PR to:** https://github.com/modelcontextprotocol/servers

#### 3. Update GitHub Repository

**Add topics to repository:**
```bash
gh repo edit hacctarr/jira-mcp-bearer --add-topic mcp
gh repo edit hacctarr/jira-mcp-bearer --add-topic jira
gh repo edit hacctarr/jira-mcp-bearer --add-topic bearer-auth
gh repo edit hacctarr/jira-mcp-bearer --add-topic claude-code
gh repo edit hacctarr/jira-mcp-bearer --add-topic model-context-protocol
gh repo edit hacctarr/jira-mcp-bearer --add-topic jira-server
gh repo edit hacctarr/jira-mcp-bearer --add-topic anthropic
```

**Add description:**
```bash
gh repo edit hacctarr/jira-mcp-bearer \
  --description "MCP server for Jira Server/Data Center with Bearer token authentication"
```

#### 4. Create GitHub Release

```bash
gh release create v1.0.0 \
  --title "v1.0.0 - Initial Release" \
  --notes "Production-ready MCP server with 20 tools, caching, retry logic, and 90%+ test coverage. See CHANGELOG.md for details."
```

### Short-Term Actions (This Week)

#### 5. Share on Social Platforms

**Reddit:**
- r/programming
- r/javascript
- r/jira
- r/Claude (if exists)

**Template:**
```
I built a Model Context Protocol server for Jira Server/Data Center

Unlike existing Jira MCP packages (designed for Cloud), this works with
Jira Server instances that require Bearer token authentication.

Features:
- 20 tools (search, create, update, delete, comments, etc.)
- Response caching (5-min TTL)
- Retry logic with exponential backoff
- Field filtering to reduce token usage
- 90%+ test coverage

npm: https://www.npmjs.com/package/jira-mcp-bearer
GitHub: https://github.com/hacctarr/jira-mcp-bearer

Feedback welcome!
```

**X/Twitter:**
```
🚀 New npm package: jira-mcp-bearer

Model Context Protocol server for Jira Server/Data Center with Bearer auth.

Unlike Cloud-focused packages, this works with enterprise Jira instances.

20 tools, caching, retries, 90% test coverage.

https://www.npmjs.com/package/jira-mcp-bearer

#MCP #Jira #Claude #AI
```

**LinkedIn:**
```
I just published jira-mcp-bearer, a Model Context Protocol server for enterprise
Jira instances (Server/Data Center).

Why? All existing Jira MCP packages use Basic Auth for Cloud. Enterprise Jira
requires Bearer tokens, which none supported.

Features:
✓ 20 tools (full CRUD + comments, watchers, attachments)
✓ Response caching (90% fewer API calls)
✓ Retry logic with exponential backoff
✓ Field filtering (50-80% token reduction)
✓ 90%+ test coverage

Check it out: https://www.npmjs.com/package/jira-mcp-bearer

#DevTools #Jira #AI #OpenSource
```

#### 6. Create Discussions

**GitHub Discussions:**
- Enable discussions on your repo
- Create "Show and tell" post
- Create "Q&A" for support

```bash
# Enable discussions
gh repo edit hacctarr/jira-mcp-bearer --enable-discussions
```

### Medium-Term Actions (This Month)

#### 7. Write Blog Post

**Platforms:**
- Dev.to
- Medium
- Hashnode
- Your personal blog

**Title ideas:**
- "Building a Model Context Protocol Server for Enterprise Jira"
- "Why Jira Server Needs Bearer Token Authentication (and how I solved it)"
- "From 0% to 90% Test Coverage: Building Production-Grade MCP Servers"

#### 8. Create Video Demo

**YouTube/Loom:**
- 3-5 minute walkthrough
- Installation + setup
- Real use cases with Claude Code
- Upload to YouTube with keywords

#### 9. Submit to Awesome Lists

**Find and submit to:**
- awesome-mcp (if exists)
- awesome-jira
- awesome-claude
- awesome-ai-tools

#### 10. Engage with Community

**Discord/Slack:**
- Join Anthropic Discord
- Join MCP community channels
- Share in relevant channels (not spam)

**Stack Overflow:**
- Answer Jira + MCP questions
- Link to your package when relevant

---

## 📈 Growth Metrics to Track

### Weekly Dashboard

Create a simple tracking sheet:

| Metric | Week 1 | Week 2 | Week 3 | Week 4 |
|--------|--------|--------|--------|--------|
| npm downloads | | | | |
| GitHub stars | | | | |
| GitHub forks | | | | |
| Open issues | | | | |
| Closed issues | | | | |
| Contributors | | | | |

### Key Performance Indicators

**Healthy package signs:**
- 📥 Downloads growing week-over-week
- ⭐ Stars increasing
- 🐛 Issues being reported (shows usage!)
- 💬 Discussions/questions
- 🔀 Pull requests from community

**Red flags:**
- ❌ No downloads after 2 weeks
- ❌ Issues going unanswered
- ❌ No engagement on social posts

---

## 🎯 Success Milestones

### Phase 1: Launch (Week 1-2)
- [ ] 100 downloads
- [ ] 10 GitHub stars
- [ ] Listed in MCP registry
- [ ] 1 social media post
- [ ] 1 GitHub release

### Phase 2: Growth (Month 1-3)
- [ ] 1,000 downloads
- [ ] 50 GitHub stars
- [ ] 5 open issues (shows usage!)
- [ ] 1 external contribution
- [ ] 1 blog post written

### Phase 3: Adoption (Month 3-6)
- [ ] 5,000 downloads
- [ ] 100 GitHub stars
- [ ] 10 active users (issues/discussions)
- [ ] Featured in MCP documentation
- [ ] 5+ stars on npm

---

## 🔔 Monitoring Tools

### Set Up Alerts

**Google Alerts:**
- Create alert for: "jira-mcp-bearer"
- Email daily or weekly

**GitHub:**
- Watch your repository (All Activity)
- Get notified for all issues/PRs

**npm:**
- Check weekly: https://www.npmjs.com/package/jira-mcp-bearer

### Analytics Services (Optional)

**npm-stat Dashboard:**
```bash
# Install globally
npm install -g npm-stat

# Generate stats
npm-stat jira-mcp-bearer --output stats.html
```

**Track mentions:**
- Google Alerts
- Social Mention
- Brand24 (paid)

---

## 💡 Pro Tips

1. **Respond quickly to issues** - Shows package is maintained
2. **Update README with examples** - More examples = more users
3. **Keep CHANGELOG current** - Users like seeing progress
4. **Tag releases properly** - v1.0.1, v1.1.0, etc.
5. **Accept good PRs quickly** - Encourages contribution
6. **Thank contributors** - Build community
7. **Cross-promote** - Mention in other projects/issues when relevant (not spam)

---

## 📊 Quick Check Commands

```bash
# Check downloads
curl https://api.npmjs.org/downloads/point/last-week/jira-mcp-bearer

# Check GitHub stars
gh repo view hacctarr/jira-mcp-bearer --json stargazerCount --jq .stargazerCount

# Check latest version
npm view jira-mcp-bearer version

# Check dependents (who uses your package)
npm view jira-mcp-bearer dependents

# Check npm ranking
npm search jira-mcp-bearer --searchlimit 1
```

---

## 🎉 Celebrate Milestones

When you hit milestones, share them:
- "🎉 100 downloads in first week!"
- "⭐ 50 GitHub stars - thank you!"
- "🚀 v1.1.0 released with new features"

People love seeing open source success stories!

---

## Next Steps (Priority Order)

1. ✅ Add badges to README
2. ✅ Submit to MCP registry
3. ✅ Add GitHub topics
4. ✅ Create v1.0.0 release
5. ✅ Share on one social platform
6. ✅ Set up weekly tracking

Good luck! 🚀
