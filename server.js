import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { splitIntoSections } from "./utils/sectionSplitter.js";
import { extractSkills } from "./utils/skillExtractor.js";


dotenv.config(); // read .env file for MODEL_API_KEY

let totalCostSoFar = 0;

const app = express();
// Middleware
app.use(cors()); // Allow CORS
app.use(express.json()); // Parse JSON bodies


app.post("/analyze", async (req, res) => {
  const { resumeText, jobDescription } = req.body;

  if (!resumeText || !jobDescription) {
    return res.status(400).json({ error: "Missing resume or job description" });
  }

  // console.log("\n====== RAW JOB DESCRIPTION RECEIVED ======\n");
  // console.log(jobDescription);
  // console.log("\nJD LENGTH:", jobDescription?.length);

  // return res.json({
  //   debug: true,
  //   extractedJD: jobDescription
  // });

  // Step 1: Parse resume
  const sections = splitIntoSections(resumeText);
  const structuredSkills = extractSkills(sections.skills);

  // Step 2: Clean and number every bullet so AI works with exact text
  // Collapsing PDF whitespace artifacts here prevents the AI from
  // reconstructing bullets from memory and hallucinating "from" fields.
  function cleanBullet(text) {
    return text
      .replace(/\s+/g, ' ')
      .replace(/ ,/g, ',')
      .replace(/ \./g, '.')
      .trim();
  }

  // Common resume action verbs — used to distinguish bullet points from header lines
  const ACTION_VERBS = /^(Developed|Designed|Built|Boosted|Engineered|Automated|Maintained|Contributed|Integrated|Led|Created|Implemented|Managed|Delivered|Reduced|Improved|Architected|Deployed|Migrated|Optimized|Received|Collaborated|Spearheaded|Established)/i;

  function extractBullets(sectionText) {
    return sectionText
      .split(/\n•\s+|^•\s+/m)
      .map(b => cleanBullet(b))
      .filter(b => b.length > 20 && ACTION_VERBS.test(b));
  }

  const experienceBullets = extractBullets(sections.experience);
  const projectBullets    = extractBullets(sections.projects);

  const numberedBullets = [
    ...experienceBullets.map((b, i) => `[E${i}] ${b}`),
    ...projectBullets.map((b, i) => `[P${i}] ${b}`)
  ].join('\n');

  console.log("\nBULLETS SENT TO AI:\n", numberedBullets);

  const prompt = `You are a technical resume coach. A student is applying for a job and needs their resume bullets rewritten to better match the job description.

--- EXACT RESUME BULLETS ---
${numberedBullets}

--- SKILLS ---
${JSON.stringify(structuredSkills, null, 2)}

--- JOB DESCRIPTION ---
${jobDescription}

--- YOUR TASK ---
Identify the 2-4 bullets that are most relevant to this role but could use better wording or terminology to match the JD.
Rewrite those bullets following these rules strictly:

1. Start from the EXACT bullet text above — copy it first, then edit it.
2. Only suggest an edit if it meaningfully changes how the bullet reads to a recruiter or passes ATS — replacing a specific phrase with a term the JD uses explicitly (e.g. "message queuing" → "event-driven architecture").
3. Do NOT suggest edits that are just synonym swaps with no strategic value. Examples of useless edits: "Boosted" → "Enhanced", "combining" → "integrating", "using" → "leveraging". These waste the candidate's time.
4. Do NOT append new sentences or clauses to the end of a bullet. Rewrite within the existing sentence structure.
5. Do NOT add filler: "demonstrating", "showcasing", "enhancing user experience", "to deliver results".
6. Do NOT invent experience. Every word in the rewrite must be grounded in the original bullet.
7. Keep roughly the same length as the original.
8. If fewer than 2 bullets genuinely need changing, return only the ones that do. Quality over quantity — 1 great edit beats 4 useless ones.

--- OUTPUT FORMAT ---
Return ONLY valid JSON, no markdown:

{
  "match_score": number (0-100, be critical),
  "missing_skills": string[] (only skills absent from ALL bullets AND the skills section),
  "alignment_summary": "2-3 honest sentences about fit for this specific role",
  "edits": [
    {
      "bullet_id": "E0",
      "original": "exact original bullet copied from above",
      "rewritten": "your rewritten version",
      "reason": "specifically what terminology or framing changed and why"
    }
  ]
}
`;
  try {
    const modelResponse = await fetch("https://models.inference.ai.azure.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GITHUB_TOKEN}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
      }),
    });

    const data = await modelResponse.json();

    console.log("🔢 Token Usage:", data.usage);

    if (data.usage) {
      const inputCost =
        (data.usage.prompt_tokens / 1_000_000) * 0.075;   // adjust if using different model

      const outputCost =
        (data.usage.completion_tokens / 1_000_000) * 0.30;

      const totalCost = inputCost + outputCost;

      console.log("💰 Cost This Call: $", totalCost.toFixed(6));

      totalCostSoFar += totalCost;
      console.log("💵 Total Cost So Far: $", totalCostSoFar.toFixed(4));
    }


    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      console.error("❌ No response from gpt-4o-mini:", data);
      return res.status(500).json({ error: "gpt-4o-mini response incomplete." });
    }


    console.log("gpt-4o-mini Raw Output:\n", content);

    // Extract JSON safely
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) {
      return res.status(500).json({ error: "Could not parse gpt-4o-mini JSON output" });
    }

    const parsed = JSON.parse(match[0]);

    res.json(parsed);

  } catch (err) {
    console.error("gpt-4o-mini error:", err);
    res.status(500).json({ error: "gpt-4o-mini request failed" });
  }
});

// TEMP DEBUG MODE — skip gpt-4o-mini

//   console.log("RAW resumeText received:\n");
//   console.log(resumeText);

//   function cleanResumeText(text) {
//     // Fix spaced-out ALL CAPS words
//     text = text.replace(/\b(?:[A-Z]\s+){2,}[A-Z]\b/g, match =>
//       match.replace(/\s+/g, "")
//     );

//     // Collapse multiple spaces
//     text = text.replace(/\s{2,}/g, " ");

//     // Normalize line breaks
//     text = text.replace(/\n{3,}/g, "\n\n");

//     return text.trim();
//   }

//   const cleanedResume = cleanResumeText(resumeText);

//   console.log("\nCLEANED resumeText:\n");
//   console.log(cleanedResume);

//   return res.json({
//     debug: true,
//     rawLength: resumeText.length,
//     cleanedLength: cleanedResume.length
//   });
// });


app.listen(4000, () => {
  console.log("gpt-4o-mini backend running on http://localhost:4000");
});