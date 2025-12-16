const DoctorProfile = require("../models/DoctorProfile");

exports.getProfile = async (req, res) => {
  try {
    const profile = await DoctorProfile.findOne({ userId: req.user.sub })
      .populate('userId', 'name email');
    
    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }
    
    res.json(profile);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const updated = await DoctorProfile.findOneAndUpdate(
      { userId: req.user.sub },
      { $set: req.body },
      { new: true, runValidators: true }
    ).populate('userId', 'name email');

    if (!updated) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getPatients = async (req, res) => {
  try {
    const doctorId = req.user.sub;
    const Appointment = require("../models/Appointment");
    const User = require("../models/User");

    // Find all appointments for this doctor
    const appointments = await Appointment.find({ doctorId });

    // Extract unique patient IDs
    const patientIds = [...new Set(appointments.map(apt => apt.patientId.toString()))];

    // Fetch patient details
    const patients = await User.find({
      _id: { $in: patientIds }
    }).select('-password');

    const PatientProfile = require("../models/PatientProfile");

    // Add last visit and condition info
    const patientsWithInfo = await Promise.all(patients.map(async (patient) => {
      const lastAppt = await Appointment.findOne({
        patientId: patient._id,
        doctorId
      }).sort({ createdAt: -1 });

      const profile = await PatientProfile.findOne({ userId: patient._id });

      return {
        ...patient.toObject(),
        lastVisit: lastAppt ? lastAppt.date : 'N/A',
        condition: 'General Checkup', // Placeholder
        healthMetrics: profile?.healthMetrics || {},
        age: profile?.age || patient.age || 'N/A',
        bloodGroup: profile?.bloodGroup || 'N/A',
        gender: profile?.gender || patient.gender || 'N/A'
      };
    }));

    res.json(patientsWithInfo);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getPatientDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const User = require("../models/User");
    const PatientProfile = require("../models/PatientProfile");
    const Prescription = require("../models/Prescription");
    const MedicalRecord = require("../models/MedicalRecord");

    // 1. Fetch Basic User Info
    const user = await User.findById(id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "Patient not found" });
    }

    // 2. Fetch Extended Profile (Vitals etc)
    const profile = await PatientProfile.findOne({ userId: id });

    // 3. Fetch Prescriptions History
    const prescriptions = await Prescription.find({ patientId: id })
      .populate("doctorId", "name specialization")
      .sort({ createdAt: -1 });

    // 4. Fetch Clinical Medical Records
    const medicalRecords = await MedicalRecord.find({ patientId: id })
      .sort({ updatedAt: -1 });

    // Combine Data
    const fullRecord = {
      ...user.toObject(),
      healthMetrics: profile?.healthMetrics || {},
      emergencyContact: profile?.emergencyContact || {},
      profile: profile || {}, // Full profile doc
      prescriptions,
      medicalRecords
    };

    res.json(fullRecord);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
