const AIResponse = require('../models/ai.model');
const axios = require('axios');

exports.getAIStatus = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const aiStatus = await AIResponse.findOne({ doctorId });

    if (!aiStatus) {
      return res.status(404).json({ message: "AI settings not found." });
    }

    res.json(aiStatus);
  } catch (error) {
    res.status(500).json({ message: "Internal error", error: error.message });
  }
};

exports.toggleAI = async (req, res) => {
  const { doctorId, isAIEnabled } = req.body;
  
  try {
    let aiResponse = await AIResponse.findOneAndUpdate(
      { doctorId },
      { isAIEnabled },
      { new: true, upsert: true }
    );
    res.json({ message: `AI chat is now ${isAIEnabled ? 'enabled' : 'disabled'}.`, aiResponse });
  } catch (error) {
    res.status(500).json({ message: "Error toggling AI chat", error: error.message });
  }
};

exports.getAIResponse = async (req, res) => {
  const { query } = req.body;
  const { doctorId } = req.params;

  try {
    // Get doctor-specific AI settings
    const aiSettings = await AIResponse.findOne({ doctorId });

    if (!aiSettings || !aiSettings.isAIEnabled) {
      return res.status(400).json({ message: "AI chat is disabled or not set up." });
    }

    // Request Gemini AI response (assuming you have the Gemini API key and endpoint)
    const geminiResponse = await axios.post('https://api.gemini.com/v1/query', {
      query: query,
      key: process.env.GEMINI_API_KEY
    });

    const response = geminiResponse.data.answer || "I'm sorry, I don't have an answer to that right now.";

    res.json({ response });
  } catch (error) {
    res.status(500).json({ message: "AI Response error", error: error.message });
  }
};
