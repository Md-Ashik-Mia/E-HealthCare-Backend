const mongoose = require("mongoose");

const DoctorPrivateNoteSchema = new mongoose.Schema(
  {
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
  },
  { timestamps: true }
);

DoctorPrivateNoteSchema.index({ doctorId: 1, patientId: 1, createdAt: -1 });

module.exports = mongoose.model("DoctorPrivateNote", DoctorPrivateNoteSchema);
