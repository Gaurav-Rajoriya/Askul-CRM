const CallLog = require("../models/CallLog");
const Client  = require("../models/Client");
const axios   = require("axios");

// ── Helpers ───────────────────────────────────────────────────────────────────
const getData = (req) => {
  const bodyHasData = req.body && Object.keys(req.body).length > 0
  return bodyHasData ? req.body : req.query
}

const getExotelBase = () => {
  const { EXOTEL_KEY, EXOTEL_TOKEN, EXOTEL_SID } = process.env
  return {
    // Calls API — v1
    callsUrl: `https://${EXOTEL_KEY}:${EXOTEL_TOKEN}@api.exotel.com/v1/Accounts/${EXOTEL_SID}`,
    // Users/Groups API — v2 aur ccm-api
    usersUrl: `https://${EXOTEL_KEY}:${EXOTEL_TOKEN}@ccm-api.exotel.com/v2/Accounts/${EXOTEL_SID}`,
    sid: EXOTEL_SID,
  }
}

// ─── 1. INCOMING CALL ─────────────────────────────────────────────────────────
exports.incomingCall = async (req, res) => {
  try {
    const data = getData(req)
    const { CallFrom, CallSid, Status } = data
    console.log("📞 Incoming:", data)

    const client = await Client.findOne({ phone: CallFrom })

    await CallLog.create({
      clientId:      client?._id        || undefined,
      salesId:       client?.assignedTo || undefined,
      exotelCallSid: CallSid,
      direction:     "incoming",
      status:        Status || "in-progress",
      calledAt:      new Date(),
      feedback:      client
        ? "Incoming call — auto logged"
        : `Unknown caller: ${CallFrom}`,
    })

    if (client) {
      await Client.findByIdAndUpdate(client._id, { status: "followup" })
    }

    res.status(200).send("OK")
  } catch (error) {
    console.error("❌ incomingCall:", error)
    res.status(200).send("OK")
  }
}

// ─── 2. CALL COMPLETED ────────────────────────────────────────────────────────
exports.callCompleted = async (req, res) => {
  try {
    const data = getData(req)
    const { CallSid, DialCallDuration, RecordingUrl, CallType, CallFrom } = data

    console.log("✅ Completed:", data)

    // RecordingUrl "null" string check karo
    const recording = (RecordingUrl && RecordingUrl !== "null") ? RecordingUrl : null
    const duration  = parseInt(DialCallDuration) || parseInt(data.Duration) || 0

    await CallLog.findOneAndUpdate(
      { exotelCallSid: CallSid },
      {
        duration:     duration,
        recordingUrl: recording,
        status:       CallType || "completed",
      },
      { new: true }
    )

    // Client followup update
    const client = await Client.findOne({ phone: CallFrom })
    if (client) {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(10, 0, 0, 0)
      await Client.findByIdAndUpdate(client._id, {
        nextCallDate: tomorrow,
        status: "followup",
      })
    }

    res.status(200).send("OK")
  } catch (error) {
    console.error("❌ callCompleted:", error)
    res.status(200).send("OK")
  }
}

// ─── 3. CLICK TO CALL ─────────────────────────────────────────────────────────
exports.clickToCall = async (req, res) => {
  try {
    const { clientId } = req.body
    const client = await Client.findById(clientId)
    if (!client) return res.status(404).json({ message: "Client not found" })

    const User = require("../models/User")
    const salesUser = await User.findById(req.user.id)
    if (!salesUser?.phone) {
      return res.status(400).json({
        message: "Tumhara phone number profile mein nahi hai",
      })
    }

    const { callsUrl } = getExotelBase()
    const response = await axios.post(
      `${callsUrl}/Calls/connect`,
      new URLSearchParams({
        From:           salesUser.phone,
        To:             client.phone,
        CallerId:       process.env.EXOTEL_VIRTUAL_NUMBER,
        StatusCallback: `${process.env.BACKEND_URL}/api/exotel/completed`,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    )

    await CallLog.create({
      clientId:      client._id,
      salesId:       req.user.id,
      exotelCallSid: response.data?.Call?.Sid || null,
      direction:     "outgoing",
      status:        "initiated",
      calledAt:      new Date(),
    })

    res.json({ message: "Call initiated!", call: response.data })
  } catch (error) {
    console.error("❌ clickToCall:", error.response?.data || error.message)
    res.status(500).json({ message: "Call start nahi ho saka" })
  }
}

// ─── 4. GET RECORDINGS FROM DB ────────────────────────────────────────────────
exports.getCallLogsWithRecordings = async (req, res) => {
  try {
    const calls = await CallLog.find({ recordingUrl: { $ne: null } })
      .sort({ createdAt: -1 })
      .populate("clientId", "name phone")
      .populate("salesId", "name")
    res.json(calls)
  } catch (error) {
    res.status(500).json(error)
  }
}

// ─── 5. GET AGENTS — ccm-api.exotel.com ──────────────────────────────────────
exports.getExotelAgents = async (req, res) => {
  try {
    const User = require("../models/User")
    const users = await User.find({ role: "sales" })
      .select("name phone email role createdAt")
      .sort({ createdAt: -1 })

    const formatted = users.map(u => ({
      FirstName: u.name,
      Phone:     u.phone || "—",
      Email:     u.email || "—",
      Role:      u.role,
      Status:    u.phone ? "idle" : "offline",
      _id:       u._id,
    }))

    res.json(formatted)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}








// ─── 6. ADD AGENT — ccm-api.exotel.com ───────────────────────────────────────
exports.addExotelAgent = async (req, res) => {
  try {
    const User   = require("../models/User")
    const bcrypt = require("bcryptjs")
    const { name, phone, email, role } = req.body

    if (!name || !phone) {
      return res.status(400).json({ message: "Name aur phone zaroori hai!" })
    }

    const exists = await User.findOne({ $or: [{ phone }, { username: phone }] })
    if (exists) {
      return res.status(400).json({ message: "Phone number already registered hai!" })
    }

    const hashed = await bcrypt.hash(phone, 10)
    const user = await User.create({
      name, phone,
      email:    email || `${phone}@crm.local`,
      username: phone,
      password: hashed,
      role:     role === "admin" ? "admin" : "sales",
    })

    res.json({
      message: `✅ Agent add ho gaya! Login: ${phone} / Password: ${phone}`,
      agent: {
        FirstName: user.name,
        Phone:     user.phone,
        Email:     user.email,
        Role:      user.role,
        Status:    "idle",
        _id:       user._id,
      }
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// ─── 7. UPDATE AGENT ──────────────────────────────────────────────────────────
exports.updateExotelAgent = async (req, res) => {
  try {
    const { usersUrl } = getExotelBase()
    const { agentId }  = req.params
    const { name, phone, email, role } = req.body

    const response = await axios.put(
      `${usersUrl}/users/${agentId}`,
      { first_name: name, phone, email, role },
      { headers: { "Content-Type": "application/json" } }
    )

    res.json({ message: "✅ Agent updated!", agent: response.data })
  } catch (error) {
    console.error("❌ updateExotelAgent:", error.response?.data || error.message)
    res.status(500).json({ message: error.response?.data?.message || error.message })
  }
}

// ─── 8. DELETE AGENT ──────────────────────────────────────────────────────────
exports.deleteExotelAgent = async (req, res) => {
  try {
    const User = require("../models/User")
    const { agentId } = req.params
    const user = await User.findByIdAndDelete(agentId)
    if (!user) return res.status(404).json({ message: "Agent nahi mila" })
    res.json({ message: `✅ ${user.name} remove ho gaya!` })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// ─── 9. GET GROUPS ────────────────────────────────────────────────────────────
exports.getExotelGroups = async (req, res) => {
  // Exotel CCM trial restricted — static return karo
  res.json([
    { Name: "Sales",   TotalUsers: 0 },
    { Name: "Support", TotalUsers: 0 },
  ])
}


// ─── 10. GET LIVE CALLS ───────────────────────────────────────────────────────
exports.getLiveCalls = async (req, res) => {
  try {
    const { callsUrl } = getExotelBase()
    const response = await axios.get(`${callsUrl}/Calls/live.json`)
    const calls = response.data?.Calls?.Call || []
    res.json(Array.isArray(calls) ? calls : [calls])
  } catch (error) {
    console.log("📵 No live calls")
    res.json([])
  }
}

// ─── 11. GET ALL CALLS FROM EXOTEL ────────────────────────────────────────────
exports.getExotelCalls = async (req, res) => {
  try {
    const { callsUrl } = getExotelBase()
    const response = await axios.get(`${callsUrl}/Calls`, {
      params: { PageSize: 50, Page: 0 }
    })
    const calls = response.data?.Calls?.Call || []
    res.json(Array.isArray(calls) ? calls : [calls])
  } catch (error) {
    console.error("❌ getExotelCalls:", error.response?.data || error.message)
    res.status(500).json({ message: error.message })
  }
}

// ─── 12. WHITELIST NUMBER ─────────────────────────────────────────────────────
exports.whitelistNumber = async (req, res) => {
  try {
    const { callsUrl } = getExotelBase()
    const { phone } = req.body

    if (!phone) return res.status(400).json({ message: "Phone number zaroori hai!" })

    const response = await axios.post(
      `${callsUrl}/CustomerWhitelist`,
      new URLSearchParams({ Number: phone }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    )

    res.json({ message: `✅ ${phone} whitelist ho gaya!`, data: response.data })
  } catch (error) {
    console.error("❌ whitelistNumber:", error.response?.data || error.message)
    res.status(500).json({ message: error.response?.data || error.message })
  }
}

// ─── 13. GET WHITELISTED NUMBERS ─────────────────────────────────────────────
exports.getWhitelistedNumbers = async (req, res) => {
  try {
    const { callsUrl } = getExotelBase()
    const response = await axios.get(`${callsUrl}/CustomerWhitelist`)
    res.json(response.data)
  } catch (error) {
    console.error("❌ getWhitelistedNumbers:", error.response?.data || error.message)
    res.status(500).json({ message: error.message })
  }
}


// ─── RECORDING PROXY ──────────────────────────────────────────────────────────
exports.getRecording = async (req, res) => {
  try {
    const { EXOTEL_KEY, EXOTEL_TOKEN } = process.env
    const { url } = req.query

    if (!url) return res.status(400).json({ message: "URL required" })

    const response = await axios.get(url, {
      auth: { username: EXOTEL_KEY, password: EXOTEL_TOKEN },
      responseType: "stream",
    })

    res.setHeader("Content-Type", "audio/mpeg")
    res.setHeader("Accept-Ranges", "bytes")
    response.data.pipe(res)
  } catch (error) {
    console.error("❌ getRecording:", error.message)
    res.status(500).json({ message: "Recording load nahi hua" })
  }
}




