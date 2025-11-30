const router = require("express").Router();
const auth = require("../middleware/auth");
const role = require("../middleware/role");
const controller = require("../controllers/schedule.controller");

router.post("/", auth, role("doctor"), controller.createSchedule);
router.get("/", auth, role("doctor"), controller.getSchedules);
router.delete("/:id", auth, role("doctor"), controller.deleteSchedule);


module.exports = router;
