const db = require("../config/db");
const bcrypt = require("bcryptjs");

// Get user profile
exports.getProfile = (req, res) => {
  const userId = req.user.id;

  db.query(
    "SELECT id, name, email, role, photo, phone FROM users WHERE id = $1",
    [userId],
    (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ message: "Gagal mengambil profil" });
      }

      if (result.rows.length === 0) {
        return res.status(404).json({ message: "User tidak ditemukan" });
      }

      const user = result.rows[0];
      return res.json({
        message: "Profil berhasil diambil",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          photo: user.photo,
          phone: user.phone,
        },
      });
    }
  );
};

// Update user profile
exports.updateProfile = (req, res) => {
  const userId = req.user.id;
  const { name, email, phone } = req.body;
  const photo = req.file ? req.file.location : null; // Use location for S3 URL

  // Check if at least one field is provided
  if (!name && !email && phone === undefined && !photo) {
    return res
      .status(400)
      .json({ message: "Setidaknya satu field harus diisi" });
  }

  // If email is provided, check if it's already used by another user
  if (email) {
    db.query(
      "SELECT id FROM users WHERE email = $1 AND id != $2",
      [email, userId],
      (err, result) => {
        if (err) {
          console.log(err);
          return res.status(500).json({ message: "Gagal memverifikasi email" });
        }

        if (result.rows.length > 0) {
          return res.status(400).json({ message: "Email sudah digunakan" });
        }

        // Proceed to update
        performUpdate();
      }
    );
  } else {
    // No email provided, proceed to update
    performUpdate();
  }

  function performUpdate() {
    // Update profil
    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;

    if (name) {
      updateFields.push(`name = $${paramCount++}`);
      updateValues.push(name);
    }

    if (email) {
      updateFields.push(`email = $${paramCount++}`);
      updateValues.push(email);
    }

    if (phone !== undefined) {
      updateFields.push(`phone = $${paramCount++}`);
      updateValues.push(phone);
    }

    if (photo) {
      updateFields.push(`photo = $${paramCount++}`);
      updateValues.push(photo);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: "Tidak ada field yang diupdate" });
    }

    updateValues.push(userId);

    const query = `UPDATE users SET ${updateFields.join(
      ", "
    )} WHERE id = $${paramCount}`;

    db.query(query, updateValues, (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ message: "Gagal update profil" });
      }

      return res.json({ message: "Profil berhasil diupdate" });
    });
  }
};

// Change password
exports.changePassword = (req, res) => {
  const userId = req.user.id;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res
      .status(400)
      .json({ message: "Password saat ini dan password baru wajib diisi" });
  }

  if (newPassword.length < 6) {
    return res
      .status(400)
      .json({ message: "Password baru minimal 6 karakter" });
  }

  // Ambil password saat ini dari database
  db.query(
    "SELECT password FROM users WHERE id = $1",
    [userId],
    (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ message: "Gagal mengambil data user" });
      }

      if (result.rows.length === 0) {
        return res.status(404).json({ message: "User tidak ditemukan" });
      }

      const user = result.rows[0];

      // Verifikasi password saat ini
      const passwordMatch = bcrypt.compareSync(currentPassword, user.password);
      if (!passwordMatch) {
        return res.status(400).json({ message: "Password saat ini salah" });
      }

      // Hash password baru
      const hashedNewPassword = bcrypt.hashSync(newPassword, 10);

      // Update password
      db.query(
        "UPDATE users SET password = $1 WHERE id = $2",
        [hashedNewPassword, userId],
        (err, result) => {
          if (err) {
            console.log(err);
            return res.status(500).json({ message: "Gagal mengubah password" });
          }

          return res.json({ message: "Password berhasil diubah" });
        }
      );
    }
  );
};

// Get transaction history
exports.getTransactionHistory = (req, res) => {
  const userId = req.user.id;

  const query = `
    SELECT
      payments.orderId,
      payments.transactionId,
      payments.paymentType,
      payments.transactionStatus,
      payments.transactionTime,
      payments.grossAmount,
      villas.name AS villaName
    FROM payments
    JOIN bookings ON payments.bookingId = bookings.id
    JOIN villas ON bookings.villaId = villas.id
    WHERE bookings.userId = $1
    ORDER BY payments.transactionTime DESC
  `;

  db.query(query, [userId], (err, result) => {
    if (err) {
      console.log(err);
      return res
        .status(500)
        .json({ message: "Gagal mengambil riwayat transaksi" });
    }

    return res.json({
      message: "Riwayat transaksi berhasil diambil",
      transactions: result.rows,
    });
  });
};
