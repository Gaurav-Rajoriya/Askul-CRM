const express = require("express");

const router = express.Router();

const protect = require("../middleware/authMiddleware");

const {
adminDashboard,
salesDashboard
} = require("../controllers/dashboardController");


// ADMIN DASHBOARD

router.get("/admin",protect,adminDashboard);


// SALES DASHBOARD

router.get("/sales",protect,salesDashboard);

module.exports = router;