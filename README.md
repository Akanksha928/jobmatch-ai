# JobMatch AI

> 🧠 Chrome Extension + AI backend that compares your resume with LinkedIn job descriptions using Groq's LLaMA 3 model.


## 📌 What It Does

- Scrapes LinkedIn job descriptions in real time
- Lets you upload your resume (PDF or text)
- Sends both to a local Node.js backend powered by [Groq](https://console.groq.com)
- Returns:
  - ✅ Match Score (0–100)
  - ❌ Missing Skills
  - 💡 Suggestions to improve alignment
- Results shown in browser console (UI in progress)


## 🛠️ Tech Stack

| Frontend                   | Backend               | AI Layer              |
|---------------------------|------------------------|------------------------|
| Chrome Extension (V3)     | Node.js + Express      | Groq API (LLaMA 3)     |
| MutationObserver + DOM JS | REST API (`/analyze`)  | Structured prompt output |
| PDF.js (for resume upload)| dotenv, CORS           | JSON-based skill mapping |


