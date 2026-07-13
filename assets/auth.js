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

  async function requireUser() {
    if (!client) {
      window.location.href = "login.html?setup=1";
      return null;
    }

    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError || !sessionData?.session?.user) {
      const redirect = encodeURIComponent(currentPageWithQuery());
      window.location.href = `login.html?redirect=${redirect}`;
      return null;
    }

    return sessionData.session.user;
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
      return url.toString();
    } catch {
      throw new Error("Please enter a valid PayPal.Me link, such as https://paypal.me/YourName");
    }
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
  });
})();
