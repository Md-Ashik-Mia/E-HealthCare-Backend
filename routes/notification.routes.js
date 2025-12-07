const router = require("express").Router();
const auth = require("../middleware/auth");
const controller = require("../controllers/notification.controller");

// Get user's notifications
router.get("/", auth, controller.getNotifications);

// Mark notification as read
router.patch("/:id/read", auth, controller.markAsRead);

// Mark all notifications as read
router.patch("/read-all", auth, controller.markAllAsRead);

// Delete notification
router.delete("/:id", auth, controller.deleteNotification);

module.exports = router;
