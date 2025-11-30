const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");

const {
  bookAppointment,
  getDoctorAvailability,
  getMyAppointments,
  cancelAppointment,
  markAsPaid,
} = require("../controllers/appointmentController");
const role = require("../middleware/role");

// 📌 Book appointment
router.post("/book", auth, bookAppointment);

// 📌 Doctor availability
router.get("/doctor/:doctorId", getDoctorAvailability);

// 📌 My appointments
router.get("/my", auth, getMyAppointments);

// 📌 Cancel appointment
router.patch("/:id/cancel", auth,role('doctor','patient'), cancelAppointment);

// 📌 Mark appointment paid
router.patch("/:id/pay", auth, markAsPaid);

module.exports = router;
