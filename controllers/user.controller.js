// controllers/user.controller.js
const User = require('../models/User');
const DoctorProfile = require('../models/DoctorProfile'); // Make sure the path is correct

// Function to get all doctors with 'approved' status
exports.getApprovedDoctors = async (req, res) => {
  try {
    const approvedDoctors = await User.aggregate([
      {
        // Match only users with role 'doctor'
        $match: {
          role: 'doctor',
        },
      },
      {
        // Lookup to join with doctor profiles
        $lookup: {
          from: 'doctorprofiles', // The collection to join
          localField: '_id', // The field in the 'users' collection to match
          foreignField: 'userId', // The field in the 'doctorprofiles' collection to match
          as: 'doctorProfile', // The name of the field to store the result
        },
      },
      {
        // Unwind the 'doctorProfile' array since $lookup will return an array
        $unwind: {
          path: '$doctorProfile',
          preserveNullAndEmptyArrays: true, // Ensure if there's no doctor profile, it still returns the user
        },
      },
      {
        // Filter out doctors that are approved
        $match: {
          'doctorProfile.status': 'approved', // Check the status inside doctorProfile
        },
      },
      {
        // Project the necessary fields to return
        $project: {
          name: 1,
          email: 1,
          speciality: '$doctorProfile.speciality',
          status: '$doctorProfile.status',
          registrationNumber: '$doctorProfile.registrationNumber',
          degree: '$doctorProfile.degree',
          experienceYears: '$doctorProfile.experienceYears',
          consultationFee: '$doctorProfile.consultationFee',
        },
      },
    ]);

    // Return the list of approved doctors
    res.json(approvedDoctors);
  } catch (error) {
    res.status(500).json({ message: 'Internal error', error: error.message });
  }
};


// controllers/user.controller.js

exports.getAllDoctors = async (req, res) => {
  try {
    // Get all users where role is 'doctor'
    const doctors = await User.find({ role: 'doctor' });

    // Return the list of doctors
    res.json(doctors);
  } catch (error) {
    res.status(500).json({ message: 'Internal error', error: error.message });
  }
};


exports.getAllUsers = async (req, res) => {
  try {
    // Retrieve all users
    const users = await User.find();

    // Return the list of users
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Internal error', error: error.message });
  }
};