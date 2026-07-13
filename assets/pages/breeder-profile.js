"use strict";

(async function initialiseBreederProfile() {
  const { client, escapeHtml, isConfigured, money, showMessage } = window.Dag;
  const id = new URLSearchParams(window.location.search).get("id");
  const message = document.querySelector("#message");
  const profileContent = document.querySelector("#profileContent");
  const dogGrid = document.querySelector("#dogGrid");
  const dogsHeading = document.querySelector("#dogsHeading");
  const dogsDescription = document.querySelector("#dogsDescription");

  if (!isConfigured || !client) {
    showMessage(message, "Supabase is not configured. Check assets/supabase-config.js.", "error");
    return;
  }
  if (!id) {
    showMessage(message, "No breeder was selected.", "error");
    return;
  }

  // Validate the user with Supabase rather than trusting a cached browser session.
  const { data: userData } = await client.auth.getUser();
  const currentUserId = userData?.user?.id || null;
  const isOwner = currentUserId === id;

  let profileQuery = client.from("breeder_profiles").select("*").eq("user_id", id);
  if (!isOwner) profileQuery = profileQuery.eq("approval_status", "approved");
  const { data: profile, error: profileError } = await profileQuery.maybeSingle();

  if (profileError || !profile) {
    showMessage(
      message,
      isOwner
        ? profileError?.message || "Your breeder profile could not be loaded."
        : "This breeder profile is not publicly available.",
      "error",
    );
    return;
  }

  const profileApproval = normalise(profile.approval_status);
  const profileApproved = profileApproval === "approved";

  document.querySelector("#pageTitle").textContent = profile.business_name || "Breeder Profile";
  document.querySelector("#pageSubtitle").textContent =
    [profile.town, profile.province].filter(Boolean).join(", ") || "Breeder information";

  if (isOwner) {
    dogsHeading.textContent = "My Dog Listings";
    dogsDescription.textContent = "All of your listings appear here, including pending and rejected listings.";
  }

  const whatsapp = (profile.whatsapp || profile.phone || "").replace(/\D/g, "");
  profileContent.innerHTML = `
    <div>
      <span class="badge">${isOwner ? `Profile: ${escapeHtml(profileApproval || "pending")}` : "Approved breeder"}</span>
      <h2>${escapeHtml(profile.business_name || "Breeder")}</h2>
      <p>${escapeHtml(profile.description || "Contact this breeder for more information.")}</p>
      <p><strong>Breeds:</strong> ${escapeHtml(profile.breeds || "Not supplied")}</p>
      <p><strong>Location:</strong> ${escapeHtml([profile.town, profile.province].filter(Boolean).join(", ") || "Not supplied")}</p>
      ${!isOwner && profile.paypal_me_url ? '<p><span class="badge">PayPal payments available</span></p>' : ""}
      <div class="button-row">
        ${isOwner ? '<a class="btn btn-outline" href="edit-profile.html">Edit Profile</a><a class="btn btn-primary" href="add-dog.html">Add a Dog</a><a class="btn btn-outline" href="dashboard.html">Dashboard</a>' : ""}
        ${!isOwner && profile.phone ? `<a class="btn btn-primary" href="tel:${escapeHtml(profile.phone)}">Call Breeder</a>` : ""}
        ${!isOwner && whatsapp ? `<a class="btn btn-green" href="https://wa.me/${whatsapp}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
      </div>
    </div>
    <img src="${escapeHtml(profile.profile_image_url || "assets/hero.jpg")}" alt="${escapeHtml(profile.business_name || "Breeder")}" />`;

  let dogQuery = client.from("dogs").select("*").eq("breeder_id", id);
  if (!isOwner) dogQuery = dogQuery.eq("approval_status", "approved");
  const { data: dogs, error: dogsError } = await dogQuery.order("created_at", { ascending: false });

  if (dogsError) {
    showMessage(message, dogsError.message, "error");
    dogGrid.innerHTML = '<div class="empty-state">The dog listings could not be loaded.</div>';
    return;
  }

  const visibleDogs = isOwner
    ? dogs || []
    : (dogs || []).filter((dog) => normalise(dog.status) !== "sold");

  dogGrid.innerHTML = visibleDogs.length
    ? visibleDogs.map((dog) => {
      const status = normalise(dog.status) || "available";
      const approval = normalise(dog.approval_status) || "pending";
      const publicApproved = profileApproved && approval === "approved";
      const canBid = !isOwner && publicApproved && ["available", "reserved"].includes(status);
      const canBuy = !isOwner && publicApproved && status === "available";
      const dogUrl = `dog.html?id=${encodeURIComponent(dog.id)}`;

      return `
        <article class="card dog-card">
          <img src="${escapeHtml(dog.main_image_url || "assets/hero.jpg")}" alt="${escapeHtml(dog.name)}" />
          <div class="card-body">
            <span class="badge">${escapeHtml(statusLabel(status))}</span>
            ${isOwner ? `<span class="badge">Approval: ${escapeHtml(approval)}</span>` : ""}
            <h3>${escapeHtml(dog.name)}</h3>
            <p>${escapeHtml(dog.breed)}</p>
            <div class="price">${money(dog.price)}</div>
            <div class="button-row">
              <a class="btn btn-primary" href="${dogUrl}">View Dog</a>
              ${canBid ? `<a class="btn btn-outline" href="${dogUrl}&bid=1#bidOffer">Place a Bid</a>` : ""}
              ${canBuy ? `<a class="btn btn-paypal" href="${dogUrl}&checkout=1#paypalCheckout">Buy with PayPal</a>` : ""}
              ${isOwner ? `<a class="btn btn-outline" href="edit-dog.html?id=${encodeURIComponent(dog.id)}">Edit</a>` : ""}
            </div>
          </div>
        </article>`;
    }).join("")
    : `<div class="empty-state"><p>${isOwner ? "You have no dog listings yet." : "No approved dogs are currently available."}</p>${isOwner ? '<a class="btn btn-primary" href="add-dog.html">Add a Dog</a>' : ""}</div>`;

  function normalise(value) {
    return String(value || "").trim().toLowerCase();
  }

  function statusLabel(status = "available") {
    return status === "unavailable"
      ? "Temporarily unavailable"
      : status.charAt(0).toUpperCase() + status.slice(1);
  }
})();
