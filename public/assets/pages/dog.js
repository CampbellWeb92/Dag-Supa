"use strict";

(async function initialiseDogListing() {
  const { client, escapeHtml, formatDate, isConfigured, money, showMessage } = window.Dag;
  const id = new URLSearchParams(window.location.search).get("id");
  const message = document.querySelector("#message");
  const content = document.querySelector("#dogContent");
  const bidForm = document.querySelector("#bidForm");
  const bidSection = document.querySelector(".bid-section");
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

  const { data: sessionData } = await client.auth.getSession();
  const currentUserId = sessionData?.session?.user?.id || null;

  const { data: dog, error } = await client
    .from("dogs")
    .select("*, breeder_profiles!dogs_breeder_id_fkey(business_name,phone,whatsapp,paypal_me_url,town,province,approval_status)")
    .eq("id", id)
    .maybeSingle();

  if (error || !dog) {
    showMessage(message, error?.message || "This dog listing could not be found.", "error");
    content.innerHTML = '<div class="empty-state">The listing is unavailable or you do not have permission to view it.</div>';
    return;
  }

  currentDog = dog;
  const breeder = dog.breeder_profiles || {};
  const isOwner = currentUserId === dog.breeder_id;
  const whatsapp = (breeder.whatsapp || breeder.phone || "").replace(/\D/g, "");
  const canBuy = !isOwner && dog.status === "available" && dog.approval_status === "approved";
  const canBid = !isOwner && ["available", "reserved"].includes(dog.status) && dog.approval_status === "approved";

  document.querySelector("#pageTitle").textContent = dog.name;
  document.querySelector("#pageSubtitle").textContent = [dog.breed, [breeder.town, breeder.province].filter(Boolean).join(", ")].filter(Boolean).join(" · ");

  content.innerHTML = `
    <div><img src="${escapeHtml(dog.main_image_url || "assets/hero.jpg")}" alt="${escapeHtml(dog.name)}" /></div>
    <div>
      <span class="status-pill">${escapeHtml(statusLabel(dog.status))}</span>
      ${isOwner ? `<span class="status-pill">Approval: ${escapeHtml(dog.approval_status || "pending")}</span>` : ""}
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
        ${canBuy ? '<button class="btn btn-paypal" type="button" id="openPayPalCheckout">Buy with PayPal</button>' : ""}
      </div>
      ${dog.status === "unavailable" ? '<p class="form-message show info">Payment is being checked by the breeder. This dog is temporarily unavailable.</p>' : ""}
      ${dog.status === "sold" ? '<p class="form-message show success">This dog has been sold.</p>' : ""}
      ${dog.status === "reserved" ? '<p class="form-message show info">This dog is currently reserved. Contact the breeder for details.</p>' : ""}
    </div>`;

  if (!canBid) {
    bidSection.hidden = true;
  } else {
    bidForm.elements.dog_id.value = dog.id;
    bidForm.elements.breeder_id.value = dog.breeder_id;
    bidForm.elements.amount.value = dog.price;
  }

  if (canBuy) {
    const openButton = document.querySelector("#openPayPalCheckout");
    openButton?.addEventListener("click", async (event) => {
      event.preventDefault();
      paypalSection.hidden = false;
      paypalSection.scrollIntoView({ behavior: "smooth", block: "start" });
      if (!paypalContainer.dataset.initialised) {
        paypalContainer.dataset.initialised = "true";
        await setupPayPal(dog, breeder);
      }
    });
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
    const clientId = String(window.DAG_PAYPAL_CLIENT_ID || "");
    paypalSummary.textContent = `Pay ${money(listing.price)} securely with PayPal.`;

    if (!clientId || /REPLACE_|YOUR-/i.test(clientId)) {
      if (breederProfile.paypal_me_url) {
        paypalContainer.innerHTML = `<a class="btn btn-paypal" target="_blank" rel="noopener" href="${escapeHtml(breederProfile.paypal_me_url)}">Buy with PayPal</a>`;
        showMessage(
          paypalMessage,
          "This opens the breeder’s PayPal.Me page. Automatic temporary-unavailable status requires the secure PayPal setup in PAYPAL-SETUP.txt.",
          "info",
        );
      } else {
        showMessage(paypalMessage, "This breeder has not connected PayPal yet.", "info");
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
          showMessage(paypalMessage, "Payment confirmed. This dog is temporarily unavailable while the breeder confirms receipt.", "success");
          paypalContainer.innerHTML = "";
          window.setTimeout(() => window.location.reload(), 1400);
        },
        onCancel: () => showMessage(paypalMessage, "Payment was cancelled. The dog remains available.", "info"),
        onError: (paypalError) => showMessage(paypalMessage, paypalError?.message || "PayPal checkout could not be completed.", "error"),
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

  function statusLabel(status = "available") {
    return status === "unavailable"
      ? "Temporarily unavailable"
      : status.charAt(0).toUpperCase() + status.slice(1);
  }
})();
