const pool = require("../db")

const {findOverlappingApprovedLeave, findOverlappingActiveLeave} = require("../services/leaveService")
const {getLeaveBalance, hasAvailableLeaves} = require("../services/leaveBalanceService")




async function createLeave(req,res,next) {

    const {leave_type, start_date, end_date, reason} = req.body

    const user_id = req.user.id;

    try{

        const overlappingLeave = await findOverlappingActiveLeave(user_id, start_date, end_date);

        if(overlappingLeave){
            return res.status(409).json({
                message:"Your leave overlaps with an existing approved or pending leave. If it is pending leave you can cancel the leave and request leave again",
                overlappingLeave: {
                    id: overlappingLeave.id,
                    start_date : overlappingLeave.start_date,
                    end_date : overlappingLeave.end_date,
                    status: overlappingLeave.status
                }
            });
        }

        // Calculate duration in days
        const startDateObj = new Date(start_date);
        const endDateObj = new Date(end_date);
        const duration = Math.ceil((endDateObj - startDateObj) / (1000 * 60 * 60 * 24)) + 1;

        // Check if user has available leaves
        const leaveCheck = await hasAvailableLeaves(user_id, leave_type, duration);

        if (!leaveCheck.available) {
            return res.status(422).json({
                message: leaveCheck.reason,
                code: "INSUFFICIENT_LEAVES"
            });
        }

        const result = await pool.query(`
        INSERT INTO leaves
        (user_id, leave_type, start_date, end_date, reason)
        values
        ($1,$2,$3,$4,$5)
        returning
        id, user_id, leave_type, start_date, end_date, reason, status, created_at`,
        [user_id, leave_type, start_date, end_date, reason]);

            res.status(201).json({
                message:"Leave application created successfully",
                leave: result.rows[0]
            })

    } catch(error){
        console.error("Create Leave Error: ", error);

        if (error.code === "23514"){
            return res.status(400).json({
                message:"Invalid leave data"
            })
        }

        next(error);
    }
}

async function getPendingLeaves(req,res, next){
    try{
        const result = await pool.query(`
            select 
            leaves.id,leaves.user_id,users.username,leaves.leave_type,
            leaves.start_date,leaves.end_date,leaves.reason,leaves.status,
            (leaves.end_date - leaves.start_date + 1)::integer AS requested_days,
            leaves.created_at
            from leaves
            join users
            on leaves.user_id = users.id
            where leaves.status = 'pending'
            order by leaves.created_at asc`);

        res.status(200).json({
            message:"Pending leaves retrieved successfully",
            leaves: result.rows
        })
    } catch (error){
        next(error);
    }
}

async function getLeaveReviewDetails(req, res, next) {
    const { id } = req.params;

    try {
        const leaveResult = await pool.query(`
            SELECT l.id, l.user_id, u.username, l.leave_type,
                   l.start_date, l.end_date, l.reason, l.status, l.created_at,
                   (l.end_date - l.start_date + 1)::integer AS requested_days
            FROM leaves l
            JOIN users u ON u.id = l.user_id
            WHERE l.id = $1`, [id]);

        if (leaveResult.rows.length === 0) {
            return res.status(404).json({ message: "Leave not found" });
        }

        const leave = leaveResult.rows[0];
        const balance = await getLeaveBalance(leave.user_id);
        const approvedResult = await pool.query(`
            SELECT id, leave_type, start_date, end_date, reason, status, created_at
            FROM leaves
            WHERE user_id = $1 AND status = 'approved'
            ORDER BY start_date ASC, created_at ASC`, [leave.user_id]);

        return res.status(200).json({
            message: "Leave review details retrieved successfully",
            leave,
            requested_days: Number(leave.requested_days),
            balance,
            approvedLeaves: approvedResult.rows
        });
    } catch (error) {
        return next(error);
    }
}

async function updateLeaveStatus(req, res,next) {
    const {id} = req.params;
    const {status} = req.body;

    if (status !== "approved" && status !== "rejected"){
        return res.status(400).json({
            message:"Status must be approved or rejected"
        })
    }

    try{

        const leaveResult = await pool.query(`
            SELECT id, user_id, leave_type, start_date, end_date, reason, status, created_at,
                   (end_date - start_date + 1)::integer AS requested_days
            FROM leaves WHERE id = $1`,[id]);

        if(leaveResult.rows.length === 0){
            return res.status(404).json({
                message:"Leave Not Found"
            });
        }

        const leave = leaveResult.rows[0]

        if(leave.status !== 'pending'){
            return res.status(400).json({
                message:"Leave has already been processed"
            });
        }

        if(status === "approved") {
            const duration = Math.ceil((new Date(leave.end_date) - new Date(leave.start_date)) / (1000 * 60 * 60 * 24)) + 1;
            const leaveCheck = await hasAvailableLeaves(leave.user_id, leave.leave_type, duration);

            if (!leaveCheck.available) {
                return res.status(422).json({
                    message: leaveCheck.reason,
                    code: "INSUFFICIENT_LEAVES"
                });
            }

            const overlappingLeave = await
            findOverlappingApprovedLeave(leave.user_id, leave.start_date, leave.end_date, leave.id);

            if (overlappingLeave){
                return res.status(409).json({
                    message:"Leave overlaps with an existing approved leave",
                    overlappingLeave: {
                        id : overlappingLeave.id,
                        start_date: overlappingLeave.start_date,
                        end_date: overlappingLeave.end_date
                    }
                });
            }
        }

        let result;
        try {
            result = await pool.query(`
                UPDATE leaves
                SET status = $1,
                    reviewed_at = CURRENT_TIMESTAMP,
                    reviewed_by = $3
                WHERE id = $2
                  AND status = 'pending'
                RETURNING id, user_id, leave_type, start_date, end_date, reason,
                          status, created_at, reviewed_at, reviewed_by`, [status, id, req.user.id]);
        } catch (error) {
            if (error.code !== "42703") throw error;
            // Allow approval/rejection before the optional reviewer migration is installed.
            result = await pool.query(`
                UPDATE leaves
                SET status = $1
                WHERE id = $2
                  AND status = 'pending'
                RETURNING id, user_id, leave_type, start_date, end_date, reason,
                          status, created_at`, [status, id]);
        }

            if (result.rows.length === 0 ) {
                return res.status(409).json({
                    message:"Leave could not be processed"
                })
            }

            res.status(200).json({
                message : `leave ${status} successfully`,
                leave: result.rows[0]
            })
    }
    catch (error){
        next(error);

    }

}

async function getMyLeaves(req, res, next) {
    const baseQuery = `
        SELECT l.id, l.leave_type, l.start_date, l.end_date, l.reason, l.status, l.created_at,
               cancellation.reviewed_at AS cancellation_reviewed_at,
               cancellation.reviewer_reason,
               cancellation_reviewer.username AS cancellation_reviewer_name,
               pending_cancel.id IS NOT NULL AS has_pending_cancellation
        FROM leaves l
        LEFT JOIN LATERAL (
            SELECT lcr.reviewed_at, lcr.reviewed_by, lcr.reviewer_reason
            FROM leave_cancellation_requests lcr
            WHERE lcr.leave_id = l.id AND lcr.status = 'approved'
            ORDER BY lcr.reviewed_at DESC NULLS LAST
            LIMIT 1
        ) cancellation ON TRUE
        LEFT JOIN LATERAL (
            SELECT lcr.id
            FROM leave_cancellation_requests lcr
            WHERE lcr.leave_id = l.id AND lcr.status = 'pending'
            LIMIT 1
        ) pending_cancel ON TRUE
        LEFT JOIN users cancellation_reviewer ON cancellation_reviewer.id = cancellation.reviewed_by
        WHERE l.user_id = $1
        ORDER BY l.created_at DESC`;

    try {
        let result;
        try {
            result = await pool.query(`
                SELECT l.id, l.leave_type, l.start_date, l.end_date, l.reason, l.status, l.created_at,
                       l.reviewed_at,
                       reviewer.username AS reviewer_name,
                       l.reviewer_reason,
                       pending_cancel.id IS NOT NULL AS has_pending_cancellation
                FROM leaves l
                LEFT JOIN LATERAL (
                    SELECT lcr.id
                    FROM leave_cancellation_requests lcr
                    WHERE lcr.leave_id = l.id AND lcr.status = 'pending'
                    LIMIT 1
                ) pending_cancel ON TRUE
                LEFT JOIN users reviewer ON reviewer.id = l.reviewed_by
                WHERE l.user_id = $1
                ORDER BY l.created_at DESC`, [req.user.id]);
        } catch (error) {
            if (error.code !== "42703") throw error;
            result = await pool.query(baseQuery, [req.user.id]);
            result.rows = result.rows.map(leave => ({
                ...leave,
                reviewed_at: leave.cancellation_reviewed_at,
                reviewer_name: leave.cancellation_reviewer_name
            }));
        }

        return res.status(200).json({
            message: "Leave retrieved successfully",
            leaves: result.rows
        });
    } catch (error) {
        return next(error);
    }

}

async function requestLeaveCancellation(req,res, next) {
    const { id } = req.params;
    const { reason } = req.body;

    const user_id = req.user.id;

    try{
        // 1. We must find the leave
        const leaveResult = await pool.query(`
            select id, user_id, status
            from leaves 
            where id = $1`, [id]);
        
        if (leaveResult.rows.length === 0){
            return res.status(404).json({
                message:"Leave not found"
            });
        }

        const leave = leaveResult.rows[0];

        //2. We must check whether this leave belongs to the logged in user
        if(Number(leave.user_id) !== Number(user_id)){
            return res.status(403).json({
                message:"You can only request cancellation for your own leave"
            });
        }

        //3. Cancellation request is allowed for approved leave
        if(leave.status !== "approved"){
            return res.status(400).json({
                message:"Only approved leave can be cancelled through a cancellation request"
            })
        }

        //4. Check if there's already a pending cancellation request for this leave
        const existingRequest = await pool.query(`
            select id, status
            from leave_cancellation_requests
            where leave_id = $1 and status = 'pending'`,
            [id]);

        if (existingRequest.rows.length > 0) {
            return res.status(409).json({
                message: "A cancellation request is already pending for this leave. Please wait for it to be processed."
            });
        }

        //5. Create a cancellation request
        const result = await pool.query(`
            insert into leave_cancellation_requests (leave_id, user_id, reason)
            values ($1,$2,$3)
            returning
            id, leave_id, user_id, reason, status, created_at, reviewed_at, reviewed_by, reviewer_reason`,
            [id,user_id,reason])

        res.status(201).json({
            message:"Leave cancellation request submitted successfully",
            cancellationRequest: result.rows[0]
        })
    } catch(error){
        // Handle duplicate key error gracefully
        if (error.code === "23505") {
            return res.status(409).json({
                message: "A cancellation request already exists for this leave. Please wait for it to be processed."
            });
        }
        next(error);
    }
}


async function getPendingCancellationRequests(req, res, next){
    try{
        const result= await pool.query(`
            select lcr.id, lcr.leave_id, lcr.user_id,
            u.username, l.leave_type, l.start_date,l.end_date,
            (l.end_date - l.start_date + 1)::integer AS requested_days,
            l.reason as leave_reason, lcr.reason as cancellation_reason,
            lcr.status,lcr.created_at
            from leave_cancellation_requests lcr
            join leaves l
            on lcr.leave_id = l.id
            join users u
            on lcr.user_id = u.id
            where lcr.status = 'pending'
            order by lcr.created_at asc`);

        res.status(200).json({
            message:"Pending cancellation requests retrieved successfully",
            cancellationRequests: result.rows
        });
    }
    catch(error){
        next(error);
    };


}

async function updateCancellationRequestStatus (req, res,  next){
    const { id } = req.params;
    const { status , reviewer_reason } = req.body;

    const manager_id = req.user.id;

    if(status !== "approved" && status !== "rejected"){
        return res.status(400).json({
            message:"Status must be approved or rejected"
        })
    }

    let client = null;

    try{

        client = await pool.connect();

        await client.query("BEGIN");

        //1. Find the pending cancellation request
        const cancellationResult = await client.query(`
            select id, leave_id, user_id, status
            from leave_cancellation_requests
            where id = $1
            for update`, [id]);

        if (cancellationResult.rows.length === 0){
            await client.query("ROLLBACK")

            return res.status(404).json({
                message:"Cancellation request not found"
            });
        }

        const cancellationRequest = cancellationResult.rows[0]


        //2. Make sure the cancellation request is still pending

        if (cancellationRequest.status !== "pending"){
            await client.query("ROLLBACK")

            return res.status(400).json({
                message:"Cancellation request has already been processed"
            });
  
        }


        //3. Update the cancellation request

        const cancellationUpdate = await client.query(`
            UPDATE leave_cancellation_requests
            set
            status = $1,
            reviewed_at = current_timestamp,
            reviewed_by = $2,
            reviewer_reason = $3 where id = $4
            returning id, leave_id, user_id, reason, status, created_at, reviewed_at, reviewed_by, reviewer_reason`,
            [status,manager_id, reviewer_reason || null, id]

        );

        //4. If manager Approved cancellation, cancel the actual Leave

        if (status === "approved"){

            const leaveUpdate = await client.query(`
                UPDATE leaves
                SET status = 'cancelled',
                    reviewed_at = CURRENT_TIMESTAMP,
                    reviewed_by = $2
                WHERE id = $1 AND status = 'approved'
                RETURNING id, user_id, leave_type, start_date, end_date, reason, status, created_at, reviewed_at, reviewed_by`,
            [cancellationRequest.leave_id, manager_id]);

            if (leaveUpdate.rows.length === 0){
                await client.query("ROLLBACK");

                return res.status(409).json({
                    message:"Leave is no longer an approved state"
                })
            }

            await client.query("COMMIT");

            return res.status(200).json({
                message: "Leave Cancellation approved sucessfully",
                cancellationRequest: cancellationUpdate.rows[0],
                leave: leaveUpdate.rows[0]
            });
        }

        //5. If rejected, Leave remains approved
        await client.query("COMMIT");

        return res.status(200).json({
            message: "Leave cancellation rejected sucessfully",
            cancellationRequest: cancellationUpdate.rows[0]
        });
    } catch (error){
        if (client){
            try{
                await client.query("ROLLBACK");
            } catch(rollbackError){
                console.error("Rollback failed:", rollbackError);
            }
        }

        console.error("Update Cancellation Request Status Error: ", error);

        return next(error);
    }

    finally{
        if(client){
            client.release();
        }
    }
}

async function withdrawLeave(req, res, next){
    const { id } = req.params;
    const user_id = req.user.id;

    try{
        //1. Find the Leave
        const leaveResult = await pool.query(`
            SELECT id, user_id, leave_type, start_date, end_date, reason, status, created_at,
                   (end_date - start_date + 1)::integer AS requested_days
            FROM leaves WHERE id = $1`,[id]);
        
        if (leaveResult.rows.length === 0){
            return res.status(404).json({
                message:"Leave not found"
            })
        }

        const leave = leaveResult.rows[0];

        //2. Check the ownership
        if (Number(leave.user_id) !== Number(user_id)){
            return res.status(403).json({
                message:"You can only withdraw your own leave"
            });
        }

        //3.Only pending leaves can be withdrawn
        if(leave.status !== 'pending'){
            return res.status(400).json({
                message:"Only Pending leave requests can be withdrawn"
            });
        }

        //4. Change pending -> cancelled
        const result = await pool.query(`
            update leaves
            set status = 'cancelled'
            where id = $1
            and user_id= $2
            and status = 'pending'
            returning id, user_id, leave_type, start_date, end_date, reason, status, created_at`,
        [id,user_id]);

        if(result.rows.length === 0){
            return res.status(400).json({
                message:"Leave could not be withdrawn"
            })
        }

        res.status(200).json({
            message:"Leave withdrawn successfully",
            leave: result.rows[0]
        })

    } catch(error){
        next(error);
    }
}

async function bulkWithdrawLeaves(req, res, next){
    const { leaveIds } = req.body;
    const userId = req.user.id;

    if (
        !Array.isArray(leaveIds) ||
        leaveIds.length === 0 ||
        !leaveIds.every(
            id => (typeof id === "number" && Number.isSafeInteger(id) && id>0)||
                  (typeof id === "string" && /^[1-9]\d*$/.test(id)) && BigInt(id) <= 9223372036854775807n) ||
        new Set(leaveIds.map(String)).size !== leaveIds.length
    ) { return res.status(400).json({
        message:"leaveIds must be a non-empty array of unique positive IDs"
    }); }

    let client = null

    try{

        client = await pool.connect();

        await client.query("BEGIN");

        const leaveResult = await client.query(`
            select id, user_id, status
            from leaves
            where id = ANY($1::bigint[])
            for update`, [leaveIds.map(String)]);
        
        const leaves = leaveResult.rows;

        if(leaves.length !== leaveIds.length){
            await client.query("ROLLBACK")

            return res.status(404).json({
                message:"One or more leave requests were not found"
            });
        }

        if (leaves.some(leave => String(leave.user_id) !== String(userId))){
            await client.query("ROLLBACK");

            return res.status(403).json({
                message:"You can only withdraw your own leave requests"
            });
        }

        if (leaves.some(leave => leave.status !== "pending")){
            await client.query("ROLLBACK")

            return res.status(400).json({
                message:"All requested leaves must have pending status"
            });
        }

        const result = await client.query(`
            update leaves
            set status = 'cancelled'
            where id = ANY($1::bigint[])
            and user_id = $2
            and status = 'pending'
            returning id, user_id,leave_type, start_date, end_date, reason, status, created_at`,
        [leaveIds.map(String), userId]);

        if(result.rows.length !== leaveIds.length){
            await client.query("ROLLBACK");

            return res.status(409).json({
                message:"Leave requests changed while processing; please try again"
            });
        }

        await client.query("COMMIT");

        return res.status(200).json({
            message: "Leave requests withdrawn successfully",
            leaves: result.rows
        });
    } catch (error){

        if(client){
        try{
            await client.query("ROLLBACK");
        } catch(rollbackError){
            console.error("Bulk withdrawl rollback failed:", rollbackError);
        }
    }
       return next(error);

    } finally{
        if(client){
        client.release();
    }}

}

async function getCalendarLeaves(req, res, next){
    try{
        const result = await pool.query(`SELECT
            id, leave_type, start_date, end_date, reason, status, created_at
            FROM leaves
            WHERE user_id = $1
            ORDER BY start_date ASC, created_at ASC`, [req.user.id])

            res.status(200).json({
                message:"Calendar leaves retrieved successfully",
                leaves: result.rows
            });
    } catch(error) {
        next(error);
    }
}



async function getManagerLeaveSummary(req, res, next) {
    try {
        const result = await pool.query(`
            WITH year_bounds AS (
                SELECT
                    DATE_TRUNC('year', CURRENT_DATE)::date AS year_start,
                    (
                        DATE_TRUNC('year', CURRENT_DATE)
                        + INTERVAL '1 year'
                        - INTERVAL '1 day'
                    )::date AS year_end
            ),
            approved_leave_days AS (
                SELECT
                    l.user_id,
                    LOWER(l.leave_type) AS leave_type,
                    (
                        LEAST(l.end_date, y.year_end)
                        - GREATEST(l.start_date, y.year_start)
                        + 1
                    )::integer AS days_taken
                FROM leaves l
                CROSS JOIN year_bounds y
                WHERE l.status = 'approved'
                  AND l.start_date <= y.year_end
                  AND l.end_date >= y.year_start
            )
            SELECT
                u.id,
                u.username,
                COALESCE(
                    SUM(a.days_taken)
                    FILTER (WHERE a.leave_type = 'annual'), 0
                )::integer AS annual,
                COALESCE(
                    SUM(a.days_taken)
                    FILTER (WHERE a.leave_type = 'casual'), 0
                )::integer AS casual,
                COALESCE(
                    SUM(a.days_taken)
                    FILTER (WHERE a.leave_type = 'sick'), 0
                )::integer AS sick,
                COALESCE(
                    SUM(a.days_taken)
                    FILTER (WHERE a.leave_type = 'personal'), 0
                )::integer AS personal,
                COALESCE(SUM(a.days_taken), 0)::integer AS total_days
            FROM users u
            LEFT JOIN approved_leave_days a
                ON a.user_id = u.id
            WHERE u.is_active = TRUE
              AND u.role = 'employee'
            GROUP BY u.id, u.username
            ORDER BY total_days DESC, u.username ASC
        `);

        return res.status(200).json({
            message: "Manager leave summary retrieved successfully",
            year: new Date().getFullYear(),
            employees: result.rows
        });
    } catch (error) {
        return next(error);
    }
}

async function getUserLeaveBalance(req, res, next) {
    const user_id = req.user.id;

    try {
        const {getLeaveBalance} = require("../services/leaveBalanceService");
        const balance = await getLeaveBalance(user_id);

        return res.status(200).json({
            message: "Leave balance retrieved successfully",
            year: new Date().getFullYear(),
            balance: balance
        });
    } catch (error) {
        return next(error);
    }
}



module.exports = {createLeave, getPendingLeaves, getLeaveReviewDetails, updateLeaveStatus, getMyLeaves, requestLeaveCancellation, getPendingCancellationRequests, updateCancellationRequestStatus, withdrawLeave,bulkWithdrawLeaves, getCalendarLeaves, getManagerLeaveSummary, getUserLeaveBalance};