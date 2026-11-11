import pool from "../db.js";
import { getSupabaseClient } from "../config/supabase.js";
import { isVerifiedDatabaseConnection } from "../config/databaseTls.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const adminError = (status, message) => Object.assign(new Error(message), { status });
export function adminId(value) {
  if (!UUID.test(value || "")) throw adminError(400, "A valid record ID is required.");
  return value;
}
function text(value, max, required = true) {
  if (typeof value !== "string" || value.trim().length > max || (required && !value.trim())) {
    throw adminError(400, `Provide text between ${required ? 1 : 0} and ${max} characters.`);
  }
  return value.trim();
}
function pageOptions(input = {}) {
  const page = Number(input.page || 1);
  if (!Number.isInteger(page) || page < 1 || page > 10000) throw adminError(400, "Invalid page.");
  return { page, offset: (page - 1) * 25, search: text(input.search || "", 160, false) };
}
const userFields = `u.id,u.email,u.created_at,u.last_sign_in_at,u.email_confirmed_at,
  coalesce(u.banned_until > now(),false) as deactivated,
  u.raw_user_meta_data->>'full_name' as full_name`;

const contractMetrics = [
  { key: "processed_contracts", label: "Contracts with a completed analysis", table: "analysis_runs",
    expression: "count(distinct contract_id)::int from public.analysis_runs where status='completed'",
    source: "Distinct contracts with at least one completed analysis run; a later run may have failed." },
  { key: "pending_runs", label: "Analysis runs awaiting completion", table: "analysis_runs",
    expression: "count(*)::int from public.analysis_runs where status in ('queued','processing','extracting','analysing','indexing')",
    source: "Analysis runs in a queued or processing state, not distinct contracts." },
  { key: "failed_runs", label: "Failed analysis runs", table: "analysis_runs",
    expression: "count(*)::int from public.analysis_runs where status='failed'",
    source: "All recorded failed analysis runs, including historical attempts." },
  { key: "clauses", label: "Extracted clause records", table: "clauses",
    expression: "count(*)::int from public.clauses",
    source: "Stored clause records across analysis runs, including pending review and repeated analyses." },
  { key: "obligations", label: "Identified obligation records", table: "obligations",
    expression: "count(*)::int from public.obligations",
    source: "Stored obligation records across analysis runs, including pending review and repeated analyses." },
  { key: "upcoming_deadlines", label: "Dated deadline records in 30 days", table: "deadlines",
    expression: "count(*)::int from public.deadlines where normalized_date>=now() and normalized_date<now()+interval '30 days' and review_status<>'rejected'",
    source: "Non-rejected normalized dates in the next 30 days; repeated analyses may duplicate deadlines. Relative and undated deadlines are excluded." },
  { key: "risks", label: "Identified risk records", table: "risks",
    expression: "count(*)::int from public.risks",
    source: "Stored risk records across analysis runs, including pending review and repeated analyses; not verified losses." },
  { key: "high_severity_risks", label: "High or critical risk records", table: "risks",
    expression: "count(*)::int from public.risks where severity in ('high','critical')",
    source: "Stored high or critical severity records across analysis runs, not calibrated probabilities or financial losses." },
  { key: "ai_usage_events", label: "AI usage records in 30 days", table: "ai_intelligence_usage",
    expression: "count(*)::int from public.ai_intelligence_usage where created_at>=now()-interval '30 days' and created_at<=now()",
    source: "Recorded AI usage rows created in the last 30 days; not active users, working time or billed revenue." },
];

export function createPlatformAdminService({ database = pool, authClient = getSupabaseClient, now = () => new Date() } = {}) {
  const query = database.query.bind(database);
  const audit = (execute, actor, action, entity, id, reason, metadata = {}) => execute(
    `insert into public.audit_events(actor_id,action,entity_type,entity_id,metadata,organization_id)
     values($1,$2,$3,$4,$5::jsonb,$6)`,
    [actor, action, entity, id, JSON.stringify({ reason, ...metadata }), metadata.organizationId || (entity === "organization" ? id : null)],
  );
  async function transaction(actor, callback) {
    const client = await database.connect();
    try {
      await client.query("BEGIN");
      await client.query("select pg_advisory_xact_lock(760176)");
      const current = await client.query(
        `select 1 from public.platform_user_roles where user_id=$1 and role='SUPERADMIN' and status='active'`,
        [actor],
      );
      if (!current.rows.length) throw adminError(403, "Active Super Admin authorization is required.");
      const result = await callback(client.query.bind(client));
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }
  async function users(input) {
    const { page, offset, search } = pageOptions(input);
    const status = input.status || "all";
    if (!["all", "active", "deactivated", "unconfirmed"].includes(status)) throw adminError(400, "Invalid account filter.");
    const result = await query(
      `select ${userFields},count(*) over()::int as total,
        coalesce((select jsonb_agg(jsonb_build_object('role',r.role,'status',r.status))
          from public.platform_user_roles r where r.user_id=u.id),'[]'::jsonb) as roles,
        coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'role',m.role,'status',m.status))
          from public.organization_memberships m join public.organizations o on o.id=m.organization_id
          where m.user_id=u.id),'[]'::jsonb) as organizations
       from auth.users u where u.deleted_at is null
       and ($1='' or position(lower($1) in lower(coalesce(u.email,'')||' '||coalesce(u.raw_user_meta_data->>'full_name','')))>0)
       and ($2='all' or ($2='active' and (u.banned_until is null or u.banned_until<=now()))
         or ($2='deactivated' and u.banned_until>now()) or ($2='unconfirmed' and u.email_confirmed_at is null))
       order by u.created_at desc,u.id limit 25 offset $3`, [search, status, offset],
    );
    return { users: result.rows.map(({ total, ...user }) => user), total: result.rows[0]?.total || 0, page, pageSize: 25 };
  }
  async function user(id) {
    adminId(id);
    const result = await query(`select ${userFields} from auth.users u where u.id=$1 and u.deleted_at is null`, [id]);
    if (!result.rows[0]) throw adminError(404, "User not found.");
    const history = await query(
      `select id,action,entity_type,entity_id,actor_id,created_at from public.audit_events
       where entity_id=$1 order by created_at desc limit 50`, [id],
    );
    return { user: result.rows[0], history: history.rows };
  }
  async function summary(days = 30) {
    days = Number(days);
    if (![7, 30, 90].includes(days)) throw adminError(400, "Choose 7, 30 or 90 days.");
    const result = await query(`select
      (select count(*)::int from auth.users where deleted_at is null) as users,
      (select count(*)::int from auth.users where deleted_at is null and last_sign_in_at>=now()-make_interval(days=>$1)) as signed_in_users,
      (select count(*)::int from public.organizations) as organizations,
      (select count(*)::int from public.organizations where status='active') as active_organizations,
      (select count(*)::int from public.contracts) as contracts,
      (select count(*)::int from public.analysis_runs where status='completed') as completed_analyses,
      (select count(*)::int from public.commercial_companies) as commercial_companies,
      (select count(*)::int from public.commercial_opportunities where status='PILOT') as pilots,
      (select count(*)::int from public.commercial_opportunities where status='CUSTOMER') as customer_opportunities`, [days]);
    const activity = await query(`select to_char(created_at at time zone 'UTC','YYYY-MM-DD') as day,count(*)::int as events
      from public.audit_events where created_at>=now()-make_interval(days=>$1)
      group by 1 order by 1`, [days]);
    const events = await query(`select id,action,entity_type,entity_id,created_at from public.audit_events
      order by created_at desc limit 20`);
    const availability = await query(`select name,to_regclass('public.'||name) is not null as available
      from unnest(array['blog_posts','external_market_observations','aviation_contract_outcomes',
      'aviation_forecast_snapshots','obligation_fulfilment_assessments','recommendation_decision_history']) name`);
    return {
      metrics: result.rows[0], activity: activity.rows, events: events.rows, dependencies: availability.rows,
      days, generatedAt: now().toISOString(),
      unavailable: ["Revenue and subscriptions: no verified billing ledger integration", "Engagement and conversion: no verified event source", "Forecast calibration: verified outcome history required"],
      sources: {
        users: "auth.users; non-deleted accounts",
        signed_in_users: `auth.users.last_sign_in_at in last ${days} days; not online users`,
        organizations: "organizations; tenant/company identity, not commercial prospects",
        active_organizations: "organizations.status = active; not subscription or payment verification",
        contracts: "contracts; aggregate count only",
        completed_analyses: "analysis_runs.status = completed; runs, not distinct contracts",
        commercial_companies: "commercial_companies; prospects, not necessarily customers",
        pilots: "commercial_opportunities.status = PILOT; opportunities, not distinct paying accounts",
        customer_opportunities: "commercial_opportunities.status = CUSTOMER; not payment verification",
      },
    };
  }
  async function contractIntelligence() {
    const client = await database.connect();
    try {
      if (!isVerifiedDatabaseConnection(client)) {
        throw Object.assign(adminError(503, "Global contract intelligence requires a verified TLS database connection."), { code: "GLOBAL_TLS_UNVERIFIED" });
      }
      const execute = client.query.bind(client);
      const scope = await execute("select rolsuper or rolbypassrls as full_scope from pg_roles where rolname=current_user");
      if (scope.rows[0]?.full_scope !== true) {
        throw Object.assign(adminError(503, "Global contract intelligence requires a verified platform-wide database role."), { code: "GLOBAL_SCOPE_UNVERIFIED" });
      }
      const tables = [...new Set(contractMetrics.map(metric => metric.table))];
      const catalog = await execute(
        "select name, exists(select 1 from pg_class where oid=to_regclass('public.' || name) and relkind in ('r','p')) as available from unnest($1::text[]) as name",
        [tables],
      );
      const available = new Set(catalog.rows.filter(row => row.available).map(row => row.name));
      const fields = contractMetrics.map(metric => available.has(metric.table)
        ? `(select ${metric.expression}) as ${metric.key}`
        : `null::int as ${metric.key}`);
      const result = await execute(`select ${fields.join(", ")}`);
      return {
        generatedAt: now().toISOString(),
        metrics: contractMetrics.map(({ key, label, table, source }) => ({
          key, label, source, value: result.rows[0][key], available: available.has(table),
        })),
      };
    } finally {
      client.release();
    }
  }
  async function organizations(input) {
    const { page, offset, search } = pageOptions(input);
    const result = await query(`select o.*,count(*) over()::int as total,
      (select count(*)::int from public.organization_memberships m where m.organization_id=o.id and m.status='active') as users,
      (select count(*)::int from public.contracts c where c.organization_id=o.id) as contracts
      from public.organizations o where $1='' or position(lower($1) in lower(o.name||' '||o.slug))>0
      order by o.created_at desc,o.id limit 25 offset $2`, [search, offset]);
    return { organizations: result.rows.map(({ total, ...o }) => o), total: result.rows[0]?.total || 0, page, pageSize: 25 };
  }
  async function organization(id) {
    adminId(id);
    const org = await query("select * from public.organizations where id=$1", [id]);
    if (!org.rows[0]) throw adminError(404, "Organization not found.");
    const members = await query(`select m.user_id,m.role,m.status,u.email,u.raw_user_meta_data->>'full_name' as full_name
      from public.organization_memberships m join auth.users u on u.id=m.user_id where m.organization_id=$1
      order by m.created_at`, [id]);
    const events = await query(`select id,action,entity_type,entity_id,created_at from public.audit_events
      where organization_id=$1 or entity_id=$1 order by created_at desc limit 30`, [id]);
    return { organization: org.rows[0], members: members.rows, events: events.rows };
  }
  async function saveOrganization(actor, id, input) {
    const name = text(input.name, 160);
    const slug = text(input.slug, 100);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw adminError(400, "Use a lowercase hyphenated slug.");
    const status = input.status || "active";
    if (!["active", "suspended"].includes(status)) throw adminError(400, "Invalid organization status.");
    if (id) adminId(id);
    const reason = text(input.reason, 500);
    return transaction(actor, async execute => {
      const result = id
        ? await execute("update public.organizations set name=$1,slug=$2,status=$3,updated_at=now() where id=$4 and status<>'deleted' returning *", [name, slug, status, id])
        : await execute("insert into public.organizations(name,slug,status) values($1,$2,$3) returning *", [name, slug, status]);
      if (!result.rows[0]) throw adminError(404, "Organization not found.");
      await audit(execute, actor, id ? "ORGANIZATION_UPDATED" : "ORGANIZATION_CREATED", "organization", result.rows[0].id, reason);
      return { organization: result.rows[0] };
    });
  }
  async function membership(actor, orgId, userId, input) {
    adminId(orgId); adminId(userId);
    const { role, status } = input;
    if (!["CUSTOMER_ADMIN", "CUSTOMER_USER"].includes(role) || !["active", "suspended", "removed"].includes(status)) {
      throw adminError(400, "Choose a canonical customer role and valid membership status.");
    }
    const reason = text(input.reason, 500);
    return transaction(actor, async execute => {
      const organization = await execute("select id,status from public.organizations where id=$1 and status<>'deleted' for update", [orgId]);
      if (!organization.rows.length) throw adminError(404, "Organization not found or deleted.");
      const exists = await execute("select id from auth.users where id=$1 and deleted_at is null", [userId]);
      if (!exists.rows.length) throw adminError(404, "Auth user not found.");
      const current = await execute("select role,status from public.organization_memberships where organization_id=$1 and user_id=$2 for update", [orgId, userId]);
      const admins = ["owner", "admin", "ORG_ADMIN", "CUSTOMER_ADMIN"];
      if (current.rows[0]?.status === "active" && admins.includes(current.rows[0].role) && (status !== "active" || role !== "CUSTOMER_ADMIN")) {
        const remaining = await execute(`select count(*)::int as count from public.organization_memberships
          where organization_id=$1 and user_id<>$2 and status='active' and role=any($3::text[])`, [orgId, userId, admins]);
        if (!remaining.rows[0]?.count) throw adminError(409, "Assign another active organization administrator before removing or demoting the last one.");
      }
      const result = await execute(`insert into public.organization_memberships(organization_id,user_id,role,status)
        values($1,$2,$3,$4) on conflict(organization_id,user_id) do update
        set role=excluded.role,status=excluded.status,updated_at=now() returning user_id,organization_id,role,status`, [orgId, userId, role, status]);
      await audit(execute, actor, "ORGANIZATION_MEMBERSHIP_CHANGED", "user", userId, reason, { organizationId: orgId, role, status });
      return { membership: result.rows[0] };
    });
  }
  async function platformRole(actor, id, input) {
    adminId(id);
    if (id.toLowerCase() === actor.toLowerCase()) throw adminError(409, "You cannot change your own platform role.");
    if (!["active", "revoked"].includes(input.status)) throw adminError(400, "Choose active or revoked.");
    const reason = text(input.reason, 500);
    return transaction(actor, async execute => {
      const target = await execute("select id from auth.users where id=$1 and deleted_at is null and (banned_until is null or banned_until<=now())", [id]);
      if (!target.rows.length) throw adminError(409, "An active Auth account is required.");
      await execute(`insert into public.platform_user_roles(user_id,role,status) values($1,'SUPERADMIN',$2)
        on conflict(user_id,role) do update set status=excluded.status,updated_at=now()`, [id, input.status]);
      await audit(execute, actor, "PLATFORM_ROLE_CHANGED", "user", id, reason, { role: "SUPERADMIN", status: input.status });
      return { userId: id, role: "SUPERADMIN", status: input.status };
    });
  }
  async function accountStatus(actor, id, input) {
    adminId(id);
    if (id.toLowerCase() === actor.toLowerCase()) throw adminError(409, "You cannot deactivate your own account.");
    if (typeof input.active !== "boolean") throw adminError(400, "Specify active as a boolean.");
    const reason = text(input.reason, 500);
    await audit(query, actor, "ACCOUNT_STATUS_INTENT", "user", id, reason, { active: input.active });
    return transaction(actor, async execute => {
      const roles = await execute("select 1 from public.platform_user_roles where user_id=$1 and role='SUPERADMIN' and status='active'", [id]);
      if (roles.rows.length && !input.active) throw adminError(409, "Revoke the platform role before deactivating this administrator.");
      await audit(execute, actor, "ACCOUNT_STATUS_REQUESTED", "user", id, reason, { active: input.active });
      const { error } = await authClient().auth.admin.updateUserById(id, { ban_duration: input.active ? "none" : "876000h" });
      if (error) throw adminError(502, "Auth provider rejected the account change.");
      await audit(execute, actor, "ACCOUNT_STATUS_CHANGED", "user", id, reason, { active: input.active });
      return { userId: id, active: input.active };
    });
  }
  async function provision(actor, input) {
    const email = text(input.email, 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw adminError(400, "Provide a valid email address.");
    const reason = text(input.reason, 500);
    const fullName = text(input.full_name || "", 120, false);
    let id;
    await transaction(actor, async execute => {
      const found = await execute("select id from auth.users where lower(email)=$1 and deleted_at is null", [email]);
      if (found.rows.length) throw adminError(409, "Account exists. Use its recovery email action.");
      await audit(execute, actor, "AUTH_ACCOUNT_CREATE_REQUESTED", "user", null, reason);
    });
    const client = authClient();
    await transaction(actor, async execute => {
      const created = await client.auth.admin.createUser({ email, email_confirm: false, ...(fullName ? { user_metadata: { full_name: fullName } } : {}) });
      if (created.error || !created.data?.user?.id) throw adminError(502, "Auth account creation failed.");
      id = created.data.user.id;
      await audit(execute, actor, "AUTH_ACCOUNT_CREATED", "user", id, reason);
    });
    const delivery = await client.auth.resetPasswordForEmail(email, { redirectTo: "https://www.operionos.com/login?recovery=1" });
    await audit(query, actor, delivery.error ? "AUTH_SETUP_EMAIL_FAILED" : "AUTH_SETUP_EMAIL_REQUESTED", "user", id, reason);
    return { userId: id, accountCreated: true, emailRequested: !delivery.error,
      message: delivery.error ? "Account created, but setup email failed. Retry from the user profile; do not recreate the account." : "Setup email requested. Delivery and password setup require recipient confirmation." };
  }
  async function recovery(actor, id, input) {
    adminId(id);
    const reason = text(input.reason, 500);
    const result = await query("select email from auth.users where id=$1 and deleted_at is null", [id]);
    if (!result.rows[0]) throw adminError(404, "Auth user not found.");
    await audit(query, actor, "AUTH_RECOVERY_EMAIL_REQUESTED", "user", id, reason);
    const { error } = await authClient().auth.resetPasswordForEmail(result.rows[0].email, { redirectTo: "https://www.operionos.com/login?recovery=1" });
    if (error) {
      await audit(query, actor, "AUTH_RECOVERY_EMAIL_FAILED", "user", id, reason);
      throw adminError(502, "Recovery email request failed. Check sender configuration and rate limits.");
    }
    return { emailRequested: true, message: "Recovery email requested; delivery is not yet verified." };
  }
  return { users, user, summary, contractIntelligence, organizations, organization, saveOrganization, membership, platformRole, accountStatus, provision, recovery };
}
