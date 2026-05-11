const Client  = require("../models/Client")
const User    = require("../models/User")
const CallLog = require("../models/CallLog")
const mongoose = require("mongoose")

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
const DAY_NAMES   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]

// ─── ADMIN DASHBOARD ──────────────────────────────────────────────────────────
exports.adminDashboard = async (req, res) => {
  try {
    const now              = new Date()
    const thisMonthStart   = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart   = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthEnd     = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
    const sixMonthsAgo     = new Date(now.getFullYear(), now.getMonth() - 5, 1)
    const fourteenDaysAgo  = new Date(now - 14 * 24 * 60 * 60 * 1000)
    const todayStart       = new Date(now); todayStart.setHours(0,0,0,0)
    const todayEnd         = new Date(now); todayEnd.setHours(23,59,59,999)

    // ── Basic counts ──────────────────────────────────────────────────────────
    const [
      totalClients, totalSales, totalCalls,
      followups, closedClients, newClients,
      salesTeamSize,
    ] = await Promise.all([
      Client.countDocuments(),
      User.countDocuments({ role: "sales" }),
      CallLog.countDocuments(),
      Client.countDocuments({ status: "followup" }),
      Client.countDocuments({ status: "closed" }),
      Client.countDocuments({ status: "new" }),
      User.countDocuments({ role: "sales" }),
    ])

    // ── Delta % vs last month ─────────────────────────────────────────────────
    const [clientsThisMonth, clientsLastMonth] = await Promise.all([
      Client.countDocuments({ createdAt: { $gte: thisMonthStart } }),
      Client.countDocuments({ createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd } }),
    ])
    const clientsDelta = clientsLastMonth === 0 ? 0
      : Math.round(((clientsThisMonth - clientsLastMonth) / clientsLastMonth) * 100)

    const [callsThisMonth, callsLastMonth] = await Promise.all([
      CallLog.countDocuments({ createdAt: { $gte: thisMonthStart } }),
      CallLog.countDocuments({ createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd } }),
    ])
    const callsDelta = callsLastMonth === 0 ? 0
      : Math.round(((callsThisMonth - callsLastMonth) / callsLastMonth) * 100)

    // ── Conversion rate ───────────────────────────────────────────────────────
    const conversionRate = totalClients > 0
      ? Math.round((closedClients / totalClients) * 100) : 0

    // ── Avg calls per client ──────────────────────────────────────────────────
    const avgCallsPerClient = totalClients > 0
      ? Math.round((totalCalls / totalClients) * 10) / 10 : 0

    // ── Status breakdown (pie chart) ──────────────────────────────────────────
    const statusAgg = await Client.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ])
    const statusBreakdown = ["new","contacted","interested","followup","closed"].map(s => ({
      status: s,
      count: statusAgg.find(g => g._id === s)?.count || 0,
    }))

    // ── Clients per month — last 6 months (area chart) ────────────────────────
    const clientsPerMonthRaw = await Client.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      { $group: {
        _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
        count: { $sum: 1 }
      }},
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ])
    const clientsPerMonth = clientsPerMonthRaw.map(d => ({
      month: MONTH_NAMES[d._id.month - 1],
      count: d.count,
    }))

    // ── Calls per day — last 14 days (area chart) ─────────────────────────────
    const callsPerDayRaw = await CallLog.aggregate([
      { $match: { createdAt: { $gte: fourteenDaysAgo } } },
      { $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        calls: { $sum: 1 }
      }},
      { $sort: { _id: 1 } }
    ])
    const callsPerDay = callsPerDayRaw.map(d => ({
      day:   DAY_NAMES[new Date(d._id).getDay()],
      calls: d.calls,
    }))

    // ── Sales performance (bar chart) ─────────────────────────────────────────
    const salesUsers = await User.find({ role: "sales" }).select("name _id")
    const salesPerformance = await Promise.all(
      salesUsers.map(async (s) => {
        const [clients, closed] = await Promise.all([
          Client.countDocuments({ assignedTo: s._id }),
          Client.countDocuments({ assignedTo: s._id, status: "closed" }),
        ])
        return { name: s.name.split(" ")[0], clients, closed }
      })
    )

    // ── Recent clients ────────────────────────────────────────────────────────
    const recentClients = await Client.find()
      .sort({ createdAt: -1 })
      .limit(6)
      .populate("assignedTo", "name")
      .select("name status assignedTo createdAt _id")

    // ── Today's followups ─────────────────────────────────────────────────────
    const todayFollowupsCount = await Client.countDocuments({
      nextCallDate: { $gte: todayStart, $lte: todayEnd }
    })

    res.json({
      // Stat cards
      totalClients,
      totalSales,
      totalCalls,
      followups: todayFollowupsCount,
      closedClients,
      newClients,
      conversionRate,
      avgCallsPerClient,
      salesTeamSize,
      clientsDelta,
      callsDelta,

      // Charts
      statusBreakdown,
      clientsPerMonth,
      callsPerDay,
      salesPerformance,

      // Table
      recentClients,
    })

  } catch (error) {
    console.error("❌ adminDashboard error:", error)
    res.status(500).json({ message: error.message })
  }
}

// ─── SALES DASHBOARD ──────────────────────────────────────────────────────────
exports.salesDashboard = async (req, res) => {
  try {
    const salesId         = req.user.id
    const salesObjId      = new mongoose.Types.ObjectId(salesId)
    const now             = new Date()
    const thisMonthStart  = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart  = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthEnd    = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
    const sixMonthsAgo    = new Date(now.getFullYear(), now.getMonth() - 5, 1)
    const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000)
    const todayStart      = new Date(now); todayStart.setHours(0,0,0,0)
    const todayEnd        = new Date(now); todayEnd.setHours(23,59,59,999)
    const weekStart       = new Date(now - 7 * 24 * 60 * 60 * 1000)
    const sevenDaysAhead  = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    // ── Basic counts ──────────────────────────────────────────────────────────
    const [myClients, myCalls, todayFollowups, callsThisWeek] = await Promise.all([
      Client.countDocuments({ assignedTo: salesId }),
      CallLog.countDocuments({ salesId }),
      Client.countDocuments({ assignedTo: salesId, nextCallDate: { $gte: todayStart, $lte: todayEnd } }),
      CallLog.countDocuments({ salesId, createdAt: { $gte: weekStart } }),
    ])

    // ── Status breakdown ──────────────────────────────────────────────────────
    const statusAgg = await Client.aggregate([
      { $match: { assignedTo: salesObjId } },
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ])
    const statusBreakdown = ["new","contacted","interested","followup","closed"].map(s => ({
      status: s,
      count: statusAgg.find(g => g._id === s)?.count || 0,
    }))

    const interested     = statusBreakdown.find(s => s.status === "interested")?.count || 0
    const closed         = statusBreakdown.find(s => s.status === "closed")?.count     || 0
    const conversionRate = myClients > 0 ? Math.round((closed / myClients) * 100) : 0

    // ── Delta % ───────────────────────────────────────────────────────────────
    const [clientsThisMonth, clientsLastMonth] = await Promise.all([
      Client.countDocuments({ assignedTo: salesId, createdAt: { $gte: thisMonthStart } }),
      Client.countDocuments({ assignedTo: salesId, createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd } }),
    ])
    const clientsDelta = clientsLastMonth === 0 ? 0
      : Math.round(((clientsThisMonth - clientsLastMonth) / clientsLastMonth) * 100)

    const [callsThisMonth, callsLastMonth] = await Promise.all([
      CallLog.countDocuments({ salesId, createdAt: { $gte: thisMonthStart } }),
      CallLog.countDocuments({ salesId, createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd } }),
    ])
    const callsDelta = callsLastMonth === 0 ? 0
      : Math.round(((callsThisMonth - callsLastMonth) / callsLastMonth) * 100)

    // ── Calls per day — last 14 days ──────────────────────────────────────────
    const callsPerDayRaw = await CallLog.aggregate([
      { $match: { salesId: salesObjId, createdAt: { $gte: fourteenDaysAgo } } },
      { $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        calls: { $sum: 1 }
      }},
      { $sort: { _id: 1 } }
    ])
    const callsPerDay = callsPerDayRaw.map(d => ({
      day: DAY_NAMES[new Date(d._id).getDay()],
      calls: d.calls,
    }))

    // ── Clients per month ─────────────────────────────────────────────────────
    const clientsPerMonthRaw = await Client.aggregate([
      { $match: { assignedTo: salesObjId, createdAt: { $gte: sixMonthsAgo } } },
      { $group: {
        _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
        count: { $sum: 1 }
      }},
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ])
    const clientsPerMonth = clientsPerMonthRaw.map(d => ({
      month: MONTH_NAMES[d._id.month - 1],
      count: d.count,
    }))

    // ── Recent calls ──────────────────────────────────────────────────────────
    const recentCalls = await CallLog.find({ salesId })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("clientId", "name phone")

    // ── Upcoming followups ────────────────────────────────────────────────────
    const upcomingFollowups = await Client.find({
      assignedTo:   salesId,
      nextCallDate: { $gte: todayStart, $lte: sevenDaysAhead },
    })
      .sort({ nextCallDate: 1 })
      .limit(5)
      .select("name phone nextCallDate status")

    res.json({
      myClients, myCalls, interested, closed,
      todayFollowups, conversionRate, callsThisWeek,
      clientsDelta, callsDelta,
      statusBreakdown, callsPerDay, clientsPerMonth,
      recentCalls, upcomingFollowups,
    })

  } catch (error) {
    console.error("❌ salesDashboard error:", error)
    res.status(500).json({ message: error.message })
  }
}