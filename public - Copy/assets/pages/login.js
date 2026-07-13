import {
  isConfigured,
  setButtonLoading,
  showMessage,
  supabase,
} from "../auth.js";

const form = document.querySelector("#loginForm");
const message = document.querySelector("#message");
const warning = document.querySelector("#setupWarning");

if (!isConfigured) warning.hidden = false;

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!isConfigured) {
    showMessage(
      message,
      "Connect Supabase first using SETUP-GUIDE.txt.",
      "error",
    );
    return;
  }

  const button = form.querySelector('button[type="submit"]');
  setButtonLoading(button, true, "Logging in…");

  const { error } = await supabase.auth.signInWithPassword({
    email: form.elements.email.value.trim(),
    password: form.elements.password.value,
  });

  setButtonLoading(button, false);

  if (error) {
    showMessage(message, error.message, "error");
    return;
  }

  window.location.href = "dashboard.html";
});
