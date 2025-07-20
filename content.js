
// Inject pdf.js script if not already loaded
if (!window["pdfjsLib"]) {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("libs/pdf.js");
  script.onload = () => console.log("📦 PDF.js loaded");
  document.head.appendChild(script);
}


function extractJobDataFromPanel() {
    const titleElement = document.querySelector('.job-details-jobs-unified-top-card__job-title, h2.top-card-layout__title');
    const descriptionElement = document.querySelector('.jobs-description-content__text, .jobs-description__content');

    const jobTitle = titleElement ? titleElement.innerText.trim() : "Job title not found";
    const jobDescription = descriptionElement ? descriptionElement.innerText.trim() : "Job description not found";

    console.clear();
    console.log("Job Title:", jobTitle);
    console.log("Job Description:", jobDescription.slice(0, 300), "...");
}

function watchJobPanel() {
    const fallbackContainer = document.querySelector('.scaffold-layout__detail');

    if (!fallbackContainer) {
        console.log("Still waiting for .scaffold-layout__detail...");
        setTimeout(watchJobPanel, 1000);
        return;
    }

    console.log("Found .scaffold-layout__detail. Watching for changes...");

    const observer = new MutationObserver(() => {
        setTimeout(extractJobDataFromPanel, 500); // wait for new content to load
    });

    observer.observe(fallbackContainer, {
        childList: true,
        subtree: true
    });
}

window.addEventListener("load", () => {
    setTimeout(watchJobPanel, 2000);
});


async function extractTextFromPDF(file) {
    const arrayBuffer = await file.arrayBuffer();

    // Load local version of pdf.js
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


// Inject UI and watch job panel
window.addEventListener("load", () => {
    setTimeout(() => {
        // injectResumeUploadUI();
        watchJobPanel();
    }, 2000);
});


chrome.storage.local.get("resumeText", ({ resumeText }) => {
  if (resumeText) {
    console.log("Resume from storage:", resumeText.slice(0, 300));
    // Compare it with job description using LLM
  } else {
    console.log("No resume uploaded yet.");
  }
});

chrome.storage.local.get("resumeText", async ({ resumeText }) => {
  if (!resumeText) return;

  const titleElement = document.querySelector('.job-details-jobs-unified-top-card__job-title, h2.top-card-layout__title');
  const descriptionElement = document.querySelector('.jobs-description-content__text, .jobs-description__content');
  const jobDescription = descriptionElement?.innerText.trim() || "";

  if (!jobDescription) return;

  const response = await fetch("http://localhost:4000/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resumeText, jobDescription })
  });

  const result = await response.json();
  console.log("GPT-4 Match Result:", result);
});

