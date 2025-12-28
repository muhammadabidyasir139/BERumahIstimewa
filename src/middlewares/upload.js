const multer = require("multer");
const multerS3 = require("multer-s3");
const { s3, bucketName } = require("../config/s3");

// Debug logging
console.log("Upload middleware - bucketName:", bucketName);
console.log(
  "Upload middleware - available env vars:",
  Object.keys(process.env).filter((key) => key.startsWith("AWS_"))
);

// Gunakan S3 storage untuk upload
const storage = multerS3({
  s3: s3,
  bucket: bucketName || "rumahistimewa", // fallback to hardcoded bucket name
  acl: "public-read", // agar bisa diakses publik
  contentType: (req, file, cb) => {
    cb(null, "image/jpeg");
  },
  metadata: (req, file, cb) => {
    cb(null, { fieldName: file.fieldname });
  },
  key: (req, file, cb) => {
    const uniqueName =
      "user-photos/" +
      Date.now() +
      "-" +
      file.originalname.replace(/\s+/g, "_");
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
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

module.exports = upload;
