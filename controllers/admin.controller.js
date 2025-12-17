const DoctorProfile = require("../models/DoctorProfile");
const User = require("../models/User");
const Appointment = require("../models/Appointment");

exports.getStats = async (req, res) => {
  try {
    const totalPatients = await User.countDocuments({ role: "patient" });
    const totalDoctors = await User.countDocuments({ role: "doctor" });
    const activeAppointments = await Appointment.countDocuments({ 
      status: { $in: ["pending", "confirmed"] } 
    });

    // Calculate detailed revenue
    // 1. Find all paid appointments
    const paidAppointments = await Appointment.find({ paymentStatus: "paid" });
    
    // 2. Calculate total revenue by summing doctor's consultation fee for each appointment
    // Note: This relies on current consultation fee. Ideally, snapshot fee at booking time.
    let totalRevenue = 0;
    
    for (const apt of paidAppointments) {
      const doctorProfile = await DoctorProfile.findOne({ userId: apt.doctorId });
      if (doctorProfile && doctorProfile.consultationFee) {
        totalRevenue += doctorProfile.consultationFee;
      }
    }

    res.json({
      totalPatients,
      totalDoctors,
      activeAppointments,
      revenue: `$${totalRevenue.toLocaleString()}`,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getPendingDoctors = async (req, res) => {
  const list = await DoctorProfile.find({ status: "pending" });
  res.json(list);
};

exports.approveDoctor = async (req, res) => {
  await DoctorProfile.findByIdAndUpdate(req.params.id, { status: "approved" });
  res.json({ message: "Doctor approved" });
};

exports.rejectDoctor = async (req, res) => {
  await DoctorProfile.findByIdAndUpdate(req.params.id, { status: "rejected" });
  res.json({ message: "Doctor rejected" });
};

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({})
      .select("name email role isActive createdAt")
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getPatients = async (req, res) => {
  try {
    const PatientProfile = require("../models/PatientProfile");
    
    // 1. Find all users with role 'patient'
    const patients = await User.find({ role: "patient" }).select("name email createdAt");

    // 2. Enrich with additional data
    const enrichedPatients = await Promise.all(patients.map(async (patient) => {
      // Fetch Profile for Age
      const profile = await PatientProfile.findOne({ userId: patient._id });
      
      // Fetch Last Appointment for Visit & Doctor info
      const lastAppointment = await Appointment.findOne({ 
        patientId: patient._id,
        status: { $in: ['completed', 'confirmed'] }
      })
      .sort({ date: -1, time: -1 })
      .populate('doctorId', 'name');

      return {
        _id: patient._id,
        name: patient.name,
        email: patient.email,
        age: profile?.age || 'N/A',
        lastVisit: lastAppointment ? lastAppointment.date : 'N/A',
        assignedDoctor: lastAppointment?.doctorId?.name || 'None',
        joinedDate: patient.createdAt
      };
    }));

    res.json(enrichedPatients);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getPatientDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const PatientProfile = require("../models/PatientProfile");
    const Prescription = require("../models/Prescription");
    const MedicalRecord = require("../models/MedicalRecord");

    // 1. Fetch User Info
    const user = await User.findById(id).select("-password");
    if (!user) return res.status(404).json({ message: "Patient not found" });

    // 2. Fetch Profile
    const profile = await PatientProfile.findOne({ userId: id });

    // 3. Fetch Prescriptions (History with Diagnosis & Notes)
    const prescriptions = await Prescription.find({ patientId: id })
      .sort({ createdAt: -1 })
      .populate("doctorId", "name");

    // 4. Fetch Appointment History
    const appointments = await Appointment.find({ patientId: id })
      .sort({ date: -1, time: -1 })
      .populate("doctorId", "name");
      
    // 5. Fetch Medical Records (optional but useful)
    const medicalRecord = await MedicalRecord.findOne({ patientId: id });

    res.json({
      user,
      profile,
      prescriptions,
      appointments,
      medicalRecord
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
