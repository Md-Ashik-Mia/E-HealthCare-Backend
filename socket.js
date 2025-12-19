// socket.js
require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const OpenAI = require("openai");
const Message = require("./models/Message");  
const Conversation = require("./models/Conversation");
const DoctorProfile = require("./models/DoctorProfile");
const User = require("./models/User");
const AIResponse = require("./models/ai.model");
const DoctorPrivateNote = require("./models/DoctorPrivateNote");
const Notification = require("./models/Notification");

const defaultCorsOrigins = ["http://localhost:3000"];
const envCorsOrigins = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
const corsOrigins = [...new Set([...defaultCorsOrigins, ...envCorsOrigins])];

const initializeSocket = (server) => {
    const io = new Server(server, {
        cors: {
           origin: corsOrigins,
            methods: ["GET", "POST", "OPTIONS"],
            credentials: true,
            allowedHeaders: ["Content-Type", "Authorization"]
        }
    });

    console.log("🟢 Socket.io Initialized");

    // Track online users: Map<userId, Set<socketId>>
    // We also make each socket join a per-user room (named by userId string)
    // so we can emit via `io.to(userId)` for messages/calls/notifications.
    const onlineUsers = new Map();

    function normalizeUserId(userId) {
        if (userId === null || userId === undefined) return null;
        try {
            return String(userId);
        } catch {
            return null;
        }
    }

    function addOnlineSocket(userId, socketId) {
        const id = normalizeUserId(userId);
        if (!id) return;
        const set = onlineUsers.get(id) || new Set();
        set.add(socketId);
        onlineUsers.set(id, set);
    }

    function removeOnlineSocket(userId, socketId) {
        const id = normalizeUserId(userId);
        if (!id) return;
        const set = onlineUsers.get(id);
        if (!set) return;
        set.delete(socketId);
        if (set.size === 0) onlineUsers.delete(id);
        else onlineUsers.set(id, set);
    }

    function emitPresenceUpdate() {
        io.emit("presence:update", [...onlineUsers.keys()]);
    }

    function serializeObjectId(value) {
        if (value === null || value === undefined) return value;
        try {
            return value.toString();
        } catch {
            return value;
        }
    }

    function serializeMessageDoc(doc) {
        if (!doc) return doc;
        const obj = typeof doc.toObject === "function" ? doc.toObject({ virtuals: false }) : { ...doc };
        if (obj._id) obj._id = serializeObjectId(obj._id);
        if (obj.conversationId) obj.conversationId = serializeObjectId(obj.conversationId);
        if (obj.senderId) obj.senderId = serializeObjectId(obj.senderId);
        if (obj.receiverId) obj.receiverId = serializeObjectId(obj.receiverId);
        return obj;
    }

    function serializeNotificationDoc(doc) {
        if (!doc) return doc;
        const obj = typeof doc.toObject === "function" ? doc.toObject({ virtuals: false }) : { ...doc };
        if (obj._id) obj._id = serializeObjectId(obj._id);
        if (obj.userId) obj.userId = serializeObjectId(obj.userId);
        if (obj.fromUserId) obj.fromUserId = serializeObjectId(obj.fromUserId);
        if (obj.conversationId) obj.conversationId = serializeObjectId(obj.conversationId);
        return obj;
    }

    // Initialize Gemini AI (optional)
    const geminiModelName = process.env.GEMINI_MODEL || "gemini-2.0-flash";
    const genAI = process.env.GEMINI_API_KEY
        ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
        : null;
    const model = genAI ? genAI.getGenerativeModel({ model: geminiModelName }) : null;

    const allowedOpenAIModels = new Set(["gpt-4o", "gpt-4o-mini"]);
    const openAIModelName = allowedOpenAIModels.has((process.env.OPENAI_MODEL || "").trim())
        ? (process.env.OPENAI_MODEL || "").trim()
        : "gpt-4o-mini";
    const openai = process.env.OPENAI_API_KEY
        ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
        : null;



    function normalizePatientFacingNote(note) {
        if (!note || typeof note !== "string") return "";
        const cleaned = note.replace(/\s+/g, " ").trim();
        if (!cleaned) return "";
        // Keep it short to avoid walls of text in fallback.
        return cleaned.length > 260 ? `${cleaned.slice(0, 257)}...` : cleaned;
    }

    function clipText(text, maxLen) {
        const s = (text || "").toString().replace(/\s+/g, " ").trim();
        if (!s) return "";
        return s.length > maxLen ? `${s.slice(0, Math.max(0, maxLen - 3))}...` : s;
    }

    function buildFallbackReply({ doctorName, patientName, messageText, patientNote }) {
        const text = (messageText || "").toLowerCase();

        // Very light, safe, non-diagnostic guidance hints.
        let generalTip = "";
        if (/(fever|temperature|high temp)/.test(text)) {
            generalTip = "For fever, stay hydrated and consider checking your temperature; avoid self-medicating beyond what you usually tolerate.";
        } else if (/(cough|cold|sore throat|throat)/.test(text)) {
            generalTip = "For cough/cold symptoms, rest and fluids can help; if you have breathing difficulty, seek urgent care.";
        } else if (/(chest pain|shortness of breath|breathless|difficulty breathing)/.test(text)) {
            generalTip = "Chest pain or breathing difficulty can be serious—please seek emergency care immediately.";
        } else if (/(vomit|vomiting|diarrhea|loose motion)/.test(text)) {
            generalTip = "For vomiting/diarrhea, focus on hydration; if you cannot keep fluids down or feel very weak, seek urgent care.";
        }

        const note = normalizePatientFacingNote(patientNote);

        const greeting = patientName ? `Hi ${patientName}, ` : "";
        const base =
            `${greeting}thanks for your message. Dr. ${doctorName} is currently busy with another patient, but will review your message as soon as possible.`;

        const ask =
            `If you can, please share your main symptoms, how long they've been happening, and any current medications.`;

        const urgent =
            `If this feels urgent or severe, please seek emergency care.`;

        const parts = [base];
        if (generalTip) parts.push(generalTip);
        parts.push(ask);
        if (note) parts.push(`Note from doctor: ${note}`);
        parts.push(urgent);

        return parts.join(" ");
    }

    // Safe AI reply generator used by the socket logic. Returns a string or null.
    async function generateAIReply({ doctorId, patientId, conversationId, messageText, doctorName, patientName }) {
        let effectiveEnabled = false;
        try {
            // Conversation-level override: null => inherit global
            let convoOverride = null;
            if (conversationId) {
                const convo = await Conversation.findById(conversationId).select("aiAutoReplyEnabled").lean();
                convoOverride = convo?.aiAutoReplyEnabled ?? null;
            }

            // Global settings: support both AIResponse (used by /ai routes) and DoctorProfile (profile page fields)
            const aiSettings = await AIResponse.findOne({ doctorId }).lean();
            const profile = await DoctorProfile.findOne({ userId: doctorId }).lean();

            const globalEnabled =
                (typeof aiSettings?.isAIEnabled === "boolean" && aiSettings.isAIEnabled) ||
                !!profile?.isAutoAIReplyEnabled;

            effectiveEnabled = convoOverride === null ? globalEnabled : !!convoOverride;
            console.log(`🔍 AI effective enabled for Dr ${doctorId} (override=${convoOverride}):`, effectiveEnabled);

            if (!effectiveEnabled) {
                return null;
            }

            const instructions =
                (profile?.aiInstructions && profile.aiInstructions.trim()) ||
                (aiSettings?.instructions && aiSettings.instructions.trim()) ||
                "Be polite and helpful with patients.";

            // Pull lightweight context for better replies (not "training"; just prompt context)
            let recentHistory = [];
            if (conversationId) {
                recentHistory = await Message.find({ conversationId })
                    .sort({ createdAt: -1 })
                    .limit(12)
                    .lean();
                recentHistory.reverse();
            }

            const historyText = recentHistory
                .map((m) => {
                    const sender = String(m.senderId);
                    const isDoctor = sender === String(doctorId);
                    const isPatient = patientId && sender === String(patientId);
                    const label = m.isAI
                        ? "Assistant"
                        : isDoctor
                            ? `Doctor (Dr. ${doctorName})`
                            : isPatient
                                ? `Patient (${patientName || "patient"})`
                                : "User";
                    return `${label}: ${clipText(m.message, 420)}`;
                })
                .filter(Boolean)
                .join("\n");

            const privateNotes = patientId
                ? await DoctorPrivateNote.find({ doctorId, patientId })
                    .sort({ createdAt: -1 })
                    .limit(5)
                    .lean()
                : [];

            const privateNotesText = (privateNotes || [])
                .map((n) => {
                    const date = n.createdAt ? new Date(n.createdAt).toLocaleDateString() : "";
                    const prefix = date ? `(${date}) ` : "";
                    return `- ${prefix}${clipText(n.content, 260)}`;
                })
                .filter(Boolean)
                .join("\n");

            // If no external AI key/model, use safe fallback reply (still fulfills auto-reply feature)
            console.log(`🤖 Generative AI replying for Dr. ${doctorName}...`);

            const prompt = `
You are an AI assistant replying on behalf of Dr. ${doctorName}.

Patient name: ${patientName || "(unknown)"}
Doctor name: Dr. ${doctorName}

Doctor-provided instructions:
"""
${instructions}
"""

Doctor's private notes about this patient (FOR INTERNAL CONTEXT ONLY):
${privateNotesText ? `"""\n${privateNotesText}\n"""` : "(none)"}

Recent conversation history:
${historyText ? `"""\n${historyText}\n"""` : "(none)"}

Latest patient message:
"""
${clipText(messageText, 600)}
"""

Hard rules:
1) Greet the patient by name if available (e.g., "Hi <name>,").
2) Acknowledge politely and reassure the patient.
3) Say the doctor will review soon.
4) You may provide only general guidance. Do NOT diagnose, prescribe, or give specific medical advice.
5) If symptoms sound urgent/severe, advise emergency care.
6) Do NOT mention private notes or that you saw them.
7) Keep it short: 2-3 sentences max.
`;

            // 1) Prefer OpenAI if configured
            if (openai) {
                try {
                    const completion = await openai.chat.completions.create({
                        model: openAIModelName,
                        messages: [
                            {
                                role: "system",
                                content:
                                    "You are a cautious medical office assistant. " +
                                    "Do not diagnose or prescribe. Keep replies short and safe.",
                            },
                            { role: "user", content: prompt },
                        ],
                        temperature: 0.3,
                        max_tokens: 180,
                    });

                    const text = completion?.choices?.[0]?.message?.content || "";
                    const cleaned = text.trim();
                    return cleaned ? cleaned : buildFallbackReply({ doctorName, patientName, messageText, patientNote: instructions });
                } catch (e) {
                    console.error("❌ OpenAI reply error:", e?.message || e);
                    // fall through to Gemini
                }
            }

            // 2) Fallback to Gemini if configured
            if (process.env.GEMINI_API_KEY && model) {
                const result = await model.generateContent(prompt);
                const response = result.response;
                const text = typeof response?.text === "function" ? response.text() : "";
                return (text && text.trim())
                    ? text.trim()
                    : buildFallbackReply({ doctorName, patientName, messageText, patientNote: instructions });
            }

            // 3) Final fallback
            return buildFallbackReply({ doctorName, patientName, messageText, patientNote: instructions });
            
        } catch (err) {
            console.error("❌ AI Reply Error Full:", JSON.stringify(err, null, 2));
            console.error("❌ AI Reply Error Message:", err.message);
            // If AI is enabled but the LLM fails (quota/key/timeout), still send a safe generic auto-reply.
            return effectiveEnabled
                ? buildFallbackReply({ doctorName, patientName, messageText, patientNote: "" })
                : null;
        }
    }

    io.on("connection", (socket) => {
        console.log("⚡ User connected:", socket.id);

        // Log all incoming events for debugging
        socket.onAny((eventName, ...args) => {
            console.log(`📥 Received event: ${eventName}`, args);
        });

        // 1️⃣ Register user (online)
        socket.on("user:online", (userId) => {
            const normalized = normalizeUserId(userId);
            if (!normalized) return;

            addOnlineSocket(normalized, socket.id);
            socket.userId = normalized;

            // Join a per-user room so other server modules can emit via `io.to(userId)`.
            // This also enables notifications delivery even if a user reconnects with a new socket id.
            try {
                socket.join(normalized);
            } catch {}

            console.log(`🟢 User Online: ${normalized}`);
            emitPresenceUpdate();
        });

        // 2️⃣ Typing Indicator
        socket.on("typing:start", (data) => {
            const to = normalizeUserId(data?.to);
            const from = normalizeUserId(data?.from);
            if (!to || !from) return;
            io.to(to).emit("typing:start", { from });
        });

        socket.on("typing:stop", (data) => {
            const to = normalizeUserId(data?.to);
            const from = normalizeUserId(data?.from);
            if (!to || !from) return;
            io.to(to).emit("typing:stop", { from });
        });

        // 3️⃣ Real-time Messaging
        socket.on("message:send", async (data) => {
            console.log("🔥 MESSAGE:SEND HANDLER TRIGGERED with data:", JSON.stringify(data, null, 2));
            try {
                const conversationId = data?.conversationId;
                const from = normalizeUserId(data?.from);
                const to = normalizeUserId(data?.to);
                const message = data?.message;

                if (!conversationId || !from || !to || typeof message !== "string") {
                    throw new Error("Invalid message payload");
                }
                console.log("📨 Message details:", { conversationId, from, to, message });

                // Fetch users for notification + AI prompt context
                const [senderUser, receiverUser] = await Promise.all([
                    User.findById(from).select("name role").lean(),
                    User.findById(to).select("name role").lean(),
                ]);

                // Save message to database
                const msg = await Message.create({
                    conversationId,
                    senderId: from,
                    receiverId: to,
                    message,
                });
                console.log("✅ Message saved to DB:", msg._id);

                const msgPayload = serializeMessageDoc(msg);

                // Update conversation's lastMessage
                await Conversation.findByIdAndUpdate(conversationId, {
                    lastMessage: message,
                    lastSender: from,
                });
                console.log("✅ Conversation updated");

                // Send confirmation to sender
                // Use room-based emit so all sender tabs/devices see the confirmation.
                io.to(from).emit("message:receive", msgPayload);
                // Fallback for the very early window before `user:online`/room join.
                socket.emit("message:receive", msgPayload);
                console.log("📤 Confirmation sent to sender");

                // Deliver to receiver (room-based; no-op if offline)
                io.to(to).emit("message:receive", msgPayload);
                console.log("📤 Message emitted to receiver room");

                // Create a persisted notification for the receiver (works for both patient and doctor)
                if (receiverUser) {
                    const senderName = senderUser?.name || "Someone";
                    const link = receiverUser.role === "doctor"
                        ? "/dashboard/doctor/chats"
                        : receiverUser.role === "patient"
                            ? "/dashboard/patient/chats"
                            : null;

                    const notification = await Notification.create({
                        userId: receiverUser._id,
                        conversationId,
                        fromUserId: senderUser?._id || from,
                        type: "message",
                        title: "New message",
                        message: `New message from ${senderName}`,
                        link,
                    });

                    const notificationPayload = serializeNotificationDoc(notification);

                    // Emit real-time notification (room-based)
                    io.to(receiverUser._id.toString()).emit("notification:new", notificationPayload);
                }

                // AI Auto Reply Logic
                console.log("🔍 Looking up receiver for AI check. ID:", to);
                const receiver = receiverUser;
                console.log("👤 Receiver found:", receiver ? `${receiver.name} (${receiver.role})` : "null");

                if (receiver && receiver.role === "doctor") {
                    const patientName = senderUser?.name || "";
                    // patient → doctor message → maybe AI reply
                    const aiReply = await generateAIReply({
                        doctorId: receiver._id,
                        patientId: from,
                        conversationId,
                        messageText: message,
                        doctorName: receiver.name,
                        patientName,
                    });

                    if (aiReply) {
                        const replyMsg = await Message.create({
                            conversationId,
                            senderId: to,
                            receiverId: from,
                            message: aiReply,
                            isAI: true
                        });

                        const replyPayload = serializeMessageDoc(replyMsg);

                        // Update conversation with AI reply
                        await Conversation.findByIdAndUpdate(conversationId, {
                            lastMessage: aiReply,
                            lastSender: to,
                        });

                        // Send AI reply to patient
                        io.to(from).emit("message:receive", replyPayload);

                        // Send to doctor (all doctor tabs/devices)
                        io.to(to).emit("message:receive", replyPayload);
                        console.log("🤖 AI reply sent");
                    }
                }
            } catch (err) {
                console.error("❌ Message Send Error:", err);
                socket.emit("message:error", { error: err.message });
            }
        });

        // 4️⃣ WebRTC Signaling (Audio/Video Calls)
        socket.on("call:offer", (data) => {
            const to = normalizeUserId(data?.to);
            if (!to) return;
            io.to(to).emit("call:offer", data);
        });

        socket.on("call:answer", (data) => {
            const to = normalizeUserId(data?.to);
            if (!to) return;
            io.to(to).emit("call:answer", data);
        });

        socket.on("call:ice-candidate", (data) => {
            const to = normalizeUserId(data?.to);
            if (!to) return;
            io.to(to).emit("call:ice-candidate", data);
        });

        socket.on("call:end", (data) => {
            const to = normalizeUserId(data?.to);
            if (!to) return;
            io.to(to).emit("call:end", data);
        });

        // 5️⃣ Disconnect event
        socket.on("disconnect", () => {
            console.log("🔴 User disconnected:", socket.id);

            if (socket.userId) {
                removeOnlineSocket(socket.userId, socket.id);
                emitPresenceUpdate();
            }
        });
    });

    return io;
};

// Export both the initialization function and a way to get the io instance
let ioInstance = null;

const wrappedInitialize = (server) => {
    const io = initializeSocket(server);
    ioInstance = io;
    return io;
};

module.exports = wrappedInitialize;
module.exports.getIO = () => ioInstance;
