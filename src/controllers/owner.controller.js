const db = require("../config/db");

// CREATE VILLA (dengan multiple foto)
exports.addVilla = async (req, res) => {
  const { name, location, price, description } = req.body;
  const ownerId = req.user.id;
  const files = req.files || []; // array file

  if (!name || !location || !price) {
    return res.status(400).json({ message: "Data villa tidak lengkap" });
  }

  try {
    const villaQuery = `
      INSERT INTO villas (ownerId, name, location, price, description, status)
      VALUES ($1, $2, $3, $4, $5, 'pending')
      RETURNING id
    `;

    const villaResult = await new Promise((resolve, reject) => {
      db.query(
        villaQuery,
        [ownerId, name, location, price, description],
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
        db.query(
          "INSERT INTO villa_photos (villaId, fileName) VALUES ($1, $2)",
          [villaId, file.filename],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    });

    await Promise.all(photoPromises);

    const photoUrls = files.map((f) => `/uploads/${f.filename}`);

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
      SELECT v.*, GROUP_CONCAT(vp.fileName) AS photos
      FROM villas v
      LEFT JOIN villa_photos vp ON vp.villaId = v.id
      GROUP BY v.id
      ORDER BY v.id DESC
    `;
    params = [];
  } else {
    // Owner/customer can only see their own villas
    query = `
      SELECT v.*, GROUP_CONCAT(vp.fileName) AS photos
      FROM villas v
      LEFT JOIN villa_photos vp ON vp.villaId = v.id
      WHERE v.ownerId = ?
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

exports.updateVilla = (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;
  const updatedData = req.body;

  // Build the check query based on role
  let checkQuery;
  let checkParams;

  if (userRole === "admin") {
    checkQuery = "SELECT status FROM villas WHERE id = ?";
    checkParams = [id];
  } else {
    checkQuery = "SELECT status FROM villas WHERE id = ? AND ownerId = ?";
    checkParams = [id, userId];
  }

  db.query(checkQuery, checkParams, (err, result) => {
    if (err)
      return res.status(500).json({ message: "Gagal mengambil data villa" });

    if (result.length === 0) {
      return res.status(404).json({ message: "Villa tidak ditemukan" });
    }

    const status = result[0].status;

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

    // Jika pending → edit biasa tanpa mengubah status
    let updateQuery;
    let updateParams;

    if (userRole === "admin") {
      updateQuery = "UPDATE villas SET ? WHERE id = ?";
      updateParams = [updatedData, id];
    } else {
      updateQuery = "UPDATE villas SET ? WHERE id = ? AND ownerId = ?";
      updateParams = [updatedData, id, userId];
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
    checkQuery = "SELECT status FROM villas WHERE id = ?";
    checkParams = [id];
  } else {
    checkQuery = "SELECT status FROM villas WHERE id = ? AND ownerId = ?";
    checkParams = [id, userId];
  }

  db.query(checkQuery, checkParams, (err, result) => {
    if (err)
      return res.status(500).json({ message: "Gagal mengambil data villa" });

    if (result.length === 0) {
      return res.status(404).json({ message: "Villa tidak ditemukan" });
    }

    const status = result[0].status;

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
      deleteQuery = "DELETE FROM villas WHERE id = ?";
      deleteParams = [id];
    } else {
      deleteQuery = "DELETE FROM villas WHERE id = ? AND ownerId = ?";
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
    WHERE villas.ownerId = ?
  `;

  db.query(query, [ownerId], (err, result) => {
    if (err)
      return res.status(500).json({ message: "Gagal mengambil data booking" });

    res.json(result);
  });
};
