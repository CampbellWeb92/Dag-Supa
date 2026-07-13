import { escapeHtml, isConfigured, showMessage, supabase } from "../auth.js";

const grid = document.querySelector("#breederGrid");
const message = document.querySelector("#breederMessage");

if (isConfigured) loadLiveBreeders();

async function loadLiveBreeders() {
  const { data: profiles, error } = await supabase
    .from("breeder_profiles")
    .select(
      "user_id,business_name,town,province,breeds,description,profile_image_url",
    )
    .eq("approval_status", "approved")
    .order("business_name");

  if (error) {
    showMessage(
      message,
      "Live breeder profiles could not be loaded. The sample profiles are still available.",
      "error",
    );
    return;
  }

  if (!profiles?.length) return;

  const liveCards = profiles
    .map(
      (profile) => `
    <article class="card">
      <img
        src="${escapeHtml(profile.profile_image_url || "https://placehold.co/900x650?text=Breeder")}"
        alt="${escapeHtml(profile.business_name)}"
      />
      <div class="card-body">
        <span class="badge">${escapeHtml(profile.town || "")}, ${escapeHtml(profile.province || "")}</span>
        <h2>${escapeHtml(profile.business_name)}</h2>
        <p>${escapeHtml(profile.breeds || profile.description || "View this breeder’s available dogs.")}</p>
        <a class="btn btn-primary" href="breeder-profile.html?id=${encodeURIComponent(profile.user_id)}">View Profile</a>
      </div>
    </article>
  `,
    )
    .join("");

  grid.insertAdjacentHTML("afterbegin", liveCards);
}
