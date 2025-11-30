const router = require("express").Router();
const auth = require("../middleware/auth");
const role = require("../middleware/role");
const controller = require("../controllers/doctor.controller");

router.patch("/profile", auth, role("doctor"), controller.updateProfile);
// router.get("/active",controller.getActiveDoctors)

module.exports = router;
