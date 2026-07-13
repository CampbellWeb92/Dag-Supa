"use strict";

(async function initialiseEditDog() {
  const { client, previewImage, requireUser, setButtonLoading, showMessage, uploadImage } = window.Dag;
  const user = await requireUser();
  if (!user) return;

  const id = new URLSearchParams(window.location.search).get("id");
  const form = document.querySelector("#dogForm");
  const preview = document.querySelector("#preview");
  const imageInput = document.querySelector("#mainImage");
  const message = document.querySelector("#message");
  let dog = null;

  if (!id) {
    window.location.replace("dashboard.html");
    return;
  }
  previewImage(imageInput, preview);

  const { data, error } = await client
    .from("dogs")
    .select("*")
    .eq("id", id)
    .eq("breeder_id", user.id)
    .maybeSingle();

  if (error || !data) {
    showMessage(message, error?.message || "Listing not found or you do not have permission to edit it.", "error");
    form.querySelector('button[type="submit"]').disabled = true;
    return;
  }

  dog = data;
  ["name", "breed", "sex", "date_of_birth", "colour", "price", "health_tests", "bloodline", "description"].forEach((fieldName) => {
    if (form.elements[fieldName]) form.elements[fieldName].value = dog[fieldName] ?? "";
  });
  if (form.elements.status) {
    form.elements.status.value = ["available", "reserved"].includes(dog.status) ? dog.status : "available";
    form.elements.status.disabled = ["unavailable", "sold"].includes(dog.status);
  }
  form.elements.registered.value = String(Boolean(dog.registered));
  form.elements.vaccinated.value = String(Boolean(dog.vaccinated));
  form.elements.microchipped.value = String(Boolean(dog.microchipped));
  imageInput.required = false;
  if (dog.main_image_url) {
    preview.src = dog.main_image_url;
    preview.style.display = "block";
  }
  if (["unavailable", "sold"].includes(dog.status)) {
    showMessage(message, `This dog is ${dog.status === "unavailable" ? "temporarily unavailable" : "sold"}. Its status is managed from the dashboard.`, "info");
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    setButtonLoading(button, true);

    try {
      let mainImageUrl = dog.main_image_url || null;
      if (imageInput.files?.[0]) {
        mainImageUrl = await uploadImage(imageInput.files[0], `${user.id}/dogs/${id}/main`);
      }

      const price = Number(form.elements.price.value);
      if (!Number.isFinite(price) || price < 0) throw new Error("Please enter a valid price.");

      const updates = {
        name: form.elements.name.value.trim(),
        breed: form.elements.breed.value.trim(),
        sex: form.elements.sex.value,
        date_of_birth: form.elements.date_of_birth.value || null,
        colour: form.elements.colour.value.trim() || null,
        price,
        status: ["unavailable", "sold"].includes(dog.status) ? dog.status : form.elements.status.value,
        registered: form.elements.registered.value === "true",
        vaccinated: form.elements.vaccinated.value === "true",
        microchipped: form.elements.microchipped.value === "true",
        health_tests: form.elements.health_tests.value.trim() || null,
        bloodline: form.elements.bloodline.value.trim() || null,
        description: form.elements.description.value.trim(),
        main_image_url: mainImageUrl,
        approval_status: "pending",
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await client
        .from("dogs")
        .update(updates)
        .eq("id", id)
        .eq("breeder_id", user.id);
      if (updateError) throw updateError;

      dog = { ...dog, ...updates };
      showMessage(message, "Changes saved. The updated listing is pending public approval.", "success");
    } catch (saveError) {
      showMessage(message, saveError?.message || "The listing could not be saved.", "error");
    } finally {
      setButtonLoading(button, false);
    }
  });
})();
