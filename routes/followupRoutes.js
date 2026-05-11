const express = require("express");

const router = express.Router();

const protect = require("../middleware/authMiddleware");

const {
getTodayFollowups,
getAllFollowups
} = require("../controllers/followupController");


// SALES TODAY FOLLOWUPS

router.get("/today",protect,getTodayFollowups);


// ADMIN FOLLOWUPS

router.get("/all",protect,getAllFollowups);

module.exports = router;