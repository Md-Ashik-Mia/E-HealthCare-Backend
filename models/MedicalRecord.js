const mongoose = require("mongoose");

const medicalRecordSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  bloodType: {
    type: String,
    enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"],
    default: "Unknown",
  },
  allergies: [String],
  chronicConditions: [String],
  pastSurgeries: [
    {
      name: String,
      date: Date,
      notes: String,
    },
  ],
  familyHistory: String,
  currentMedications: [String],
  vaccinations: [
    {
      name: String,
      date: Date,
    },
  ],
  height: Number, // in cm
  weight: Number, // in kg
  emergencyContact: {
    name: String,
    relationship: String,
    phone: String,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update timestamp on save
medicalRecordSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("MedicalRecord", medicalRecordSchema);
