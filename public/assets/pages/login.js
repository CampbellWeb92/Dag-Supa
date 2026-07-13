"use strict";

(async function initialiseLogin() {
  const { client, isConfigured, setButtonLoading, showMessage } = window.Dag;
  const form = document.querySelector("#loginForm");
  const message = document.querySelector("#message");
  const warning = document.querySelector("#setupWarning");

  if (!form) return;
  if (!isConfigured || !client) {
    if (warning) warning.hidden = false;
  } else {
    const { data } = await client.auth.getSession();
    if (data?.session?.user) {
      window.location.replace("dashboard.html");
      return;
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!isConfigured || !client) {
      showMessage(message, "Supabase is not configured. Check assets/supabase-config.js.", "error");
      return;
    }

    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    const button = form.querySelector('button[type="submit"]');
    setButtonLoading(button, true, "Logging in…");

    try {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;

      showMessage(message, "Login successful. Opening your dashboard…", "success");
      const requested = new URLSearchParams(window.location.search).get("redirect");
      const safeRedirect = requested && /^[a-z0-9._-]+\.html(?:[?#].*)?$/i.test(requested)
        ? requested
        : "dashboard.html";
      window.location.assign(safeRedirect);
    } catch (error) {
      let text = error?.message || "Login failed. Check your email and password.";
      if (/invalid login credentials/i.test(text)) text = "Incorrect email address or password.";
      if (/email not confirmed/i.test(text)) text = "Please confirm your email address before logging in.";
      showMessage(message, text, "error");
    } finally {
      setButtonLoading(button, false);
    }
  });
})();
