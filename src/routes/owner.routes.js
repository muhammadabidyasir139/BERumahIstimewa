const express = require("express");
const router = express.Router();
const verifyJWT = require("../middlewares/auth");
const upload = require("../middlewares/upload");

const {
  addVilla,
  getOwnerVillas,
  updateVilla,
  deleteVilla,
  getOwnerBookings,
} = require("../controllers/owner.controller");

// Owner dapat CRUD hanya jika status pending/rejected
router.post(
  "/villas",
  verifyJWT,
  upload.array("photos", 10), // max 10 file per request, bisa kamu naikkan
  addVilla
);
router.get("/villas", verifyJWT, getOwnerVillas);
router.put("/villas/:id", verifyJWT, updateVilla);
router.delete("/villas/:id", verifyJWT, deleteVilla);
router.get("/bookings", verifyJWT, getOwnerBookings);

module.exports = router;
