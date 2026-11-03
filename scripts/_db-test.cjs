const { Client } = require("pg");
const hosts = [
  { host: "aws-0-eu-central-1.pooler.supabase.com", port: 5432, user: "postgres.vdkqrqtrftzhbtquzked" },
  { host: "aws-1-eu-central-1.pooler.supabase.com", port: 5432, user: "postgres.vdkqrqtrftzhbtquzked" },
  { host: "db.vdkqrqtrftzhbtquzked.supabase.co", port: 5432, user: "postgres" },
];
(async () => {
  for (const h of hosts) {
    const c = new Client({ ...h, password: "yanlis-sifre-test", database: "postgres", ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 });
    try { await c.connect(); console.log(h.host, "BAGLANDI (beklenmiyor)"); await c.end(); }
    catch (e) { console.log(h.host, "->", (e.code || "") + " " + (e.message || "").slice(0, 120)); }
  }
})();
