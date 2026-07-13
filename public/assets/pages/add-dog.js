import {
  previewImage,
  requireUser,
  setButtonLoading,
  showMessage,
  supabase,
  uploadImage,
} from "../auth.js";

const user = await requireUser();
const form = document.querySelector("#dogForm");
const preview = document.querySelector("#preview");
const imageInput = document.querySelector("#mainImage");
const message = document.querySelector("#message");

previewImage(imageInput, preview);

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = form.querySelector('button[type="submit"]');
  setButtonLoading(button, true, "Submitting…");

  try {
    const dogId = crypto.randomUUID();
    const mainImageUrl = await uploadImage(
      imageInput.files[0],
      `${user.id}/dogs/${dogId}/main`,
    );

    const row = getDogValues(form);
    row.id = dogId;
    row.breeder_id = user.id;
    row.main_image_url = mainImageUrl;
    row.approval_status = "pending";

    const { error } = await supabase.from("dogs").insert(row);
    if (error) throw error;

    form.reset();
    preview.removeAttribute("src");
    preview.style.display = "none";
    showMessage(
      message,
      "Dog submitted successfully and is waiting for approval.",
      "success",
    );
  } catch (error) {
    showMessage(message, error.message, "error");
  } finally {
    setButtonLoading(button, false);
  }
});

function getDogValues(dogForm) {
  return {
    name: dogForm.elements.name.value.trim(),
    breed: dogForm.elements.breed.value.trim(),
    sex: dogForm.elements.sex.value,
    date_of_birth: dogForm.elements.date_of_birth.value || null,
    colour: dogForm.elements.colour.value.trim(),
    price: Number(dogForm.elements.price.value),
    status: dogForm.elements.status.value,
    registered: dogForm.elements.registered.value === "true",
    vaccinated: dogForm.elements.vaccinated.value === "true",
    microchipped: dogForm.elements.microchipped.value === "true",
    health_tests: dogForm.elements.health_tests.value.trim(),
    bloodline: dogForm.elements.bloodline.value.trim(),
    description: dogForm.elements.description.value.trim(),
  };
}
