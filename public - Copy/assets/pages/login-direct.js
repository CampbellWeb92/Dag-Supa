(function () {
  "use strict";

  const form = document.getElementById("loginForm");
  const message = document.getElementById("message");
  const warning = document.getElementById("setupWarning");

  function showMessage(text, type) {
    if (!message) return;
    message.textContent = text;
    message.className = "form-message show " + (type || "info");
  }

  function setLoading(button, loading) {
    if (!button) return;
    if (loading) {
      button.dataset.originalText = button.textContent;
      button.textContent = "Logging in…";
      button.disabled = true;
    } else {
      button.textContent = button.dataset.originalText || "Log In";
      button.disabled = false;
    }
  }

  const supabaseUrl = String(window.DAG_SUPABASE_URL || "").replace(/\/$/, "");
  const supabaseKey = String(window.DAG_SUPABASE_PUBLISHABLE_KEY || "");
  const configured =
    /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl) &&
    supabaseKey.length > 20 &&
    !supabaseKey.includes("YOUR-");

  if (!configured && warning) warning.hidden = false;

  if (!form) return;

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (!configured) {
      showMessage("Supabase is not configured. Check assets/supabase-config.js.", "error");
      return;
    }

    const email = String(form.elements.email.value || "").trim();
    const password = String(form.elements.password.value || "");
    const button = form.querySelector('button[type="submit"]');

    if (!email || !password) {
      showMessage("Enter your email address and password.", "error");
      return;
    }

    setLoading(button, true);
    showMessage("", "info");

    try {
      const response = await fetch(
        supabaseUrl + "/auth/v1/token?grant_type=password",
        {
          method: "POST",
          headers: {
            apikey: supabaseKey,
            Authorization: "Bearer " + supabaseKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: email, password: password }),
        },
      );

      const result = await response.json().catch(function () { return {}; });

      if (!response.ok) {
        const raw = result.msg || result.message || result.error_description || result.error;
        let friendly = raw || "Login failed. Check your email address and password.";

        if (/invalid login credentials/i.test(friendly)) {
          friendly = "Incorrect email address or password.";
        } else if (/email not confirmed/i.test(friendly)) {
          friendly = "Please confirm your email address before logging in. Check your inbox and spam folder.";
        }

        showMessage(friendly, "error");
        return;
      }

      if (!result.access_token || !result.user) {
        showMessage("Supabase did not return a valid login session.", "error");
        return;
      }

      const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
      const storageKey = "sb-" + projectRef + "-auth-token";
      const session = {
        access_token: result.access_token,
        token_type: result.token_type || "bearer",
        expires_in: result.expires_in,
        expires_at: result.expires_at || Math.floor(Date.now() / 1000) + Number(result.expires_in || 3600),
        refresh_token: result.refresh_token,
        user: result.user,
      };

      localStorage.setItem(storageKey, JSON.stringify(session));
      showMessage("Login successful. Opening your dashboard…", "success");

      const params = new URLSearchParams(window.location.search);
      const requested = params.get("redirect");
      const safeRedirect = requested && /^[a-z0-9._-]+\.html(?:[?#].*)?$/i.test(requested)
        ? requested
        : "dashboard.html";

      window.location.replace(safeRedirect);
      return;
    } catch (error) {
      console.error("Login request failed:", error);
      showMessage(
        "The login service could not be reached. Check your internet connection and confirm the Supabase project is active.",
        "error",
      );
    } finally {
      setLoading(button, false);
    }
  });
})();
