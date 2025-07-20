document.getElementById("resume-input").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  let resumeText = "";

  if (file.type === "application/pdf") {
    const arrayBuffer = await file.arrayBuffer();

    const pdfjsLib = await import(chrome.runtime.getURL("libs/pdf.mjs"));
    pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("libs/pdf.worker.js");

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      resumeText += content.items.map((item) => item.str).join(" ") + "\n";
    }
  } else {
    resumeText = await file.text();
  }

  await chrome.storage.local.set({ resumeText });
  document.getElementById("status").textContent = "Resume uploaded and saved.";
});
