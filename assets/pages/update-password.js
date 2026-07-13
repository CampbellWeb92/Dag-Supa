"use strict";

(function initialisePasswordUpdate() {
  const { client, isConfigured, setButtonLoading, showMessage } = window.Dag;
  const form = document.querySelector("#passwordForm");
  const message = document.querySelector("#message");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!isConfigured || !client) {
      showMessage(message, "Supabase is not configured. Check assets/supabase-config.js.", "error");
      return;
    }

    const password = form.elements.password.value;
    const confirmation = form.elements.confirmPassword.value;
    if (password !== confirmation) {
      showMessage(message, "The passwords do not match.", "error");
      return;
    }
    if (password.length < 8) {
      showMessage(message, "Use a password with at least 8 characters.", "error");
      return;
    }

    const button = form.querySelector('button[type="submit"]');
    setButtonLoading(button, true, "Updating…");
    try {
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      form.reset();
      showMessage(message, "Password updated. You can now return to your dashboard.", "success");
    } catch (error) {
      showMessage(message, error?.message || "Your password could not be updated.", "error");
    } finally {
      setButtonLoading(button, false);
    }
  });
})();
