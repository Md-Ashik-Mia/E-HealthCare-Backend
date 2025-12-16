// socket.js
require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const Message = require("./models/Message");  
const Conversation = require("./models/Conversation");
const DoctorProfile = require("./models/DoctorProfile");
const User = require("./models/User");
const AIResponse = require("./models/ai.model");

const initializeSocket = (server) => {
    const io = new Server(server, {
        cors: {
           origin: [
                "http://localhost:3000", 
                "https://e-health-care-front-end.vercel.app",
                "https://e-healthcare-backend.onrender.com"
            ],
            methods: ["GET", "POST"]
        }
    });

    console.log("🟢 Socket.io Initialized");

    // track online users: Map<userId, socketId>
    const onlineUsers = new Map();

    // Initialize Gemini AI
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });



    // Safe AI reply generator used by the socket logic. Returns a string or null.
    async function generateAIReply(doctorId, messageText, doctorName) {
        try {
            // Check doctor-specific AI settings
            const settings = await AIResponse.findOne({ doctorId });
            console.log(`🔍 AI Settings for ${doctorId}:`, settings);

            if (!settings || !settings.isAIEnabled) {
                console.log("⚠️ AI Auto-Reply disabled or settings not found for this doctor.");
                return null;
            }

            // If no external AI key, skip calling external API and return null
            if (!process.env.GEMINI_API_KEY) {
                console.error("❌ Missing GEMINI_API_KEY in environment variables.");
                return null;
            }
            console.log(`🔑 AI Key Loaded: ${process.env.GEMINI_API_KEY.substring(0, 5)}...`);

            console.log(`🤖 Generative AI replying for Dr. ${doctorName}...`);

            const prompt = `
                You are a helpful AI assistant replying on behalf of Dr. ${doctorName}.
                The doctor is currently unavailable. 
                
                Patient's message: "${messageText}"
                
                Instructions:
                1. Acknowledge the patient's message politely.
                2. State that the doctor is currently away/busy but will see the message soon.
                3. If the message contains a simple general query, provide a brief, general guideline (do NOT give specific medical advice or diagnosis).
                4. Keep the response short, professional, and reassuring.
                5. Max 2-3 sentences.
            `;

            const result = await model.generateContent(prompt);
            const response = result.response;
            return response.text();
            
        } catch (err) {
            console.error("❌ AI Reply Error Full:", JSON.stringify(err, null, 2));
            console.error("❌ AI Reply Error Message:", err.message);
            return null;
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
            console.log("🔥 MESSAGE:SEND HANDLER TRIGGERED with data:", JSON.stringify(data, null, 2));
            try {
                const { conversationId, from, to, message } = data;
                console.log("📨 Message details:", { conversationId, from, to, message });

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
                console.log("🔍 Looking up receiver for AI check. ID:", to);
                const receiver = await User.findById(to);
                console.log("👤 Receiver found:", receiver ? `${receiver.name} (${receiver.role})` : "null");

                if (receiver && receiver.role === "doctor") {
                    // patient → doctor message → maybe AI reply
                    const aiReply = await generateAIReply(receiver._id, message, receiver.name);

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
