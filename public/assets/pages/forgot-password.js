"use strict";

(function initialisePasswordReset() {
  const { client, isConfigured, setButtonLoading, showMessage } = window.Dag;
  const form = document.querySelector("#resetForm");
  const message = document.querySelector("#message");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!isConfigured || !client) {
      showMessage(message, "Supabase is not configured. Check assets/supabase-config.js.", "error");
      return;
    }

    const button = form.querySelector('button[type="submit"]');
    setButtonLoading(button, true, "Sending…");
    try {
      const { error } = await client.auth.resetPasswordForEmail(
        form.elements.email.value.trim(),
        { redirectTo: new URL("update-password.html", window.location.href).href },
      );
      if (error) throw error;
      showMessage(message, "Check your email for the password-reset link.", "success");
    } catch (error) {
      showMessage(message, error?.message || "The reset email could not be sent.", "error");
    } finally {
      setButtonLoading(button, false);
    }
  });
})();
