const db = require("../config/db");

// GET ALL VILLAS (Customer – hanya approved)
exports.getAllVillas = (req, res) => {
  const query = `
    SELECT v.*, GROUP_CONCAT(vp.fileName) AS photos
    FROM villas v
    LEFT JOIN villa_photos vp ON vp.villaId = v.id
    WHERE v.status = 'approved'
    GROUP BY v.id
    ORDER BY v.id DESC
  `;

  db.query(query, (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ message: "Gagal mengambil data villa" });
    }

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

// GET VILLA DETAIL
exports.getVillaById = (req, res) => {
  const { id } = req.params;

  const query = `
    SELECT v.*, GROUP_CONCAT(vp.fileName) AS photos
    FROM villas v
    LEFT JOIN villa_photos vp ON vp.villaId = v.id
    WHERE v.id = ?
    GROUP BY v.id
  `;

  db.query(query, [id], (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ message: "Gagal mengambil detail villa" });
    }

    if (result.length === 0) {
      return res.status(404).json({ message: "Villa tidak ditemukan" });
    }

    const row = result[0];
    let photos = [];
    if (row.photos) {
      photos = row.photos.split(",").map((file) => `/uploads/${file}`);
    }

    res.json({
      ...row,
      photos,
    });
  });
};
