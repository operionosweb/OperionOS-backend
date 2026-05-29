const supabase = require('../supabaseClient');

const requireSuperAdmin = async (req, res, next) => {
    try {
        const user = req.user;

        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized'
            });
        }

        const { data, error } = await supabase
            .from('user_roles')
            .select('*')
            .eq('user_id', user.id)
            .eq('role', 'super_admin')
            .single();

        if (error || !data) {
            return res.status(403).json({
                success: false,
                error: 'Super Admin access required'
            });
        }

        next();

    } catch (err) {
        return res.status(500).json({
            success: false,
            error: err.message
        });
    }
};

module.exports = requireSuperAdmin;
