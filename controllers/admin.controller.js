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

    res.json({
      totalPatients,
      totalDoctors,
      activeAppointments,
      revenue: "$0", // Placeholder - implement revenue tracking as needed
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
