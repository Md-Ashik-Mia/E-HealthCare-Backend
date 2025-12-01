const PatientProfile = require("../models/PatientProfile");
const User = require("../models/User");

// Get Profile
exports.getProfile = async (req, res) => {
  try {
    const profile = await PatientProfile.findOne({ userId: req.user.id }).populate("userId", "name email");
    if (!profile) {
      // Return basic user info if profile doesn't exist yet
      const user = await User.findById(req.user.id).select("name email");
      return res.json({ userId: user, isNewProfile: true });
    }
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update/Create Profile
exports.updateProfile = async (req, res) => {
  try {
    const { age, bloodGroup, gender, phone, address, emergencyContact } = req.body;

    // Upsert: update if exists, create if not
    const profile = await PatientProfile.findOneAndUpdate(
      { userId: req.user.id },
      {
        $set: {
          age,
          bloodGroup,
          gender,
          phone,
          address,
          emergencyContact
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
