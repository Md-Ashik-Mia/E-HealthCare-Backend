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
