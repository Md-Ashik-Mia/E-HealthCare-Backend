// Simple Socket.IO relay smoke test for WebRTC signaling events.
// Requires backend server running on http://localhost:5000

const { io } = require("socket.io-client");

const SERVER_URL = process.env.SOCKET_URL || "http://localhost:5000";

const makeClient = (label) =>
  io(SERVER_URL, {
    transports: ["websocket"],
    reconnection: false,
    timeout: 2000,
  }).on("connect_error", (e) => {
    console.error(`❌ ${label} connect_error:`, e?.message || e);
  });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const a = makeClient("A");
  const b = makeClient("B");

  const state = { gotOffer: false, gotAnswer: false, gotIce: false, gotEnd: false };

  a.on("connect", () => a.emit("user:online", "userA"));
  b.on("connect", () => b.emit("user:online", "userB"));

  b.on("call:offer", async (payload) => {
    state.gotOffer = true;
    console.log("✅ B got call:offer", payload?.from);

    b.emit("call:answer", {
      to: "userA",
      from: "userB",
      answer: { type: "answer", sdp: "fake" },
    });

    b.emit("call:ice-candidate", {
      to: "userA",
      from: "userB",
      candidate: {
        candidate: "candidate:0 1 UDP 2122252543 1.2.3.4 12345 typ host",
        sdpMid: "0",
        sdpMLineIndex: 0,
      },
    });

    await sleep(200);
    b.emit("call:end", { to: "userA", from: "userB" });
  });

  a.on("call:answer", () => {
    state.gotAnswer = true;
    console.log("✅ A got call:answer");
  });

  a.on("call:ice-candidate", () => {
    state.gotIce = true;
    console.log("✅ A got call:ice-candidate");
  });

  a.on("call:end", async () => {
    state.gotEnd = true;
    console.log("✅ A got call:end");
    await sleep(50);
    console.log("RESULT", state);
    a.close();
    b.close();
    process.exit(0);
  });

  // Wait for both to connect and join rooms
  await sleep(250);

  // Initiate
  a.emit("call:offer", {
    to: "userB",
    from: "userA",
    offer: { type: "offer", sdp: "fake" },
  });

  // Hard timeout
  setTimeout(() => {
    console.log("TIMEOUT RESULT", state);
    a.close();
    b.close();
    process.exit(1);
  }, 3000);
})();
