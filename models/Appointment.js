const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    scheduleId: { type: mongoose.Schema.Types.ObjectId, ref: "DoctorSchedule", required: true },

    date: { type: String, required: true },            // "2025-11-30"
    time: { type: String, required: true },            // "10:00 AM"

    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled"],
      default: "pending",
    },

    paymentStatus: {
      type: String,
      enum: ["not_paid", "paid"],
      default: "not_paid",
    },

    note: { type: String }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Appointment", appointmentSchema);
