const express = require("express");
const cors = require("cors");
require("dotenv").config();
const db = require("./config/db");
const authRoutes = require("./routes/auth.routes");

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/user", require("./routes/user.routes"));
app.use("/api/v1/wishlist", require("./routes/wishlist.routes"));
app.get("/", (req, res) => {
  res.send("Villa Booking API Running...");
});

app.use("/uploads", express.static("uploads"));
app.use("/api/v1/owner", require("./routes/owner.routes"));
app.use("/api/v1/villas", require("./routes/villa.routes"));
app.use("/api/v1/bookings", require("./routes/booking.routes"));
app.use("/api/v1/admin", require("./routes/admin.routes"));

app.use("/api/v1/payments", require("./routes/payment.route"));

module.exports = app;
