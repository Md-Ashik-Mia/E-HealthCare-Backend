const router = require("express").Router();
const auth = require("../middleware/auth");
const role = require("../middleware/role");
const controller = require("../controllers/admin.controller");

router.get("/stats", auth, role("admin"), controller.getStats);
router.get("/users", auth, role("admin"), controller.getAllUsers);
router.get("/doctors/pending", auth, role("admin"), controller.getPendingDoctors);
router.patch("/doctors/:id/approve", auth, role("admin"), controller.approveDoctor);
router.patch("/doctors/:id/reject", auth, role("admin"), controller.rejectDoctor);

module.exports = router;
