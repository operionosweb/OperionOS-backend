const express = require('express');
const router = express.Router();

const requireSuperAdmin = require('../middleware/superAdminMiddleware');

router.get(
    '/dashboard',
    requireSuperAdmin,
    async (req, res) => {
        res.json({
            success: true,
            message: 'Welcome Super Admin'
        });
    }
);

module.exports = router;
