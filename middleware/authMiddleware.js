import jwt from "jsonwebtoken";

/* =====================================================
   REQUIRE ADMIN AUTH
===================================================== */

export function requireAdmin(req, res, next) {

  try {

    const authHeader = req.headers.authorization;

    if (!authHeader) {

      return res.status(401).json({
        success: false,
        error: "Authorization header missing"
      });

    }

    const token = authHeader.split(" ")[1];

    if (!token) {

      return res.status(401).json({
        success: false,
        error: "Token missing"
      });

    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.admin = decoded;

    next();

  } catch (err) {

    console.error(err);

    return res.status(401).json({
      success: false,
      error: "Unauthorized"
    });

  }
}
