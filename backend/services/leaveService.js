const pool = require("../db");

async function findOverlappingApprovedLeave(userId,startDate,endDate,excludeLeaveId){
    const result = await pool.query(`
        select id, user_id, leave_type, start_date, end_date, reason,created_at
        from leaves
        where user_id = $1
        and status = 'approved'
        and start_date <= $2
        and end_date >= $3
        and id <> $4
        limit 1`, [userId,endDate,startDate,excludeLeaveId]);

    return result.rows[0] || null;
}

async function findOverlappingActiveLeave(userId,startDate,endDate){
    const result = await pool.query(`
        select id,user_id,leave_type, start_date,end_date,reason, status, created_at
        from leaves
        where user_id = $1 and
        status in ('approved','pending')
        and start_date <= $2
        and end_date >=$3
        limit 1`, [userId,endDate,startDate]);

        return result.rows[0] || null;
}

module.exports = {findOverlappingApprovedLeave, findOverlappingActiveLeave};