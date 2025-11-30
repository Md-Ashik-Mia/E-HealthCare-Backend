const DoctorProfile = require("../models/DoctorProfile");

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
