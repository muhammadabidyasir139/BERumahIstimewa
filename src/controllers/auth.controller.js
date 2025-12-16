const db = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// REGISTER
exports.register = (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Harap isi semua field" });
  }

  // Cek email sudah terdaftar
  db.query("SELECT * FROM users WHERE email = ?", [email], (err, result) => {
    if (result.length > 0) {
      return res.status(400).json({ message: "Email sudah terdaftar" });
    }

    // Hash password
    const hashedPassword = bcrypt.hashSync(password, 10);

    const newUser = {
      name,
      email,
      password: hashedPassword,
      role: role || "customer",
    };

    db.query("INSERT INTO users SET ?", newUser, (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ message: "Gagal membuat user" });
      }

      return res.status(201).json({ message: "Registrasi berhasil" });
    });
  });
};

// LOGIN
exports.login = (req, res) => {
  const { email, password } = req.body;

  db.query("SELECT * FROM users WHERE email = ?", [email], (err, users) => {
    if (users.length === 0) {
      return res.status(400).json({ message: "Email tidak ditemukan" });
    }

    const user = users[0];

    // Cek password
    const passwordMatch = bcrypt.compareSync(password, user.password);

    if (!passwordMatch) {
      return res.status(400).json({ message: "Password salah" });
    }

    // Buat token JWT
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
};
