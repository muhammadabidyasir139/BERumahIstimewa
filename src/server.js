const express = require("express");
const cors = require("cors");
require("dotenv").config();
const db = require("./config/db"); // tambahkan ini
const authRoutes = require("./routes/auth.routes");

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/v1/auth", authRoutes);
app.get("/", (req, res) => {
  res.send("Villa Booking API Running...");
});

app.use("/api/v1/owner", require("./routes/owner.routes"));
app.use("/api/v1/villas", require("./routes/villa.routes"));
app.use("/api/v1/bookings", require("./routes/booking.routes"));
app.use("/api/v1/admin", require("./routes/admin.routes"));

app.listen(process.env.PORT, () => {
  console.log("Server running on port " + process.env.PORT);
});
