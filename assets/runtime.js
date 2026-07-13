"use strict";
window.addEventListener("error", (event) => {
  const source = event?.filename || "";
  if (!source.includes("/assets/") && !source.includes("cdn.jsdelivr.net")) return;
  const target = document.querySelector("#message, #breederMessage, #contactNotice");
  if (!target) return;
  target.textContent = "A required website script could not load. Refresh the page with Ctrl + F5. If the problem continues, confirm the site is being opened through HTTPS and that your internet connection allows the Supabase library.";
  target.className = "form-message show error";
});
window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled website error:", event.reason);
});
