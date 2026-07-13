import {
  escapeHtml,
  isConfigured,
  money,
  showMessage,
  supabase,
} from "../auth.js";

const id = new URLSearchParams(window.location.search).get("id");
const message = document.querySelector("#message");
const profileContent = document.querySelector("#profileContent");
const dogGrid = document.querySelector("#dogGrid");

if (!isConfigured) {
  showMessage(
    message,
    "Connect Supabase to display live breeder profiles.",
    "info",
  );
} else if (!id) {
  showMessage(message, "No breeder was selected.", "error");
} else {
  await loadProfile();
}

async function loadProfile() {
  const { data: profile, error: profileError } = await supabase
    .from("breeder_profiles")
    .select("*")
    .eq("user_id", id)
    .eq("approval_status", "approved")
    .single();

  if (profileError || !profile) {
    showMessage(message, "This breeder profile could not be found.", "error");
    return;
  }

  document.querySelector("#pageTitle").textContent = profile.business_name;
  document.querySelector("#pageSubtitle").textContent =
    `${profile.town || ""}, ${profile.province || ""}`;

  const whatsapp = (profile.whatsapp || profile.phone || "").replace(/\D/g, "");
  profileContent.innerHTML = `
    <div>
      <span class="badge">Approved breeder</span>
      <h2>${escapeHtml(profile.business_name)}</h2>
      <p>${escapeHtml(profile.description || "Contact this breeder for more information.")}</p>
      <p><strong>Breeds:</strong> ${escapeHtml(profile.breeds || "Not supplied")}</p>
      <p><strong>Location:</strong> ${escapeHtml(profile.town || "")}, ${escapeHtml(profile.province || "")}</p>
      <div class="button-row">
        ${profile.phone ? `<a class="btn btn-primary" href="tel:${escapeHtml(profile.phone)}">Call Breeder</a>` : ""}
        ${whatsapp ? `<a class="btn btn-green" href="https://wa.me/${whatsapp}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
      </div>
    </div>
    <img src="${escapeHtml(profile.profile_image_url || "https://placehold.co/900x650?text=Breeder")}" alt="${escapeHtml(profile.business_name)}" />
  `;

  const { data: dogs, error: dogsError } = await supabase
    .from("dogs")
    .select("*")
    .eq("breeder_id", id)
    .eq("approval_status", "approved")
    .order("created_at", { ascending: false });

  if (dogsError) {
    showMessage(message, dogsError.message, "error");
    return;
  }

  dogGrid.innerHTML = dogs?.length
    ? dogs
        .map(
          (dog) => `
      <article class="card dog-card">
        <img src="${escapeHtml(dog.main_image_url || "https://placehold.co/900x650?text=Dog")}" alt="${escapeHtml(dog.name)}" />
        <div class="card-body">
          <span class="badge">${escapeHtml(dog.status)}</span>
          <h3>${escapeHtml(dog.name)}</h3>
          <p>${escapeHtml(dog.breed)}</p>
          <div class="price">${money(dog.price)}</div>
          <a class="btn btn-primary" href="dog.html?id=${encodeURIComponent(dog.id)}">View Dog</a>
        </div>
      </article>
    `,
        )
        .join("")
    : '<div class="empty-state"><p>No approved dogs are listed yet.</p></div>';
}
