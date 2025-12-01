// socket.js
require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const Message = require("./models/Message");  
const Conversation = require("./models/Conversation");
const DoctorProfile = require("./models/DoctorProfile");
const User = require("./models/User");
const axios = require("axios");

// Start standalone Socket.IO server
const server = http.createServer();
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

// 🔗 Connect MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("🟢 Socket Server MongoDB Connected"))
    .catch((err) => console.log("❌ MongoDB Error:", err));


// 📌 Track online users
const onlineUsers = new Map();

// Helper: Send Gemini AI Auto Reply
async function generateAIReply(doctorId, patientMessage) {
    try {
        // Load doctor profile
        const profile = await DoctorProfile.findOne({ userId: doctorId });

        if (!profile?.isAutoAIReplyEnabled) return null;

        const prompt = `
Doctor Instructions: ${profile.aiInstructions}
Patient Message: ${patientMessage}
Generate a short helpful response as the doctor.
        `;

        const result = await axios.post(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=" + process.env.GEMINI_API_KEY,
            {
                contents: [{ parts: [{ text: prompt }] }]
            }
        );

        return result.data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } catch (err) {
        console.log("AI Reply Error:", err.message);
        return null;
    }
}


// 🚀 SOCKET CONNECTION
io.on("connection", (socket) => {
    console.log("⚡ User connected:", socket.id);

    // 1️⃣ Register user (online)
    socket.on("user:online", (userId) => {
        onlineUsers.set(userId, socket.id);
        socket.userId = userId;

        console.log(`🟢 User Online: ${userId}`);

        io.emit("presence:update", [...onlineUsers.keys()]);
    });

    // 2️⃣ Typing Indicator
    socket.on("typing:start", (data) => {
        const targetSocket = onlineUsers.get(data.to);
        if (targetSocket) {
            io.to(targetSocket).emit("typing:start", {
                from: data.from,
            });
        }
    });

    socket.on("typing:stop", (data) => {
        const targetSocket = onlineUsers.get(data.to);
        if (targetSocket) {
            io.to(targetSocket).emit("typing:stop", {
                from: data.from,
            });
        }
    });

    // 3️⃣ Real-time Messaging
    socket.on("message:send", async (data) => {
        const { conversationId, from, to, message } = data;

        // Save DB
        const msg = await Message.create({
            conversationId,
            senderId: from,
            receiverId: to,
            message,
        });

        // Deliver to receiver
        const targetSocket = onlineUsers.get(to);
        if (targetSocket) {
            io.to(targetSocket).emit("message:receive", msg);
        }

        // AI Auto Reply Logic
        const receiver = await User.findById(to);
        if (receiver.role === "doctor") {
            // patient → doctor message → maybe AI reply
            const aiReply = await generateAIReply(receiver._id, message);

            if (aiReply) {
                const replyMsg = await Message.create({
                    conversationId,
                    senderId: to,
                    receiverId: from,
                    message: aiReply,
                    isAI: true
                });

                io.to(socket.id).emit("message:receive", replyMsg);
            }
        }
    });

    // 4️⃣ WebRTC Signaling (Audio/Video Calls)
    socket.on("call:offer", (data) => {
        const targetSocket = onlineUsers.get(data.to);
        if (targetSocket) io.to(targetSocket).emit("call:offer", data);
    });

    socket.on("call:answer", (data) => {
        const targetSocket = onlineUsers.get(data.to);
        if (targetSocket) io.to(targetSocket).emit("call:answer", data);
    });

    socket.on("call:ice-candidate", (data) => {
        const targetSocket = onlineUsers.get(data.to);
        if (targetSocket) io.to(targetSocket).emit("call:ice-candidate", data);
    });

    socket.on("call:end", (data) => {
        const targetSocket = onlineUsers.get(data.to);
        if (targetSocket) io.to(targetSocket).emit("call:end", data);
    });











    // 5️⃣ Disconnect event
    socket.on("disconnect", () => {
        console.log("🔴 User disconnected:", socket.id);

        if (socket.userId) {
            onlineUsers.delete(socket.userId);
            io.emit("presence:update", [...onlineUsers.keys()]);
        }
    });
});


// 🚀 Start socket server
const PORT = process.env.SOCKET_PORT || 6000;
server.listen(PORT, () => {
    console.log("🚀 Socket.io Server Running on port:", PORT);
});
