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
