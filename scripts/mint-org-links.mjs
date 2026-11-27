#!/usr/bin/env node
/**
 * Mint clean per-org outreach links for modern-day-coach.com.
 *
 *   node scripts/mint-org-links.mjs batch.csv
 *   node scripts/mint-org-links.mjs batch.csv --out links.csv
 *   MDC_TRACK_FORWARD_SECRET=... node scripts/mint-org-links.mjs batch.csv --register
 *
 * CSV columns: name,type,email,batch_date,campaign,path,code
 *   type: little_league | travel | other
 *   path defaults to /leagues
 *   code is optional (generated as ll- / tb- / org- plus a slug)
 *
 * Links look like:
 *   https://www.modern-day-coach.com/leagues?o=ll-westfield&c=ll-nov-2026
 *
 * Never put a person's name or email in the URL. --register stores the
 * name/email/batch in the MDC Track org registry (Supabase). Visits still
 * attribute by ?o= even before the row is registered; the dashboard then
 * shows the code until the registry has a name.
 *
 * The secret is the existing MDC_TRACK_FORWARD_SECRET on the modern-day-coach
 * and supa-organized Vercel projects. Do not print it or commit it.
 */

import { readFileSync, writeFileSync } from "node:fs";

const ORIGIN = "https://www.modern-day-coach.com";
const REGISTER_URL =
  process.env.MDC_ORG_REGISTER_URL ||
  "https://supa-organized.vercel.app/api/attribution/orgs";

function normalizeCode(raw) {
  if (!raw) return "";
  const t = String(raw).trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]{0,40}$/.test(t) ? t : "";
}

function normalizeCampaign(raw) {
  if (!raw) return "";
  const t = String(raw).trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]{0,80}$/.test(t) ? t : "";
}

function slugify(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32)
    .replace(/-+$/g, "");
}

function codeFor(type, name, explicit) {
  const given = normalizeCode(explicit);
  if (given) return given;
  const prefix = type === "little_league" ? "ll" : type === "travel" ? "tb" : "org";
  const code = normalizeCode(`${prefix}-${slugify(name) || "org"}`);
  if (!code) throw new Error(`could not build a code for ${name}`);
  return code;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') {
      quoted = true;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    if (ch !== "\r") cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => String(c).trim()));
}

function usage() {
  console.error("Usage: node scripts/mint-org-links.mjs <batch.csv> [--out links.csv] [--register]");
  process.exit(1);
}

const args = process.argv.slice(2).filter((a) => a !== "--");
if (!args.length || args.includes("-h") || args.includes("--help")) usage();
const register = args.includes("--register");
const outIdx = args.indexOf("--out");
const outPath = outIdx >= 0 ? args[outIdx + 1] : "";
const file = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--out");
if (!file) usage();

const table = parseCsv(readFileSync(file, "utf8"));
const header = table[0].map((h) => h.trim().toLowerCase());
const idx = (name) => header.indexOf(name);
if (idx("name") < 0 || idx("type") < 0) {
  console.error("CSV needs a header row with at least name,type");
  process.exit(1);
}

const orgs = [];
for (const cells of table.slice(1)) {
  const get = (name) => (idx(name) >= 0 ? (cells[idx(name)] || "").trim() : "");
  const name = get("name");
  if (!name) continue;
  const typeRaw = get("type").toLowerCase().replace(/\s+/g, "_");
  const type = typeRaw === "little_league" || typeRaw === "littleleague" || typeRaw === "ll"
    ? "little_league"
    : typeRaw === "travel" || typeRaw === "travel_ball" || typeRaw === "tb"
      ? "travel"
      : "other";
  const campaign = normalizeCampaign(get("campaign"));
  if (!campaign) {
    console.error(`Missing campaign for ${name}. Use a slug like ll-nov-2026.`);
    process.exit(1);
  }
  const path = get("path") || "/leagues";
  const code = codeFor(type, name, get("code"));
  const email = get("email");
  const url = new URL(path.startsWith("/") ? path : `/${path}`, ORIGIN);
  url.searchParams.set("o", code);
  url.searchParams.set("c", campaign);
  if (email && url.toString().toLowerCase().includes(email.toLowerCase())) {
    console.error(`Refusing to put an email address into the link for ${name}.`);
    process.exit(1);
  }
  orgs.push({
    name,
    type,
    email,
    batch_date: get("batch_date") || get("batch") || "",
    campaign,
    path: url.pathname,
    code,
    url: url.toString(),
  });
}

if (!orgs.length) {
  console.error("No orgs in CSV.");
  process.exit(1);
}

const lines = ["code,name,type,email,batch_date,campaign,url"];
for (const org of orgs) {
  const cells = [org.code, org.name, org.type, org.email, org.batch_date, org.campaign, org.url];
  lines.push(cells.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(","));
}
const csv = `${lines.join("\n")}\n`;
if (outPath) writeFileSync(outPath, csv);
process.stdout.write(csv);

if (!register) {
  console.error(`\n${orgs.length} link(s). Pass --register to store names in MDC Track.`);
  process.exit(0);
}

const secret = process.env.MDC_TRACK_FORWARD_SECRET;
if (!secret) {
  console.error("\n--register needs MDC_TRACK_FORWARD_SECRET in the environment. Links above are still valid.");
  process.exit(2);
}

const res = await fetch(REGISTER_URL, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-mdc-forward-secret": secret,
  },
  body: JSON.stringify({
    orgs: orgs.map((org) => ({
      name: org.name,
      type: org.type,
      email: org.email || undefined,
      batch_date: org.batch_date || undefined,
      campaign: org.campaign,
      path: org.path,
      code: org.code,
    })),
  }),
});
const data = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error(`\nRegister failed (${res.status}): ${data.error || "unknown"}`);
  if (data.migrationRequired) {
    console.error("Run supabase/migrations/20261127180000_outreach_orgs.sql in the SupaOrganized Supabase SQL editor, then re-run with --register.");
  }
  process.exit(1);
}
console.error(`\nRegistered ${data.upserted ?? orgs.length} org(s) in MDC Track.`);
