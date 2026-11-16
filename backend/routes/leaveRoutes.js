const express = require("express");

const authenticateToken = require("../middleware/authenticateToken");
const { createLeave, getPendingLeaves, getLeaveReviewDetails, updateLeaveStatus , getMyLeaves, requestLeaveCancellation,
    getPendingCancellationRequests, updateCancellationRequestStatus, withdrawLeave, getCalendarLeaves,
    bulkWithdrawLeaves, getManagerLeaveSummary, getUserLeaveBalance
} = require("../controllers/leaveController");
const validateLeave = require("../middleware/validateLeave");
const authorizeRoles = require("../middleware/authorizeRoles")
const validateLeaveId = require("../middleware/validateLeaveId")


const router = express.Router();

router.post("/leaves", authenticateToken, validateLeave , createLeave);

router.get("/leaves/pending", authenticateToken, authorizeRoles("manager"), getPendingLeaves);

router.get("/leaves/:id/review", authenticateToken, authorizeRoles("manager"), validateLeaveId, getLeaveReviewDetails);

router.patch("/leaves/:id/status", authenticateToken, authorizeRoles("manager"),validateLeaveId, updateLeaveStatus);

router.get("/leaves/my",authenticateToken,getMyLeaves)

router.post("/leaves/:id/cancellation",authenticateToken,validateLeaveId,requestLeaveCancellation)

router.get("/leave-cancellations/pending", authenticateToken, authorizeRoles("manager"), getPendingCancellationRequests);

router.patch("/leave-cancellations/:id/status", authenticateToken,authorizeRoles("manager"),validateLeaveId, updateCancellationRequestStatus);

router.patch("/leaves/:id/withdraw", authenticateToken,validateLeaveId, withdrawLeave)

router.patch("/leaves/bulk-withdraw", authenticateToken, bulkWithdrawLeaves);

router.get("/leaves/calendar",authenticateToken,getCalendarLeaves)

router.get("/leaves/summary",authenticateToken,authorizeRoles("manager"), getManagerLeaveSummary);

router.get("/balance", authenticateToken, getUserLeaveBalance);

module.exports = router;