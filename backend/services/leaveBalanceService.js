const pool = require("../db");

// Default leave allocations per year
const DEFAULT_LEAVES = {
    annual: 10,
    sick: 5,
    casual: 3,
    personal: 2,
    total: 20
};

/**
 * Get leave balance for a user in current year
 */
async function getLeaveBalance(userId) {
    try {
        const currentYear = new Date().getFullYear();

        // Query to get total and used leaves by type
        const result = await pool.query(`
            SELECT
                COALESCE(SUM(CASE WHEN LOWER(leave_type) = 'annual' AND status = 'approved'
                    THEN CAST((end_date - start_date + 1) AS INT) ELSE 0 END), 0) as annual_used,
                COALESCE(SUM(CASE WHEN LOWER(leave_type) = 'sick' AND status = 'approved'
                    THEN CAST((end_date - start_date + 1) AS INT) ELSE 0 END), 0) as sick_used,
                COALESCE(SUM(CASE WHEN LOWER(leave_type) = 'casual' AND status = 'approved'
                    THEN CAST((end_date - start_date + 1) AS INT) ELSE 0 END), 0) as casual_used,
                COALESCE(SUM(CASE WHEN LOWER(leave_type) = 'personal' AND status = 'approved'
                    THEN CAST((end_date - start_date + 1) AS INT) ELSE 0 END), 0) as personal_used
            FROM leaves
            WHERE user_id = $1
            AND EXTRACT(YEAR FROM start_date) = $2
            AND status = 'approved'
        `, [userId, currentYear]);

        const used = result.rows[0] || {};

        // Helper function to ensure non-negative values
        const safeAvailable = (total, usedVal) => Math.max(0, total - Math.max(0, usedVal || 0));

        return {
            annual: {
                total: DEFAULT_LEAVES.annual,
                used: Math.max(0, used.annual_used || 0),
                available: safeAvailable(DEFAULT_LEAVES.annual, used.annual_used)
            },
            sick: {
                total: DEFAULT_LEAVES.sick,
                used: Math.max(0, used.sick_used || 0),
                available: safeAvailable(DEFAULT_LEAVES.sick, used.sick_used)
            },
            casual: {
                total: DEFAULT_LEAVES.casual,
                used: Math.max(0, used.casual_used || 0),
                available: safeAvailable(DEFAULT_LEAVES.casual, used.casual_used)
            },
            personal: {
                total: DEFAULT_LEAVES.personal,
                used: Math.max(0, used.personal_used || 0),
                available: safeAvailable(DEFAULT_LEAVES.personal, used.personal_used)
            },
            total: {
                total: DEFAULT_LEAVES.total,
                used: Math.max(0, (used.annual_used || 0) + (used.sick_used || 0) + (used.casual_used || 0) + (used.personal_used || 0)),
                available: safeAvailable(DEFAULT_LEAVES.total, (used.annual_used || 0) + (used.sick_used || 0) + (used.casual_used || 0) + (used.personal_used || 0))
            }
        };
    } catch (error) {
        console.error("Error getting leave balance:", error);
        throw error;
    }
}

/**
 * Check if user has available leaves for the requested type and duration
 */
async function hasAvailableLeaves(userId, leaveType, duration) {
    try {
        const balance = await getLeaveBalance(userId);
        const typeBalance = balance[leaveType.toLowerCase()];

        if (!typeBalance) {
            return { available: false, reason: "Invalid leave type" };
        }

        if (typeBalance.available < duration) {
            return {
                available: false,
                reason: `Insufficient ${leaveType} leaves. Available: ${typeBalance.available}, Requested: ${duration}`
            };
        }

        return { available: true };
    } catch (error) {
        console.error("Error checking available leaves:", error);
        throw error;
    }
}

module.exports = {
    DEFAULT_LEAVES,
    getLeaveBalance,
    hasAvailableLeaves
};
