const router = require("express").Router();
const auth = require("../middleware/auth");
const role = require("../middleware/role");
const controller = require("../controllers/prescription.controller");

// Create prescription (doctor only)
router.post("/", auth, role("doctor"), controller.createPrescription);

// Get patient's prescriptions
router.get("/patient/:patientId", auth, controller.getPatientPrescriptions);

// Get specific prescription
router.get("/:id", auth, controller.getPrescription);

// Update prescription (doctor only)
router.put("/:id", auth, role("doctor"), controller.updatePrescription);

module.exports = router;
