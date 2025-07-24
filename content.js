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
