"use strict";

(async function loadLiveBreeders() {
  const { client, escapeHtml, isConfigured, showMessage } = window.Dag;
  const grid = document.querySelector("#breederGrid");
  const message = document.querySelector("#breederMessage");
  if (!grid || !isConfigured || !client) return;

  const { data: profiles, error } = await client
    .from("breeder_profiles")
    .select("user_id,business_name,town,province,breeds,description,profile_image_url,paypal_me_url")
    .eq("approval_status", "approved")
    .order("business_name");

  if (error) {
    showMessage(message, "Live breeder profiles could not be loaded. Sample profiles remain available.", "error");
    return;
  }
  if (!profiles?.length) return;

  const liveHeading = document.createElement("div");
  liveHeading.className = "full-width-list-heading";
  liveHeading.innerHTML = "<h2>Registered Dag Breeders</h2>";
  grid.before(liveHeading);

  const liveCards = profiles.map((profile) => `
    <article class="card live-breeder-card">
      <img src="${escapeHtml(profile.profile_image_url || "assets/hero.jpg")}" alt="${escapeHtml(profile.business_name)}" />
      <div class="card-body">
        <span class="badge">${escapeHtml([profile.town, profile.province].filter(Boolean).join(", ") || "South Africa")}</span>
        ${profile.paypal_me_url ? '<span class="badge">PayPal available</span>' : ""}
        <h2>${escapeHtml(profile.business_name)}</h2>
        <p>${escapeHtml(profile.breeds || profile.description || "View this breeder’s dog listings.")}</p>
        <a class="btn btn-primary" href="breeder-profile.html?id=${encodeURIComponent(profile.user_id)}">View Profile</a>
      </div>
    </article>`).join("");

  grid.insertAdjacentHTML("afterbegin", liveCards);
  showMessage(message, `${profiles.length} registered breeder profile${profiles.length === 1 ? "" : "s"} loaded.`, "success");
})();
