import {
  previewImage,
  requireUser,
  setButtonLoading,
  showMessage,
  supabase,
  uploadImage,
} from "../auth.js";

const user = await requireUser();
const id = new URLSearchParams(window.location.search).get("id");
const form = document.querySelector("#dogForm");
const preview = document.querySelector("#preview");
const imageInput = document.querySelector("#mainImage");
const message = document.querySelector("#message");
let dog = null;

if (!id) window.location.href = "dashboard.html";
previewImage(imageInput, preview);
if (user && id) await loadDog();

async function loadDog() {
  const { data, error } = await supabase
    .from("dogs")
    .select("*")
    .eq("id", id)
    .eq("breeder_id", user.id)
    .single();

  if (error || !data) {
    showMessage(
      message,
      "Listing not found or you do not have permission to edit it.",
      "error",
    );
    form.querySelector('button[type="submit"]').disabled = true;
    return;
  }

  dog = data;
  const textFields = [
    "name",
    "breed",
    "sex",
    "date_of_birth",
    "colour",
    "price",
    "status",
    "health_tests",
    "bloodline",
    "description",
  ];

  textFields.forEach((fieldName) => {
    form.elements[fieldName].value = dog[fieldName] ?? "";
  });

  form.elements.registered.value = String(dog.registered);
  form.elements.vaccinated.value = String(dog.vaccinated);
  form.elements.microchipped.value = String(dog.microchipped);
  imageInput.required = false;

  if (dog.main_image_url) {
    preview.src = dog.main_image_url;
    preview.style.display = "block";
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!dog) return;

  const button = form.querySelector('button[type="submit"]');
  setButtonLoading(button, true);

  try {
    let mainImageUrl = dog.main_image_url;
    if (imageInput.files[0]) {
      mainImageUrl = await uploadImage(
        imageInput.files[0],
        `${user.id}/dogs/${id}/main`,
      );
    }

    const updates = {
      name: form.elements.name.value.trim(),
      breed: form.elements.breed.value.trim(),
      sex: form.elements.sex.value,
      date_of_birth: form.elements.date_of_birth.value || null,
      colour: form.elements.colour.value.trim(),
      price: Number(form.elements.price.value),
      status: ["unavailable", "sold"].includes(dog.status) ? dog.status : form.elements.status.value,
      registered: form.elements.registered.value === "true",
      vaccinated: form.elements.vaccinated.value === "true",
      microchipped: form.elements.microchipped.value === "true",
      health_tests: form.elements.health_tests.value.trim(),
      bloodline: form.elements.bloodline.value.trim(),
      description: form.elements.description.value.trim(),
      main_image_url: mainImageUrl,
      approval_status: "pending",
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("dogs")
      .update(updates)
      .eq("id", id)
      .eq("breeder_id", user.id);

    if (error) throw error;
    dog = { ...dog, ...updates };
    showMessage(message, "Changes saved and submitted for review.", "success");
  } catch (error) {
    showMessage(message, error.message, "error");
  } finally {
    setButtonLoading(button, false);
  }
});
