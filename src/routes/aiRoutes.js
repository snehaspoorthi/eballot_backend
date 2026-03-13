import express from "express";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "../config/database.js";

const router = express.Router();

/**
 * Helper to call the correct AI provider
 */
async function getAIResponse(messages, systemInstruction = "") {
  const provider = process.env.AI_PROVIDER || "openai";
  const modelName = process.env.AI_MODEL;

  try {
    if (provider === "gemini") {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ 
        model: modelName || "gemini-2.5-flash",
        systemInstruction: systemInstruction 
      });

      // Gemini's SDK handles content differently
      const userMessage = messages[messages.length - 1].content;
      const result = await model.generateContent(userMessage);
      return result.response.text();
    } else {
      // OpenAI-compatible providers (OpenAI, Grok, etc.)
      const apiKey = provider === "grok" ? process.env.XAI_API_KEY : process.env.OPENAI_API_KEY;
      const baseURL = provider === "grok" ? process.env.XAI_BASE_URL : undefined;
      const openai = new OpenAI({ apiKey, baseURL });

      const fullMessages = systemInstruction 
        ? [{ role: "system", content: systemInstruction }, ...messages]
        : messages;

      const response = await openai.chat.completions.create({
        model: modelName || (provider === "grok" ? "grok-beta" : "gpt-4o-mini"),
        messages: fullMessages,
        temperature: 0.7,
      });

      return response.choices[0].message.content;
    }
  } catch (error) {
    console.error(`[AI ERROR] Provider: ${provider}, Message: ${error.message}`);
    throw error;
  }
}

/**
 * @route   POST /api/ai/summarize
 */
router.post("/summarize", async (req, res) => {
  const { manifesto, candidateName } = req.body;
  if (!manifesto) return res.status(400).json({ error: "Manifesto required" });

  const systemInstruction = "Summarize the following candidate manifesto into 3-5 clear bullet points. Focus on key promises. Professional tone.";
  const messages = [{ role: "user", content: `Candidate: ${candidateName}\n\nManifesto: ${manifesto}` }];

  try {
    const summary = await getAIResponse(messages, systemInstruction);
    res.json({ summary });
  } catch (err) {
    // Dynamic Mock Fallback
    res.json({
      summary: `• (Limited Mode) Key priority: Transparency and student-led initiatives.\n• Analysis of ${candidateName || 'this candidate'}: Focuses on improving campus infrastructure.\n• Vision: A more inclusive and modern voting environment.`
    });
  }
});

/**
 * @route   POST /api/ai/chatbot
 */
router.post("/chatbot", async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Message required" });

  // Fetch real-time context from database
  let contextInfo = "Currently, there is no active data to display.";
  try {
    const activeElections = await prisma.election.findMany({
      where: { status: "OPEN" },
      select: { title: true, description: true }
    });

    if (activeElections.length > 0) {
      contextInfo = `The following elections are currently ACTIVE and OPEN for voting on this E-Ballot platform:\n` +
        activeElections.map(e => `- ${e.title}: ${e.description || 'No description'}`).join("\n");
    } else {
      contextInfo = "There are currently NO active elections open for voting on the platform.";
    }
  } catch (error) {
    console.error("[CONTEXT FETCH ERROR]", error.message);
  }

  const systemInstruction = `You are the E-Ballot AI Assistant. You are currently running on a live, localhost development environment of the E-Ballot Secure Voting system.
  
REAL-TIME PLATFORM DATA:
${contextInfo}

INSTRUCTIONS:
1. Use the data above to answer specific questions about what elections are active. 
2. If the user asks general voting questions, give helpful, objective advice.
3. Keep your tone professional, secure, and encouraging.
4. If a user asks a question about the 'localhost' or 'backend', acknowledge that you are part of the E-Ballot development portal created by the user.`;

  const messages = [{ role: "user", content: message }];

  try {
    const reply = await getAIResponse(messages, systemInstruction);
    res.json({ reply });
  } catch (err) {
    res.json({
      reply: "I'm in limited mode right now. To vote, go to Dashboard -> Active Ballots. To verify, go to the Verify section."
    });
  }
});

export default router;
