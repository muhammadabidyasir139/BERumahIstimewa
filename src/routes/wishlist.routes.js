const express = require("express");
const router = express.Router();
const verifyJWT = require("../middlewares/auth");

const {
  addToWishlist,
  removeFromWishlist,
  getMyWishlist,
} = require("../controllers/wishlist.controller");

// Add to wishlist
router.post("/", verifyJWT, addToWishlist);

// Get my wishlist
router.get("/my", verifyJWT, getMyWishlist);

// Remove from wishlist
router.delete("/", verifyJWT, removeFromWishlist);

module.exports = router;
