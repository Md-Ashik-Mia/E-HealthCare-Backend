const Notification = require("../models/Notification");

// Get user's notifications
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.sub;
    const { limit = 50, skip = 0, unreadOnly = false } = req.query;

    const query = { userId };
    if (unreadOnly === "true") {
      query.isRead = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const unreadCount = await Notification.countDocuments({
      userId,
      isRead: false,
    });

    res.json({
      notifications,
      unreadCount,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Mark notification as read
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.sub;

    const notification = await Notification.findOne({ _id: id, userId });

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    notification.isRead = true;
    await notification.save();

    res.json(notification);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Mark all notifications as read
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.sub;

    await Notification.updateMany({ userId, isRead: false }, { isRead: true });

    res.json({ message: "All notifications marked as read" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete notification
exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.sub;

    const notification = await Notification.findOneAndDelete({ _id: id, userId });

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    res.json({ message: "Notification deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Create notification (internal use, can be called from other controllers)
exports.createNotification = async (userId, type, title, message, link = null) => {
  try {
    const notification = await Notification.create({
      userId,
      type,
      title,
      message,
      link,
    });

    // Emit socket event for real-time notification
    const io = require("../socket").getIO();
    if (io) {
      io.to(userId.toString()).emit("notification:new", notification);
    }

    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
    return null;
  }
};
