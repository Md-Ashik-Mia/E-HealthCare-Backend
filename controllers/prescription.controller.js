const Prescription = require("../models/Prescription");
const Appointment = require("../models/Appointment");

// Create a new prescription
exports.createPrescription = async (req, res) => {
  try {
    const { appointmentId, patientId, medications, diagnosis, notes } = req.body;
    const doctorId = req.user.sub;

    // Verify the appointment exists and belongs to this doctor
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    if (appointment.doctorId.toString() !== doctorId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const prescription = await Prescription.create({
      appointmentId,
      patientId,
      doctorId,
      medications,
      diagnosis,
      notes,
    });

    res.status(201).json(prescription);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all prescriptions for a patient
exports.getPatientPrescriptions = async (req, res) => {
  try {
    const { patientId } = req.params;
    const userId = req.user.sub;

    // Patients can only view their own prescriptions
    if (req.user.role === "patient" && userId !== patientId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const prescriptions = await Prescription.find({ patientId })
      .populate("doctorId", "name email")
      .populate("appointmentId", "date time")
      .sort({ createdAt: -1 });

    res.json(prescriptions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get a specific prescription
exports.getPrescription = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.sub;

    const prescription = await Prescription.findById(id)
      .populate("doctorId", "name email")
      .populate("patientId", "name email")
      .populate("appointmentId", "date time");

    if (!prescription) {
      return res.status(404).json({ error: "Prescription not found" });
    }

    // Only patient, doctor, or admin can view
    if (
      req.user.role === "patient" &&
      prescription.patientId._id.toString() !== userId
    ) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    if (
      req.user.role === "doctor" &&
      prescription.doctorId._id.toString() !== userId
    ) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    res.json(prescription);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update a prescription (doctor only)
exports.updatePrescription = async (req, res) => {
  try {
    const { id } = req.params;
    const doctorId = req.user.sub;
    const { medications, diagnosis, notes } = req.body;

    const prescription = await Prescription.findById(id);
    if (!prescription) {
      return res.status(404).json({ error: "Prescription not found" });
    }

    if (prescription.doctorId.toString() !== doctorId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    prescription.medications = medications || prescription.medications;
    prescription.diagnosis = diagnosis || prescription.diagnosis;
    prescription.notes = notes || prescription.notes;

    await prescription.save();
    res.json(prescription);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
