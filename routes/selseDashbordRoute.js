// ─────────────────────────────────────────────────────────────────────────────
// Add to: routes/dashboard.js
// Already has: router.get("/admin", ...)
// Add this below it:
// ─────────────────────────────────────────────────────────────────────────────

// GET /dashboard/sales  — personal stats for the logged-in sales user
router.get("/sales", protect, async (req, res) => {
  try {
    const salesId = req.user.id

    const now           = new Date()
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
    const todayStart     = new Date(now); todayStart.setHours(0,0,0,0)
    const todayEnd       = new Date(now); todayEnd.setHours(23,59,59,999)
    const weekStart      = new Date(now - 7 * 24 * 60 * 60 * 1000)
    const sixMonthsAgo   = new Date(now.getFullYear(), now.getMonth() - 5, 1)
    const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000)
    const sevenDaysAhead  = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    const DAY_NAMES   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]

    // ── 1. Basic counts ──────────────────────────────────────────────────────
    const [myClients, todayFollowups, callsThisWeek] = await Promise.all([
      Client.countDocuments({ assignedTo: salesId }),
      Client.countDocuments({ assignedTo: salesId, nextCallDate: { $gte: todayStart, $lte: todayEnd } }),
      CallLog.countDocuments({ salesId, createdAt: { $gte: weekStart } }),
    ])

    const myCalls = await CallLog.countDocuments({ salesId })

    // ── 2. Status breakdown ──────────────────────────────────────────────────
    const statusAgg = await Client.aggregate([
      { $match: { assignedTo: require("mongoose").Types.ObjectId(salesId) } },
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ])

    const statusBreakdown = ["new","contacted","interested","followup","closed"].map(s => ({
      status: s,
      count: statusAgg.find(g => g._id === s)?.count || 0
    }))

    const interested     = statusBreakdown.find(s => s.status === "interested")?.count || 0
    const closed         = statusBreakdown.find(s => s.status === "closed")?.count     || 0
    const conversionRate = myClients > 0 ? Math.round((closed / myClients) * 100) : 0

    // ── 3. Delta % vs last month ─────────────────────────────────────────────
    const [clientsThisMonth, clientsLastMonth] = await Promise.all([
      Client.countDocuments({ assignedTo: salesId, createdAt: { $gte: thisMonthStart } }),
      Client.countDocuments({ assignedTo: salesId, createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd } }),
    ])
    const clientsDelta = clientsLastMonth === 0 ? 0 : Math.round(((clientsThisMonth - clientsLastMonth) / clientsLastMonth) * 100)

    const [callsThisMonthCount, callsLastMonthCount] = await Promise.all([
      CallLog.countDocuments({ salesId, createdAt: { $gte: thisMonthStart } }),
      CallLog.countDocuments({ salesId, createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd } }),
    ])
    const callsDelta = callsLastMonthCount === 0 ? 0 : Math.round(((callsThisMonthCount - callsLastMonthCount) / callsLastMonthCount) * 100)

    // ── 4. Calls per day — last 14 days (area chart) ─────────────────────────
    const callsPerDayRaw = await CallLog.aggregate([
      { $match: { salesId: require("mongoose").Types.ObjectId(salesId), createdAt: { $gte: fourteenDaysAgo } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, calls: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ])
    const callsPerDay = callsPerDayRaw.map(d => ({
      day:   DAY_NAMES[new Date(d._id).getDay()],
      calls: d.calls,
    }))

    // ── 5. Clients assigned per month — last 6 months (area chart) ───────────
    const clientsPerMonthRaw = await Client.aggregate([
      { $match: { assignedTo: require("mongoose").Types.ObjectId(salesId), createdAt: { $gte: sixMonthsAgo } } },
      { $group: { _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ])
    const clientsPerMonth = clientsPerMonthRaw.map(d => ({
      month: MONTH_NAMES[d._id.month - 1],
      count: d.count,
    }))

    // ── 6. Recent calls — last 5 (bottom table) ───────────────────────────────
    const recentCalls = await CallLog.find({ salesId })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("clientId", "name phone")

    // ── 7. Upcoming followups — next 7 days ───────────────────────────────────
    const upcomingFollowups = await Client.find({
      assignedTo:   salesId,
      nextCallDate: { $gte: todayStart, $lte: sevenDaysAhead }
    })
      .sort({ nextCallDate: 1 })
      .limit(5)
      .select("name phone nextCallDate status")

    // ── Response ──────────────────────────────────────────────────────────────
    res.json({
      // Stat cards
      myClients,
      myCalls,
      interested,
      closed,
      todayFollowups,
      conversionRate,
      callsThisWeek,
      clientsDelta,
      callsDelta,

      // Charts
      statusBreakdown,
      callsPerDay,
      clientsPerMonth,

      // Tables
      recentCalls,
      upcomingFollowups,
    })

  } catch (err) {
    console.error("Sales dashboard error:", err)
    res.status(500).json({ message: "Server error", error: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// Also add these requires at the top of routes/dashboard.js if not present:
//
//   const Client  = require("../models/Client")
//   const CallLog = require("../models/CallLog")
//   const protect = require("../middleware/authMiddleware")
// ─────────────────────────────────────────────────────────────────────────────