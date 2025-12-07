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

// 🚀 SOCKET CONNECTION FUNCTION
const initializeSocket = (server) => {
    const io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
        },
    });

    console.log("🟢 Socket.io Initialized");

    io.on("connection", (socket) => {
        console.log("⚡ User connected:", socket.id);

        // Log all incoming events for debugging
        socket.onAny((eventName, ...args) => {
            console.log(`📥 Received event: ${eventName}`, args);
        });

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
            try {
                const { conversationId, from, to, message } = data;
                console.log("📨 Message received:", { conversationId, from, to, message });

                // Save message to database
                const msg = await Message.create({
                    conversationId,
                    senderId: from,
                    receiverId: to,
                    message,
                });
                console.log("✅ Message saved to DB:", msg._id);

                // Update conversation's lastMessage
                await Conversation.findByIdAndUpdate(conversationId, {
                    lastMessage: message,
                    lastSender: from,
                });
                console.log("✅ Conversation updated");

                // Send confirmation to sender
                socket.emit("message:receive", msg);
                console.log("📤 Confirmation sent to sender");

                // Deliver to receiver if online
                const targetSocket = onlineUsers.get(to);
                if (targetSocket) {
                    io.to(targetSocket).emit("message:receive", msg);
                    console.log("📤 Message sent to receiver");
                } else {
                    console.log("⚠️ Receiver offline");
                }

                // AI Auto Reply Logic
                const receiver = await User.findById(to);
                if (receiver && receiver.role === "doctor") {
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

                        // Update conversation with AI reply
                        await Conversation.findByIdAndUpdate(conversationId, {
                            lastMessage: aiReply,
                            lastSender: to,
                        });

                        // Send AI reply to patient
                        io.to(socket.id).emit("message:receive", replyMsg);
                        
                        // Send to doctor if online
                        if (targetSocket) {
                            io.to(targetSocket).emit("message:receive", replyMsg);
                        }
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
};

module.exports = initializeSocket;
