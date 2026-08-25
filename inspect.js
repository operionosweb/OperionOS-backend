import fs from 'fs';
import dotenv from 'dotenv';
import pg from 'pg';

const parsed = dotenv.parse(fs.readFileSync('.env.phase3-test.local'));
const client = new pg.Client({
  connectionString: parsed.DATABASE_URL
});

async function run() {
  await client.connect();
  console.log('--- Connected to DB ---');

  // current_database(), version(), inet_server_addr(), inet_server_port()
  const metaRes = await client.query('SELECT current_database(), version(), inet_server_addr(), inet_server_port()');
  console.log('Database Info:', {
    current_database: metaRes.rows[0].current_database,
    version: metaRes.rows[0].version.split(',')[0],
    inet_server_addr: metaRes.rows[0].inet_server_addr,
    inet_server_port: metaRes.rows[0].inet_server_port
  });

  // non-system schemas
  const schemasRes = await client.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')");
  console.log('Non-system Schemas:', schemasRes.rows.map(r => r.schema_name));

  // all public relations with relkind and exact count for each table (COUNT(*) only)
  const relsRes = await client.query(
    SELECT c.relname, c.relkind 
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' 
      AND c.relkind IN ('r', 'v', 'm', 'f', 'p')
    ORDER BY c.relname
  );
  
  console.log('Public relations (relkind & exact counts):');
  for (const row of relsRes.rows) {
    if (row.relkind === 'r') {
      try {
        const countRes = await client.query(\SELECT COUNT(*) as count FROM public."\"\);
        console.log(\  Table \ (relkind: r): count \\);
      } catch (err) {
        console.log(\  Table \ (relkind: r): error counting (\)\);
      }
    } else {
      console.log(\  Relation \ (relkind: \)\);
    }
  }

  // public views
  const viewsRes = await client.query("SELECT table_name FROM information_schema.views WHERE table_schema = 'public'");
  console.log('Public Views:', viewsRes.rows.map(r => r.table_name));

  // known migration-history table existence/counts
  // Let's check schemas/tables containing "migration"
  const migRes = await client.query(
    SELECT table_schema, table_name 
    FROM information_schema.tables 
    WHERE table_name ILIKE '%migration%'
  );
  console.log('Migration History Tables:');
  for (const row of migRes.rows) {
    try {
      const countRes = await client.query(\SELECT COUNT(*) as count FROM "\"."\"\);
      console.log(\  Table \.\ exists, count: \\);
    } catch(err) {
      console.log(\  Table \.\ exists, count error: \\);
    }
  }

  // storage.buckets and storage.objects metadata/counts
  try {
    const bucketsRes = await client.query('SELECT id, name, public FROM storage.buckets');
    console.log('Storage Buckets metadata:');
    for (const b of bucketsRes.rows) {
      console.log(\  Bucket ID: \, Name: \, Public: \\);
    }
    const bucketsCount = await client.query('SELECT COUNT(*) as count FROM storage.buckets');
    console.log('Storage Buckets count:', bucketsCount.rows[0].count);
  } catch (err) {
    console.log('Storage Buckets query error:', err.message);
  }

  try {
    const objectsCount = await client.query('SELECT COUNT(*) as count FROM storage.objects');
    console.log('Storage Objects count:', objectsCount.rows[0].count);
    
    const objectsMeta = await client.query('SELECT id, bucket_id, name FROM storage.objects LIMIT 10');
    console.log('Storage Objects metadata snippet (up to 10):');
    for (const o of objectsMeta.rows) {
      console.log(\  Object ID: \, Bucket: \, Name: \\);
    }
  } catch (err) {
    console.log('Storage Objects query error:', err.message);
  }

  // auth.users count
  try {
    const authCount = await client.query('SELECT COUNT(*) as count FROM auth.users');
    console.log('Auth Users count:', authCount.rows[0].count);
  } catch (err) {
    console.log('Auth Users query error:', err.message);
  }

  await client.end();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
