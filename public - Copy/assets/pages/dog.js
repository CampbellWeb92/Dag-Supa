import {
  escapeHtml,
  formatDate,
  isConfigured,
  money,
  showMessage,
  supabase,
} from "../auth.js";

const id = new URLSearchParams(window.location.search).get("id");
const message = document.querySelector("#message");
const content = document.querySelector("#dogContent");
const bidForm = document.querySelector("#bidForm");
const paypalSection = document.querySelector("#paypalCheckout");
const paypalContainer = document.querySelector("#paypalButtonContainer");
const paypalMessage = document.querySelector("#paypalMessage");
const paypalSummary = document.querySelector("#paypalSummary");
let currentDog = null;

if (!isConfigured) {
  showMessage(message, "This page will display live listings after Supabase is connected.", "info");
} else if (!id) {
  showMessage(message, "No dog listing was selected.", "error");
} else {
  await loadDog();
}

async function loadDog() {
  const { data: dog, error } = await supabase
    .from("dogs")
    .select("*, breeder_profiles!dogs_breeder_id_fkey(business_name,phone,whatsapp,town,province)")
    .eq("id", id)
    .single();

  if (error || !dog) {
    showMessage(message, "This dog listing could not be found.", "error");
    return;
  }

  currentDog = dog;
  const breeder = dog.breeder_profiles || {};
  const whatsapp = (breeder.whatsapp || breeder.phone || "").replace(/\D/g, "");
  const canBuy = dog.status === "available" && dog.approval_status === "approved";

  document.querySelector("#pageTitle").textContent = dog.name;
  document.querySelector("#pageSubtitle").textContent = `${dog.breed} · ${breeder.town || ""}, ${breeder.province || ""}`;

  content.innerHTML = `
    <div><img src="${escapeHtml(dog.main_image_url || "https://placehold.co/900x700?text=Dog")}" alt="${escapeHtml(dog.name)}" /></div>
    <div>
      <span class="status-pill">${escapeHtml(statusLabel(dog.status))}</span>
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
      <h3>Breeder</h3><p><strong>${escapeHtml(breeder.business_name || "Dag breeder")}</strong><br />${escapeHtml(breeder.town || "")}, ${escapeHtml(breeder.province || "")}</p>
      <div class="form-actions">
        ${breeder.phone ? `<a class="btn btn-primary" href="tel:${escapeHtml(breeder.phone)}">Call Breeder</a>` : ""}
        ${whatsapp ? `<a class="btn btn-green" href="https://wa.me/${whatsapp}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
        ${canBuy ? `<button class="btn btn-paypal" type="button" id="openPayPalCheckout">Buy with PayPal</button>` : ""}
      </div>
      ${dog.status === "unavailable" ? '<p class="form-message info">Payment is being checked by the breeder. This dog is temporarily unavailable.</p>' : ""}
      ${dog.status === "sold" ? '<p class="form-message success">This dog has been sold.</p>' : ""}
    </div>`;

  bidForm.elements.dog_id.value = dog.id;
  bidForm.elements.breeder_id.value = dog.breeder_id;
  bidForm.elements.amount.value = dog.price;

  if (canBuy) {
    await setupPayPal(dog);
    const openPayPalButton = document.querySelector("#openPayPalCheckout");
    openPayPalButton?.addEventListener("click", (event) => {
      event.preventDefault();
      paypalSection.hidden = false;
      paypalSection.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
}

async function setupPayPal(dog) {
  const clientId = window.DAG_PAYPAL_CLIENT_ID || "";
  paypalSection.hidden = false;
  paypalSummary.textContent = `Pay ${money(dog.price)} securely with PayPal.`;

  if (!clientId || clientId.includes("REPLACE_")) {
    showMessage(paypalMessage, "PayPal is not connected yet. Add the PayPal Client ID in assets/supabase-config.js.", "info");
    return;
  }

  try {
    await loadPayPalSdk(clientId);
    window.paypal.Buttons({
      style: { layout: "vertical", shape: "rect", label: "paypal" },
      createOrder: async () => {
        showMessage(paypalMessage, "Creating secure checkout…", "info");
        const { data, error } = await supabase.functions.invoke("create-paypal-order", { body: { dogId: dog.id } });
        if (error || !data?.orderId) throw new Error(data?.error || error?.message || "Could not create the PayPal order.");
        return data.orderId;
      },
      onApprove: async (details) => {
        showMessage(paypalMessage, "Confirming your payment…", "info");
        const { data, error } = await supabase.functions.invoke("capture-paypal-order", { body: { orderId: details.orderID, dogId: dog.id } });
        if (error || !data?.success) throw new Error(data?.error || error?.message || "PayPal payment could not be confirmed.");
        showMessage(paypalMessage, "Payment confirmed. This dog is temporarily unavailable while the breeder confirms receipt.", "success");
        paypalContainer.innerHTML = "";
        setTimeout(() => window.location.reload(), 1800);
      },
      onCancel: () => showMessage(paypalMessage, "Payment was cancelled. The dog remains available.", "info"),
      onError: (error) => showMessage(paypalMessage, error?.message || "PayPal checkout could not be completed.", "error"),
    }).render(paypalContainer);
  } catch (error) {
    showMessage(paypalMessage, error.message, "error");
  }
}

function loadPayPalSdk(clientId) {
  if (window.paypal) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-dag-paypal-sdk]');
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", () => reject(new Error("PayPal SDK failed to load.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.dataset.dagPaypalSdk = "true";
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=ZAR&intent=capture`;
    script.onload = resolve;
    script.onerror = () => reject(new Error("PayPal SDK failed to load."));
    document.head.appendChild(script);
  });
}

function statusLabel(status) {
  return status === "unavailable" ? "Temporarily unavailable" : status.charAt(0).toUpperCase() + status.slice(1);
}

bidForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentDog || currentDog.status === "sold") return;
  const { error } = await supabase.from("bids").insert({
    dog_id: bidForm.elements.dog_id.value,
    breeder_id: bidForm.elements.breeder_id.value,
    buyer_name: bidForm.elements.buyer_name.value.trim(),
    buyer_email: bidForm.elements.buyer_email.value.trim(),
    buyer_phone: bidForm.elements.buyer_phone.value.trim(),
    amount: Number(bidForm.elements.amount.value),
    message: bidForm.elements.bid_message.value.trim(),
  });
  if (error) return showMessage(document.querySelector("#bidMessage"), error.message, "error");
  bidForm.reset();
  showMessage(document.querySelector("#bidMessage"), "Your bid was sent to the breeder.", "success");
});
