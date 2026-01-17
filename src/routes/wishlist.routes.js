const express = require("express");
const router = express.Router();
const verifyJWT = require("../middlewares/auth");

const {
  addToWishlist,
  removeFromWishlist,
  getMyWishlist,
} = require("../controllers/wishlist.controller");

router.post("/", verifyJWT, addToWishlist);

router.get("/my", verifyJWT, getMyWishlist);

router.delete("/:id", verifyJWT, removeFromWishlist);

module.exports = router;
