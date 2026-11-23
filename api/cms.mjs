import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { neon } from "@neondatabase/serverless";

const editableKeys = new Set(["whatwedo", "careers"]);
const sessionSeconds = 8 * 3600;
const cookieName = "__Host-aeva-admin";

const digest = value => createHash("sha256").update(String(value ?? "")).digest();
const matches = (a, b) => timingSafeEqual(digest(a), digest(b));

function signature(expiry, password, email) {
  return createHmac("sha256", password).update(JSON.stringify(["aeva-admin", email, expiry])).digest("base64url");
}

function sessionCookie(value, age) {
  return `${cookieName}=${value}; Max-Age=${age}; Path=/; Secure; HttpOnly; SameSite=Strict`;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  const email = process.env.CMS_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.CMS_ADMIN_PASSWORD;
  const databaseUrl = process.env.DATABASE_URL;
  const now = Math.floor(Date.now() / 1000);
  const token = (req.headers.cookie || "").split(/;\s*/).find(part => part.startsWith(cookieName + "="))?.slice(cookieName.length + 1);
  const [expiry, mac] = (token || "").split(".");
  const passwordLength = Array.from(password ?? "").length;
  const configured = Boolean(email && databaseUrl && passwordLength >= 10 && passwordLength <= 20);
  const user = configured && /^\d{10}$/.test(expiry) && Number(expiry) > now &&
    matches(mac, signature(expiry, password, email)) ? { email } : null;

  try {
    if (req.method === "GET") {
      if (req.query.action === "session") return res.json({ configured, user });
      if (!databaseUrl) return res.status(503).json({ error: "Database is not configured." });
      const sql = neon(databaseUrl);
      if (req.query.image) {
        if (typeof req.query.image !== "string" || !/^[0-9a-f-]{36}$/i.test(req.query.image)) return res.status(404).end();
        const [image] = await sql`select mime, encode(bytes, 'base64') as bytes from aeva_images where id::text = ${req.query.image}`;
        if (!image) return res.status(404).end();
        res.setHeader("Content-Type", image.mime);
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        return res.end(Buffer.from(image.bytes, "base64"));
      }
      const rows = await sql`select key, data from aeva_content`;
      return res.json(rows);
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).end();
    }
    if (!/^application\/json(?:;|$)/i.test(req.headers["content-type"] || "") ||
        req.headers.origin !== `https://${req.headers.host}`) {
      return res.status(403).json({ error: "Request must come from the admin site." });
    }
    if (!configured) return res.status(503).json({ error: "Admin settings are incomplete." });
    const { action, ...body } = req.body || {};
    if (action === "login") {
      if (!matches(body.email?.toLowerCase?.(), email) || !matches(body.password, password)) {
        return res.status(401).json({ error: "That email and password don’t match." });
      }
      const end = String(now + sessionSeconds);
      res.setHeader("Set-Cookie", sessionCookie(`${end}.${signature(end, password, email)}`, sessionSeconds));
      return res.json({ user: { email } });
    }
    if (action === "logout") {
      res.setHeader("Set-Cookie", sessionCookie("", 0));
      return res.json({});
    }
    if (!user) return res.status(401).json({ error: "Sign in again to make changes." });
    const sql = neon(databaseUrl);

    if (action === "save") {
      if (!editableKeys.has(body.key) || !body.data || typeof body.data !== "object" || Array.isArray(body.data)) {
        return res.status(400).json({ error: "Invalid content section." });
      }
      await sql`insert into aeva_content (key, data) values (${body.key}, ${JSON.stringify(body.data)}::jsonb)
        on conflict (key) do update set data = excluded.data, updated_at = now()`;
      return res.json({});
    }
    return res.status(400).json({ error: "Unknown admin action." });
  } catch {
    return res.status(503).json({ error: "Couldn’t reach the content database. Check the Neon setup." });
  }
}
