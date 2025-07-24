import express from "express";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const GROQ_API_KEY = process.env.GROQ_API_KEY;

app.post("/analyze", async (req, res) => {
  const { resumeText, jobDescription } = req.body;

  const prompt = `
Compare this resume and job description.
Return as JSON:
{
  "match_score": 0-100,
  "missing_skills": [list],
  "suggestions": "text"
}

--- RESUME ---
${resumeText}

--- JOB DESCRIPTION ---
${jobDescription}
`;

  try {
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3
      })
    });

    const data = await groqResponse.json();

    if (!data.choices || !data.choices[0]?.message?.content) {
      console.error("❌ No response from Groq:", data);
      return res.status(500).json({ error: "Groq response incomplete." });
    }

    const content = data.choices[0].message.content;
    console.log("Groq Output:\n", content);

    const json = JSON.parse(content.match(/\{[\s\S]*\}/)[0]);
    res.json(json);
  } catch (err) {
    console.error("AI error:", err);
    res.status(500).json({ error: "Failed to analyze with Groq" });
  }
});

app.listen(4000, () => {
  console.log("Groq Mixtral backend running on http://localhost:4000");
});
