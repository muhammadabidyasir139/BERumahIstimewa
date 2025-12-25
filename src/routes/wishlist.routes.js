const express = require("express");
const router = express.Router();
const verifyJWT = require("../middlewares/auth");

const {
  addToWishlist,
  removeFromWishlist,
} = require("../controllers/wishlist.controller");

// Add to wishlist
router.post("/", verifyJWT, addToWishlist);

// Remove from wishlist
router.delete("/", verifyJWT, removeFromWishlist);

module.exports = router;
