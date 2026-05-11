const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const checkRole = require("../middleware/roleMiddleware")
const {
  addClient,
  getClients,
  getMyClients,
  getClientById,
  updateClient,
  deleteClient,
  updateStatus
} = require("../controllers/clientController");

const CallLog = require("../models/CallLog")
const Client  = require("../models/Client")   // ← yeh missing tha!

// ADD CLIENT
router.post("/add", protect, checkRole("admin"), addClient)

// GET ALL CLIENTS (ADMIN)
router.get("/", protect, checkRole("admin"), getClients)

// GET MY CLIENTS (SALES)
router.get("/my", protect, checkRole("sales"), getMyClients)

// ⚠️ SPECIFIC ROUTES PEHLE — /:id se pehle hone chahiye
// UNASSIGNED CALLS — New Leads
router.get("/unassigned-calls", protect, checkRole("admin"), async (req, res) => {
  try {
    // Sirf woh logs jo clientId null hain — converted wale nahi dikhenge
    const leads = await CallLog.find({ 
      clientId: { $in: [null, undefined] }
    })
      .sort({ createdAt: -1 })
    res.json(leads)
  } catch (err) {
    console.error("Unassigned calls error:", err)
    res.status(500).json({ message: err.message })
  }
})

// CONVERT LEAD TO CLIENT
router.post("/from-call", protect, checkRole("admin"), async (req, res) => {
  try {
    const { phone, name, assignedTo, callLogId } = req.body

    const client = await Client.create({
      name,
      phone,
      assignedTo: assignedTo || null,
      status: "new"
    })

    if (callLogId) {
      await CallLog.findByIdAndUpdate(callLogId, {
        clientId: client._id,
        salesId:  assignedTo || null
      })
    }

    res.json({ message: "Client created from lead", client })
  } catch (err) {
    console.error("From-call error:", err)
    res.status(500).json({ message: err.message })
  }
})

// UPDATE STATUS
router.put("/status/:id", protect, updateStatus)

// ⚠️ /:id WALE ROUTES SABSE LAST MEIN
// GET CLIENT BY ID
router.get("/:id", protect, checkRole("admin"), getClientById)

// UPDATE CLIENT
router.put("/:id", protect, checkRole("admin"), updateClient)

// DELETE CLIENT
router.delete("/:id", protect, checkRole("admin"), deleteClient)

module.exports = router;
