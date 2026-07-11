let jobCallCount = 0;

// --- Anti-spam guards (prevents rate limits) ---
let analyzeTimer = null;     // debounce timer
let lastJobHash = null;      // dedupe: remember last job analyzed
let isAnalyzing = false;     // prevents overlapping calls
const jobCache = new Map();  // cache: jobHash -> AI result

function hashText(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return String(hash);
}

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

if (!document.getElementById("jobmatch-styles")) {
  const link = document.createElement("link");
  link.id = "jobmatch-styles";
  link.rel = "stylesheet";
  link.href = chrome.runtime.getURL("panel.css");
  document.head.appendChild(link);
}

// Watch for job description panel changes
function watchJobPanel() {
  const fallbackContainer = document.querySelector('.scaffold-layout__detail');

  if (!fallbackContainer) {
    console.log("Still waiting for .scaffold-layout__detail...");
    setTimeout(watchJobPanel, 1000);
    return;
  }

  console.log("Found .scaffold-layout__detail. Watching for changes...");

  const observer = new MutationObserver(() => {
    if (analyzeTimer) clearTimeout(analyzeTimer);
    analyzeTimer = setTimeout(() => {
      analyzeResumeWithJobDescription();
    }, 1200);
  });

  observer.observe(fallbackContainer, {
    childList: true,
    subtree: true
  });
}

function analyzeViaBackground(payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: "ANALYZE_JOB", payload }, (resp) => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      if (!resp?.ok) return reject(resp?.error || "Unknown error");
      resolve(resp.data);
    });
  });
}

// Analyze resume against current job description
function analyzeResumeWithJobDescription() {
  if (!chrome.runtime?.id) return; // extension context invalidated
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
    console.log("RESUME LENGTH:", resumeText.length);
    console.log("FULL RESUME:\n", resumeText);

    const jobHash = hashText(jobDescription);

    // 1) Cache: if we already analyzed this exact job, reuse result
    // Validate new format (original/rewritten) — skip stale old-format (from/to) entries
    if (jobCache.has(jobHash)) {
      const cached = jobCache.get(jobHash);
      const isNewFormat = !cached.edits?.length || cached.edits[0].original !== undefined;
      if (isNewFormat) {
        console.log("⚡ Using cached result.");
        showPanel(cached);
        return;
      }
      console.log("🔄 Stale cache format — re-fetching.");
      jobCache.delete(jobHash);
    }

    // 2) Dedupe: if same job as last time, skip
    if (jobHash === lastJobHash) {
      console.log("⏭️ Same job as last time — skipping.");
      return;
    }

    // 3) No overlap: avoid multiple AI calls at once
    if (isAnalyzing) {
      console.log("⏳ Already analyzing — skipping.");
      return;
    }

    lastJobHash = jobHash;
    isAnalyzing = true;


    if (!jobDescription || jobDescription.length < 100) {
      console.warn("Job description too short or not found.");
      return;
    }

    console.log("Sending to Groq backend:", {
      resume: resumeText.slice(0, 100),
      job: jobDescription.slice(0, 100)
    });

    try {
      const result = await analyzeViaBackground({ resumeText, jobDescription });

      jobCallCount++;
      console.log("📊 Total Job Analyses So Far:", jobCallCount);

      // save result so returning to same job doesn't call AI again
      jobCache.set(jobHash, result);

      console.log("Groq Response:", result);
      showPanel(result);
    } catch (err) {
      console.error("❌ Failed to fetch from backend:", err);
    } finally {
      isAnalyzing = false;
    }


  });
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

// Remember panel position across job refreshes
let panelPosition = null;

function showPanel(result) {
  const { match_score, missing_skills, alignment_summary, edits = [] } = result;

  const existing = document.getElementById("jobmatch-panel");
  if (existing) {
    // Save current position before removing
    const rect = existing.getBoundingClientRect();
    const isRepositioned = existing.style.left !== "";
    if (isRepositioned) {
      panelPosition = { left: existing.style.left, top: existing.style.top };
    }
    existing.remove();
  }

  const score = match_score ?? 0;
  const scoreTier = score >= 80 ? "great" : score >= 60 ? "good" : score >= 40 ? "mid" : "low";

  const skillsHtml = (missing_skills || []).length
    ? missing_skills.map(s => `<span class="jm-skill-tag">${s}</span>`).join("")
    : `<span class="jm-skill-tag" style="color:#8b87a0;background:#f7f6f3;border-color:#e8e4f0">None</span>`;

  const summaryHtml = alignment_summary
    ? `<div class="jm-divider"></div>
       <div>
         <div class="jm-label">Summary</div>
         <div class="jm-summary">${alignment_summary}</div>
       </div>`
    : "";

  const editsHtml = edits.length
    ? '<div class="jm-divider"></div><div><div class="jm-label">Suggested Edits</div>' +
      edits.map(function(e, idx) {
        // Convert bullet_id (E0, P1) to readable label
        const rawId = e.bullet_id || e.section || "";
        const sectionLabel = rawId.startsWith('E') ? 'Experience' 
                           : rawId.startsWith('P') ? 'Project'
                           : rawId || 'Resume';
        const original     = e.original  || e.from     || "";
        const rewritten    = e.rewritten || e.to       || "";
        const reasonHtml   = e.reason
          ? '<div class="jm-edit-reason">💡 ' + e.reason + '</div>'
          : "";
        return '<div class="jm-edit-card">' +
          '<div class="jm-edit-section-label">' + sectionLabel + '</div>' +
          '<div class="jm-edit-from">'  + original  + '</div>' +
          '<div class="jm-edit-to" id="jm-rewrite-' + idx + '">' + rewritten + '</div>' +
          reasonHtml +
          '<button class="jm-copy-btn" data-idx="' + idx + '">Copy</button>' +
          '</div>';
      }).join("") + '</div>'
    : "";

  const panel = document.createElement("div");
  panel.id = "jobmatch-panel";
  panel.innerHTML = `
    <div class="jm-header" id="jm-drag-handle">
      <div class="jm-header-left">
        <div class="jm-logo-mark">
          <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
            <circle cx="9" cy="9" r="8.5" stroke="#b5a8f5" stroke-width="1"/>
            <path d="M5 9.5 L7.5 12 L13 6.5" stroke="#7c6fe0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <h3 class="jm-title">JobMatch <em>AI</em></h3>
      </div>
      <button class="jm-close" id="jm-close-btn">
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
          <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
    <div class="jm-body">
      <div>
        <div class="jm-label">Match Score</div>
        <div class="jm-score-row">
          <span class="jm-score-number">${score}%</span>
          <div class="jm-score-bar-wrap">
            <div class="jm-score-bar ${scoreTier}" style="width:${score}%"></div>
          </div>
        </div>
      </div>
      <div class="jm-divider"></div>
      <div>
        <div class="jm-label">Missing Skills</div>
        <div class="jm-skills-wrap">${skillsHtml}</div>
      </div>
      ${summaryHtml}
      ${editsHtml}
    </div>
  `;

  document.body.appendChild(panel);

  // Restore previous position if panel was moved
  if (panelPosition) {
    panel.style.bottom = "auto";
    panel.style.right = "auto";
    panel.style.left = panelPosition.left;
    panel.style.top = panelPosition.top;
  }

  // Copy button handlers
  panel.querySelectorAll(".jm-copy-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = btn.getAttribute("data-idx");
      const text = document.getElementById(`jm-rewrite-${idx}`)?.innerText || "";
      navigator.clipboard.writeText(text).then(() => {
        btn.textContent = "Copied!";
        btn.classList.add("copied");
        setTimeout(() => { btn.textContent = "Copy"; btn.classList.remove("copied"); }, 2000);
      });
    });
  });

  // Close with fade-out
  document.getElementById("jm-close-btn").addEventListener("click", () => {
    panel.style.transition = "opacity 0.15s, transform 0.15s";
    panel.style.opacity = "0";
    panel.style.transform = "translateY(8px) scale(0.97)";
    setTimeout(() => panel.remove(), 150);
  });

  // Drag to move
  const handle = document.getElementById("jm-drag-handle");
  let isDragging = false, dragOffsetX = 0, dragOffsetY = 0;

  handle.addEventListener("mousedown", (e) => {
    if (e.target.closest(".jm-close")) return;
    isDragging = true;
    const rect = panel.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    panel.style.bottom = "auto";
    panel.style.right = "auto";
    panel.style.left = rect.left + "px";
    panel.style.top = rect.top + "px";
    handle.style.cursor = "grabbing";
    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const x = e.clientX - dragOffsetX;
    const y = e.clientY - dragOffsetY;
    const newLeft = Math.max(0, Math.min(x, window.innerWidth - panel.offsetWidth)) + "px";
    const newTop  = Math.max(0, Math.min(y, window.innerHeight - panel.offsetHeight)) + "px";
    panel.style.left = newLeft;
    panel.style.top  = newTop;
    panelPosition = { left: newLeft, top: newTop };
  });

  document.addEventListener("mouseup", () => {
    if (isDragging) { isDragging = false; handle.style.cursor = "grab"; }
  });
}