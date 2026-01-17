const express = require("express");
const router = express.Router();
const verifyJWT = require("../middlewares/auth");
const verifyOwner = require("../middlewares/owner");
const verifyCustomer = require("../middlewares/customer");
const upload = require("../middlewares/upload");

const {
  addVilla,
  getOwnerVillas,
  updateVilla,
  deleteVilla,
  getOwnerBookings,
  getOwnerIncome,
} = require("../controllers/owner.controller");

router.post(
  "/villas",
  verifyJWT,
  verifyCustomer,
  upload.array("photos", 10),
  addVilla
);
router.get("/villas", verifyJWT, verifyCustomer, getOwnerVillas);
router.put("/villas/:id", verifyJWT, verifyCustomer, updateVilla);
router.delete("/villas/:id", verifyJWT, verifyCustomer, deleteVilla);
router.get("/bookings", verifyJWT, verifyCustomer, getOwnerBookings);
router.get("/income", verifyJWT, verifyCustomer, getOwnerIncome);

module.exports = router;
