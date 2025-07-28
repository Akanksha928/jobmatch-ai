console.log("content.js is running");

if (chrome?.storage?.local) {
  console.log("chrome.storage.local is available");
} else {
  console.error("chrome.storage.local is undefined — content.js not injected properly.");
}


if (!window["pdfjsLib"]) {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("libs/pdf.js");
  script.onload = () => console.log("PDF.js loaded");
  document.head.appendChild(script);
}

// Watch for job description panel changes
function watchJobPanel() {
  const fallbackContainer = document.querySelector('.scaffold-layout__detail');

  if (!fallbackContainer) {
    console.log("Still waiting for .scaffold-layout__detail...");
    setTimeout(watchJobPanel, 1000);
    return;
  }

  console.log("✅ Found .scaffold-layout__detail. Watching for changes...");

  const observer = new MutationObserver(() => {
    console.log("Job panel changed");
    setTimeout(analyzeResumeWithJobDescription, 500);
  });

  observer.observe(fallbackContainer, {
    childList: true,
    subtree: true
  });
}

// Analyze resume against current job description
function analyzeResumeWithJobDescription() {
  console.log("analyzeResumeWithJobDescription() called");

  chrome.storage.local.get("resumeText", async ({ resumeText }) => {
    if (!resumeText) {
      console.warn("No resume found in storage.");
      return;
    }

    const descriptionElement = document.querySelector(
      '.jobs-description-content__text, .jobs-description__content, .description__text, .jobs-box__html-content'
    );
    const jobDescription = descriptionElement?.innerText.trim() || "";

    if (!jobDescription || jobDescription.length < 100) {
      console.warn("Job description too short or not found.");
      return;
    }

    console.log("Sending to Groq backend:", {
      resume: resumeText.slice(0, 100),
      job: jobDescription.slice(0, 100)
    });

    try {
      const response = await fetch("http://localhost:4000/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText, jobDescription })
      });

      const result = await response.json();
      console.log("Groq Response:", result);
      showGPTPanel(result);
    } catch (err) {
      console.error("❌ Failed to fetch from backend:", err);
    }
  });
}

// Resume parsing helper (PDF.js)
async function extractTextFromPDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdfjsLib = window["pdfjsLib"];
  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("libs/pdf.worker.js");

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(item => item.str).join(' ') + '\n';
  }
  return text;
}

// Init everything
window.addEventListener("load", () => {
  setTimeout(() => {
    watchJobPanel();
    chrome.storage.local.get("resumeText", ({ resumeText }) => {
      if (resumeText) {
        console.log("Resume from storage:", resumeText.slice(0, 300));
      } else {
        console.log("No resume uploaded yet.");
      }
    });
  }, 1500);
});

function showGPTPanel(result) {
  const { match_score, missing_skills, suggestions } = result;

  const old = document.getElementById("jobmatch-panel");
  if (old) old.remove();

  const panel = document.createElement("div");
  panel.id = "jobmatch-panel";
  panel.style.position = "fixed";
  panel.style.bottom = "20px";
  panel.style.right = "20px";
  panel.style.width = "360px";
  panel.style.maxHeight = "60vh";
  panel.style.overflowY = "auto";
  panel.style.background = "white";
  panel.style.border = "1px solid #e0e0e0";
  panel.style.borderRadius = "12px";
  panel.style.boxShadow = "0 10px 24px rgba(0, 0, 0, 0.15)";
  panel.style.padding = "20px";
  panel.style.fontFamily = "Inter, sans-serif";
  panel.style.fontSize = "14px";
  panel.style.zIndex = "999999";
  panel.style.color = "#333";

  panel.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
      <h3 style="margin:0; font-size:16px;">📊 <span style="color:#0047AB;">JobMatch AI</span></h3>
      <button style="border:none; background:none; font-size:16px; cursor:pointer;" onclick="document.getElementById('jobmatch-panel').remove()">×</button>
    </div>
    
    <div style="margin-bottom:8px;"><strong>Match Score:</strong> 
      <span style="background:#e0f7fa; color:#00796b; padding:2px 8px; border-radius:8px;">
        ${match_score}%
      </span>
    </div>

    <div style="margin-bottom:8px;"><strong>Missing Skills:</strong>
      <ul style="margin: 4px 0 8px 16px; padding: 0;">
        ${missing_skills.map(skill => `<li style="margin-bottom:4px;">${skill}</li>`).join("")}
      </ul>
    </div>

    <div style="margin-bottom:4px;"><strong>Suggestion:</strong></div>
    <div style="background:#f9f9f9; padding:12px; border-radius:8px; border:1px solid #ddd;">
      ${suggestions}
    </div>
  `;

  document.body.appendChild(panel);
}

