import { loadAcceptanceEnvironment, repositoryRoot } from "./environment.mjs";

loadAcceptanceEnvironment();
process.env.PORT = new URL(process.env.CONTRACT_ACCEPTANCE_API_URL).port || "10001";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
process.chdir(repositoryRoot);
await import("../../../index.js");