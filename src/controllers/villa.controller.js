const db = require("../config/db");

// GET ALL VILLAS (Customer – hanya approved)
exports.getAllVillas = (req, res) => {
  const { name, location, sort, min_price, max_price } = req.query;

  let query = `
    SELECT v.*, string_agg(vp.fileName, ',') AS photos
    FROM villas v
    LEFT JOIN villa_photos vp ON vp.villaId = v.id
    WHERE v.status = 'approved'
  `;

  const params = [];
  const conditions = [];

  if (name) {
    conditions.push(`v.name ILIKE $${params.length + 1}`);
    params.push(`%${name}%`);
  }

  if (location) {
    conditions.push(`v.location ILIKE $${params.length + 1}`);
    params.push(`%${location}%`);
  }

  if (min_price) {
    conditions.push(`v.price >= $${params.length + 1}`);
    params.push(parseFloat(min_price));
  }

  if (max_price) {
    conditions.push(`v.price <= $${params.length + 1}`);
    params.push(parseFloat(max_price));
  }

  if (conditions.length > 0) {
    query += ` AND ${conditions.join(" AND ")}`;
  }

  query += `
    GROUP BY v.id
  `;

  // Handle sorting
  if (sort === "price_asc") {
    query += ` ORDER BY v.price ASC`;
  } else if (sort === "price_desc") {
    query += ` ORDER BY v.price DESC`;
  } else {
    query += ` ORDER BY v.id DESC`;
  }

  db.query(query, params, (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ message: "Gagal mengambil data villa" });
    }

    const data = result.rows.map((row) => {
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
    SELECT v.*, string_agg(vp.fileName, ',') AS photos
    FROM villas v
    LEFT JOIN villa_photos vp ON vp.villaId = v.id
    WHERE v.id = $1
    GROUP BY v.id
  `;

  db.query(query, [id], (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ message: "Gagal mengambil detail villa" });
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Villa tidak ditemukan" });
    }

    const row = result.rows[0];
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
