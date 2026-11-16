const express = require("express")

const authenticateToken = require("../middleware/authenticateToken")
const authorizeRoles = require("../middleware/authorizeRoles")
const {getCurrentUser, getAllUsers, createUser, deactivateUser, changePassword} = require("../controllers//userController")

const router = express.Router();

router.get("/me", authenticateToken, getCurrentUser);
router.get("/", authenticateToken, authorizeRoles("manager"), getAllUsers);
router.post("/", authenticateToken, authorizeRoles("manager"), createUser);
router.patch("/:id/deactivate", authenticateToken, authorizeRoles("manager"), deactivateUser);
router.patch("/change-password", authenticateToken, changePassword)

module.exports = router;