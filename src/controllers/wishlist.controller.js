const db = require("../config/db");
const { s3, bucketName } = require("../config/s3");

// Helper for S3 URL
const getS3Url = (filename) => {
  return `${s3.endpoint.href}${bucketName}/${filename}`;
};

// Add to wishlist
exports.addToWishlist = (req, res) => {
  const userId = req.user.id;
  const { villaid } = req.body;

  if (!villaid) {
    return res.status(400).json({ message: "Villa ID wajib diisi" });
  }

  // Check if already in wishlist
  db.query(
    "SELECT * FROM wishlist_villas WHERE userid = $1 AND villaid = $2",
    [userId, villaid],
    (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ message: "Gagal memeriksa wishlist" });
      }

      if (result.length > 0) {
        return res.status(400).json({ message: "Villa sudah ada di wishlist" });
      }

      // Add to wishlist
      db.query(
        "INSERT INTO wishlist_villas (userid, villaid, createdat) VALUES ($1, $2, NOW())",
        [userId, villaid],
        (err, result) => {
          if (err) {
            console.log(err);
            return res
              .status(500)
              .json({ message: "Gagal menambah ke wishlist" });
          }

          return res.json({
            message: "Villa berhasil ditambahkan ke wishlist",
          });
        }
      );
    }
  );
};

// Remove from wishlist
exports.removeFromWishlist = (req, res) => {
  const userId = req.user.id;
  const { villaid } = req.body;

  if (!villaid) {
    return res.status(400).json({ message: "Villa ID wajib diisi" });
  }

  // Remove from wishlist
  db.query(
    "DELETE FROM wishlist_villas WHERE userid = $1 AND villaid = $2",
    [userId, villaid],
    (err, result) => {
      if (err) {
        console.log(err);
        return res
          .status(500)
          .json({ message: "Gagal menghapus dari wishlist" });
      }

      if (result.rowCount === 0) {
        return res
          .status(404)
          .json({ message: "Villa tidak ditemukan di wishlist" });
      }

      return res.json({ message: "Villa berhasil dihapus dari wishlist" });
    }
  );
};

// Get My Wishlist
exports.getMyWishlist = (req, res) => {
  const userId = req.user.id;

  const query = `
    SELECT v.*, string_agg(vp.fileName, ',') AS photos
    FROM wishlist_villas wv
    JOIN villas v ON wv.villaid = v.id
    LEFT JOIN villa_photos vp ON vp.villaId = v.id
    WHERE wv.userid = $1
    GROUP BY v.id
    ORDER BY wv.createdat DESC
  `;

  db.query(query, [userId], (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ message: "Gagal mengambil data wishlist" });
    }

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
