"use strict";

(async function initialiseDogListing() {
  const { client, escapeHtml, formatDate, isConfigured, money, showMessage } = window.Dag;
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const message = document.querySelector("#message");
  const content = document.querySelector("#dogContent");
  const bidForm = document.querySelector("#bidForm");
  const bidSection = document.querySelector("#bidOffer");
  const paypalSection = document.querySelector("#paypalCheckout");
  const paypalContainer = document.querySelector("#paypalButtonContainer");
  const paypalMessage = document.querySelector("#paypalMessage");
  const paypalSummary = document.querySelector("#paypalSummary");
  let currentDog = null;

  if (!isConfigured || !client) {
    showMessage(message, "Supabase is not configured. Check assets/supabase-config.js.", "error");
    return;
  }
  if (!id) {
    showMessage(message, "No dog listing was selected.", "error");
    return;
  }

  // Validate the session with Supabase so a stale local token cannot make a
  // public visitor look like the listing owner.
  const { data: userData } = await client.auth.getUser();
  const currentUserId = userData?.user?.id || null;

  // Load the dog and breeder separately. This avoids relying on a specific
  // generated foreign-key relationship name, which differed between older
  // Dag database versions and caused the buyer controls to disappear.
  const { data: dog, error: dogError } = await client
    .from("dogs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (dogError || !dog) {
    showMessage(message, dogError?.message || "This dog listing could not be found.", "error");
    content.innerHTML = '<div class="empty-state">The listing is unavailable or you do not have permission to view it.</div>';
    return;
  }

  const isOwner = currentUserId === dog.breeder_id;
  let breederQuery = client.from("breeder_profiles").select("*").eq("user_id", dog.breeder_id);
  if (!isOwner) breederQuery = breederQuery.eq("approval_status", "approved");
  const { data: breeder, error: breederError } = await breederQuery.maybeSingle();

  if (breederError || !breeder) {
    showMessage(
      message,
      breederError?.message || "The approved breeder profile for this listing could not be loaded.",
      "error",
    );
    content.innerHTML = '<div class="empty-state">The breeder profile is not publicly available.</div>';
    return;
  }

  currentDog = dog;
  const dogStatus = normalise(dog.status) || "available";
  const dogApproval = normalise(dog.approval_status) || "pending";
  const breederApproval = normalise(breeder.approval_status) || "pending";
  const listingIsPublic = dogApproval === "approved" && breederApproval === "approved";
  const whatsapp = (breeder.whatsapp || breeder.phone || "").replace(/\D/g, "");
  const canBuy = !isOwner && listingIsPublic && dogStatus === "available";
  const canBid = !isOwner && listingIsPublic && ["available", "reserved"].includes(dogStatus);

  document.querySelector("#pageTitle").textContent = dog.name || "Dog Listing";
  document.querySelector("#pageSubtitle").textContent = [
    dog.breed,
    [breeder.town, breeder.province].filter(Boolean).join(", "),
  ].filter(Boolean).join(" · ");

  content.innerHTML = `
    <div><img src="${escapeHtml(dog.main_image_url || "assets/hero.jpg")}" alt="${escapeHtml(dog.name)}" /></div>
    <div>
      <span class="status-pill">${escapeHtml(statusLabel(dogStatus))}</span>
      ${isOwner ? `<span class="status-pill">Approval: ${escapeHtml(dogApproval)}</span>` : ""}
      <h2>${escapeHtml(dog.name)}</h2>
      <h3>${money(dog.price)}</h3>
      <div class="detail-list">
        <div><strong>Breed</strong><br />${escapeHtml(dog.breed)}</div>
        <div><strong>Sex</strong><br />${escapeHtml(dog.sex || "Not supplied")}</div>
        <div><strong>Date of birth</strong><br />${formatDate(dog.date_of_birth)}</div>
        <div><strong>Colour</strong><br />${escapeHtml(dog.colour || "Not supplied")}</div>
        <div><strong>Vaccinated</strong><br />${dog.vaccinated ? "Yes" : "No"}</div>
        <div><strong>Microchipped</strong><br />${dog.microchipped ? "Yes" : "No"}</div>
        <div><strong>Registered</strong><br />${dog.registered ? "Yes" : "No"}</div>
      </div>
      <h3>About this dog</h3><p>${escapeHtml(dog.description || "")}</p>
      <h3>Health information</h3><p>${escapeHtml(dog.health_tests || "Ask the breeder for full records.")}</p>
      <h3>Breeder</h3><p><strong>${escapeHtml(breeder.business_name || "Dag breeder")}</strong><br />${escapeHtml([breeder.town, breeder.province].filter(Boolean).join(", "))}</p>
      <div class="form-actions">
        ${isOwner ? `<a class="btn btn-primary" href="edit-dog.html?id=${encodeURIComponent(dog.id)}">Edit Listing</a><a class="btn btn-outline" href="dashboard.html">Dashboard</a>` : ""}
        ${!isOwner && breeder.phone ? `<a class="btn btn-primary" href="tel:${escapeHtml(breeder.phone)}">Call Breeder</a>` : ""}
        ${!isOwner && whatsapp ? `<a class="btn btn-green" href="https://wa.me/${whatsapp}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
        ${canBid ? '<button class="btn btn-outline" type="button" id="openBidForm">Place a Bid</button>' : ""}
        ${canBuy ? '<button class="btn btn-paypal" type="button" id="openPayPalCheckout">Buy with PayPal</button>' : ""}
      </div>
      ${isOwner && listingIsPublic && dogStatus === "available" ? '<p class="form-message show info">This is your breeder view. Log out or use a private/incognito window to see the public Place a Bid and Buy with PayPal controls.</p>' : ""}
      ${dogStatus === "unavailable" ? '<p class="form-message show info">Payment is being checked by the breeder. This dog is temporarily unavailable.</p>' : ""}
      ${dogStatus === "sold" ? '<p class="form-message show success">This dog has been sold.</p>' : ""}
      ${dogStatus === "reserved" ? '<p class="form-message show info">This dog is currently reserved. Buyers may still send a bid or contact the breeder.</p>' : ""}
      ${!isOwner && !listingIsPublic ? '<p class="form-message show info">Buyer actions are available only after both the breeder and dog listing are approved.</p>' : ""}
    </div>`;

  if (canBid) {
    bidSection.hidden = false;
    bidForm.elements.dog_id.value = dog.id;
    bidForm.elements.breeder_id.value = dog.breeder_id;
    bidForm.elements.amount.value = dog.price;

    document.querySelector("#openBidForm")?.addEventListener("click", (event) => {
      event.preventDefault();
      bidSection.scrollIntoView({ behavior: "smooth", block: "start" });
      bidForm.elements.buyer_name?.focus({ preventScroll: true });
    });

    if (params.get("bid") === "1" || window.location.hash === "#bidOffer") {
      window.setTimeout(() => bidSection.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
    }
  } else {
    bidSection.hidden = true;
  }

  if (canBuy) {
    const openCheckout = async () => {
      paypalSection.hidden = false;
      paypalSection.scrollIntoView({ behavior: "smooth", block: "start" });
      if (!paypalContainer.dataset.initialised) {
        paypalContainer.dataset.initialised = "true";
        await setupPayPal(dog, breeder);
      }
    };

    document.querySelector("#openPayPalCheckout")?.addEventListener("click", async (event) => {
      event.preventDefault();
      await openCheckout();
    });

    if (params.get("checkout") === "1" || window.location.hash === "#paypalCheckout") {
      window.setTimeout(() => openCheckout(), 0);
    }
  } else {
    paypalSection.hidden = true;
  }

  bidForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentDog || !canBid) return;

    const bidMessage = document.querySelector("#bidMessage");
    const button = bidForm.querySelector('button[type="submit"]');
    button.disabled = true;

    const amount = Number(bidForm.elements.amount.value);
    if (!Number.isFinite(amount) || amount <= 0) {
      showMessage(bidMessage, "Enter a valid bid amount.", "error");
      button.disabled = false;
      return;
    }

    const { error: bidError } = await client.from("bids").insert({
      dog_id: bidForm.elements.dog_id.value,
      breeder_id: bidForm.elements.breeder_id.value,
      buyer_name: bidForm.elements.buyer_name.value.trim(),
      buyer_email: bidForm.elements.buyer_email.value.trim(),
      buyer_phone: bidForm.elements.buyer_phone.value.trim() || null,
      amount,
      message: bidForm.elements.bid_message.value.trim() || null,
    });

    button.disabled = false;
    if (bidError) {
      showMessage(bidMessage, bidError.message, "error");
      return;
    }

    bidForm.reset();
    bidForm.elements.dog_id.value = dog.id;
    bidForm.elements.breeder_id.value = dog.breeder_id;
    bidForm.elements.amount.value = dog.price;
    showMessage(bidMessage, "Your bid was sent to the breeder.", "success");
  });

  async function setupPayPal(listing, breederProfile) {
    const clientId = String(window.DAG_PAYPAL_CLIENT_ID || "").trim();
    paypalSummary.textContent = `Pay ${money(listing.price)} securely with PayPal.`;
    paypalContainer.replaceChildren();

    // When the marketplace checkout is not configured, use the approved
    // breeder's saved public PayPal.Me URL instead of removing the buy option.
    if (!clientId || /REPLACE_|YOUR-/i.test(clientId)) {
      if (breederProfile.paypal_me_url) {
        const link = document.createElement("a");
        link.className = "btn btn-paypal";
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.href = breederProfile.paypal_me_url;
        link.textContent = "Buy with PayPal";
        paypalContainer.append(link);
        showMessage(
          paypalMessage,
          "You are opening this approved breeder’s PayPal.Me page. The breeder must confirm receipt before marking the dog sold.",
          "info",
        );
      } else {
        showMessage(
          paypalMessage,
          "This approved breeder has not saved a PayPal.Me link yet. Please contact the breeder or place a bid.",
          "info",
        );
      }
      return;
    }

    try {
      await loadPayPalSdk(clientId);
      if (!window.paypal?.Buttons) throw new Error("PayPal checkout did not load correctly.");

      await window.paypal.Buttons({
        style: { layout: "vertical", shape: "rect", label: "paypal" },
        createOrder: async () => {
          showMessage(paypalMessage, "Creating secure checkout…", "info");
          const { data, error: invokeError } = await client.functions.invoke("create-paypal-order", {
            body: { dogId: listing.id },
          });
          if (invokeError || !data?.orderId) {
            throw new Error(data?.error || invokeError?.message || "Could not create the PayPal order.");
          }
          return data.orderId;
        },
        onApprove: async (details) => {
          showMessage(paypalMessage, "Confirming your payment…", "info");
          const { data, error: captureError } = await client.functions.invoke("capture-paypal-order", {
            body: { orderId: details.orderID, dogId: listing.id },
          });
          if (captureError || !data?.success) {
            throw new Error(data?.error || captureError?.message || "PayPal payment could not be confirmed.");
          }
          showMessage(
            paypalMessage,
            "Payment confirmed. This dog is temporarily unavailable while the breeder confirms receipt.",
            "success",
          );
          paypalContainer.replaceChildren();
          window.setTimeout(() => window.location.reload(), 1400);
        },
        onCancel: () => showMessage(paypalMessage, "Payment was cancelled. The dog remains available.", "info"),
        onError: (paypalError) => showMessage(
          paypalMessage,
          paypalError?.message || "PayPal checkout could not be completed.",
          "error",
        ),
      }).render(paypalContainer);
    } catch (paypalError) {
      showMessage(paypalMessage, paypalError.message, "error");
    }
  }

  function loadPayPalSdk(clientId) {
    if (window.paypal) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-dag-paypal-sdk]');
      if (existing) {
        if (existing.dataset.loaded === "true") return resolve();
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", () => reject(new Error("PayPal SDK failed to load.")), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.dataset.dagPaypalSdk = "true";
      script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=ZAR&intent=capture`;
      script.onload = () => {
        script.dataset.loaded = "true";
        resolve();
      };
      script.onerror = () => reject(new Error("PayPal SDK failed to load."));
      document.head.appendChild(script);
    });
  }

  function normalise(value) {
    return String(value || "").trim().toLowerCase();
  }

  function statusLabel(status = "available") {
    return status === "unavailable"
      ? "Temporarily unavailable"
      : status.charAt(0).toUpperCase() + status.slice(1);
  }
})();
