const express = require("express");
const router = express.Router();
const verifyJWT = require("../middlewares/auth");
const upload = require("../middlewares/upload");

const {
  getProfile,
  updateProfile,
  changePassword,
  getTransactionHistory,
} = require("../controllers/user.controller");

// Get user profile
router.get("/profile", verifyJWT, getProfile);

// Update user profile (name, email, phone, photo)
router.put("/profile", verifyJWT, upload.single("photo"), updateProfile);

// Change password
router.put("/change-password", verifyJWT, changePassword);

// Get transaction history
router.get("/transactions", verifyJWT, getTransactionHistory);

module.exports = router;
