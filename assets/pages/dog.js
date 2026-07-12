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

if (!isConfigured) {
  showMessage(
    message,
    "This page will display live listings after Supabase is connected.",
    "info",
  );
} else if (!id) {
  showMessage(message, "No dog listing was selected.", "error");
} else {
  await loadDog();
}

async function loadDog() {
  const { data: dog, error } = await supabase
    .from("dogs")
    .select(
      "*, breeder_profiles!dogs_breeder_id_fkey(business_name,phone,whatsapp,town,province)",
    )
    .eq("id", id)
    .single();

  if (error || !dog) {
    showMessage(message, "This dog listing could not be found.", "error");
    return;
  }

  const breeder = dog.breeder_profiles || {};
  const whatsapp = (breeder.whatsapp || breeder.phone || "").replace(/\D/g, "");

  document.querySelector("#pageTitle").textContent = dog.name;
  document.querySelector("#pageSubtitle").textContent =
    `${dog.breed} · ${breeder.town || ""}, ${breeder.province || ""}`;

  content.innerHTML = `
    <div>
      <img src="${escapeHtml(dog.main_image_url || "https://placehold.co/900x700?text=Dog")}" alt="${escapeHtml(dog.name)}" />
    </div>
    <div>
      <span class="status-pill">${escapeHtml(dog.status)}</span>
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

      <h3>About this dog</h3>
      <p>${escapeHtml(dog.description || "")}</p>

      <h3>Health information</h3>
      <p>${escapeHtml(dog.health_tests || "Ask the breeder for full records.")}</p>

      <h3>Breeder</h3>
      <p><strong>${escapeHtml(breeder.business_name || "Dag breeder")}</strong><br />${escapeHtml(breeder.town || "")}, ${escapeHtml(breeder.province || "")}</p>

      <div class="form-actions">
        ${breeder.phone ? `<a class="btn btn-primary" href="tel:${escapeHtml(breeder.phone)}">Call Breeder</a>` : ""}
        ${whatsapp ? `<a class="btn btn-green" href="https://wa.me/${whatsapp}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
      </div>
    </div>
  `;

  bidForm.elements.dog_id.value = dog.id;
  bidForm.elements.breeder_id.value = dog.breeder_id;
  bidForm.elements.amount.value = dog.price;
}

bidForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const { error } = await supabase.from("bids").insert({
    dog_id: bidForm.elements.dog_id.value,
    breeder_id: bidForm.elements.breeder_id.value,
    buyer_name: bidForm.elements.buyer_name.value.trim(),
    buyer_email: bidForm.elements.buyer_email.value.trim(),
    buyer_phone: bidForm.elements.buyer_phone.value.trim(),
    amount: Number(bidForm.elements.amount.value),
    message: bidForm.elements.bid_message.value.trim(),
  });

  if (error) {
    showMessage(document.querySelector("#bidMessage"), error.message, "error");
    return;
  }

  bidForm.reset();
  showMessage(
    document.querySelector("#bidMessage"),
    "Your bid was sent to the breeder.",
    "success",
  );
});
