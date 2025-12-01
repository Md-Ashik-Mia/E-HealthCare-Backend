const router = require("express").Router();
const auth = require("../middleware/auth");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");

// 1️⃣ Start or fetch a conversation between 2 users
router.post("/start", auth, async (req, res) => {
  try {
    const { userId } = req.body;
    const currentUser = req.user.id;

    // Check if existing conversation
    let convo = await Conversation.findOne({
      participants: { $all: [currentUser, userId] },
    });

    if (!convo) {
      convo = await Conversation.create({
        participants: [currentUser, userId],
      });
    }

    res.json(convo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2️⃣ Get messages of conversation
router.get("/:id/messages", auth, async (req, res) => {
  try {
    const messages = await Message.find({
      conversationId: req.params.id,
    }).sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3️⃣ Get all conversations for sidebar
router.get("/my", auth, async (req, res) => {
  try {
    const conversations = await Conversation
      .find({ participants: req.user.id })
      .populate("participants", "name email role")
      .sort({ updatedAt: -1 });

    res.json(conversations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
