import { isConfigured, setButtonLoading, showMessage, supabase } from "../auth.js";

const form = document.querySelector("#passwordForm");
const message = document.querySelector("#message");

form?.addEventListener("submit", async (event) => {
  if (!isConfigured || !supabase) {
    event.preventDefault();
    showMessage(message, "Connect Supabase first using SETUP-GUIDE.txt.", "error");
    return;
  }
  event.preventDefault();

  const password = form.elements.password.value;
  const confirmation = form.elements.confirmPassword.value;
  if (password !== confirmation) {
    showMessage(message, "The passwords do not match.", "error");
    return;
  }

  const button = form.querySelector('button[type="submit"]');
  setButtonLoading(button, true, "Updating…");
  const { error } = await supabase.auth.updateUser({ password });
  setButtonLoading(button, false);

  if (error) {
    showMessage(message, error.message, "error");
    return;
  }

  form.reset();
  showMessage(
    message,
    "Password updated. You can now return to your dashboard.",
    "success",
  );
});
