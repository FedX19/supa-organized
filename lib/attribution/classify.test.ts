import assert from "node:assert/strict";
import test from "node:test";
import { classifyVisit } from "./classify.ts";

const CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

test("real browsers are humans", () => {
  assert.equal(classifyVisit({ userAgent: CHROME, js: true, nav: "beacon" }).isBot, false);
  assert.equal(classifyVisit({ userAgent: IPHONE, js: true, nav: "beacon" }).uaClass, "browser");
  const nav = classifyVisit({
    userAgent: CHROME,
    nav: "document",
    secFetchDest: "document",
  });
  assert.equal(nav.isBot, false);
});

test("whatsapp in-app browser stays human; preview fetch does not", () => {
  const inApp = classifyVisit({
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 WhatsApp/2.23.20",
    js: true,
    nav: "beacon",
  });
  assert.equal(inApp.isBot, false);
  const preview = classifyVisit({ userAgent: "WhatsApp/2.23.20.0", nav: "document" });
  assert.equal(preview.isBot, true);
  assert.equal(preview.uaClass, "preview");
});

test("automated clients are bots", () => {
  const cases: Array<[string, string]> = [
    ["curl/8.5.0", "http_client"],
    ["python-requests/2.32.0", "http_client"],
    ["node", "http_client"],
    ["node-fetch/3.0", "http_client"],
    ["Googlebot/2.1", "crawler"],
    ["Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", "crawler"],
    ["facebookexternalhit/1.1", "preview"],
    ["Proofpoint/1.0", "security_scanner"],
    ["Mozilla/5.0 Mimecast", "security_scanner"],
    ["Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 10.0; Microsoft Office)", "security_scanner"],
    ["Mozilla/5.0 HeadlessChrome/131.0.0.0", "headless"],
    ["Mozilla/5.0 Playwright", "headless"],
    ["UptimeRobot/2.0", "monitor"],
    ["", "unknown"],
  ];
  for (const [ua, uaClass] of cases) {
    const result = classifyVisit({ userAgent: ua, js: true, nav: "beacon" });
    assert.equal(result.isBot, true, ua || "(empty)");
    assert.equal(result.uaClass, uaClass, ua || "(empty)");
  }
});

test("agents, previews, prefetch, no-js, and security ASNs are excluded", () => {
  assert.equal(
    classifyVisit({ userAgent: CHROME, actor: "agent", js: true }).uaClass,
    "agent",
  );
  assert.equal(
    classifyVisit({ userAgent: CHROME, origin: "https://modern-day-coach-git-main.vercel.app" })
      .actor,
    "agent",
  );
  assert.equal(
    classifyVisit({ userAgent: CHROME, purpose: "prefetch", nav: "document" }).uaClass,
    "prefetch",
  );
  assert.equal(
    classifyVisit({
      userAgent: CHROME,
      nav: "document",
      secFetchDest: null,
    }).uaClass,
    "no_js",
  );
  assert.equal(classifyVisit({ userAgent: CHROME, js: false, nav: "pixel" }).uaClass, "no_js");
  assert.equal(classifyVisit({ userAgent: CHROME, asn: "26211", js: true }).uaClass, "datacenter");
  assert.equal(
    classifyVisit({ userAgent: CHROME, asn: "16509", js: true, nav: "beacon" }).isBot,
    false,
  );
});
