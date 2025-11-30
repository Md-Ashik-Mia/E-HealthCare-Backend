const mongoose = require("mongoose");

const DoctorScheduleSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    dayOfWeek: Number,
    startTime: String,
    endTime: String,
    slotDurationMinutes: Number,
  },
  { timestamps: true }
);

module.exports = mongoose.model("DoctorSchedule", DoctorScheduleSchema);
