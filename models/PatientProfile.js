const mongoose = require("mongoose");

const PatientProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  age: {
    type: Number,
  },
  bloodGroup: {
    type: String,
    enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
  },
  gender: {
    type: String,
    enum: ["Male", "Female", "Other"],
  },
  phone: {
    type: String,
  },
  address: {
    type: String,
  },
  emergencyContact: {
    name: String,
    relation: String,
    phone: String,
  },
}, { timestamps: true });

module.exports = mongoose.model("PatientProfile", PatientProfileSchema);
