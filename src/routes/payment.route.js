const express = require("express");
const router = express.Router();
const { midtransNotification } = require("../controllers/payment.controller");

router.post("/midtrans/notification", midtransNotification);

module.exports = router;
