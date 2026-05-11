const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

const connectDB = require("./config/db");

const app = express();
const server = http.createServer(app);

// ── Socket.io Setup ────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: "https://askulcrm.vercel.app/",
    methods: ["GET", "POST"],
  },
});

// Socket.io ko globally accessible banao (controllers mein use ke liye)
global.io = io;

io.on("connection", (socket) => {
  console.log("🔌 Socket connected:", socket.id);

  // Sales/Admin apna userId se room join kare
  socket.on("join", (userId) => {
    socket.join(userId);
    console.log(`✅ User ${userId} joined room`);
  });

  socket.on("disconnect", () => {
    console.log("❌ Socket disconnected:", socket.id);
  });
});

// ── DB Connect ─────────────────────────────────────────────────────────────
connectDB();

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(express.json());
app.use(cors());

// ── Routes ─────────────────────────────────────────────────────────────────
app.use("/api/auth",      require("./routes/authRoutes"));
app.use("/api/clients",   require("./routes/clientRoutes"));
app.use("/api/users",     require("./routes/userRoutes"));
app.use("/api/calls",     require("./routes/callRoutes"));
app.use("/api/followups", require("./routes/followupRoutes"));
app.use("/api/dashboard", require("./routes/dashboardRoutes"));

app.get("/", (req, res) => {
  res.send("CRM Backend Running");
});

// ── Start ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});