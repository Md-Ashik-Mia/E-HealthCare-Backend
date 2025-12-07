const MedicalRecord = require("../models/MedicalRecord");

// Create or update medical record
exports.createOrUpdateMedicalRecord = async (req, res) => {
  try {
    const { patientId } = req.params;
    const userId = req.user.sub;

    // Patients can only update their own records
    if (req.user.role === "patient" && userId !== patientId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const recordData = {
      patientId,
      ...req.body,
    };

    // Use findOneAndUpdate with upsert to create or update
    const medicalRecord = await MedicalRecord.findOneAndUpdate(
      { patientId },
      recordData,
      { new: true, upsert: true, runValidators: true }
    );

    res.json(medicalRecord);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get patient's medical record
exports.getMedicalRecord = async (req, res) => {
  try {
    const { patientId } = req.params;
    const userId = req.user.sub;

    // Patients can only view their own records, doctors and admins can view any
    if (
      req.user.role === "patient" &&
      userId !== patientId
    ) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const medicalRecord = await MedicalRecord.findOne({ patientId }).populate(
      "patientId",
      "name email"
    );

    if (!medicalRecord) {
      return res.status(404).json({ error: "Medical record not found" });
    }

    res.json(medicalRecord);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete medical record (admin only)
exports.deleteMedicalRecord = async (req, res) => {
  try {
    const { patientId } = req.params;

    const medicalRecord = await MedicalRecord.findOneAndDelete({ patientId });

    if (!medicalRecord) {
      return res.status(404).json({ error: "Medical record not found" });
    }

    res.json({ message: "Medical record deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
