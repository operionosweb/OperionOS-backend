import dotenv from "dotenv";
import { Client } from "pg";

dotenv.config({ path: ".env.phase3-test.local" });

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  await client.connect();

  const result = await client.query(
    `
    SELECT
      conname,
      contype,
      pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conname = $1
    `,
    ["contracts_id_organization_key"]
  );

  console.log(result.rows);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => client.end());