const db = require("../config/db");
const { s3, bucketName } = require("../config/s3");

// Helper for S3 URL
const getS3Url = (filename) => {
  return `${s3.endpoint.href}${bucketName}/${filename}`;
};

// CREATE VILLA (dengan multiple foto)
exports.addVilla = async (req, res) => {
  const { name, location, price, description } = req.body;
  const ownerId = req.user.id;
  const userRole = req.user.role;
  const files = req.files || []; // array file

  if (!name || !location || !price) {
    return res.status(400).json({ message: "Data villa tidak lengkap" });
  }

  // If role is admin, set status to 'approved', else 'pending'
  const status = userRole === "admin" ? "approved" : "pending";

  try {
    const villaQuery = `
      INSERT INTO villas (ownerId, name, location, price, description, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;

    const villaResult = await new Promise((resolve, reject) => {
      db.query(
        villaQuery,
        [ownerId, name, location, price, description, status],
        (err, result) => {
          if (err) reject(err);
          else resolve(result);
        }
      );
    });

    const villaId = villaResult.rows[0].id;

    if (files.length === 0) {
      return res.status(201).json({
        message: "Villa berhasil diajukan (tanpa foto)",
        villaId,
        photos: [],
      });
    }

    // simpan semua foto ke tabel villa_photos
    const photoPromises = files.map((file) => {
      return new Promise((resolve, reject) => {
        // Use file.key (S3) or fallback to filename if local
        const key = file.key || file.filename;
        db.query(
          "INSERT INTO villa_photos (villaId, fileName) VALUES ($1, $2)",
          [villaId, key],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    });

    await Promise.all(photoPromises);

    // Use file.location if available (S3), otherwise construct URL
    const photoUrls = files.map((f) =>
      f.location || getS3Url(f.key || f.filename)
    );

    res.status(201).json({
      message: "Villa berhasil diajukan",
      villaId,
      photos: photoUrls,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Gagal menambahkan villa" });
  }
};

// GET OWNER VILLAS
exports.getOwnerVillas = (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;

  let query;
  let params;

  if (userRole === "admin") {
    // Admin can see all villas
    query = `
      SELECT v.*, string_agg(vp.fileName, ',') AS photos
      FROM villas v
      LEFT JOIN villa_photos vp ON vp.villaId = v.id
      GROUP BY v.id
      ORDER BY v.id DESC
    `;
    params = [];
  } else {
    // Owner/customer can only see their own villas
    query = `
      SELECT v.*, string_agg(vp.fileName, ',') AS photos
      FROM villas v
      LEFT JOIN villa_photos vp ON vp.villaId = v.id
      WHERE v.ownerId = $1
      GROUP BY v.id
      ORDER BY v.id DESC
    `;
    params = [userId];
  }

  db.query(query, params, (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ message: "Gagal mengambil data villa" });
    }

    // ubah string "f1.jpg,f2.jpg" -> array URL
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

    res.json(data);
  });
};

exports.updateVilla = (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;
  const updatedData = req.body;

  // Build the check query based on role
  let checkQuery;
  let checkParams;

  if (userRole === "admin") {
    checkQuery = "SELECT status FROM villas WHERE id = $1";
    checkParams = [id];
  } else {
    checkQuery = "SELECT status FROM villas WHERE id = $1 AND ownerId = $2";
    checkParams = [id, userId];
  }

  db.query(checkQuery, checkParams, (err, result) => {
    if (err)
      return res.status(500).json({ message: "Gagal mengambil data villa" });

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Villa tidak ditemukan" });
    }

    const status = result.rows[0].status;

    // Tidak boleh edit approved atau inactive
    if (status === "approved" || status === "inactive") {
      return res.status(403).json({
        message:
          "Villa sudah disetujui/ditutup admin. Edit tidak diperbolehkan.",
      });
    }

    // Jika villa REJECTED → ubah status kembali ke pending
    if (status === "rejected") {
      updatedData.status = "pending";
    }

    // Handle partial updates for Postgres
    // Note: '?' syntax was simple for object update in MySQL driver, but pg driver doesn't support "SET ?"
    // We need to construct the query dynamically
    const fields = Object.keys(updatedData);
    const values = Object.values(updatedData);

    if (fields.length === 0) {
      return res.status(400).json({ message: "Tidak ada data yang diupdate" });
    }

    let setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(", ");
    let updateQuery;
    let updateParams = [...values];

    if (userRole === "admin") {
      updateQuery = `UPDATE villas SET ${setClause} WHERE id = $${values.length + 1}`;
      updateParams.push(id);
    } else {
      updateQuery = `UPDATE villas SET ${setClause} WHERE id = $${values.length + 1} AND ownerId = $${values.length + 2}`;
      updateParams.push(id, userId);
    }

    db.query(updateQuery, updateParams, (err2) => {
      if (err2) {
        console.log(err2);
        return res.status(500).json({ message: "Gagal update villa" });
      }

      res.json({ message: "Update villa berhasil" });
    });
  });
};

exports.deleteVilla = (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;

  // Build the check query based on role
  let checkQuery;
  let checkParams;

  if (userRole === "admin") {
    checkQuery = "SELECT status FROM villas WHERE id = $1";
    checkParams = [id];
  } else {
    checkQuery = "SELECT status FROM villas WHERE id = $1 AND ownerId = $2";
    checkParams = [id, userId];
  }

  db.query(checkQuery, checkParams, (err, result) => {
    if (err)
      return res.status(500).json({ message: "Gagal mengambil data villa" });

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Villa tidak ditemukan" });
    }

    const status = result.rows[0].status;

    // Tidak boleh delete jika approved/inactive
    if (status === "approved" || status === "inactive") {
      return res.status(403).json({
        message:
          "Villa sudah disetujui/ditutup admin. Hapus tidak diperbolehkan.",
      });
    }

    let deleteQuery;
    let deleteParams;

    if (userRole === "admin") {
      deleteQuery = "DELETE FROM villas WHERE id = $1";
      deleteParams = [id];
    } else {
      deleteQuery = "DELETE FROM villas WHERE id = $1 AND ownerId = $2";
      deleteParams = [id, userId];
    }

    db.query(deleteQuery, deleteParams, (err2) => {
      if (err2)
        return res.status(500).json({ message: "Gagal menghapus villa" });

      res.json({ message: "Villa berhasil dihapus" });
    });
  });
};

// GET OWNER BOOKINGS
exports.getOwnerBookings = (req, res) => {
  const ownerId = req.user.id;

  const query = `
    SELECT bookings.*, villas.name AS villaName
    FROM bookings
    JOIN villas ON villas.id = bookings.villaId
    WHERE villas.ownerId = $1
  `;

  db.query(query, [ownerId], (err, result) => {
    if (err)
      return res.status(500).json({ message: "Gagal mengambil data booking" });

    res.json(result.rows);
  });
};

// GET OWNER INCOME
exports.getOwnerIncome = (req, res) => {
  const ownerId = req.user.id;

  const query = `
    SELECT
      COALESCE(SUM(p.grossAmount), 0) as totalIncome,
      COUNT(p.id) as totalTransactions
    FROM payments p
    JOIN bookings b ON p.bookingId = b.id
    JOIN villas v ON b.villaId = v.id
    WHERE v.ownerId = $1
    AND p.transactionstatus IN ('settlement', 'capture')
  `;

  db.query(query, [ownerId], (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ message: "Gagal mengambil data pendapatan" });
    }

    const data = result.rows[0];
    res.json({
      message: "Data pendapatan berhasil diambil",
      totalIncome: parseFloat(data.totalincome),
      totalTransactions: parseInt(data.totaltransactions)
    });
  });
};
