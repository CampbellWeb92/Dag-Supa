"use strict";

(async function initialiseAddDog() {
  const {
    client,
    createUuid,
    ensureBreederProfile,
    previewImage,
    requireUser,
    setButtonLoading,
    showMessage,
    uploadImage,
  } = window.Dag;

  const form = document.querySelector("#dogForm");
  const preview = document.querySelector("#preview");
  const imageInput = document.querySelector("#mainImage");
  const message = document.querySelector("#message");
  if (!form) return;

  const user = await requireUser();
  if (!user) return;
  previewImage(imageInput, preview);

  try {
    await ensureBreederProfile(user);
  } catch (error) {
    showMessage(message, `Your breeder profile is not ready: ${error.message}`, "error");
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    setButtonLoading(button, true, "Submitting…");

    try {
      await ensureBreederProfile(user);

      const name = form.elements.name.value.trim();
      const breed = form.elements.breed.value.trim();
      const description = form.elements.description.value.trim();
      const price = Number(form.elements.price.value);
      if (!name || !breed || !description) throw new Error("Complete all required listing details.");
      if (!Number.isFinite(price) || price < 0) throw new Error("Please enter a valid price.");

      const dogId = createUuid();
      const file = imageInput.files?.[0] || null;
      const mainImageUrl = file
        ? await uploadImage(file, `${user.id}/dogs/${dogId}/main`)
        : null;

      const row = {
        id: dogId,
        breeder_id: user.id,
        name,
        breed,
        sex: form.elements.sex.value,
        date_of_birth: form.elements.date_of_birth.value || null,
        colour: form.elements.colour.value.trim() || null,
        price,
        status: "available",
        registered: form.elements.registered.value === "true",
        vaccinated: form.elements.vaccinated.value === "true",
        microchipped: form.elements.microchipped.value === "true",
        health_tests: form.elements.health_tests.value.trim() || null,
        bloodline: form.elements.bloodline.value.trim() || null,
        description,
        main_image_url: mainImageUrl,
        approval_status: "pending",
      };

      const { error } = await client.from("dogs").insert(row);
      if (error) throw error;

      showMessage(
        message,
        "Dog added successfully. It now appears in your dashboard while awaiting public approval.",
        "success",
      );
      window.setTimeout(() => window.location.assign("dashboard.html"), 700);
    } catch (error) {
      showMessage(
        message,
        error?.message || "The dog could not be added. Run supabase/DATABASE-REPAIR.sql and try again.",
        "error",
      );
    } finally {
      setButtonLoading(button, false);
    }
  });
})();
