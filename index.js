require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

const http = require("http");
const initializeSocket = require("./socket");

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
initializeSocket(server);

app.use(cors({
    origin: [
        "http://localhost:3000", 
        "https://e-health-care-front-end.vercel.app",
        "https://e-healthcare-backend.onrender.com"
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

// Connect DB
connectDB();

// Routes
app.use("/auth", require("./routes/auth.routes"));
app.use("/admin", require("./routes/admin.routes"));
app.use("/doctor", require("./routes/doctor.routes"));
app.use("/doctor/schedule", require("./routes/schedule.routes"));
app.use("/appointments", require("./routes/appointmentRoutes"))
app.use("/users",require("./routes/user.routes"))
app.use("/ai", require("./routes/ai.routes"));
app.use("/chat", require("./routes/chat.routes"));
app.use("/patient", require("./routes/patient.routes"));
app.use("/prescriptions", require("./routes/prescription.routes"));
app.use("/medical-records", require("./routes/medicalRecord.routes"));
app.use("/notifications", require("./routes/notification.routes"));

app.get("/", (req, res) => {
  res.send("E-Healthcare Backend Running...");
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
