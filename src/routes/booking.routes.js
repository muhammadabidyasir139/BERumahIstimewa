const express = require("express");
const router = express.Router();
const {
  createBooking,
  getMyBookings,
} = require("../controllers/booking.controller");
const verifyJWT = require("../middlewares/auth");

router.post("/", verifyJWT, createBooking);
router.get("/my", verifyJWT, getMyBookings);

module.exports = router;
