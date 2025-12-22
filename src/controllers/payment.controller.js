const db = require("../config/db");
const crypto = require("crypto");

exports.midtransNotification = (req, res) => {
  const body = req.body;

  const {
    order_id,
    transaction_status,
    transaction_id,
    payment_type,
    gross_amount,
    status_code,
    signature_key,
    transaction_time,
  } = body;

  // 1. Verifikasi signature
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  const checkSignature = crypto
    .createHash("sha512")
    .update(order_id + status_code + gross_amount + serverKey)
    .digest("hex");

  if (checkSignature !== signature_key) {
    console.log("Signature tidak valid");
    return res.status(403).json({ message: "Invalid signature" });
  }

  // 2. Update tabel payments
  const updatePaymentQuery = `
    UPDATE payments
    SET transactionId = $1,
        paymentType = $2,
        transactionStatus = $3,
        transactionTime = $4,
        rawResponse = $5
    WHERE orderId = $6
  `;

  db.query(
    updatePaymentQuery,
    [
      transaction_id,
      payment_type,
      transaction_status,
      transaction_time,
      JSON.stringify(body),
      order_id,
    ],
    (err, result) => {
      if (err) {
        console.log("Gagal update payment:", err);
        // tetap balas 200 agar Midtrans tidak spam retry
      }
    }
  );

  // 3. Dapatkan bookingId dari tabel payments
  const getPaymentQuery = "SELECT bookingId FROM payments WHERE orderId = $1";

  db.query(getPaymentQuery, [order_id], (err, result) => {
    if (err) {
      console.log("Gagal mengambil bookingId:", err);
      return res.json({ message: "OK" });
    }

    if (result.length === 0) {
      console.log("Payment tidak ditemukan untuk orderId:", order_id);
      return res.json({ message: "OK" });
    }

    const bookingId = result[0]["bookingid"];

    // 4. Tentukan status booking berdasarkan transaction_status
    let newStatus = "waiting_payment";
    if (
      transaction_status === "capture" ||
      transaction_status === "settlement"
    ) {
      newStatus = "paid";
    } else if (
      transaction_status === "cancel" ||
      transaction_status === "expire" ||
      transaction_status === "deny"
    ) {
      newStatus = "cancelled";
    }

    const updateBookingQuery = "UPDATE bookings SET status = $1 WHERE id = $2";

    db.query(updateBookingQuery, [newStatus, bookingId], (err2) => {
      if (err2) {
        console.log("Gagal update status booking:", err2);
      }

      // Midtrans hanya butuh response 200 OK
      return res.json({ message: "OK" });
    });
  });
};
