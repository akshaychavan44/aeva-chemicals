// Existing installations create this table on first use.
export async function withInquiryTable(sql, operation) {
  try {
    return await operation();
  } catch (error) {
    if (error.code !== "42P01") throw error;
  }
  await sql.transaction([
    sql`select pg_advisory_xact_lock(7285609)`,
    sql`create table if not exists aeva_inquiries (
      id uuid primary key, received_at timestamptz not null default now(), details jsonb not null
    )`
  ]);
  return operation();
}
