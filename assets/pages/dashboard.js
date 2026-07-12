import {
  escapeHtml,
  money,
  requireUser,
  showMessage,
  supabase,
} from "../auth.js";

const user = await requireUser();
const welcome = document.querySelector("#welcome");
const profileStatus = document.querySelector("#profileStatus");
const dogCount = document.querySelector("#dogCount");
const availableCount = document.querySelector("#availableCount");
const dogList = document.querySelector("#dogList");
const message = document.querySelector("#message");
const logoutButton = document.querySelector("#logout");

if (user) await loadDashboard();

logoutButton.addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.href = "login.html";
});

async function loadDashboard() {
  const { data: profile, error: profileError } = await supabase
    .from("breeder_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) showMessage(message, profileError.message, "error");

  welcome.textContent = profile
    ? `Welcome, ${profile.business_name}.`
    : "Complete your breeder profile.";
  profileStatus.textContent = profile?.approval_status || "Incomplete";

  const { data: dogs, error } = await supabase
    .from("dogs")
    .select("*")
    .eq("breeder_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    showMessage(message, error.message, "error");
    dogList.innerHTML =
      '<div class="empty-state">Could not load your listings.</div>';
    return;
  }

  const listings = dogs || [];
  dogCount.textContent = listings.length;
  availableCount.textContent = listings.filter(
    (dog) => dog.status === "available",
  ).length;
  renderDogs(listings);
  await loadBids();
}

async function loadBids() {
  if (!bidList) return;

  const { data: bids, error } = await supabase
    .from("bids")
    .select("*, dogs(name, breed)")
    .eq("breeder_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    bidList.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
    return;
  }

  if (!bids?.length) {
    bidList.innerHTML =
      '<div class="empty-state">No buyer bids have been received yet.</div>';
    return;
  }

  bidList.innerHTML = bids
    .map(
      (bid) => `
    <article class="dog-row bid-row">
      <div>
        <strong>${escapeHtml(bid.buyer_name)}</strong>
        <div>${escapeHtml(bid.dogs?.name || "Dog listing")} · ${money(bid.amount)}</div>
        <div>${escapeHtml(bid.buyer_email)}${bid.buyer_phone ? ` · ${escapeHtml(bid.buyer_phone)}` : ""}</div>
        ${bid.message ? `<p>${escapeHtml(bid.message)}</p>` : ""}
      </div>
      <span class="status-pill">${escapeHtml(bid.status)}</span>
    </article>
  `,
    )
    .join("");
}

function renderDogs(dogs) {
  if (!dogs.length) {
    dogList.innerHTML = `
      <div class="empty-state">
        <h3>No dogs added yet</h3>
        <p>Create your first listing to get started.</p>
        <a class="btn btn-primary" href="add-dog.html">Add a Dog</a>
      </div>
    `;
    return;
  }

  dogList.innerHTML = dogs
    .map(
      (dog) => `
    <article class="dog-row">
      <img src="${escapeHtml(dog.main_image_url || "https://placehold.co/180x140?text=Dog")}" alt="${escapeHtml(dog.name)}" />
      <div>
        <strong>${escapeHtml(dog.name)}</strong>
        <div>${escapeHtml(dog.breed)} · ${money(dog.price)}</div>
        <span class="status-pill">${escapeHtml(dog.status)}</span>
        <span class="status-pill">Approval: ${escapeHtml(dog.approval_status)}</span>
      </div>
      <div class="row-actions">
        <a class="btn btn-outline" href="edit-dog.html?id=${encodeURIComponent(dog.id)}">Edit</a>
        <a class="btn btn-primary" href="dog.html?id=${encodeURIComponent(dog.id)}">View</a>
        <button class="btn btn-danger" type="button" data-delete-dog="${escapeHtml(dog.id)}">Delete</button>
      </div>
    </article>
  `,
    )
    .join("");

  dogList.querySelectorAll("[data-delete-dog]").forEach((button) => {
    button.addEventListener("click", () => deleteDog(button.dataset.deleteDog));
  });
}

async function deleteDog(id) {
  const confirmed = window.confirm("Delete this dog listing permanently?");
  if (!confirmed) return;

  const { error } = await supabase
    .from("dogs")
    .delete()
    .eq("id", id)
    .eq("breeder_id", user.id);

  if (error) {
    showMessage(message, error.message, "error");
    return;
  }

  showMessage(message, "Dog listing deleted.", "success");
  await loadDashboard();
}
