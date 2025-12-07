const router = require("express").Router();
const auth = require("../middleware/auth");
const role = require("../middleware/role");
const controller = require("../controllers/medicalRecord.controller");

// Create or update medical record
router.put("/patient/:patientId", auth, controller.createOrUpdateMedicalRecord);

// Get patient's medical record
router.get("/patient/:patientId", auth, controller.getMedicalRecord);

// Delete medical record (admin only)
router.delete("/patient/:patientId", auth, role("admin"), controller.deleteMedicalRecord);

module.exports = router;
