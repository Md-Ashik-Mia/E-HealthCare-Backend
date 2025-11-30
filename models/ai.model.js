const mongoose = require('mongoose');

const aiResponseSchema = new mongoose.Schema(
  {
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    isAIEnabled: { type: Boolean, default: false }, // AI can be enabled/disabled
    instructions: { type: String, default: "Be polite and helpful with patients." }, // AI behavior
    lastUpdated: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

module.exports = mongoose.model("AIResponse", aiResponseSchema);
