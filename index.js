require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

const app = express();

app.use(cors());
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


app.get("/", (req, res) => {
  res.send("E-Healthcare Backend Running...");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
