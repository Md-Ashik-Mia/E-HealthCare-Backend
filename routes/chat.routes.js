const router = require("express").Router();
const auth = require("../middleware/auth");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const User = require("../models/User");
const DoctorProfile = require("../models/DoctorProfile");
const AIResponse = require("../models/ai.model");

async function getDoctorGlobalAIEnabled(doctorId) {
  // Prefer AIResponse (used by existing /ai routes), but also support DoctorProfile fields.
  const ai = await AIResponse.findOne({ doctorId }).lean();
  if (ai && typeof ai.isAIEnabled === "boolean") return ai.isAIEnabled;

  const profile = await DoctorProfile.findOne({ userId: doctorId }).lean();
  return !!profile?.isAutoAIReplyEnabled;
}

// 1️⃣ Start or fetch a conversation between 2 users
router.post("/start", auth, async (req, res) => {
  try {
    const { userId } = req.body;
    const currentUser = req.user.sub; // Changed from req.user.id

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

// 2.5️⃣ Get per-conversation AI auto-reply status (doctor only)
router.get("/:id/ai-auto-reply", auth, async (req, res) => {
  try {
    const currentUserId = req.user.sub;
    const currentUser = await User.findById(currentUserId).select("role").lean();
    if (!currentUser || currentUser.role !== "doctor") {
      return res.status(403).json({ message: "Only doctors can access AI auto-reply settings." });
    }

    const convo = await Conversation.findById(req.params.id).lean();
    if (!convo) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const isParticipant = (convo.participants || []).some(
      (p) => p.toString() === currentUserId
    );
    if (!isParticipant) {
      return res.status(403).json({ message: "Not a participant of this conversation." });
    }

    const override = convo.aiAutoReplyEnabled ?? null;
    const globalEnabled = await getDoctorGlobalAIEnabled(currentUserId);
    const effectiveEnabled = override === null ? globalEnabled : !!override;

    res.json({ override, globalEnabled, effectiveEnabled });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2.6️⃣ Set per-conversation AI auto-reply override (doctor only)
// Body: { enabled: true | false | null }  (null => inherit global)
router.patch("/:id/ai-auto-reply", auth, async (req, res) => {
  try {
    const currentUserId = req.user.sub;
    const currentUser = await User.findById(currentUserId).select("role").lean();
    if (!currentUser || currentUser.role !== "doctor") {
      return res.status(403).json({ message: "Only doctors can change AI auto-reply settings." });
    }

    const { enabled } = req.body;
    if (!(enabled === true || enabled === false || enabled === null)) {
      return res.status(400).json({ message: "'enabled' must be true, false, or null." });
    }

    const convo = await Conversation.findById(req.params.id);
    if (!convo) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const isParticipant = (convo.participants || []).some(
      (p) => p.toString() === currentUserId
    );
    if (!isParticipant) {
      return res.status(403).json({ message: "Not a participant of this conversation." });
    }

    convo.aiAutoReplyEnabled = enabled;
    await convo.save();

    const override = convo.aiAutoReplyEnabled ?? null;
    const globalEnabled = await getDoctorGlobalAIEnabled(currentUserId);
    const effectiveEnabled = override === null ? globalEnabled : !!override;

    res.json({ override, globalEnabled, effectiveEnabled });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3️⃣ Get all conversations for sidebar
router.get("/my", auth, async (req, res) => {
  try {
    const conversations = await Conversation
      .find({ participants: req.user.sub }) // Changed from req.user.id
      .populate("participants", "name email role")
      .sort({ updatedAt: -1 });

    res.json(conversations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
