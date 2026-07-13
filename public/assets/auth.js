"use strict";

(function initialiseDagAuth() {
  const sdk = window.supabase;
  const projectUrl = String(window.DAG_SUPABASE_URL || "").replace(/\/$/, "");
  const publishableKey = String(window.DAG_SUPABASE_PUBLISHABLE_KEY || "");
  const hasUrl = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(projectUrl);
  const hasKey = publishableKey.length > 20 && !/YOUR-|REPLACE_/i.test(publishableKey);
  const isConfigured = Boolean(sdk?.createClient && hasUrl && hasKey);

  const projectRef = hasUrl ? new URL(projectUrl).hostname.split(".")[0] : "dag";
  const client = isConfigured
    ? sdk.createClient(projectUrl, publishableKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: `sb-${projectRef}-auth-token`,
        },
      })
    : null;

  function showMessage(element, text, type = "info") {
    if (!element) return;
    element.textContent = text || "";
    element.className = text ? `form-message show ${type}` : "form-message";
  }

  function clearMessage(element) {
    showMessage(element, "");
  }

  function money(value) {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
      maximumFractionDigits: 0,
    }).format(Number(value || 0));
  }

  function escapeHtml(value = "") {
    const element = document.createElement("div");
    element.textContent = String(value ?? "");
    return element.innerHTML;
  }

  function formatDate(value) {
    if (!value) return "Not supplied";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Not supplied";
    return new Intl.DateTimeFormat("en-ZA", { dateStyle: "long" }).format(date);
  }

  function currentPageWithQuery() {
    const page = window.location.pathname.split("/").pop() || "dashboard.html";
    return `${page}${window.location.search || ""}`;
  }

  function revealPrivatePage() {
    if (!document.body?.classList.contains("private-page")) return;
    document.body.classList.remove("auth-pending");
    document.body.classList.add("auth-ready");
  }

  function redirectToLogin(reason = "") {
    const redirect = encodeURIComponent(currentPageWithQuery());
    const suffix = reason ? `&reason=${encodeURIComponent(reason)}` : "";
    window.location.replace(`login.html?redirect=${redirect}${suffix}`);
  }

  async function requireUser() {
    if (!client) {
      window.location.replace("login.html?setup=1");
      return null;
    }

    try {
      // getUser() validates the saved token with Supabase. Do not trust only
      // getSession(), because a stale browser session can make private controls
      // appear after the user is no longer authenticated.
      const { data, error } = await client.auth.getUser();
      if (error || !data?.user) {
        await client.auth.signOut({ scope: "local" }).catch(() => {});
        redirectToLogin("login-required");
        return null;
      }

      revealPrivatePage();
      return data.user;
    } catch {
      await client.auth.signOut({ scope: "local" }).catch(() => {});
      redirectToLogin("session-error");
      return null;
    }
  }

  async function ensureBreederProfile(user) {
    if (!client || !user) throw new Error("You must be logged in as a breeder.");

    const { data: existing, error: readError } = await client
      .from("breeder_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (readError) throw readError;
    if (existing) return existing;

    const metadata = user.user_metadata || {};
    const fallbackName =
      metadata.business_name ||
      metadata.contact_name ||
      user.email?.split("@")[0] ||
      "New breeder";

    const row = {
      user_id: user.id,
      email: user.email || "",
      business_name: fallbackName,
      contact_name: metadata.contact_name || fallbackName,
      phone: metadata.phone || null,
      province: metadata.province || null,
      town: metadata.town || null,
      breeds: metadata.breeds || null,
      approval_status: "pending",
    };

    const { data: created, error: createError } = await client
      .from("breeder_profiles")
      .upsert(row, { onConflict: "user_id" })
      .select("*")
      .single();

    if (createError) throw createError;
    return created;
  }

  function createUuid() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
      const random = (Math.random() * 16) | 0;
      const value = character === "x" ? random : (random & 0x3) | 0x8;
      return value.toString(16);
    });
  }

  async function uploadImage(file, path) {
    if (!file) return null;
    if (!client) throw new Error("Supabase has not been connected.");

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      throw new Error("Please choose a JPG, PNG or WebP image.");
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new Error("The image must be smaller than 5 MB.");
    }

    const extension = (file.name.split(".").pop() || "jpg").toLowerCase();
    const safeExtension = ["jpg", "jpeg", "png", "webp"].includes(extension)
      ? extension
      : "jpg";
    const safePath = `${path}.${safeExtension}`;

    const { error } = await client.storage
      .from("dog-images")
      .upload(safePath, file, { upsert: true, contentType: file.type });

    if (error) {
      throw new Error(
        `${error.message}. Confirm that supabase/DATABASE-REPAIR.sql has been run and the dog-images bucket exists.`,
      );
    }

    return client.storage.from("dog-images").getPublicUrl(safePath).data.publicUrl;
  }

  function previewImage(input, image) {
    input?.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file || !image) return;
      image.src = URL.createObjectURL(file);
      image.style.display = "block";
    });
  }

  function setButtonLoading(button, isLoading, loadingText = "Saving…") {
    if (!button) return;
    if (isLoading) {
      button.dataset.originalText = button.textContent;
      button.textContent = loadingText;
      button.disabled = true;
    } else {
      button.textContent = button.dataset.originalText || button.textContent;
      button.disabled = false;
    }
  }

  function cleanPayPalUrl(value) {
    const trimmed = String(value || "").trim();
    if (!trimmed) return null;
    try {
      const url = new URL(trimmed);
      if (!["paypal.me", "www.paypal.me"].includes(url.hostname.toLowerCase())) {
        throw new Error();
      }
      url.protocol = "https:";
      return url.toString();
    } catch {
      throw new Error("Please enter a valid PayPal.Me link, such as https://paypal.me/YourName");
    }
  }

  function navigationIsCurrent(href) {
    return (window.location.pathname.split("/").pop() || "index.html") === href;
  }

  let navigationSyncVersion = 0;

  function clearBreederNavigation() {
    document
      .querySelectorAll('[data-auth-generated="true"]')
      .forEach((element) => element.remove());

    document.querySelectorAll("[data-auth-footer-links]").forEach((container) => {
      container.replaceChildren();
      container.hidden = true;
    });
  }

  async function getVerifiedBreeder() {
    if (!client) return null;

    const { data: userData, error: userError } = await client.auth.getUser();
    const user = userData?.user || null;
    if (userError || !user) {
      await client.auth.signOut({ scope: "local" }).catch(() => {});
      return null;
    }

    const { data: breeder, error: breederError } = await client
      .from("breeder_profiles")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (breederError || !breeder) return null;
    return { user, breeder };
  }

  function addBreederNavigation() {
    const links = [
      ["dashboard.html", "Dashboard"],
      ["add-dog.html", "Add a Dog"],
      ["edit-profile.html", "Edit Profile"],
    ];

    document.querySelectorAll(".site-nav").forEach((navigation) => {
      links.forEach(([href, label]) => {
        const anchor = document.createElement("a");
        anchor.href = href;
        anchor.textContent = label;
        anchor.dataset.authGenerated = "true";
        anchor.className = "auth-session-link";
        if (navigationIsCurrent(href)) {
          anchor.classList.add("active");
          anchor.setAttribute("aria-current", "page");
        }
        navigation.append(anchor);
      });

      const logout = document.createElement("button");
      logout.type = "button";
      logout.className = "nav-logout auth-session-link";
      logout.textContent = "Log Out";
      logout.dataset.authGenerated = "true";
      logout.addEventListener("click", async () => {
        logout.disabled = true;
        clearBreederNavigation();
        document
          .querySelectorAll('[data-public-auth="true"]')
          .forEach((link) => { link.hidden = false; });

        try {
          await client.auth.signOut();
        } finally {
          window.location.replace("login.html");
        }
      });
      navigation.append(logout);
    });

    document.querySelectorAll("[data-auth-footer-links]").forEach((container) => {
      container.hidden = false;
      container.innerHTML = `
        <a data-auth-generated="true" href="dashboard.html">Breeder Dashboard</a>
        <a data-auth-generated="true" href="add-dog.html">Add a Dog</a>
        <a data-auth-generated="true" href="edit-profile.html">Edit Profile</a>`;
    });
  }

  async function syncNavigationWithAuth() {
    const syncVersion = ++navigationSyncVersion;
    const publicLinks = document.querySelectorAll('[data-public-auth="true"]');

    // Render the public menu first. The four breeder controls are created only
    // after Supabase validates the current user and a breeder profile exists.
    clearBreederNavigation();
    publicLinks.forEach((link) => { link.hidden = false; });

    if (!client) return;

    const loggedInBreeder = await getVerifiedBreeder();
    if (syncVersion !== navigationSyncVersion || !loggedInBreeder) return;

    publicLinks.forEach((link) => { link.hidden = true; });
    addBreederNavigation();
  }

  window.Dag = Object.freeze({
    client,
    isConfigured,
    showMessage,
    clearMessage,
    money,
    escapeHtml,
    formatDate,
    requireUser,
    ensureBreederProfile,
    createUuid,
    uploadImage,
    previewImage,
    setButtonLoading,
    cleanPayPalUrl,
    revealPrivatePage,
    syncNavigationWithAuth,
  });

  syncNavigationWithAuth().catch(() => {});
  client?.auth.onAuthStateChange(() => {
    window.setTimeout(() => syncNavigationWithAuth().catch(() => {}), 0);
  });
})();
