import { createHash, createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { neon } from "@neondatabase/serverless";

import { withInquiryTable } from "../lib/inquiries.mjs";

const scrypt = promisify(scryptCallback);
const editableKeys = new Set(["whatwedo", "careers"]);
const sessionSeconds = 8 * 3600;
const cookieName = "__Host-aeva-admin";
const passwordLimits = { min: 10, max: 20 };

const digest = value => createHash("sha256").update(String(value ?? "")).digest();
const matches = (a, b) => timingSafeEqual(digest(a), digest(b));
const length = value => Array.from(value ?? "").length;

// Sessions are signed with the Vercel password plus the stored password hash (once the password
// has been changed in the admin), so changing the password signs out every other session.
function signature(expiry, key, email) {
  return createHmac("sha256", key).update(JSON.stringify(["aeva-admin", email, expiry])).digest("base64url");
}
const signingKey = (password, hash) => (hash ? `${password}\n${hash}` : password);

/* A password changed in the admin is kept as an scrypt hash in aeva_admin_auth and replaces
   CMS_ADMIN_PASSWORD for signing in. Delete that row to go back to the Vercel password. */
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };
async function hashPassword(plain) {
  const salt = randomBytes(16);
  const hash = await scrypt(plain, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64url"), hash.toString("base64url")].join("$");
}
async function verifyPassword(plain, stored) {
  const [kind, N, r, p, salt, hash] = String(stored).split("$");
  if (kind !== "scrypt" || typeof plain !== "string") return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await scrypt(plain, Buffer.from(salt, "base64url"), expected.length, { N: +N, r: +r, p: +p });
  return timingSafeEqual(actual, expected);
}
async function storedHash(sql) {
  try {
    const [row] = await sql`select password_hash from aeva_admin_auth where id = 1`;
    return row?.password_hash || null;
  } catch (error) {
    if (error.code === "42P01") return null; // the table is created on the first password change
    throw error;
  }
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
  const passwordLength = length(password);
  const configured = Boolean(email && databaseUrl && passwordLength >= passwordLimits.min && passwordLength <= passwordLimits.max);
  const sql = databaseUrl ? neon(databaseUrl) : null;
  const hasSession = configured && /^\d{10}$/.test(expiry) && Number(expiry) > now;
  const newSession = hash => {
    const end = String(now + sessionSeconds);
    res.setHeader("Set-Cookie", sessionCookie(`${end}.${signature(end, signingKey(password, hash), email)}`, sessionSeconds));
  };

  try {
    // only look up the stored hash when there is a session cookie to check
    const hash = hasSession ? await storedHash(sql) : null;
    const user = hasSession && matches(mac, signature(expiry, signingKey(password, hash), email)) ? { email } : null;

    if (req.method === "GET") {
      if (req.query.action === "session") return res.json({ configured, user });
      if (!sql) return res.status(503).json({ error: "Database is not configured." });
      if (req.query.action === "inquiries") {
        if (!user) return res.status(401).end();
        const rows = await withInquiryTable(sql, () => sql`select received_at, details from aeva_inquiries order by received_at desc`);
        return res.json(rows);
      }
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
      const loginHash = await storedHash(sql);
      const emailOk = matches(body.email?.toLowerCase?.(), email);
      const passwordOk = loginHash ? await verifyPassword(body.password, loginHash) : matches(body.password, password);
      if (!emailOk || !passwordOk) {
        return res.status(401).json({ error: "That email and password don’t match." });
      }
      newSession(loginHash);
      return res.json({ user: { email } });
    }
    if (action === "logout") {
      res.setHeader("Set-Cookie", sessionCookie("", 0));
      return res.json({});
    }
    if (!user) return res.status(401).json({ error: "Sign in again to make changes." });

    if (action === "change-password") {
      const { current, next } = body;
      if (typeof current !== "string" || typeof next !== "string") return res.status(400).json({ error: "Enter your current and new password." });
      const currentOk = hash ? await verifyPassword(current, hash) : matches(current, password);
      if (!currentOk) return res.status(400).json({ error: "Your current password is not correct." });
      if (length(next) < passwordLimits.min || length(next) > passwordLimits.max) {
        return res.status(400).json({ error: `The new password must be ${passwordLimits.min} to ${passwordLimits.max} characters.` });
      }
      if (next === current) return res.status(400).json({ error: "Choose a password different from your current one." });
      const nextHash = await hashPassword(next);
      await sql.transaction([
        sql`create table if not exists aeva_admin_auth (
          id smallint primary key default 1 check (id = 1), password_hash text not null, updated_at timestamptz not null default now()
        )`,
        sql`insert into aeva_admin_auth (id, password_hash) values (1, ${nextHash})
          on conflict (id) do update set password_hash = excluded.password_hash, updated_at = now()`,
      ]);
      newSession(nextHash); // keep this session signed in; every other session is signed out
      return res.json({});
    }

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
