const express   = require("express")
const router    = express.Router()
const protect   = require("../middleware/authMiddleware")
const checkRole = require("../middleware/roleMiddleware")

const {
  incomingCall,
  callCompleted,
  clickToCall,
  getCallLogsWithRecordings,
  getExotelAgents,
  addExotelAgent,
  getRecording,
  updateExotelAgent,
  deleteExotelAgent,
  getExotelGroups,
  getLiveCalls,
  getExotelCalls,
  whitelistNumber,
  getWhitelistedNumbers,
} = require("../controllers/exotelController")

// Webhooks
router.get("/incoming",  incomingCall)
router.post("/incoming", incomingCall)
router.get("/completed",  callCompleted)
router.post("/completed", callCompleted)

// Sales
router.post("/click-to-call", protect, clickToCall)
router.get("/recordings",     protect, getCallLogsWithRecordings)
router.get("/recording", protect, getRecording)

// Admin — Agents
router.get("/agents",              protect, checkRole("admin"), getExotelAgents)
router.post("/agents",             protect, checkRole("admin"), addExotelAgent)
router.put("/agents/:agentId",     protect, checkRole("admin"), updateExotelAgent)
router.delete("/agents/:agentId",  protect, checkRole("admin"), deleteExotelAgent)

// Admin — Groups, Calls, Live
router.get("/groups",    protect, checkRole("admin"), getExotelGroups)
router.get("/live",      protect, checkRole("admin"), getLiveCalls)
router.get("/calls",     protect, checkRole("admin"), getExotelCalls)

// Admin — Whitelist
router.get("/whitelist",  protect, checkRole("admin"), getWhitelistedNumbers)
router.post("/whitelist", protect, checkRole("admin"), whitelistNumber)

module.exports = router
