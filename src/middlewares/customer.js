module.exports = (req, res, next) => {
  if (req.user.role !== "customer" && req.user.role !== "admin") {
    return res
      .status(403)
      .json({
        message: "Akses ditolak. Hanya customer atau admin yang diperbolehkan.",
      });
  }
  next();
};
