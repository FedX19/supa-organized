/**
 * Coarse visit classification for modern-day-coach.com.
 * Returns a class and a bot flag. Never returns a raw user agent, IP, or ASN.
 * Keep in sync with supa-organized/lib/attribution/classify.ts.
 */

export type UaClass =
  | "browser"
  | "crawler"
  | "preview"
  | "security_scanner"
  | "headless"
  | "http_client"
  | "monitor"
  | "agent"
  | "no_js"
  | "prefetch"
  | "datacenter"
  | "unknown";

export type ClassifyInput = {
  userAgent?: string | null;
  /** Self-identification. Only "agent" is honored, and it can only mark a bot. */
  actor?: string | null;
  /** Explicit no-JS pixel. A claimed js:true does not override a bot user agent. */
  js?: boolean | null;
  purpose?: string | null;
  secFetchDest?: string | null;
  /** Numeric ASN if a platform header provided one. Used for classification only. */
  asn?: string | null;
  origin?: string | null;
  /** document = full page navigation; beacon = JS collect; pixel = noscript image. */
  nav?: "document" | "beacon" | "pixel" | "unknown" | null;
};

export type ClassifyResult = {
  isBot: boolean;
  uaClass: UaClass;
  actor: "human" | "agent" | "bot";
};

/** Email-security vendors' own networks. Generic cloud ASNs are intentionally absent. */
const SECURITY_ASNS = new Set([
  "13916",
  "22843",
  "26211",
  "52129",
  "30031",
  "33538",
  "136792",
  "15324",
]);

const SECURITY_UA = [
  "proofpoint",
  "urldefense",
  "mimecast",
  "barracuda",
  "fireeye",
  "trellix",
  "ironport",
  "symantec",
  "forcepoint",
  "zscaler",
  "bluecoat",
  "fortigate",
  "fortinet",
  "bitdefender",
  "sophos",
  "mcafee",
  "avanan",
  "darktrace",
  "safelinks",
  "microsoft office",
  "msoffice",
  "microsoft outlook",
  "outlook-ios",
  "googleimageproxy",
  "ggpht.com",
  "skypeuripreview",
  "linkpreview",
  "linkscan",
  "urlscan",
  "virustotal",
  "messagelabs",
  "protection.outlook",
  "trendmicro",
  "trend micro",
];

const HEADLESS_UA = [
  "headless",
  "phantomjs",
  "puppeteer",
  "playwright",
  "selenium",
  "webdriver",
  "chrome-lighthouse",
  "lighthouse",
  "browserless",
  "browserbase",
  "agent-browser",
  "browser-use",
];

const MONITOR_UA = [
  "uptimerobot",
  "pingdom",
  "statuscake",
  "datadog",
  "newrelic",
  "new relic",
  "site24x7",
  "freshping",
  "better uptime",
  "betteruptime",
  "checkly",
  "hetrixtools",
  "montastic",
  "catchpoint",
  "thousandeyes",
  "siteuptime",
  "uptime.com",
  "synthetic",
];

const PREVIEW_UA = [
  "facebookexternalhit",
  "facebot",
  "twitterbot",
  "linkedinbot",
  "slackbot",
  "slack-imgproxy",
  "discordbot",
  "telegrambot",
  "pinterestbot",
  "redditbot",
  "embedly",
  "bitlybot",
  "skypeuripreview",
  "iframely",
  "quora link preview",
  "vkshare",
  "nuzzel",
];

const PREVIEW_IF_NOT_BROWSER = ["whatsapp", "telegram", "viber", "line/"];

const CRAWLER_UA = [
  "googlebot",
  "bingbot",
  "yandex",
  "baiduspider",
  "duckduckbot",
  "applebot",
  "petalbot",
  "bytespider",
  "ahrefs",
  "semrush",
  "mj12bot",
  "dotbot",
  "slurp",
  "amazonbot",
  "gptbot",
  "chatgpt-user",
  "oai-searchbot",
  "claudebot",
  "anthropic-ai",
  "perplexitybot",
  "ccbot",
  "meta-externalagent",
  "facebookbot",
  "ia_archiver",
  "sogou",
  "exabot",
  "dataforseo",
  "zoominfobot",
  "rogerbot",
  "screaming frog",
];

const HTTP_SUBSTRINGS = [
  "curl/",
  "wget/",
  "python-requests",
  "python-urllib",
  "aiohttp",
  "httpx",
  "go-http-client",
  "okhttp",
  "axios",
  "node-fetch",
  "undici",
  "scrapy",
  "postman",
  "insomnia",
  "httpie",
  "libwww",
  "libcurl",
  "java/",
  "faraday",
  "got/",
  "mechanize",
  "guzzle",
];

const HTTP_TOKENS = ["curl", "wget", "python", "node", "ruby", "perl", "php", "httpie"];

function includesAny(hay: string, needles: string[]): boolean {
  return needles.some((n) => hay.includes(n));
}

function hasToken(hay: string, token: string): boolean {
  let from = 0;
  while (from < hay.length) {
    const i = hay.indexOf(token, from);
    if (i < 0) return false;
    const beforeOk = i === 0 || !/[a-z0-9]/i.test(hay[i - 1] || "");
    const end = i + token.length;
    const afterOk = end === hay.length || !/[a-z0-9]/i.test(hay[end] || "");
    if (beforeOk && afterOk) return true;
    from = i + 1;
  }
  return false;
}

export function looksLikeBrowser(ua: string): boolean {
  if (!ua) return false;
  return /mozilla\/|applewebkit|chrome\/|safari\/|firefox\/|edg\/|opr\//i.test(ua);
}

function isHttpClient(ua: string): boolean {
  if (includesAny(ua, HTTP_SUBSTRINGS)) return true;
  return HTTP_TOKENS.some((token) => hasToken(ua, token));
}

function isCrawler(ua: string): boolean {
  if (includesAny(ua, CRAWLER_UA)) return true;
  return hasToken(ua, "bot") || hasToken(ua, "spider") || hasToken(ua, "crawler");
}

function bot(uaClass: UaClass, actor: ClassifyResult["actor"] = "bot"): ClassifyResult {
  return { isBot: true, uaClass, actor };
}

export function classifyVisit(input: ClassifyInput): ClassifyResult {
  const ua = (input.userAgent || "").trim().toLowerCase();
  const actorRaw = (input.actor || "").trim().toLowerCase();
  const origin = (input.origin || "").toLowerCase();
  const purpose = (input.purpose || "").toLowerCase();
  const dest = (input.secFetchDest || "").toLowerCase();
  const asn = String(input.asn || "")
    .replace(/^as/i, "")
    .trim();
  const nav = input.nav || "unknown";

  if (actorRaw === "agent" || actorRaw === "internal" || actorRaw === "mdc-agent") {
    return bot("agent", "agent");
  }
  if (origin.endsWith(".vercel.app") || origin.includes("grok-sandbox.com")) {
    return bot("agent", "agent");
  }
  if (purpose.includes("prefetch") || purpose.includes("preview")) {
    return bot("prefetch");
  }
  if (asn && SECURITY_ASNS.has(asn)) {
    return bot("datacenter");
  }
  if (!ua) return bot("unknown");
  if (includesAny(ua, SECURITY_UA)) return bot("security_scanner");
  if (includesAny(ua, HEADLESS_UA)) return bot("headless");
  if (includesAny(ua, MONITOR_UA)) return bot("monitor");
  if (includesAny(ua, PREVIEW_UA)) return bot("preview");

  const browser = looksLikeBrowser(ua);
  if (!browser && includesAny(ua, PREVIEW_IF_NOT_BROWSER)) return bot("preview");
  if (isHttpClient(ua)) return bot("http_client");
  if (isCrawler(ua)) return bot("crawler");

  if (nav === "document" && browser && dest !== "document") {
    return bot("no_js");
  }
  if (input.js === false) {
    return bot(browser ? "no_js" : "unknown");
  }
  if (!browser) return bot("unknown");
  return { isBot: false, uaClass: "browser", actor: "human" };
}

export function asnFromHeaders(headers: {
  get(name: string): string | null;
}): string | null {
  const names = ["x-vercel-ip-as-number", "x-vercel-ip-asn", "x-vercel-ip-as", "x-mdc-asn"];
  for (const name of names) {
    const raw = headers.get(name);
    if (!raw) continue;
    const digits = raw.replace(/^as/i, "").trim();
    if (/^\d{1,10}$/.test(digits)) return digits;
  }
  return null;
}
