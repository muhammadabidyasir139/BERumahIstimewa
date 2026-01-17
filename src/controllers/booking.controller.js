const db = require("../config/db");
const snap = require("../config/midtrans");
const { s3, bucketName } = require("../config/s3");

const getS3Url = (filename) => {
  return `${s3.endpoint.href}${bucketName}/${filename}`;
};

exports.getMyBookings = (req, res) => {
  const userId = req.user.id;

  const query = `
    SELECT
      p.id AS payment_id,
      p.bookingid,
      p.orderid,
      p.transactionid,
      p.paymenttype,
      p.grossamount,
      p.transactionstatus,
      p.transactiontime,
      p.rawresponse,
      p.createdat,
      p.token,
      p.redirecturl,

      b.id AS booking_id,
      b.userid,
      b.villaid,
      b.checkin,
      b.checkout,
      b.status AS booking_status,
      b.totalamount AS booking_totalamount,
      
      v.name AS villa_name,
      v.location AS villa_location,
      (SELECT fileName FROM villa_photos vp WHERE vp.villaId = v.id LIMIT 1) AS villa_photo

    FROM payments p
    INNER JOIN bookings b ON p.bookingid = b.id
    INNER JOIN villas v ON b.villaid = v.id
    WHERE b.userid = $1
    ORDER BY p.transactiontime DESC
  `;

  db.query(query, [userId], (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ message: "Gagal mengambil data booking" });
    }

    const bookings = result.rows.map((row) => {
      let status = row.booking_status;
      if (
        row.transactionstatus === "settlement" ||
        row.transactionstatus === "capture"
      ) {
        status = "paid";
      } else if (row.transactionstatus === "pending") {
        status = "waiting_payment";
      } else if (
        row.transactionstatus === "expire" ||
        row.transactionstatus === "cancel" ||
        row.transactionstatus === "deny"
      ) {
        status = "cancelled";
      }

      let photoUrl = null;
      if (row.villa_photo) {
        photoUrl = getS3Url(row.villa_photo);
      }

      return {
        payment_id: row.payment_id,
        bookingid: row.bookingid,
        orderid: row.orderid,
        transactionid: row.transactionid,
        paymenttype: row.paymenttype,
        grossamount: row.grossamount,
        transactionstatus: row.transactionstatus,
        transactiontime: row.transactiontime,
        rawresponse: row.rawresponse,
        createdat: row.createdat,
        token: row.token,

        booking_id: row.booking_id,
        userid: row.userid,
        villaid: row.villaid,
        checkin: row.checkin,
        checkout: row.checkout,
        booking_status: status, // Updated status
        booking_totalamount: row.booking_totalamount,

        villa_name: row.villa_name,
        villa_location: row.villa_location,
        villa_photo: photoUrl,

        payment: {
          orderId: row.orderid,
          token: row.token,
          redirectUrl: row.redirecturl,
        },
      };
    });

    return res.json(bookings);
  });
};
function countNights(checkIn, checkOut) {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const diffTime = end - start;
  const nights = diffTime / (1000 * 60 * 60 * 24);
  return nights;
}

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

exports.createBooking = async (req, res) => {
  try {
    const { villaId, checkIn, checkOut } = req.body;
    const userId = req.user.id;

    if (!villaId || !checkIn || !checkOut) {
      return res.status(400).json({ message: "Data booking tidak lengkap" });
    }

    const isAvailable = await checkAvailability(villaId, checkIn, checkOut);
    if (!isAvailable) {
      return res.status(400).json({
        message: "Villa tidak tersedia pada tanggal tersebut",
      });
    }

    const villaQuery = "SELECT * FROM villas WHERE id = $1";
    const villa = await new Promise((resolve, reject) => {
      db.query(villaQuery, [villaId], (err, result) => {
        if (err) return reject(err);
        if (result.rows.length === 0)
          return reject(new Error("Villa tidak ditemukan"));
        resolve(result.rows[0]);
      });
    });

    const nights = countNights(checkIn, checkOut);
    if (nights <= 0) {
      return res
        .status(400)
        .json({ message: "Tanggal check-in/check-out tidak valid" });
    }

    const pricePerNight = villa.price;
    const totalAmount = pricePerNight * nights;

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

    const orderId = `BOOK-${bookingId}-${Date.now()}`;

    const userQuery = "SELECT name, email FROM users WHERE id = $1";
    const user = await new Promise((resolve, reject) => {
      db.query(userQuery, [userId], (err, result) => {
        if (err) return reject(err);
        if (result.rows.length === 0)
          return reject(new Error("User tidak ditemukan"));
        resolve(result.rows[0]);
      });
    });

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

    const transaction = await snap.createTransaction(parameter);

    const redirectUrl = transaction.redirect_url;
    const token = transaction.token;

    const insertPaymentQuery = `
      INSERT INTO payments (bookingId, orderId, grossAmount, transactionStatus, token, redirectUrl, rawResponse)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;

    await new Promise((resolve, reject) => {
      db.query(
        insertPaymentQuery,
        [
          bookingId,
          orderId,
          totalAmount,
          "pending",
          token,
          redirectUrl,
          JSON.stringify({ redirect_url: redirectUrl }),
        ],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });

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

exports.getMyBookings = (req, res) => {
  const userId = req.user.id;

  const query = `
    SELECT
      p.id AS payment_id,
      p.bookingid,
      p.orderid,
      p.transactionid,
      p.paymenttype,
      p.grossamount,
      p.transactionstatus,
      p.transactiontime,
      p.rawresponse,
      p.createdat,
      p.token,
      p.redirecturl,

      b.id AS booking_id,
      b.userid,
      b.villaid,
      b.checkin,
      b.checkout,
      b.status AS booking_status,
      b.totalamount AS booking_totalamount,

      v.name AS villa_name,
      v.location AS villa_location,
      (SELECT fileName FROM villa_photos vp WHERE vp.villaId = v.id LIMIT 1) AS villa_photo

    FROM payments p
    INNER JOIN bookings b ON p.bookingid = b.id
    INNER JOIN villas v ON b.villaid = v.id
    WHERE b.userid = $1
    ORDER BY p.transactiontime DESC
  `;

  db.query(query, [userId], (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ message: "Gagal mengambil data booking" });
    }

    const bookings = result.rows.map((row) => {
      let status = row.booking_status;
      if (
        row.transactionstatus === "settlement" ||
        row.transactionstatus === "capture"
      ) {
        status = "paid";
      } else if (row.transactionstatus === "pending") {
        status = "waiting_payment";
      } else if (
        row.transactionstatus === "expire" ||
        row.transactionstatus === "cancel" ||
        row.transactionstatus === "deny"
      ) {
        status = "cancelled";
      }

      let photoUrl = null;
      if (row.villa_photo) {
        photoUrl = getS3Url(row.villa_photo);
      }

      return {
        payment_id: row.payment_id,
        bookingid: row.bookingid,
        orderid: row.orderid,
        transactionid: row.transactionid,
        paymenttype: row.paymenttype,
        grossamount: row.grossamount,
        transactionstatus: row.transactionstatus,
        transactiontime: row.transactiontime,
        rawresponse: row.rawresponse,
        createdat: row.createdat,
        token: row.token,

        booking_id: row.booking_id,
        userid: row.userid,
        villaid: row.villaid,
        checkin: row.checkin,
        checkout: row.checkout,
        booking_status: status,
        booking_totalamount: row.booking_totalamount,

        villa_name: row.villa_name,
        villa_location: row.villa_location,
        villa_photo: photoUrl,

        payment: {
          orderId: row.orderid,
          token: row.token,
          redirectUrl: row.redirecturl,
        },
      };
    });

    return res.json(bookings);
  });
};

exports.getBookingById = (req, res) => {
  const userId = req.user.id;
  const bookingId = req.params.id;

  const query = `
    SELECT
      p.id AS payment_id,
      p.bookingid,
      p.orderid,
      p.transactionid,
      p.paymenttype,
      p.grossamount,
      p.transactionstatus,
      p.transactiontime,
      p.rawresponse,
      p.createdat,
      p.token,
      p.redirecturl,

      b.id AS booking_id,
      b.userid,
      b.villaid,
      b.checkin,
      b.checkout,
      b.status AS booking_status,
      b.totalamount AS booking_totalamount,
      
      v.name AS villa_name,
      v.location AS villa_location,
      (SELECT fileName FROM villa_photos vp WHERE vp.villaId = v.id LIMIT 1) AS villa_photo

    FROM bookings b
    LEFT JOIN payments p ON p.bookingid = b.id
    INNER JOIN villas v ON b.villaid = v.id
    WHERE b.id = $1 AND b.userid = $2
  `;

  db.query(query, [bookingId, userId], (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ message: "Gagal mengambil data booking" });
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Booking tidak ditemukan" });
    }

    const row = result.rows[0];

    let status = row.booking_status;
    if (
      row.transactionstatus === "settlement" ||
      row.transactionstatus === "capture"
    ) {
      status = "paid";
    } else if (row.transactionstatus === "pending") {
      status = "waiting_payment";
    } else if (
      row.transactionstatus === "expire" ||
      row.transactionstatus === "cancel" ||
      row.transactionstatus === "deny"
    ) {
      status = "cancelled";
    }

    let photoUrl = null;
    if (row.villa_photo) {
      photoUrl = getS3Url(row.villa_photo);
    }

    res.json({
      bookingId: row.booking_id,
      checkIn: row.checkin,
      checkOut: row.checkout,
      totalAmount: row.booking_totalamount,
      bookingStatus: status,

      villa: {
        name: row.villa_name,
        location: row.villa_location,
        photo: photoUrl,
      },

      payment: {
        transactionId: row.transactionid,
        orderId: row.orderid,
        status: row.transactionstatus,
        type: row.paymenttype,
        time: row.transactiontime,
        token: row.token,
        redirectUrl: row.redirecturl,
      },
    });
  });
};
