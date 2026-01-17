const db = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.register = (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Harap isi semua field" });
  }

  db.query("SELECT * FROM users WHERE email = $1", [email], (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ message: "Database error" });
    }
    if (result.rows.length > 0) {
      return res.status(400).json({ message: "Email sudah terdaftar" });
    }

    bcrypt.hash(password, 10, (err, hashedPassword) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ message: "Error hashing password" });
      }

      const newUser = {
        name,
        email,
        password: hashedPassword,
        role: role || "customer",
      };

      db.query(
        "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)",
        [newUser.name, newUser.email, newUser.password, newUser.role],
        (err, result) => {
          if (err) {
            console.log(err);
            return res.status(500).json({ message: "Gagal membuat user" });
          }

          return res.status(201).json({ message: "Registrasi berhasil" });
        }
      );
    });
  });
};

exports.login = (req, res) => {
  const { email, password } = req.body;

  db.query("SELECT * FROM users WHERE email = $1", [email], (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ message: "Database error" });
    }
    if (result.rows.length === 0) {
      return res.status(400).json({ message: "Email tidak ditemukan" });
    }

    const user = result.rows[0];
    bcrypt.compare(password, user.password, (err, passwordMatch) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ message: "Error comparing password" });
      }

      if (!passwordMatch) {
        return res.status(400).json({ message: "Password salah" });
      }
      const token = jwt.sign(
        { id: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
      );

      return res.json({
        message: "Login berhasil",
        token,
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
        },
      });
    });
  });
};
