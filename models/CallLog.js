// models/CallLog.js — add duration and calledAt fields

const mongoose = require("mongoose")

const callLogSchema = new mongoose.Schema({

  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Client",
    required: false,
  },

  salesId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },

  feedback: {
    type: String,
    default: "",
  },

  nextFollowup: {
    type: Date,
  },

  // ── New fields ──────────────────────────────────────────────────
  duration: {
    type: Number,   // call duration in seconds (null if not tracked)
    default: null,
  },

  calledAt: {
    type: Date,     // exact moment the call was initiated
    default: Date.now,
  },

  exotelCallSid: {
    type: String
  },

  direction: { 
    type: String, enum: ["incoming", "outgoing"]
   },

  status: { 
    type: String 
  },  // completed, no-answer, busy

  recordingUrl: { 
    type: String
   },
  // ────────────────────────────────────────────────────────────────

}, { timestamps: true })   // createdAt = when log was saved, calledAt = when call happened

module.exports = mongoose.model("CallLog", callLogSchema)