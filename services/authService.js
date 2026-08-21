import { getSupabaseAuthClient } from "../config/supabaseAuth.js";

/* =====================================================
   ADMIN LOGIN
===================================================== */

export async function adminLogin(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email and password required",
      });
    }
    const { data, error } = await getSupabaseAuthClient().auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session || !data.user) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
      });
    }

    const role =
      data.user.app_metadata?.role ||
      data.user.user_metadata?.role ||
      "authenticated";

    return res.json({
      success: true,
      token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      user: {
        id: data.user.id,
        email: data.user.email,
        role,
      },
    });
  } catch (err) {
    console.error("Login error:", err.message);
    return res.status(500).json({
      success: false,
      error: "Login failed",
    });
  }
}
