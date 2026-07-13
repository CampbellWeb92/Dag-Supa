"use strict";

(async function initialiseDashboard() {
  const {
    client,
    ensureBreederProfile,
    escapeHtml,
    money,
    requireUser,
    showMessage,
  } = window.Dag;

  const welcome = document.querySelector("#welcome");
  const profileStatus = document.querySelector("#profileStatus");
  const dogCount = document.querySelector("#dogCount");
  const availableCount = document.querySelector("#availableCount");
  const dogList = document.querySelector("#dogList");
  const bidList = document.querySelector("#bidList");
  const message = document.querySelector("#message");
  const logoutButton = document.querySelector("#logout");
  const viewProfileLink = document.querySelector("#viewProfileLink");
  const refreshButton = document.querySelector("#refreshListings");

  const user = await requireUser();
  if (!user) return;

  if (viewProfileLink) {
    viewProfileLink.href = `breeder-profile.html?id=${encodeURIComponent(user.id)}`;
  }

  logoutButton?.addEventListener("click", async () => {
    logoutButton.disabled = true;
    await client.auth.signOut();
    window.location.replace("login.html");
  });
  refreshButton?.addEventListener("click", loadDashboard);

  await loadDashboard();

  async function loadDashboard() {
    showMessage(message, "Loading your breeder profile and listings…", "info");
    if (refreshButton) refreshButton.disabled = true;

    try {
      const profile = await ensureBreederProfile(user);
      welcome.textContent = `Welcome, ${profile.business_name || profile.contact_name || "breeder"}.`;
      profileStatus.textContent = profile.approval_status || "pending";

      const { data: dogs, error: dogError } = await client
        .from("dogs")
        .select("*")
        .eq("breeder_id", user.id)
        .order("created_at", { ascending: false });
      if (dogError) throw dogError;

      const listings = dogs || [];
      dogCount.textContent = String(listings.length);
      availableCount.textContent = String(listings.filter((dog) => dog.status === "available").length);
      renderDogs(listings);
      await loadBids();
      showMessage(message, listings.length ? `${listings.length} listing${listings.length === 1 ? "" : "s"} loaded.` : "No listings yet. Add your first dog below.", "success");
    } catch (error) {
      dogList.innerHTML = `
        <div class="empty-state">
          <h3>Your listings could not be loaded</h3>
          <p>${escapeHtml(error?.message || "Unknown database error")}</p>
          <p>Run <strong>supabase/DATABASE-REPAIR.sql</strong> in Supabase, then refresh this page.</p>
        </div>`;
      showMessage(message, error?.message || "The dashboard could not be loaded.", "error");
    } finally {
      if (refreshButton) refreshButton.disabled = false;
    }
  }

  async function loadBids() {
    if (!bidList) return;
    const { data: bids, error } = await client
      .from("bids")
      .select("*, dogs(name, breed)")
      .eq("breeder_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      bidList.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
      return;
    }
    if (!bids?.length) {
      bidList.innerHTML = '<div class="empty-state">No buyer bids have been received yet.</div>';
      return;
    }

    bidList.innerHTML = bids.map((bid) => `
      <article class="dog-row bid-row">
        <div>
          <strong>${escapeHtml(bid.buyer_name)}</strong>
          <div>${escapeHtml(bid.dogs?.name || "Dog listing")} · ${money(bid.amount)}</div>
          <div>${escapeHtml(bid.buyer_email)}${bid.buyer_phone ? ` · ${escapeHtml(bid.buyer_phone)}` : ""}</div>
          ${bid.message ? `<p>${escapeHtml(bid.message)}</p>` : ""}
        </div>
        <span class="status-pill">${escapeHtml(bid.status)}</span>
      </article>`).join("");
  }

  function renderDogs(dogs) {
    if (!dogs.length) {
      dogList.innerHTML = `
        <div class="empty-state">
          <h3>No dogs added yet</h3>
          <p>Create your first listing to get started.</p>
          <a class="btn btn-primary" href="add-dog.html">Add a Dog</a>
        </div>`;
      return;
    }

    dogList.innerHTML = dogs.map((dog) => `
      <article class="dog-row">
        <img src="${escapeHtml(dog.main_image_url || "assets/hero.jpg")}" alt="${escapeHtml(dog.name)}" />
        <div>
          <strong>${escapeHtml(dog.name)}</strong>
          <div>${escapeHtml(dog.breed)} · ${money(dog.price)}</div>
          <span class="status-pill">${escapeHtml(statusLabel(dog.status))}</span>
          <span class="status-pill">Approval: ${escapeHtml(dog.approval_status || "pending")}</span>
        </div>
        <div class="row-actions">
          <a class="btn btn-outline" href="edit-dog.html?id=${encodeURIComponent(dog.id)}">Edit</a>
          <a class="btn btn-primary" href="dog.html?id=${encodeURIComponent(dog.id)}">View</a>
          ${dog.status === "unavailable" ? `
            <button class="btn btn-green" type="button" data-confirm-sold="${escapeHtml(dog.id)}">Confirm Sold</button>
            <button class="btn btn-outline" type="button" data-release-dog="${escapeHtml(dog.id)}">Make Available Again</button>` : ""}
          <button class="btn btn-danger" type="button" data-delete-dog="${escapeHtml(dog.id)}">Delete</button>
        </div>
      </article>`).join("");

    dogList.querySelectorAll("[data-delete-dog]").forEach((button) => {
      button.addEventListener("click", () => deleteDog(button.dataset.deleteDog));
    });
    dogList.querySelectorAll("[data-confirm-sold]").forEach((button) => {
      button.addEventListener("click", () => confirmDogSold(button.dataset.confirmSold));
    });
    dogList.querySelectorAll("[data-release-dog]").forEach((button) => {
      button.addEventListener("click", () => releaseDog(button.dataset.releaseDog));
    });
  }

  async function deleteDog(id) {
    if (!window.confirm("Delete this dog listing permanently?")) return;
    const { error } = await client.from("dogs").delete().eq("id", id).eq("breeder_id", user.id);
    if (error) return showMessage(message, error.message, "error");
    showMessage(message, "Dog listing deleted.", "success");
    await loadDashboard();
  }

  async function confirmDogSold(id) {
    if (!window.confirm("Confirm that the payment was received and mark this dog as sold?")) return;
    const { data, error } = await client
      .from("dogs")
      .update({ status: "sold", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("breeder_id", user.id)
      .eq("status", "unavailable")
      .select("id");
    if (error) return showMessage(message, error.message, "error");
    if (!data?.length) return showMessage(message, "This dog was not temporarily unavailable, so it was not marked sold.", "error");
    showMessage(message, "The dog has been marked as sold.", "success");
    await loadDashboard();
  }

  async function releaseDog(id) {
    if (!window.confirm("Make this dog available for purchase again?")) return;
    const { data, error } = await client
      .from("dogs")
      .update({
        status: "available",
        paypal_order_id: null,
        paypal_capture_id: null,
        payment_received_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("breeder_id", user.id)
      .eq("status", "unavailable")
      .select("id");
    if (error) return showMessage(message, error.message, "error");
    if (!data?.length) return showMessage(message, "This dog is not currently unavailable.", "error");
    showMessage(message, "The dog is available again.", "success");
    await loadDashboard();
  }

  function statusLabel(status = "available") {
    return status === "unavailable"
      ? "Temporarily unavailable"
      : status.charAt(0).toUpperCase() + status.slice(1);
  }
})();
