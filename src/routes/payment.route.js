const express = require("express");
const router = express.Router();
const { midtransNotification } = require("../controllers/payment.controller");

// Endpoint webhook dari Midtrans (tanpa JWT)
router.post("/midtrans/notification", midtransNotification);

module.exports = router;
