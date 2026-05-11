const express   = require("express");
const router    = express.Router();
const protect   = require("../middleware/authMiddleware");
const checkRole = require("../middleware/roleMiddleware");
const CallLog   = require("../models/CallLog");

const {
  addCallLog,
  getCallHistory,
  notifyIncomingCall,
  getMyCalls,
} = require("../controllers/callController");

// ── Sales Routes ──────────────────────────────────────────────────────────────

// Manual call log karo
router.post("/add", protect, addCallLog);

// Apni saari calls dekho
router.get("/my", protect, getMyCalls);

// Ek client ki call history
router.get("/client/:clientId", protect, getCallHistory);

// ── Incoming Call Notification (Socket.io trigger) ────────────────────────────
// Ye endpoint manually ya mobile app se trigger hoga jab incoming call aaye
router.post("/incoming", notifyIncomingCall);

// ── Admin Routes ──────────────────────────────────────────────────────────────

// Saari calls dekho (admin only)
router.get("/", protect, checkRole("admin"), async (req, res) => {
  try {
    const calls = await CallLog.find()
      .sort({ createdAt: -1 })
      .populate("clientId", "name phone")
      .populate("salesId",  "name");
    res.json(calls);
  } catch (err) {
    console.error("❌ getAllCalls error:", err);
    res.status(500).json({ message: err.message });
  }
});

// Ek client ki saari calls (admin view)
router.get("/admin/client/:clientId", protect, checkRole("admin"), async (req, res) => {
  try {
    const calls = await CallLog.find({ clientId: req.params.clientId })
      .sort({ createdAt: -1 })
      .populate("salesId", "name");
    res.json(calls);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Ek sales person ki saari calls (admin view)
router.get("/admin/sales/:salesId", protect, checkRole("admin"), async (req, res) => {
  try {
    const calls = await CallLog.find({ salesId: req.params.salesId })
      .sort({ createdAt: -1 })
      .populate("clientId", "name phone");
    res.json(calls);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;