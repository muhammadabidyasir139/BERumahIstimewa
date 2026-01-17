const express = require("express");
const router = express.Router();
const verifyJWT = require("../middlewares/auth");
const upload = require("../middlewares/upload");

const {
  getProfile,
  updateProfile,
  changePassword,
  getTransactionHistory,
  getTransactionDetail,
} = require("../controllers/user.controller");

router.get("/profile", verifyJWT, getProfile);

router.put("/profile", verifyJWT, upload.single("photo"), updateProfile);

router.put("/change-password", verifyJWT, changePassword);

router.get("/transactions", verifyJWT, getTransactionHistory);

router.get("/transactions/:id", verifyJWT, getTransactionDetail);

module.exports = router;
