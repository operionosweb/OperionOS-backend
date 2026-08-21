import { getSupabaseAuthClient } from "../config/supabaseAuth.js";

function getBearerToken(req) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return null;
  }

  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

async function verifySupabaseToken(token) {
  const { data, error } = await getSupabaseAuthClient().auth.getUser(token);

  if (error || !data.user) {
    throw new Error("Invalid or expired token");
  }

  return data.user;
}

export function createUserAuthMiddleware(verifyToken = verifySupabaseToken) {
  return async function authenticateUser(req, res, next) {
    const token = getBearerToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Bearer token required",
      });
    }

    try {
      const user = await verifyToken(token);

      if (!user?.id) {
        return res.status(401).json({
          success: false,
          error: "Authenticated user required",
        });
      }

      req.user = {
        id: user.id,
        email: user.email || null,
        role:
          user.app_metadata?.role ||
          user.user_metadata?.role ||
          "authenticated",
      };
      req.auth = {
        type: "supabase_user_token",
        isAuthenticated: true,
        userId: user.id,
      };

      return next();
    } catch {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired token",
      });
    }
  };
}

export const authenticateUser = createUserAuthMiddleware();
