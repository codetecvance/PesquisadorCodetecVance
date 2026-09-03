const BLOCKED_HOSTS = [
  "instagram.com", "facebook.com", "ifood.com.br", "google.com",
  "linktr.ee", "wa.me", "whatsapp.com", "jotaja.com",
];

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

function cleanEmail(value) {
  const found = String(value || "").match(EMAIL_RE) || [];
  return [...new Set(found.map((email) => email.toLowerCase().replace(/[.,;:)]+$/, "")))]
    .filter((email) => !/\.(png|jpg|jpeg|webp|gif)$/i.test(email))
    .filter((email) => !/(sentry|wixpress|ingest\.us|example\.com|nome@email|seuemail|teste@)/i.test(email))
    .join("; ");
}

function canVisit(value) {
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) && !BLOCKED_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch (e) {
    return false;
  }
}

async function findEmail(browserContext, website) {
  if (!canVisit(website)) return "";
  const page = await browserContext.newPage();
  try {
    await page.goto(website, { waitUntil: "domcontentloaded", timeout: 12000 });
    const mailtos = await page.locator('a[href^="mailto:"]').evaluateAll((els) => els.map((el) => el.getAttribute("href") || ""));
    const html = await page.content();
    const first = cleanEmail(mailtos.map((v) => v.replace(/^mailto:/i, "")).join(" ")) || cleanEmail(html);
    if (first) return first;

    const contactHref = await page.locator('a[href]').evaluateAll((els) => {
      const link = els.find((el) => /contato|contact|fale-conosco|fale conosco/i.test((el.textContent || "") + " " + (el.getAttribute("href") || "")));
      return link ? link.href : "";
    });
    if (contactHref && new URL(contactHref).hostname === new URL(website).hostname) {
      await page.goto(contactHref, { waitUntil: "domcontentloaded", timeout: 10000 }).catch(() => {});
      return cleanEmail(await page.content());
    }
  } catch (e) {
    return "";
  } finally {
    await page.close().catch(() => {});
  }
  return "";
}

module.exports = { cleanEmail, findEmail, canVisit };
