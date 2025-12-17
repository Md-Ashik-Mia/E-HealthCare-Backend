const AIResponse = require('../models/ai.model');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const DoctorProfile = require('../models/DoctorProfile');
const OpenAI = require('openai');

function getGeminiModel() {
  if (!process.env.GEMINI_API_KEY) return null;
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  return genAI.getGenerativeModel({ model: modelName });
}

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function getOpenAIModelName() {
  const allowed = new Set(['gpt-4o', 'gpt-4o-mini']);
  const requested = (process.env.OPENAI_MODEL || '').trim();
  return allowed.has(requested) ? requested : 'gpt-4o-mini';
}

function buildSafeFallback(query) {
  const q = (query || '').toString().trim();
  const clipped = q.length > 180 ? `${q.slice(0, 177)}...` : q;
  return (
    `Thanks for your message${clipped ? `: "${clipped}"` : ''}. ` +
    `The doctor will review it as soon as possible. ` +
    `If this feels urgent or severe, please seek emergency care.`
  );
}

exports.getAIStatus = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const aiStatus = await AIResponse.findOne({ doctorId });

    if (!aiStatus) {
      // Return a safe default so the frontend can render without error handling.
      return res.json({ doctorId, isAIEnabled: false, instructions: "" });
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

    // Best-effort sync to DoctorProfile global flag if a profile exists.
    await DoctorProfile.findOneAndUpdate(
      { userId: doctorId },
      { $set: { isAutoAIReplyEnabled: !!isAIEnabled } },
      { new: false }
    );

    res.json({ message: `AI chat is now ${isAIEnabled ? 'enabled' : 'disabled'}.`, aiResponse });
  } catch (error) {
    res.status(500).json({ message: "Error toggling AI chat", error: error.message });
  }
};

// Simple runtime check to confirm whether GEMINI_API_KEY works.
// Does NOT return the key.
exports.health = async (req, res) => {
  try {
    const openai = getOpenAIClient();
    if (openai) {
      const completion = await openai.chat.completions.create({
        model: getOpenAIModelName(),
        messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
        temperature: 0,
        max_tokens: 10,
      });
      const text = completion?.choices?.[0]?.message?.content || '';
      const ok = text.toLowerCase().includes('ok');
      return res.json({ provider: 'openai', configured: true, ok, sample: text.trim().slice(0, 120) });
    }

    const configured = !!process.env.GEMINI_API_KEY;
    const model = getGeminiModel();
    if (!configured || !model) {
      return res.json({ provider: 'none', configured: false, ok: false, message: 'No OPENAI_API_KEY or GEMINI_API_KEY configured on the server.' });
    }

    const result = await model.generateContent('Reply with exactly: OK');
    const text = result?.response?.text?.() || '';
    const ok = text.toLowerCase().includes('ok');
    return res.json({ provider: 'gemini', configured: true, ok, sample: text.trim().slice(0, 120) });
  } catch (error) {
    return res.status(500).json({ configured: !!(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY), ok: false, error: error.message });
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

    const openai = getOpenAIClient();
    const gemini = getGeminiModel();

    const prompt = `
You are a helpful assistant replying on behalf of a doctor.

Doctor instructions:
"""
${aiSettings.instructions || 'Be polite and helpful with patients.'}
"""

Patient message:
"""
${query}
"""

Rules:
- Be polite and reassuring.
- Do NOT diagnose or prescribe.
- Suggest emergency care if urgent.
- Keep it short (2-3 sentences).
`;

    if (openai) {
      try {
        const completion = await openai.chat.completions.create({
          model: getOpenAIModelName(),
          messages: [
            {
              role: 'system',
              content: 'You are a cautious medical office assistant. Do not diagnose or prescribe. Keep replies short and safe.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 180,
        });

        const text = completion?.choices?.[0]?.message?.content || '';
        const response = text.trim() || buildSafeFallback(query);
        return res.json({ response, provider: 'openai' });
      } catch (e) {
        // fall back to Gemini
      }
    }

    if (gemini) {
      const result = await gemini.generateContent(prompt);
      const responseText = result?.response?.text?.() || '';
      const response = responseText.trim() || buildSafeFallback(query);
      return res.json({ response, provider: 'gemini' });
    }

    return res.json({ response: buildSafeFallback(query), provider: 'fallback' });
  } catch (error) {
    res.status(500).json({ message: "AI Response error", error: error.message });
  }
};
