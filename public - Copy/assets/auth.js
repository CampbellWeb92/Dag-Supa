import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const hasUrl =
  Boolean(window.DAG_SUPABASE_URL) &&
  !window.DAG_SUPABASE_URL.includes("YOUR-PROJECT");
const hasKey =
  Boolean(window.DAG_SUPABASE_PUBLISHABLE_KEY) &&
  !window.DAG_SUPABASE_PUBLISHABLE_KEY.includes("YOUR-");

export const isConfigured = hasUrl && hasKey;
export const supabase = isConfigured
  ? createClient(window.DAG_SUPABASE_URL, window.DAG_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;

export function showMessage(element, text, type = "info") {
  if (!element) return;
  element.textContent = text;
  element.className = `form-message show ${type}`;
}

export function clearMessage(element) {
  if (!element) return;
  element.textContent = "";
  element.className = "form-message";
}

export function money(value) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export function escapeHtml(value = "") {
  const element = document.createElement("div");
  element.textContent = String(value);
  return element.innerHTML;
}

export function formatDate(value) {
  if (!value) return "Not supplied";
  return new Intl.DateTimeFormat("en-ZA", { dateStyle: "long" }).format(
    new Date(value),
  );
}

export async function requireUser() {
  if (!supabase) {
    window.location.href = "login.html?setup=1";
    return null;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    window.location.href = `login.html?redirect=${encodeURIComponent(location.pathname.split("/").pop() + location.search)}`;
    return null;
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    window.location.href = "login.html";
    return null;
  }

  return data.user;
}

export async function uploadImage(file, path) {
  if (!file) return null;
  if (!supabase) throw new Error("Supabase has not been connected.");

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    throw new Error("Please choose a JPG, PNG or WebP image.");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("The image must be smaller than 5 MB.");
  }

  const extension = (file.name.split(".").pop() || "jpg").toLowerCase();
  const safePath = `${path}.${extension}`;

  const { error } = await supabase.storage
    .from("dog-images")
    .upload(safePath, file, { upsert: true, contentType: file.type });

  if (error) throw error;

  return supabase.storage.from("dog-images").getPublicUrl(safePath).data
    .publicUrl;
}

export function previewImage(input, image) {
  input?.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file || !image) return;

    image.src = URL.createObjectURL(file);
    image.style.display = "block";
  });
}

export function setButtonLoading(button, isLoading, loadingText = "Saving…") {
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
