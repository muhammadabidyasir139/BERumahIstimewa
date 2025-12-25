const express = require("express");
const router = express.Router();
const verifyJWT = require("../middlewares/auth");
const verifyOwner = require("../middlewares/owner");
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
  verifyOwner,
  upload.array("photos", 10), // max 10 file per request, bisa kamu naikkan
  addVilla
);
router.get("/villas", verifyJWT, verifyOwner, getOwnerVillas);
router.put("/villas/:id", verifyJWT, verifyOwner, updateVilla);
router.delete("/villas/:id", verifyJWT, verifyOwner, deleteVilla);
router.get("/bookings", verifyJWT, verifyOwner, getOwnerBookings);

module.exports = router;
