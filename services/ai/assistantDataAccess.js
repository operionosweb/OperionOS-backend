import { assertOrganizationScope } from "../../repositories/phase3/scope.js";

const TABLES = Object.freeze({
  contracts: "contracts", contract_versions: "contract_versions", clauses: "clauses",
  obligations: "obligations", deadlines: "deadlines", risks: "contract_risks",
});

export function createAssistantDataAccess({ query }) {
  if (typeof query !== "function") throw new TypeError("A database query function is required");
  return {
    async find({ organizationId, resource, filters = {}, limit = 50 }) {
      assertOrganizationScope(organizationId);
      const table = TABLES[resource];
      if (!table) throw Object.assign(new Error("Unsupported assistant data resource"), { code: "UNSUPPORTED_DATA_RESOURCE" });
      const entries = Object.entries(filters).filter(([key]) => /^[a-z_]+$/.test(key));
      const clauses = ["organization_id = $1"];
      const values = [organizationId];
      entries.forEach(([key, value], index) => { clauses.push(`${key} = $${index + 2}`); values.push(value); });
      const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
      const result = await query(`SELECT * FROM ${table} WHERE ${clauses.join(" AND ")} LIMIT ${safeLimit}`, values);
      return result.rows;
    },
  };
}