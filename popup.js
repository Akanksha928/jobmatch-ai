// document.getElementById("resume-input").addEventListener("change", async (event) => {
//   const file = event.target.files[0];
//   if (!file) return;

//   let resumeText = "";

//   if (file.type === "application/pdf") {
//     const arrayBuffer = await file.arrayBuffer();

//     const pdfjsLib = await import(chrome.runtime.getURL("libs/pdf.mjs"));
//     pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("libs/pdf.worker.js");

//     const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
//     for (let i = 1; i <= pdf.numPages; i++) {
//       const page = await pdf.getPage(i);
//       const content = await page.getTextContent();
//       resumeText += content.items.map((item) => item.str).join(" ") + "\n";
//     }
//   } else {
//     resumeText = await file.text();
//   }

//   await chrome.storage.local.set({ resumeText });
//   document.getElementById("status").textContent = "Resume uploaded and saved.";
// });


document.addEventListener("DOMContentLoaded", async () => {
  const resumeInput = document.getElementById("resume-input");
  const status     = document.getElementById("status");
  const statusPill = document.getElementById("status-pill");
  const statusDot  = document.getElementById("status-dot");
  const uploadZone = document.getElementById("upload-zone");
  const removeBtn  = document.getElementById("remove-resume");

  function setUploaded(filename) {
    status.textContent = filename ? `${filename} ready` : "Resume ready";
    statusDot.className = "status-dot active";
    statusPill.classList.add("uploaded");
    removeBtn.style.display = "inline-flex";
  }

  function setEmpty() {
    status.textContent = "No resume uploaded yet.";
    statusDot.className = "status-dot";
    statusPill.classList.remove("uploaded");
    removeBtn.style.display = "none";
  }

  function setLoading() {
    status.textContent = "Parsing resume…";
    statusDot.className = "status-dot loading";
    uploadZone.classList.add("loading");
  }

  function clearLoading() {
    uploadZone.classList.remove("loading");
  }

  // Check if resume already exists when popup opens
  const { resumeText } = await chrome.storage.local.get("resumeText");
  if (resumeText) {
    setUploaded();
  } else {
    setEmpty();
  }

  // Handle resume upload 
  resumeInput.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading();
    let resumeText = "";

    if (file.type === "application/pdf") {
      const arrayBuffer = await file.arrayBuffer();
      const pdfjsLib = await import(chrome.runtime.getURL("libs/pdf.mjs"));
      pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("libs/pdf.worker.js");

      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();

        // Sort items by Y position (top to bottom), then X (left to right).
        // PDF.js does NOT guarantee reading order — skipping this causes
        // scrambled text and missing sections on most real-world resumes.
        const items = content.items.slice().sort((a, b) => {
          const yDiff = b.transform[5] - a.transform[5]; // higher Y = higher on page
          if (Math.abs(yDiff) > 2) return yDiff;
          return a.transform[4] - b.transform[4]; // same line → left to right
        });

        // Process items purely by Y position (top→bottom) then X (left→right).
        // This correctly handles both single-column and multi-column resumes:
        // - Continuation text on the right side shares the same Y as its bullet on the left,
        //   so sorting by Y→X naturally joins them on the same line.
        // - Dates/locations in a right column appear on their own Y rows and become
        //   their own lines, which the section splitter handles gracefully.
        // Never separate into left/right column passes — that orphans continuation text.
        let lastY = null;
        let line = "";
        for (const item of items) {
          const y = item.transform[5];
          if (lastY !== null && Math.abs(lastY - y) > 2) {
            resumeText += line.trim() + "\n";
            line = "";
          }
          line += item.str + " ";
          lastY = y;
        }
        resumeText += line.trim() + "\n";
      }
    } else {
      resumeText = await file.text();
    }

    clearLoading();
    await chrome.storage.local.set({ resumeText });
    setUploaded(file.name);
  });

  // Handle resume removal
  removeBtn.addEventListener("click", async () => {
    await chrome.storage.local.remove("resumeText");
    setEmpty();
    resumeInput.value = "";
  });
});