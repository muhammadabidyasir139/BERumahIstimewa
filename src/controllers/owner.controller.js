const db = require("../config/db");

// CREATE VILLA (dengan multiple foto)
exports.addVilla = (req, res) => {
  const { name, location, price, description } = req.body;
  const ownerId = req.user.id;
  const files = req.files || []; // array file

  if (!name || !location || !price) {
    return res.status(400).json({ message: "Data villa tidak lengkap" });
  }

  const villaQuery = `
    INSERT INTO villas (ownerId, name, location, price, description, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `;

  db.query(
    villaQuery,
    [ownerId, name, location, price, description],
    (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ message: "Gagal menambahkan villa" });
      }

      const villaId = result.insertId;

      if (files.length === 0) {
        return res.status(201).json({
          message: "Villa berhasil diajukan (tanpa foto)",
          villaId,
          photos: [],
        });
      }

      // simpan semua foto ke tabel villa_photos
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
          message: "Villa berhasil diajukan",
          villaId,
          photos: photoUrls,
        });
      });
    }
  );
};

// GET OWNER VILLAS
exports.getOwnerVillas = (req, res) => {
  const ownerId = req.user.id;

  const query = `
    SELECT v.*, GROUP_CONCAT(vp.fileName) AS photos
    FROM villas v
    LEFT JOIN villa_photos vp ON vp.villaId = v.id
    WHERE v.ownerId = ?
    GROUP BY v.id
    ORDER BY v.id DESC
  `;

  db.query(query, [ownerId], (err, result) => {
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
  const ownerId = req.user.id;
  const updatedData = req.body;

  // Ambil status villa dulu
  const checkQuery = "SELECT status FROM villas WHERE id = ? AND ownerId = ?";

  db.query(checkQuery, [id, ownerId], (err, result) => {
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
    const updateQuery = "UPDATE villas SET ? WHERE id = ? AND ownerId = ?";

    db.query(updateQuery, [updatedData, id, ownerId], (err2) => {
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
  const ownerId = req.user.id;

  const query = "SELECT status FROM villas WHERE id = ? AND ownerId = ?";

  db.query(query, [id, ownerId], (err, result) => {
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

    db.query(
      "DELETE FROM villas WHERE id = ? AND ownerId = ?",
      [id, ownerId],
      (err2) => {
        if (err2)
          return res.status(500).json({ message: "Gagal menghapus villa" });

        res.json({ message: "Villa berhasil dihapus" });
      }
    );
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
