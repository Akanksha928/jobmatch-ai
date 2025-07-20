import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { OpenAI } from "openai";

dotenv.config();

const app = express();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors());
app.use(express.json());

app.post("/analyze", async (req, res) => {
  const { resumeText, jobDescription } = req.body;

  const prompt = `
You are a helpful AI career assistant. 
Compare the following resume to a job description and:
- List 3–5 **missing skills or technologies**
- Suggest **how to close the gap**
- Give a **match score out of 100**

--- RESUME ---
${resumeText}

--- JOB DESCRIPTION ---
${jobDescription}

Return your answer as structured JSON like:
{
  "match_score": 0-100,
  "missing_skills": [list],
  "suggestions": "text..."
}
`;

  try {
    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3
    });

    const textResponse = chatCompletion.choices[0].message.content;

    // Try to parse JSON from LLM output
    const json = JSON.parse(textResponse.match(/\{[\s\S]*\}/)[0]);
    res.json(json);
  } catch (err) {
    console.error("GPT error:", err);
    res.status(500).json({ error: "Failed to analyze" });
  }
});

app.listen(4000, () => {
  console.log("Server running on http://localhost:4000");
});
