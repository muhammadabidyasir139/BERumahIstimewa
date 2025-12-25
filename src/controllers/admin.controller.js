const db = require("../config/db");

// GET ALL VILLAS
exports.getAllVillas = (req, res) => {
  const query = `
    SELECT v.*, GROUP_CONCAT(vp.fileName) AS photos
    FROM villas v
    LEFT JOIN villa_photos vp ON vp.villaId = v.id
    GROUP BY v.id
    ORDER BY v.id DESC
  `;

  db.query(query, (err, result) => {
    if (err)
      return res.status(500).json({ message: "Gagal mengambil data villa" });

    const data = result.map((row) => {
      let photos = [];
      if (row.photos) {
        photos = row.photos.split(",").map((file) => `/uploads/${file}`);
      }
      return {
        ...row,
        photos,
      };
    });

    res.json(data);
  });
};

exports.createVillaByAdmin = (req, res) => {
  const { ownerId, name, location, price, description } = req.body;
  const files = req.files || [];

  if (!ownerId || !name || !location || !price) {
    return res.status(400).json({ message: "Data villa tidak lengkap" });
  }

  const query = `
    INSERT INTO villas (ownerId, name, location, price, description, status)
    VALUES (?, ?, ?, ?, ?, 'approved')
  `;

  db.query(
    query,
    [ownerId, name, location, price, description],
    (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ message: "Gagal membuat villa" });
      }

      const villaId = result.insertId;

      if (files.length === 0) {
        return res.status(201).json({
          message: "Villa berhasil dibuat oleh admin (tanpa foto)",
          villaId,
          photos: [],
        });
      }

      const photoValues = files.map((file) => [villaId, file.filename]);
      const photoQuery =
        "INSERT INTO villa_photos (villaId, fileName) VALUES ?";

      db.query(photoQuery, [photoValues], (err2) => {
        if (err2) {
          console.log(err2);
          return res.status(500).json({
            message: "Villa tersimpan tetapi gagal menyimpan foto",
          });
        }

        const photoUrls = files.map((f) => `/uploads/${f.filename}`);

        res.status(201).json({
          message: "Villa berhasil dibuat oleh admin",
          villaId,
          photos: photoUrls,
        });
      });
    }
  );
};

// APPROVE VILLA
exports.approveVilla = (req, res) => {
  const { id } = req.params;

  db.query(
    "UPDATE villas SET status = 'approved' WHERE id = ?",
    [id],
    (err, result) => {
      if (err) return res.status(500).json({ message: "Gagal approve villa" });

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Villa tidak ditemukan" });
      }

      res.json({ message: "Villa berhasil disetujui" });
    }
  );
};

// REJECT VILLA
exports.rejectVilla = (req, res) => {
  const { id } = req.params;

  db.query(
    "UPDATE villas SET status = 'rejected' WHERE id = ?",
    [id],
    (err, result) => {
      if (err) return res.status(500).json({ message: "Gagal reject villa" });

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Villa tidak ditemukan" });
      }

      res.json({ message: "Villa berhasil ditolak" });
    }
  );
};

// SET INACTIVE VILLA
exports.inactiveVilla = (req, res) => {
  const { id } = req.params;

  db.query(
    "UPDATE villas SET status = 'inactive' WHERE id = ?",
    [id],
    (err, result) => {
      if (err)
        return res.status(500).json({ message: "Gagal mengubah status villa" });

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Villa tidak ditemukan" });
      }

      res.json({ message: "Villa berhasil dinonaktifkan" });
    }
  );
};

// DELETE VILLA
exports.deleteVilla = (req, res) => {
  const { id } = req.params;

  db.query("DELETE FROM villas WHERE id = ?", [id], (err, result) => {
    if (err) return res.status(500).json({ message: "Gagal menghapus villa" });

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Villa tidak ditemukan" });
    }

    res.json({ message: "Villa berhasil dihapus" });
  });
};

// GET ALL USERS
exports.getAllUsers = (req, res) => {
  db.query("SELECT id, name, email, role, status FROM users", (err, users) => {
    if (err) return res.status(500).json({ message: "Gagal mengambil user" });

    res.json(users);
  });
};

// UPDATE USER STATUS
exports.updateUserStatus = (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!["active", "suspended"].includes(status)) {
    return res.status(400).json({ message: "Status tidak valid" });
  }

  db.query(
    "UPDATE users SET status = ? WHERE id = ?",
    [status, id],
    (err, result) => {
      if (err)
        return res.status(500).json({ message: "Gagal update status user" });

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "User tidak ditemukan" });
      }

      res.json({ message: "Status user berhasil diperbarui" });
    }
  );
};

// GET REVENUE - Total transactions with status 'paid', filterable by period
exports.getRevenue = (req, res) => {
  const { period } = req.query; // 'day', 'week', 'month' or undefined for all time

  let dateFilter = "";
  let params = [];

  if (period === "day") {
    dateFilter = "AND DATE(p.transactionTime) = CURDATE()";
  } else if (period === "week") {
    dateFilter = "AND YEARWEEK(p.transactionTime, 1) = YEARWEEK(CURDATE(), 1)";
  } else if (period === "month") {
    dateFilter =
      "AND YEAR(p.transactionTime) = YEAR(CURDATE()) AND MONTH(p.transactionTime) = MONTH(CURDATE())";
  }

  const query = `
    SELECT
      COUNT(*) as totalTransactions,
      SUM(p.grossAmount) as totalRevenue,
      AVG(p.grossAmount) as averageTransaction,
      MIN(p.transactionTime) as firstTransaction,
      MAX(p.transactionTime) as lastTransaction
    FROM payments p
    WHERE p.transactionStatus = 'paid' ${dateFilter}
  `;

  db.query(query, params, (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ message: "Gagal mengambil data revenue" });
    }

    const revenueData = result[0];
    res.json({
      message: "Data revenue berhasil diambil",
      period: period || "all",
      data: {
        totalTransactions: parseInt(revenueData.totalTransactions) || 0,
        totalRevenue: parseFloat(revenueData.totalRevenue) || 0,
        averageTransaction: parseFloat(revenueData.averageTransaction) || 0,
        firstTransaction: revenueData.firstTransaction,
        lastTransaction: revenueData.lastTransaction,
      },
    });
  });
};

// GET ALL TRANSACTIONS
exports.getAllTransactions = (req, res) => {
  const { page = 1, limit = 10, status, startDate, endDate } = req.query;
  const offset = (page - 1) * limit;

  let whereClause = "";
  let params = [];

  if (status) {
    whereClause += " AND p.transactionStatus = ?";
    params.push(status);
  }

  if (startDate) {
    whereClause += " AND DATE(p.transactionTime) >= ?";
    params.push(startDate);
  }

  if (endDate) {
    whereClause += " AND DATE(p.transactionTime) <= ?";
    params.push(endDate);
  }

  // Get total count
  const countQuery = `
    SELECT COUNT(*) as total
    FROM payments p
    JOIN bookings b ON p.bookingId = b.id
    JOIN villas v ON b.villaId = v.id
    JOIN users u ON b.userId = u.id
    WHERE 1=1 ${whereClause}
  `;

  // Get transactions with pagination
  const dataQuery = `
    SELECT
      p.orderId,
      p.transactionId,
      p.paymentType,
      p.transactionStatus,
      p.transactionTime,
      p.grossAmount,
      p.paymentCode,
      b.checkIn,
      b.checkOut,
      b.totalGuests,
      v.name as villaName,
      v.location as villaLocation,
      u.name as customerName,
      u.email as customerEmail
    FROM payments p
    JOIN bookings b ON p.bookingId = b.id
    JOIN villas v ON b.villaId = v.id
    JOIN users u ON b.userId = u.id
    WHERE 1=1 ${whereClause}
    ORDER BY p.transactionTime DESC
    LIMIT ? OFFSET ?
  `;

  params.push(parseInt(limit), parseInt(offset));

  db.query(countQuery, params.slice(0, -2), (err, countResult) => {
    if (err) {
      console.log(err);
      return res
        .status(500)
        .json({ message: "Gagal mengambil jumlah transaksi" });
    }

    const total = countResult[0].total;

    db.query(dataQuery, params, (err, transactions) => {
      if (err) {
        console.log(err);
        return res
          .status(500)
          .json({ message: "Gagal mengambil data transaksi" });
      }

      res.json({
        message: "Data transaksi berhasil diambil",
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
        },
        transactions,
      });
    });
  });
};
