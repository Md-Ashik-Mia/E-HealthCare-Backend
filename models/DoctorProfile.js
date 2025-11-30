const mongoose = require("mongoose");

const DoctorProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    speciality: String,
    registrationNumber: String,
    degree: String,
    experienceYears: Number,
    phone: String,

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    bio: String,
    consultationFee: Number,
    consultationModes: [String],
    isAutoAIReplyEnabled: Boolean,
    aiInstructions: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("DoctorProfile", DoctorProfileSchema);
