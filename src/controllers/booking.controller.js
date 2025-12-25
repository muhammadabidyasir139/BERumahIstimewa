const db = require("../config/db");
const snap = require("../config/midtrans");

// fungsi hitung jumlah malam (checkOut - checkIn)
function countNights(checkIn, checkOut) {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const diffTime = end - start; // ms
  const nights = diffTime / (1000 * 60 * 60 * 24);
  return nights;
}

// CHECK AVAILABILITY FUNCTION (sama seperti sebelumnya)
function checkAvailability(villaId, checkIn, checkOut) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT * FROM bookings
      WHERE villaId = $1
      AND (
        (checkIn <= $2 AND checkOut >= $3) OR
        (checkIn <= $4 AND checkOut >= $5)
      )
    `;

    db.query(
      query,
      [villaId, checkIn, checkIn, checkOut, checkOut],
      (err, result) => {
        if (err) return reject(err);
        resolve(result.rows.length === 0); // true = available
      }
    );
  });
}

// CREATE BOOKING + MIDTRANS SNAP
exports.createBooking = async (req, res) => {
  try {
    const { villaId, checkIn, checkOut } = req.body;
    const userId = req.user.id; // dari JWT

    if (!villaId || !checkIn || !checkOut) {
      return res.status(400).json({ message: "Data booking tidak lengkap" });
    }

    // 1. Check availability
    const isAvailable = await checkAvailability(villaId, checkIn, checkOut);
    if (!isAvailable) {
      return res.status(400).json({
        message: "Villa tidak tersedia pada tanggal tersebut",
      });
    }

    // 2. Ambil data villa & harga
    const villaQuery = "SELECT * FROM villas WHERE id = $1";
    const villa = await new Promise((resolve, reject) => {
      db.query(villaQuery, [villaId], (err, result) => {
        if (err) return reject(err);
        if (result.rows.length === 0)
          return reject(new Error("Villa tidak ditemukan"));
        resolve(result.rows[0]);
      });
    });

    // 3. Hitung jumlah malam & totalAmount
    const nights = countNights(checkIn, checkOut);
    if (nights <= 0) {
      return res
        .status(400)
        .json({ message: "Tanggal check-in/check-out tidak valid" });
    }

    const pricePerNight = villa.price;
    const totalAmount = pricePerNight * nights;

    // 4. Insert booking dengan status waiting_payment
    const insertBookingQuery = `
      INSERT INTO bookings (userId, villaId, checkIn, checkOut, status, totalAmount)
      VALUES ($1, $2, $3, $4, 'waiting_payment', $5)
      RETURNING id
    `;

    const bookingId = await new Promise((resolve, reject) => {
      db.query(
        insertBookingQuery,
        [userId, villaId, checkIn, checkOut, totalAmount],
        (err, result) => {
          if (err) return reject(err);
          resolve(result.rows[0].id);
        }
      );
    });

    // 5. Buat orderId unik untuk Midtrans
    const orderId = `BOOK-${bookingId}-${Date.now()}`;

    // 6. Ambil data user untuk customer_details
    const userQuery = "SELECT name, email FROM users WHERE id = $1";
    const user = await new Promise((resolve, reject) => {
      db.query(userQuery, [userId], (err, result) => {
        if (err) return reject(err);
        if (result.rows.length === 0)
          return reject(new Error("User tidak ditemukan"));
        resolve(result.rows[0]);
      });
    });

    // 7. Parameter Midtrans Snap
    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: totalAmount,
      },
      item_details: [
        {
          id: `villa-${villa.id}`,
          price: pricePerNight,
          quantity: nights,
          name: villa.name,
        },
      ],
      customer_details: {
        first_name: user.name,
        email: user.email,
      },
    };

    // 8. Buat transaksi Snap
    const transaction = await snap.createTransaction(parameter);

    const redirectUrl = transaction.redirect_url;
    const token = transaction.token;

    // 9. Simpan record payment (status awal pending)
    const insertPaymentQuery = `
      INSERT INTO payments (bookingId, orderId, grossAmount, transactionStatus, token, redirectUrl)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;

    await new Promise((resolve, reject) => {
      db.query(
        insertPaymentQuery,
        [bookingId, orderId, totalAmount, "pending", token, redirectUrl],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });

    // 10. Kirim response ke client
    return res.status(201).json({
      message: "Booking dibuat, silakan lakukan pembayaran",
      bookingId,
      totalAmount,
      payment: {
        orderId,
        token,
        redirectUrl,
      },
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Terjadi kesalahan saat membuat booking" });
  }
};

// GET MY BOOKINGS (boleh tetap seperti sebelumnya, tapi tambahkan status & totalAmount)
exports.getMyBookings = (req, res) => {
  const userId = req.user.id;

  const query = `
    SELECT bookings.*, villas.name AS villaName, villas.location, payments.orderId, payments.token, payments.redirectUrl
    FROM bookings
    LEFT JOIN payments ON payments.bookingId = bookings.id
    JOIN villas ON villas.id = bookings.villaId
    WHERE bookings.userId = $1
    ORDER BY bookings.id DESC
  `;

  db.query(query, [userId], (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ message: "Gagal mengambil data booking" });
    }

    // Transform the result to include payment object
    const bookings = result.rows.map((row) => ({
      ...row,
      payment: {
        orderId: row.orderid,
        token: row.token,
        redirectUrl: row.redirecturl,
      },
    }));

    // Remove the individual payment fields from the top level
    bookings.forEach((booking) => {
      delete booking.orderid;
      delete booking.token;
      delete booking.redirecturl;
    });

    return res.json(bookings);
  });
};
