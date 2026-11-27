import { neon } from "@neondatabase/serverless";
import { withInquiryTable } from "../lib/inquiries.mjs";

export default async function inquiry(req, res) {
  const reply = (status, value) => {
    res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify(value));
  };
  const origin = req.headers.origin;
  if (origin === "https://akshaychavan44.github.io") {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Vary", "Origin");
  } else if (origin && origin !== `https://${req.headers.host}` &&
      !(origin === `http://${req.headers.host}` && /^((127\.0\.0\.1)|localhost):\d+$/.test(req.headers.host))) {
    return reply(403, {});
  }
  if (req.method === "OPTIONS") return reply(204, {});
  if (req.method !== "POST") return reply(405, {});
  if (!/^application\/json\b/i.test(req.headers["content-type"] || "")) return reply(415, {});
  let body = req.body;
  if (body === undefined) {
    let text = "";
    for await (const chunk of req) {
      text += chunk;
      if (Buffer.byteLength(text) > 32000) return reply(413, {});
    }
    try { body = JSON.parse(text); } catch { return reply(400, {}); }
  }
  const details = {};
  for (const [key, limit] of Object.entries({ name: 150, company: 200, email: 254, phone: 60, industry: 100, message: 5000 })) {
    const value = body?.[key] ?? "";
    if (typeof value !== "string" || value.length > limit) return reply(400, {});
    details[key] = value.trim();
  }
  if (!details.name || !details.message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email) ||
      !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(body?.id || "")) return reply(400, {});
  try {
    const sql = neon(process.env.DATABASE_URL);
    await withInquiryTable(sql, () => sql`insert into aeva_inquiries (id, details) values
      (${body.id}, ${JSON.stringify(details)}::jsonb) on conflict (id) do nothing`);
    return reply(201, { received: true });
  } catch {
    return reply(503, {});
  }
}
