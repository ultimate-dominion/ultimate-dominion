# Discourse Forum Setup — tavern.ultimatedominion.com

Step-by-step runbook for self-hosting the Ultimate Dominion community forum.

---

## 1. Server Provisioning

**Recommended**: Hetzner CX23 (2 vCPU, 4 GB RAM, 40 GB disk) — €3.49/month.

Alternatives:
- Hetzner CX33 (4 vCPU, 8 GB, 80 GB) — €5.49/month if you expect >500 active users
- Hetzner CAX11 (Ampere ARM, 2 vCPU, 4 GB) — €3.79/month (ARM — Discourse Docker supports it but less battle-tested)
- DigitalOcean Basic Droplet (2 vCPU, 4 GB) — ~$24/month (pricier for same specs)

**OS**: Ubuntu 22.04 LTS

**Provision the server**, then SSH in:
```bash
ssh root@<server-ip>
```

Set hostname:
```bash
hostnamectl set-hostname tavern.ultimatedominion.com
```

## 2. DNS Configuration (Cloudflare)

In Cloudflare DNS for `ultimatedominion.com`:

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | tavern | `<server-ip>` | DNS only (grey cloud) |

**Important**: Use "DNS only" mode (grey cloud), NOT "Proxied" (orange cloud). Discourse needs direct access for Let's Encrypt certificate provisioning. Cloudflare's proxy interferes with the ACME challenge.

After adding the record, verify:
```bash
dig tavern.ultimatedominion.com +short
# Should return <server-ip>
```

## 3. Install Discourse

Official one-liner install (runs the setup wizard):
```bash
wget -qO- https://raw.githubusercontent.com/discourse/discourse_docker/main/scripts/web-only-install | bash
```

The wizard will prompt for:
- **Hostname**: `tavern.ultimatedominion.com`
- **Admin email**: your email (you'll get a confirmation link)
- **SMTP settings**: see next section

If you need to re-run setup later:
```bash
cd /var/discourse
./discourse-setup
```

## 4. SMTP Configuration

Discourse requires email for account activation, notifications, and password resets.

### Option A: Mailgun (Recommended for beta)

1. Sign up at https://www.mailgun.com/ (free tier: 100 emails/day)
2. Add and verify domain: `mg.ultimatedominion.com`
3. Add DNS records Mailgun provides (MX, TXT, CNAME) in Cloudflare
4. Use these SMTP settings in Discourse setup:

```
SMTP server:    smtp.mailgun.org
SMTP port:      587
SMTP username:  postmaster@mg.ultimatedominion.com
SMTP password:  <from Mailgun dashboard>
Notification email: tavern@ultimatedominion.com
```

### Option B: Skip SMTP (dev/testing only)

You can skip SMTP during initial setup and activate your admin account manually:
```bash
cd /var/discourse
./launcher enter app
rails c
> User.find_by_email("your@email.com").activate
```

**Warning**: Without SMTP, no one else can create accounts (no activation emails). Set up SMTP before inviting players.

## 5. Category Structure

After first login as admin, create categories matching the GO_TO_MARKET.md forum structure.

Go to **Admin > Categories** and create:

### Top-Level Categories

| Category | Color | Description |
|----------|-------|-------------|
| Announcements | `#e45735` | Official news from the dev team |
| Game Discussion | `#0088cc` | Talk about the game |
| Guides | `#3ab54a` | Player guides and knowledge |
| Community | `#92278f` | Social, creative, off-topic |
| Support | `#f7941d` | Bug reports and help |

### Subcategories

**Announcements:**
- Patch Notes — Version updates and changelogs (changelog bot posts here)
- Developer Blogs — Dev logs and retrospectives

**Game Discussion:**
- General Discussion
- Classes & Builds (high SEO value — players searching for build guides)
- Strategy & Tactics
- Lore & World Building
- Suggestions & Feedback

**Guides:**
- Beginner's Guide
- Economy & Trading Guides

**Community:**
- PvP Rankings & Leaderboard
- Fan Art & Creative Content
- Off-Topic / The Tavern

**Support:**
- Bug Reports
- Technical Support

### Category Settings

For each category, set:
- **Announcements > Patch Notes**: Only staff can create topics (bot + admin), everyone can reply
- **Support > Bug Reports**: Use a topic template:
  ```
  **What happened:**

  **What I expected:**

  **Steps to reproduce:**

  **Browser / Device:**

  **Screenshot (if applicable):**
  ```

## 6. Admin Configuration

### Site Settings (Admin > Settings)

**Required:**
```
title:                    Ultimate Dominion — The Tavern
site description:         Community forum for Ultimate Dominion, a browser MMORPG
contact email:            tavern@ultimatedominion.com
contact url:              https://ultimatedominion.com
logo:                     (upload game logo)
favicon:                  (upload game favicon)
default theme:            Dark (matches game aesthetic)
```

**Trust Levels** (keep defaults, they're well-tuned):
- TL0 (New): Can post, limited to 3 topics/day, 10 replies/day
- TL1 (Basic): Earned after reading 5 topics, 30 posts — can send PMs
- TL2 (Member): Earned after 15 days — can edit wiki posts, invite users
- TL3 (Regular): Auto-earned by active users — can recategorize, rename topics

**Rate Limits** (keep defaults unless spam is a problem):
```
rate limit create topic:    15  (seconds between new topics)
rate limit create post:      5  (seconds between replies)
max topics per day:         20
max posts per day:          40  (for TL0 users)
```

**Branding:**
- Upload the game logo (from `packages/client/public/`)
- Set the dark theme as default
- Customize the header with game colors

### Plugins (Optional)

Discourse has a built-in plugin system. Useful ones:
- `discourse-solved` — Mark answers in Support category
- `discourse-voting` — Feature voting in Suggestions category
- `discourse-data-explorer` — SQL queries on forum data

Install by adding to `app.yml`:
```yaml
hooks:
  after_code:
    - exec:
        cd: $home/plugins
        cmd:
          - git clone https://github.com/discourse/discourse-solved.git
          - git clone https://github.com/discourse/discourse-voting.git
```

Then rebuild: `./launcher rebuild app`

## 7. Authentication

### Phase 1 (Beta Launch): Standard Auth

Use Discourse's built-in email/password authentication. Simple, works, no extra setup.

Optionally enable social logins (Admin > Settings > Login):
- Google OAuth (since the game already uses Google sign-in via Thirdweb)
- GitHub OAuth (for dev community overlap)

### Phase 2: DiscourseConnect SSO

Bridge the game's Thirdweb auth to Discourse so players sign in once:

1. In Discourse admin, enable `discourse connect url` and set it to an endpoint on your API
2. Build a `/api/discourse-sso` endpoint that:
   - Validates the Thirdweb session
   - Returns nonce, email, external_id (wallet address), username
3. Set `discourse connect secret` to a shared secret

This is a Phase 2 enhancement — don't block the forum launch on it.

## 8. API Key for Changelog Bot

The `scripts/changelog.mjs` script posts patch notes automatically. Create a scoped API key:

1. Go to **Admin > API > New API Key**
2. Settings:
   - **Description**: `changelog-bot`
   - **User Level**: Single User → `system`
   - **Scope**: Check "Granular" → select only `posts#create` and `search#query`
3. Copy the generated key
4. Add to your project's `.env`:
   ```
   DISCOURSE_URL=https://tavern.ultimatedominion.com
   DISCOURSE_API_KEY=<paste key>
   DISCOURSE_API_USERNAME=system
   DISCOURSE_PATCH_NOTES_CATEGORY_ID=<id from step 5>
   ```

To find the category ID: go to the Patch Notes category page, the ID is in the URL (`/c/announcements/patch-notes/<id>`), or use the API:
```bash
curl -s https://tavern.ultimatedominion.com/categories.json | jq '.category_list.categories[] | {id, name}'
```

## 9. Seed Content

Don't launch an empty forum. Before inviting players, create these posts:

- [ ] **Welcome to The Tavern** (pinned in General Discussion) — What this forum is, who you are, what the game is about. Link to the manifesto.
- [ ] **Beginner's Guide** (pinned in Guides > Beginner's Guide) — How to sign up, create a character, first steps. Adapt from in-game tutorial.
- [ ] **First Changelog** (in Announcements > Patch Notes) — Run `pnpm changelog` for the current version. Even if it's sparse, it shows the forum is active.
- [ ] **Known Issues** (pinned in Support > Bug Reports) — Be transparent about beta state.
- [ ] **Suggestions Welcome** (pinned in Suggestions & Feedback) — Encourage feedback, explain how suggestions are reviewed.

## 10. Backups & Maintenance

### Automatic Backups

Discourse has built-in backups. Configure at **Admin > Backups**:
- Enable automatic backups (daily)
- Keep at least 5 backups
- Optionally configure S3 backup uploads (Admin > Settings > Backups > `s3_backup_bucket`)

### Manual Backup
```bash
cd /var/discourse
./launcher enter app
discourse backup
exit
# Backups are in /var/discourse/shared/standalone/backups/
```

### Updating Discourse
```bash
cd /var/discourse
git pull
./launcher rebuild app
```

Discourse publishes updates frequently. Check the admin dashboard — it shows when updates are available. Update at least monthly.

### Monitoring

Check disk space periodically (uploads and backups grow):
```bash
df -h
du -sh /var/discourse/shared/standalone/uploads/
```

---

## Quick Reference

| Item | Value |
|------|-------|
| URL | `https://tavern.ultimatedominion.com` |
| Server | Hetzner CX23 (€3.49/mo) |
| DNS | A record, DNS-only (grey cloud) in Cloudflare |
| SMTP | Mailgun free tier via `mg.ultimatedominion.com` |
| Auth | Standard (Phase 1), DiscourseConnect SSO (Phase 2) |
| Bot API scope | `posts#create`, `search#query` |
| Backups | Daily automatic, 5 retained |

---

_Last updated: February 2026_
