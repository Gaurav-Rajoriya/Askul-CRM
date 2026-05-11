const CallLog = require("../models/CallLog");
const Client  = require("../models/Client");

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/calls/add
// Sales person manually call log kare
// ─────────────────────────────────────────────────────────────────────────────
exports.addCallLog = async (req, res) => {
  try {
    const {
      clientId,
      feedback,
      nextFollowup,
      duration,
      calledAt,
      callStatus,
      clientStatus,
    } = req.body;

    if (!clientId) {
      return res.status(400).json({ message: "clientId is required" });
    }

    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    // Sales sirf apne clients ka log kar sake
    if (
      req.user.role === "sales" &&
      client.assignedTo.toString() !== req.user.id
    ) {
      return res.status(403).json({ message: "Not your client" });
    }

    // Call log create karo
    const call = await CallLog.create({
      clientId,
      salesId:      req.user.id,
      feedback:     feedback     || "",
      nextFollowup: nextFollowup || null,
      duration:     duration     || null,
      calledAt:     calledAt     || new Date(),
      callStatus:   callStatus   || "connected",
      clientStatus: clientStatus || null,
    });

    // Client update karo (status + nextCallDate)
    const updateData = { feedback, nextCallDate: nextFollowup || null };
    if (clientStatus) updateData.status = clientStatus;
    await Client.findByIdAndUpdate(clientId, updateData);

    // Full call history return karo
    const allCalls = await CallLog.find({ clientId })
      .sort({ createdAt: -1 })
      .populate("salesId", "name");

    res.json({
      message:   "Call log saved",
      call,
      calls:     allCalls,
      callCount: allCalls.length,
    });
  } catch (error) {
    console.error("❌ addCallLog error:", error);
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/calls/client/:clientId
// Ek client ki saari call history
// ─────────────────────────────────────────────────────────────────────────────
exports.getCallHistory = async (req, res) => {
  try {
    const calls = await CallLog.find({ clientId: req.params.clientId })
      .sort({ createdAt: -1 })
      .populate("salesId", "name");

    res.json(calls);
  } catch (error) {
    console.error("❌ getCallHistory error:", error);
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/calls/incoming
// Incoming call aaye to — frontend/webhook se trigger hoga
// Socket.io se admin + assigned sales ko notify karo
// ─────────────────────────────────────────────────────────────────────────────
exports.notifyIncomingCall = async (req, res) => {
  try {
    const { phone, callerName } = req.body;

    if (!phone) {
      return res.status(400).json({ message: "phone is required" });
    }

    // Phone se client dhundo
    const client = await Client.findOne({ phone })
      .populate("assignedTo", "name _id");

    const payload = {
      type:       "incoming_call",
      phone,
      callerName: callerName || (client?.name) || "Unknown Caller",
      clientId:   client?._id   || null,
      clientName: client?.name  || null,
      assignedTo: client?.assignedTo || null,
      time:       new Date().toISOString(),
    };

    // Socket.io — sabko broadcast karo
    if (global.io) {
      // Admin room ko notify karo
      global.io.emit("incoming_call", payload);

      // Agar client assigned hai to sales person ko bhi directly
      if (client?.assignedTo?._id) {
        global.io.to(client.assignedTo._id.toString()).emit("incoming_call", payload);
      }
    }

    res.json({ message: "Notification sent", payload });
  } catch (error) {
    console.error("❌ notifyIncomingCall error:", error);
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/calls/my
// Sales person ki apni saari calls
// ─────────────────────────────────────────────────────────────────────────────
exports.getMyCalls = async (req, res) => {
  try {
    const calls = await CallLog.find({ salesId: req.user.id })
      .sort({ createdAt: -1 })
      .populate("clientId", "name phone");

    res.json(calls);
  } catch (error) {
    console.error("❌ getMyCalls error:", error);
    res.status(500).json({ message: error.message });
  }
};