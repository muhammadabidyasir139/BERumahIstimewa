const multer = require("multer");
const multerS3 = require("multer-s3");
const { s3, bucketName } = require("../config/s3");

const storage = multerS3({
  s3: s3,
  bucket: bucketName || "rumahistimewa",
  acl: "public-read",
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
