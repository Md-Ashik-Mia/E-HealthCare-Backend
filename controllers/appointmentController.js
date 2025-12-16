const { default: mongoose } = require("mongoose");
const Appointment = require("../models/Appointment");
const DoctorSchedule = require("../models/DoctorSchedule");
const Conversation = require("../models/Conversation");

// 📌 Book Appointment
exports.bookAppointment = async (req, res) => {
  try {
    const patientId = req.user.sub;
    const { doctorId, scheduleId, date, time, note } = req.body;

    const appointment = await Appointment.create({
      patientId,
      doctorId,
      scheduleId,
      date,
      time,
      note,
    });

    // ✨ Auto-create conversation between patient and doctor
    let conversation = await Conversation.findOne({
      participants: { $all: [patientId, doctorId] },
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [patientId, doctorId],
        lastMessage: "Appointment booked",
      });
    }

    res.json({ message: "Appointment booked", appointment });
  } catch (error) {
    res.status(500).json({ message: "Internal error", error: error.message });
  }
};

// 📌 View Doctor Available Slots (For patients)
exports.getDoctorAvailability = async (req, res) => {
  try {
    const doctorId = req.params.doctorId;

    const schedules = await DoctorSchedule.find({
      userId: new mongoose.Types.ObjectId(doctorId)
    });

    return res.json(schedules);
  } catch (err) {
    console.error("❌ Availability Error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// 📌 Get Appointment History (Patient & Doctor)
exports.getMyAppointments = async (req, res) => {
  try {
    const userId = req.user.sub;

    const appointments = await Appointment.find({
      $or: [{ patientId: userId }, { doctorId: userId }],
    })
    .populate('patientId', 'name email')
    .populate('doctorId', 'name email')
    .sort({ createdAt: -1 });

    res.json(appointments);
  } catch (error) {
    res.status(500).json({ message: "Internal error", error: error.message });
  }
};

// 📌 Cancel Appointment
exports.cancelAppointment = async (req, res) => {
  try {
    // Get the appointment ID from the URL parameters
    const { id } = req.params;
    console.log(id)

    // Find the appointment and update its status to "cancelled"
    const updatedAppointment = await Appointment.findByIdAndUpdate(
      id,
      { status: "cancelled" },
      { new: true } // Get the updated appointment
    );

    if (!updatedAppointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    // Respond with a success message and the updated appointment data
    res.json({
      message: "Appointment cancelled",
      appointment: updatedAppointment,
    });
  } catch (error) {
    console.error("Error cancelling appointment: ", error);
    res.status(500).json({ message: "Internal error", error: error.message });
  }
};


// 📌 Payment Placeholder (mark appointment paid)
exports.markAsPaid = async (req, res) => {
  try {
    const { id } = req.params;

    await Appointment.findByIdAndUpdate(id, { paymentStatus: "paid" });

    res.json({ message: "Payment completed" });
  } catch (error) {
    res.status(500).json({ message: "Internal error", error: error.message });
  }
};
