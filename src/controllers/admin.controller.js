const db = require("../config/db");
const { s3, bucketName } = require("../config/s3");

const getS3Url = (filename) => {
  return `${s3.endpoint.href}${bucketName}/${filename}`;
};

exports.getAllVillas = (req, res) => {
  const query = `
    SELECT v.*, string_agg(vp.fileName, ',') AS photos
    FROM villas v
    LEFT JOIN villa_photos vp ON vp.villaId = v.id
    GROUP BY v.id
    ORDER BY v.id DESC
  `;

  db.query(query, (err, result) => {
    if (err)
      return res.status(500).json({ message: "Gagal mengambil data villa" });

    const data = result.rows.map((row) => {
      let photos = [];
      if (row.photos) {
        photos = row.photos.split(",").map((file) => getS3Url(file));
      }
      return {
        ...row,
        photos,
      };
    });

    res.json({
      message: "Data villa berhasil diambil",
      count: data.length,
      villas: data,
    });
  });
};

exports.createVillaByAdmin = async (req, res) => {
  const { ownerId, name, location, price, description } = req.body;
  const files = req.files || [];

  if (!ownerId || !name || !location || !price) {
    return res.status(400).json({ message: "Data villa tidak lengkap" });
  }

  const query = `
    INSERT INTO villas (ownerId, name, location, price, description, status)
    VALUES ($1, $2, $3, $4, $5, 'approved')
    RETURNING id
  `;

  try {
    const result = await db.query(query, [
      ownerId,
      name,
      location,
      price,
      description,
    ]);
    const villaId = result.rows[0].id;

    if (files.length === 0) {
      return res.status(201).json({
        message: "Villa berhasil dibuat oleh admin (tanpa foto)",
        villaId,
        photos: [],
      });
    }

    const photoPromises = files.map((file) => {
      const key = file.key || file.filename;
      return db.query(
        "INSERT INTO villa_photos (villaId, fileName) VALUES ($1, $2)",
        [villaId, key]
      );
    });

    await Promise.all(photoPromises);

    const photoUrls = files.map((f) => getS3Url(f.key || f.filename));

    res.status(201).json({
      message: "Villa berhasil dibuat oleh admin",
      villaId,
      photos: photoUrls,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Gagal membuat villa" });
  }
};

exports.editVilla = async (req, res) => {
  const { id } = req.params;
  const { name, location, price, description } = req.body;
  const files = req.files || [];

  if (!name || !location || !price) {
    return res.status(400).json({ message: "Data villa tidak lengkap" });
  }

  const query = `
    UPDATE villas 
    SET name = $1, location = $2, price = $3, description = $4
    WHERE id = $5
    RETURNING *
  `;

  try {
    const result = await db.query(query, [
      name,
      location,
      price,
      description,
      id,
    ]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Villa tidak ditemukan" });
    }

    if (files.length > 0) {
      const photoPromises = files.map((file) => {
        const key = file.key || file.filename;
        return db.query(
          "INSERT INTO villa_photos (villaId, fileName) VALUES ($1, $2)",
          [id, key]
        );
      });
      await Promise.all(photoPromises);
    }

    const updatedVilla = result.rows[0];

    const photosResult = await db.query(
      "SELECT fileName FROM villa_photos WHERE villaId = $1",
      [id]
    );
    const photos = photosResult.rows.map((row) => getS3Url(row.filename));

    res.json({
      message: "Villa berhasil diupdate",
      villa: {
        ...updatedVilla,
        photos,
      },
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Gagal mengupdate villa" });
  }
};

exports.approveVilla = (req, res) => {
  const { id } = req.params;

  db.query(
    "UPDATE villas SET status = 'approved' WHERE id = $1",
    [id],
    (err, result) => {
      if (err) return res.status(500).json({ message: "Gagal approve villa" });

      if (result.rowCount === 0) {
        return res.status(404).json({ message: "Villa tidak ditemukan" });
      }

      res.json({ message: "Villa berhasil disetujui" });
    }
  );
};

exports.rejectVilla = (req, res) => {
  const { id } = req.params;

  db.query(
    "UPDATE villas SET status = 'rejected' WHERE id = $1",
    [id],
    (err, result) => {
      if (err) return res.status(500).json({ message: "Gagal reject villa" });

      if (result.rowCount === 0) {
        return res.status(404).json({ message: "Villa tidak ditemukan" });
      }

      res.json({ message: "Villa berhasil ditolak" });
    }
  );
};

exports.inactiveVilla = (req, res) => {
  const { id } = req.params;

  db.query(
    "UPDATE villas SET status = 'inactive' WHERE id = $1",
    [id],
    (err, result) => {
      if (err)
        return res.status(500).json({ message: "Gagal mengubah status villa" });

      if (result.rowCount === 0) {
        return res.status(404).json({ message: "Villa tidak ditemukan" });
      }

      res.json({ message: "Villa berhasil dinonaktifkan" });
    }
  );
};

exports.deleteVilla = (req, res) => {
  const { id } = req.params;

  db.query("DELETE FROM villas WHERE id = $1", [id], (err, result) => {
    if (err) return res.status(500).json({ message: "Gagal menghapus villa" });

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Villa tidak ditemukan" });
    }

    res.json({ message: "Villa berhasil dihapus" });
  });
};

exports.getAllUsers = (req, res) => {
  db.query("SELECT id, name, email, role, status FROM users", (err, result) => {
    if (err) return res.status(500).json({ message: "Gagal mengambil user" });

    res.json({
      message: "Data user berhasil diambil",
      count: result.rowCount,
      users: result.rows,
    });
  });
};

exports.updateUserStatus = (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!["active", "suspended"].includes(status)) {
    return res.status(400).json({ message: "Status tidak valid" });
  }

  db.query(
    "UPDATE users SET status = $1 WHERE id = $2",
    [status, id],
    (err, result) => {
      if (err)
        return res.status(500).json({ message: "Gagal update status user" });

      if (result.rowCount === 0) {
        return res.status(404).json({ message: "User tidak ditemukan" });
      }

      res.json({ message: "Status user berhasil diperbarui" });
    }
  );
};

exports.getRevenue = (req, res) => {
  const { period, startDate, endDate } = req.query;

  let dateFilter = "";
  let params = [];
  let paramCount = 1;

  const statusCondition = "p.transactionstatus IN ('settlement', 'capture')";

  if (startDate && endDate) {
    dateFilter = `AND p.transactiontime::DATE >= $${paramCount++} AND p.transactiontime::DATE <= $${paramCount++}`;
    params.push(startDate, endDate);
  } else if (period === "day") {
    dateFilter = "AND p.transactiontime::DATE = CURRENT_DATE";
  } else if (period === "week") {
    dateFilter = "AND p.transactiontime >= date_trunc('week', CURRENT_DATE)";
  } else if (period === "month") {
    dateFilter = "AND p.transactiontime >= date_trunc('year', CURRENT_DATE)";
  }

  const query = `
    SELECT
      COUNT(*) as totalTransactions,
      SUM(p.grossAmount) as totalRevenue,
      AVG(p.grossAmount) as averageTransaction,
      MIN(p.transactiontime) as firstTransaction,
      MAX(p.transactiontime) as lastTransaction
    FROM payments p
    WHERE ${statusCondition} ${dateFilter}
  `;

  let breakdownQuery = "";
  if (period === "week") {
    breakdownQuery = `
      SELECT
        TRIM(TO_CHAR(p.transactiontime, 'Day')) as day_name,
        EXTRACT(ISODOW FROM p.transactiontime) as day_of_week,
        SUM(p.grossAmount) as daily_revenue
      FROM payments p
      WHERE ${statusCondition} ${dateFilter}
      GROUP BY day_name, day_of_week
      ORDER BY day_of_week ASC
    `;
  } else if (period === "month") {
    breakdownQuery = `
      SELECT
        TRIM(TO_CHAR(p.transactiontime, 'Month')) as month_name,
        EXTRACT(MONTH FROM p.transactiontime) as month_num,
        SUM(p.grossAmount) as monthly_revenue
      FROM payments p
      WHERE ${statusCondition} ${dateFilter}
      GROUP BY month_name, month_num
      ORDER BY month_num ASC
    `;
  }

  db.query(query, params, (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ message: "Gagal mengambil data revenue" });
    }

    const revenueData = result.rows[0];
    const responseData = {
      message: "Data revenue berhasil diambil",
      period: period || (startDate && endDate ? "custom" : "all"),
      data: {
        totalTransactions: parseInt(revenueData.totaltransactions) || 0,
        totalRevenue: parseFloat(revenueData.totalrevenue) || 0,
        averageTransaction: parseFloat(revenueData.averagetransaction) || 0,
        firstTransaction: revenueData.firsttransaction,
        lastTransaction: revenueData.lasttransaction,
      },
    };

    if (period === "week" || period === "month") {
      db.query(breakdownQuery, params, (err2, result2) => {
        if (err2) {
          console.log(err2);
          return res.json(responseData);
        }

        if (period === "week") {
          const days = [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday",
          ];

          const weeklyBreakdown = days.map((day) => {
            const found = result2.rows.find((row) => row.day_name === day);
            return {
              day: day,
              revenue: found ? parseFloat(found.daily_revenue) : 0,
            };
          });

          responseData.data.weeklyBreakdown = weeklyBreakdown;
        } else if (period === "month") {
          const months = [
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December",
          ];

          const monthlyBreakdown = months.map((month) => {
            const found = result2.rows.find((row) => row.month_name === month);
            return {
              month: month,
              revenue: found ? parseFloat(found.monthly_revenue) : 0,
            };
          });

          responseData.data.monthlyBreakdown = monthlyBreakdown;
        }

        res.json(responseData);
      });
    } else {
      res.json(responseData);
    }
  });
};

exports.getAllTransactions = (req, res) => {
  const { page = 1, limit = 10, status, startDate, endDate } = req.query;
  const offset = (page - 1) * limit;

  let whereClause = "";
  let params = [];
  let paramCount = 1;

  if (status) {
    whereClause += ` AND p.transactionstatus = $${paramCount++}`;
    params.push(status);
  }

  if (startDate) {
    whereClause += ` AND p.transactiontime::DATE >= $${paramCount++}`;
    params.push(startDate);
  }

  if (endDate) {
    whereClause += ` AND p.transactiontime::DATE <= $${paramCount++}`;
    params.push(endDate);
  }

  const statsQuery = `
    SELECT 
      COUNT(*) as total,
      COALESCE(SUM(CASE WHEN p.transactionstatus IN ('settlement', 'capture') THEN p.grossAmount ELSE 0 END), 0) as totalRevenue
    FROM payments p
    JOIN bookings b ON p.bookingId = b.id
    JOIN villas v ON b.villaId = v.id
    JOIN users u ON b.userId = u.id
    WHERE 1=1 ${whereClause}
  `;

  const dataQuery = `
    SELECT
      p.orderId,
      p.transactionId,
      p.paymentType,
      p.transactionstatus,
      p.transactiontime,
      p.grossAmount,
      b.checkIn,
      b.checkOut,
      v.name as villaName,
      v.location as villaLocation,
      u.name as customerName,
      u.email as customerEmail
    FROM payments p
    JOIN bookings b ON p.bookingId = b.id
    JOIN villas v ON b.villaId = v.id
    JOIN users u ON b.userId = u.id
    WHERE 1=1 ${whereClause}
    ORDER BY p.transactiontime DESC
    LIMIT $${paramCount++} OFFSET $${paramCount++}
  `;

  const countParams = [...params];

  params.push(parseInt(limit), parseInt(offset));

  db.query(statsQuery, countParams, (err, statsResult) => {
    if (err) {
      console.log(err);
      return res
        .status(500)
        .json({ message: "Gagal mengambil statistik transaksi" });
    }

    const total = parseInt(statsResult.rows[0].total);
    const totalRevenue = parseFloat(statsResult.rows[0].totalrevenue);

    db.query(dataQuery, params, (err, result) => {
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
        stats: {
          totalTransactions: total,
          totalRevenue,
        },
        transactions: result.rows,
      });
    });
  });
};
