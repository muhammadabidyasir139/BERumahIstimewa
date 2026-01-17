const express = require("express");
const router = express.Router();
const verifyJWT = require("../middlewares/auth");
const upload = require("../middlewares/upload");

const {
  getAllVillas,
  createVillaByAdmin,
  editVilla,
  approveVilla,
  rejectVilla,
  inactiveVilla,
  deleteVilla,
  getAllUsers,
  updateUserStatus,
  getRevenue,
  getAllTransactions,
} = require("../controllers/admin.controller");

function adminOnly(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Akses hanya untuk admin" });
  }
  next();
}

router.post(
  "/villas",
  verifyJWT,
  adminOnly,
  upload.array("photos", 10),
  createVillaByAdmin
);
router.put(
  "/villas/:id",
  verifyJWT,
  adminOnly,
  upload.array("photos", 10),
  editVilla
);
router.get("/villas", verifyJWT, adminOnly, getAllVillas);
router.put("/villas/:id/approve", verifyJWT, adminOnly, approveVilla);
router.put("/villas/:id/reject", verifyJWT, adminOnly, rejectVilla);
router.put("/villas/:id/inactive", verifyJWT, adminOnly, inactiveVilla);
router.delete("/villas/:id", verifyJWT, adminOnly, deleteVilla);

router.get("/users", verifyJWT, adminOnly, getAllUsers);
router.put("/users/:id/status", verifyJWT, adminOnly, updateUserStatus);

router.get("/transactions", verifyJWT, adminOnly, getAllTransactions);
router.get("/revenue", verifyJWT, adminOnly, getRevenue);

module.exports = router;
