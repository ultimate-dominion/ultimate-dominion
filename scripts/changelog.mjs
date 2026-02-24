#!/usr/bin/env node

/**
 * changelog.mjs — Generate changelogs from conventional commits and post to Discourse.
 *
 * Usage:
 *   node scripts/changelog.mjs                    # Full run: update CHANGELOG.md + post to Discourse
 *   node scripts/changelog.mjs --dry-run          # Preview markdown output, no side effects
 *   node scripts/changelog.mjs --no-post          # Update CHANGELOG.md only, skip Discourse
 *   node scripts/changelog.mjs --no-changelog     # Post to Discourse only, skip CHANGELOG.md
 *   node scripts/changelog.mjs --from v0.1.0      # Override start tag
 *   node scripts/changelog.mjs --to v0.1.3        # Override end tag (default: latest tag)
 *
 * Env vars (from root .env):
 *   DISCOURSE_URL                    — e.g. https://tavern.ultimatedominion.com
 *   DISCOURSE_API_KEY                — Scoped API key (posts#create, search#query)
 *   DISCOURSE_API_USERNAME           — e.g. system
 *   DISCOURSE_PATCH_NOTES_CATEGORY_ID — Category ID for Patch Notes
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// --- Load .env from project root (zero-dependency) ---

const envPath = resolve(ROOT, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

// --- CLI args ---

const args = process.argv.slice(2);
const flags = {
  dryRun: args.includes("--dry-run"),
  noPost: args.includes("--no-post"),
  noChangelog: args.includes("--no-changelog"),
  from: argValue("--from"),
  to: argValue("--to"),
};

function argValue(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

// --- Git helpers ---

function exec(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: "utf-8" }).trim();
}

function getTags() {
  try {
    return exec("git tag -l 'v*' --sort=-version:refname").split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

function getCommitsBetween(from, to) {
  const range = from ? `${from}..${to}` : to;
  try {
    const log = exec(`git log ${range} --pretty=format:"%H|||%s" --no-merges`);
    if (!log) return [];
    return log.split("\n").map((line) => {
      const [hash, ...rest] = line.split("|||");
      return { hash: hash.replace(/"/g, ""), subject: rest.join("|||").replace(/"/g, "") };
    });
  } catch {
    return [];
  }
}

function getTagDate(tag) {
  try {
    return exec(`git log -1 --format=%ai ${tag}`).split(" ")[0];
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

// --- Conventional commit parser ---

const COMMIT_TYPES = {
  feat: { heading: "New Features", emoji: "" },
  fix: { heading: "Bug Fixes", emoji: "" },
  docs: { heading: "Documentation", emoji: "" },
  refactor: { heading: "Refactoring", emoji: "" },
  perf: { heading: "Performance", emoji: "" },
  chore: { heading: "Maintenance", emoji: "" },
  style: { heading: "Styling", emoji: "" },
  test: { heading: "Tests", emoji: "" },
  ci: { heading: "CI/CD", emoji: "" },
};

function parseCommit(subject) {
  // Match: type(scope): message  OR  type: message
  const match = subject.match(/^(\w+)(?:\(([^)]+)\))?:\s*(.+)$/);
  if (!match) return { type: "other", scope: null, message: subject };
  return {
    type: match[1].toLowerCase(),
    scope: match[2] || null,
    message: match[3].charAt(0).toUpperCase() + match[3].slice(1),
  };
}

function groupCommits(commits) {
  const groups = {};
  for (const commit of commits) {
    const parsed = parseCommit(commit.subject);
    const type = COMMIT_TYPES[parsed.type] ? parsed.type : "other";
    if (!groups[type]) groups[type] = [];
    const scope = parsed.scope ? `**${parsed.scope}**: ` : "";
    groups[type].push(`- ${scope}${parsed.message}`);
  }
  return groups;
}

// --- Markdown formatting ---

function formatMarkdown(version, date, groups) {
  const lines = [`## ${version} (${date})`, ""];

  // Ordered types, skip empty
  const typeOrder = ["feat", "fix", "perf", "refactor", "docs", "style", "test", "ci", "chore", "other"];
  for (const type of typeOrder) {
    if (!groups[type] || groups[type].length === 0) continue;
    const heading = COMMIT_TYPES[type]?.heading || "Other Changes";
    lines.push(`### ${heading}`, "");
    lines.push(...groups[type], "");
  }

  return lines.join("\n").trimEnd();
}

function formatDiscoursePost(version, date, groups) {
  const lines = [`# ${version} Patch Notes`, "", `*Released ${date}*`, ""];

  const typeOrder = ["feat", "fix", "perf", "refactor", "docs", "style", "test", "ci", "chore", "other"];
  for (const type of typeOrder) {
    if (!groups[type] || groups[type].length === 0) continue;
    const heading = COMMIT_TYPES[type]?.heading || "Other Changes";
    lines.push(`## ${heading}`, "");
    lines.push(...groups[type], "");
  }

  lines.push("---", "", "*This changelog was auto-generated from commit history.*");
  return lines.join("\n").trimEnd();
}

// --- CHANGELOG.md update ---

function updateChangelog(markdown) {
  const changelogPath = resolve(ROOT, "CHANGELOG.md");
  const header = "# Changelog\n\nAll notable changes to Ultimate Dominion are documented here.\n";

  if (!existsSync(changelogPath)) {
    writeFileSync(changelogPath, `${header}\n${markdown}\n`, "utf-8");
    console.log("Created CHANGELOG.md");
    return;
  }

  let content = readFileSync(changelogPath, "utf-8");

  // Insert new section after header / [Unreleased] section
  const unreleasedIdx = content.indexOf("## [Unreleased]");
  const firstVersionIdx = content.search(/^## v?\d+\.\d+/m);

  if (unreleasedIdx !== -1) {
    // Find the next ## after [Unreleased]
    const afterUnreleased = content.indexOf("\n## ", unreleasedIdx + 1);
    if (afterUnreleased !== -1) {
      content = content.slice(0, afterUnreleased) + "\n\n" + markdown + "\n" + content.slice(afterUnreleased);
    } else {
      content = content.trimEnd() + "\n\n" + markdown + "\n";
    }
  } else if (firstVersionIdx !== -1) {
    content = content.slice(0, firstVersionIdx) + markdown + "\n\n" + content.slice(firstVersionIdx);
  } else {
    content = content.trimEnd() + "\n\n" + markdown + "\n";
  }

  writeFileSync(changelogPath, content, "utf-8");
  console.log("Updated CHANGELOG.md");
}

// --- Discourse API ---

async function searchDiscourse(title) {
  const url = process.env.DISCOURSE_URL;
  const key = process.env.DISCOURSE_API_KEY;
  const username = process.env.DISCOURSE_API_USERNAME || "system";

  const searchUrl = `${url}/search.json?q=${encodeURIComponent(title + " in:title")}`;
  const res = await fetch(searchUrl, {
    headers: {
      "Api-Key": key,
      "Api-Username": username,
    },
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.topics?.find((t) => t.title === title) || null;
}

async function postToDiscourse(title, body) {
  const url = process.env.DISCOURSE_URL;
  const key = process.env.DISCOURSE_API_KEY;
  const username = process.env.DISCOURSE_API_USERNAME || "system";
  const categoryId = process.env.DISCOURSE_PATCH_NOTES_CATEGORY_ID;

  if (!url || !key || !categoryId) {
    console.warn("Discourse env vars missing (DISCOURSE_URL, DISCOURSE_API_KEY, DISCOURSE_PATCH_NOTES_CATEGORY_ID).");
    console.warn("Skipping Discourse post. Set these in .env when the forum is live.");
    return;
  }

  // Idempotency: check if topic already exists
  const existing = await searchDiscourse(title);
  if (existing) {
    console.log(`Topic already exists: ${url}/t/${existing.slug}/${existing.id}`);
    console.log("Skipping duplicate post.");
    return;
  }

  const res = await fetch(`${url}/posts.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": key,
      "Api-Username": username,
    },
    body: JSON.stringify({
      title,
      raw: body,
      category: parseInt(categoryId, 10),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Discourse API error (${res.status}): ${text}`);
    process.exit(1);
  }

  const data = await res.json();
  console.log(`Posted to Discourse: ${url}/t/${data.topic_slug}/${data.topic_id}`);
}

// --- Main ---

async function main() {
  const tags = getTags();

  if (tags.length === 0) {
    console.error("No version tags found. Create a tag first: git tag v0.1.0");
    process.exit(1);
  }

  const toTag = flags.to || tags[0];
  const fromTag = flags.from || tags.find((t) => t !== toTag) || null;

  const date = getTagDate(toTag);
  const commits = getCommitsBetween(fromTag, toTag);

  if (commits.length === 0) {
    console.log(`No commits found between ${fromTag || "(beginning)"} and ${toTag}.`);
    process.exit(0);
  }

  console.log(`\nChangelog: ${fromTag || "(beginning)"} -> ${toTag} (${commits.length} commits)\n`);

  const groups = groupCommits(commits);
  const changelogMd = formatMarkdown(toTag, date, groups);
  const discourseMd = formatDiscoursePost(toTag, date, groups);

  if (flags.dryRun) {
    console.log("=== CHANGELOG.md entry ===\n");
    console.log(changelogMd);
    console.log("\n=== Discourse post ===\n");
    console.log(discourseMd);
    console.log("\n(dry run — no files written, no posts made)");
    return;
  }

  if (!flags.noChangelog) {
    updateChangelog(changelogMd);
  }

  if (!flags.noPost) {
    const title = `${toTag} Patch Notes`;
    await postToDiscourse(title, discourseMd);
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
