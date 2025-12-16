const express = require("express");
const router = express.Router();
const {
  getAllVillas,
  getVillaById,
} = require("../controllers/villa.controller");

router.get("/", getAllVillas);
router.get("/:id", getVillaById);

module.exports = router;
