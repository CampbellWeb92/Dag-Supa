import {
  isConfigured,
  setButtonLoading,
  showMessage,
  supabase,
} from "../auth.js";

const form = document.querySelector("#resetForm");
const message = document.querySelector("#message");

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
  setButtonLoading(button, true, "Sending…");

  const { error } = await supabase.auth.resetPasswordForEmail(
    form.elements.email.value.trim(),
    { redirectTo: new URL("update-password.html", window.location.href).href },
  );

  setButtonLoading(button, false);

  if (error) {
    showMessage(message, error.message, "error");
    return;
  }

  showMessage(
    message,
    "Check your email for the password-reset link.",
    "success",
  );
});
