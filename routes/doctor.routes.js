const router = require("express").Router();
const auth = require("../middleware/auth");
const role = require("../middleware/role");
const controller = require("../controllers/doctor.controller");

router.get("/profile", auth, role("doctor"), controller.getProfile);
router.patch("/profile", auth, role("doctor"), controller.updateProfile);
router.get("/patients/:id", auth, role("doctor"), controller.getPatientDetails);
router.get("/patients", auth, role("doctor"), controller.getPatients);

module.exports = router;
