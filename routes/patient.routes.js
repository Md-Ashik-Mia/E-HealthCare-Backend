const router = require("express").Router();
const auth = require("../middleware/auth");
const patientController = require("../controllers/patient.controller");

router.get("/profile", auth, patientController.getProfile);
router.post("/profile", auth, patientController.updateProfile);

module.exports = router;
