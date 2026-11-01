import { getOciSupabaseAuthClient } from "../config/ociSupabaseAuth.js";
import { query } from "../repositories/ociDatabase.js";

export function ociError(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

export async function verifyOciIdentity(token, {
  authClient = getOciSupabaseAuthClient(),
  issuer = `${process.env.OCI_SUPABASE_URL?.replace(/\/$/, "")}/auth/v1`,
  now = Date.now(),
} = {}) {
  const { data, error } = await authClient.auth.getUser(token);
  if (error?.status >= 500 || error?.name === "AuthRetryableFetchError") {
    throw ociError(503, "OCI_AUTH_UNAVAILABLE", "OCI identity verification is temporarily unavailable.");
  }
  if (error || !data?.user?.id) throw ociError(401, "OCI_INVALID_SESSION", "A verified session is required.");
  let claims;
  try {
    claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
  } catch {
    throw ociError(401, "OCI_INVALID_SESSION", "A verified session is required.");
  }
  // getUser verifies this token with the provider before its claims are used.
  if (claims.sub !== data.user.id || claims.iss !== issuer || claims.aud !== "authenticated"
    || !Number.isFinite(claims.exp) || claims.exp * 1000 <= now) {
    throw ociError(401, "OCI_INVALID_SESSION", "A verified session is required.");
  }
  if (!data.user.email_confirmed_at || !data.user.email) {
    throw ociError(403, "OCI_EMAIL_UNVERIFIED", "Verified email ownership is required.");
  }
  return {
    id: data.user.id,
    email: data.user.email,
    emailVerified: true,
    mfaVerified: claims.aal === "aal2",
  };
}

export function createOciRateLimit({ limit = 120, windowMs = 60000, now = Date.now } = {}) {
  const attempts = new Map();
  return (req, res, next) => {
    const time = now();
    for (const [key, item] of attempts) if (time >= item.expires) attempts.delete(key);
    const key = req.ip || req.socket?.remoteAddress || "unknown";
    const item = attempts.get(key) || { count: 0, expires: time + windowMs };
    if (attempts.size >= 10000 && !attempts.has(key)) {
      return res.status(503).json({ success: false, code: "OCI_RATE_LIMIT_CAPACITY", error: "Access protection is temporarily unavailable." });
    }
    attempts.set(key, item);
    if (++item.count > limit) {
      res.set("Retry-After", String(Math.ceil((item.expires - time) / 1000)));
      return res.status(429).json({ success: false, code: "OCI_RATE_LIMITED", error: "Too many requests. Please wait before retrying." });
    }
    return next();
  };
}

export async function writeOciAccessAudit(actorId, action, queryFn = query) {
  await queryFn("insert into public.oci_audit_events (actor_id, action, metadata) values ($1, $2, '{}'::jsonb)", [actorId, action]);
}

export function createOciAccessMiddleware({
  verify = verifyOciIdentity,
  queryFn = query,
  audit = (actorId, action) => writeOciAccessAudit(actorId, action, queryFn),
} = {}) {
  return async (req, res, next) => {
    res.set("Cache-Control", "private, no-store");
    res.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    let identity = null;
    try {
      const match = req.headers.authorization?.match(/^Bearer ([^\s]+)$/);
      if (!match || match[1].length > 16384) throw ociError(401, "OCI_AUTH_REQUIRED", "Sign in to access OCI.");
      identity = await verify(match[1]);
      if (!identity.emailVerified) throw ociError(403, "OCI_EMAIL_UNVERIFIED", "Verified email ownership is required.");
      if (!identity.mfaVerified) throw ociError(403, "OCI_MFA_REQUIRED", "Verify a second factor to access OCI.");
      const result = await queryFn(`select user_id from public.oci_user_roles
        where user_id = $1 and role = 'super_admin' and status = 'active'`, [identity.id]);
      if (!result.rows.length) throw ociError(403, "OCI_ACCESS_DENIED", "OCI is restricted to authorised Super Administrators.");
      req.user = { id: identity.id, email: identity.email };
      req.ociIdentity = identity;
      await audit(identity.id, "ACCESS_GRANTED");
      return next();
    } catch (error) {
      try {
        await audit(identity?.id || null, error.code === "OCI_MFA_REQUIRED" ? "MFA_REQUIRED" : "ACCESS_DENIED");
      } catch {
        console.error("OCI access audit is unavailable");
        return res.status(503).json({ success: false, code: "OCI_AUDIT_UNAVAILABLE", error: "OCI access auditing is unavailable." });
      }
      if (!error.status) console.error("OCI identity or authorization service is unavailable");
      return res.status(error.status || 503).json({
        success: false,
        code: error.status ? error.code : "OCI_AUTH_UNAVAILABLE",
        error: error.status ? error.message : "OCI identity or authorization service is unavailable.",
      });
    }
  };
}

export const requireOciAccess = createOciAccessMiddleware();

export function ociHttpBoundary(req, res, next) {
  res.set("Cache-Control", "private, no-store");
  res.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  res.set("X-Content-Type-Options", "nosniff");
  res.vary("Origin");
  const origin = req.headers.origin;
  const allowed = (process.env.OCI_ALLOWED_ORIGINS || "https://oci.operionos.com").split(",").map((item) => item.trim());
  if (origin && !allowed.includes(origin)) {
    return res.status(403).json({ success: false, code: "OCI_ORIGIN_DENIED", error: "This origin is not allowed to access OCI." });
  }
  if (origin) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  return next();
}
