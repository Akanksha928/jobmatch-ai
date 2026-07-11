chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== "ANALYZE_JOB") return;

  (async () => {
    try {
      const res = await fetch("http://localhost:4000/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(msg.payload),
      });

      const data = await res.json();
      sendResponse({ ok: true, data });
    } catch (err) {
      sendResponse({ ok: false, error: String(err) });
    }
  })();

  // keep the message channel open for async response
  return true;
});
