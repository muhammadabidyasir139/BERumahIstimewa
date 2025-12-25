const multer = require("multer");
const fs = require("fs");
const path = require("path");

// lokasi simpan file (untuk serverless, gunakan /tmp)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = "/tmp/uploads";
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() + "-" + file.originalname.replace(/\s+/g, "_");
    cb(null, uniqueName);
  },
});

// hanya izinkan gambar
const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/jpg"];
  if (!allowed.includes(file.mimetype)) {
    cb(new Error("Format file tidak didukung"), false);
  } else {
    cb(null, true);
  }
};

const upload = multer({
  storage,
  fileFilter,
  // optional: bisa tambah limit fileSize, dll
});

module.exports = upload;
