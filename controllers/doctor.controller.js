const DoctorProfile = require("../models/DoctorProfile");

exports.updateProfile = async (req, res) => {
  const updated = await DoctorProfile.findOneAndUpdate(
    { userId: req.user.sub },
    { $set: req.body },
    { new: true }
  );

  res.json(updated);
};

