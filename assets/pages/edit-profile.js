"use strict";

(async function initialiseEditProfile() {
  const {
    cleanPayPalUrl,
    client,
    ensureBreederProfile,
    previewImage,
    requireUser,
    setButtonLoading,
    showMessage,
    uploadImage,
  } = window.Dag;

  const user = await requireUser();
  if (!user) return;

  const form = document.querySelector("#profileForm");
  const preview = document.querySelector("#preview");
  const imageInput = document.querySelector("#profileImage");
  const message = document.querySelector("#message");
  let currentProfile = {};

  previewImage(imageInput, preview);

  try {
    currentProfile = await ensureBreederProfile(user);
    [
      "contact_name",
      "business_name",
      "phone",
      "whatsapp",
      "paypal_me_url",
      "province",
      "town",
      "breeds",
      "registration_number",
      "description",
    ].forEach((fieldName) => {
      if (form.elements[fieldName]) form.elements[fieldName].value = currentProfile[fieldName] || "";
    });

    if (currentProfile.profile_image_url) {
      preview.src = currentProfile.profile_image_url;
      preview.style.display = "block";
    }
  } catch (error) {
    showMessage(message, error?.message || "Your profile could not be loaded.", "error");
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    setButtonLoading(button, true);

    try {
      let profileImageUrl = currentProfile.profile_image_url || null;
      if (imageInput.files?.[0]) {
        profileImageUrl = await uploadImage(imageInput.files[0], `${user.id}/profile/profile`);
      }

      const values = {
        user_id: user.id,
        email: user.email || currentProfile.email || "",
        contact_name: form.elements.contact_name.value.trim(),
        business_name: form.elements.business_name.value.trim(),
        phone: form.elements.phone.value.trim() || null,
        whatsapp: form.elements.whatsapp.value.trim() || null,
        paypal_me_url: cleanPayPalUrl(form.elements.paypal_me_url.value),
        province: form.elements.province.value.trim() || null,
        town: form.elements.town.value.trim() || null,
        breeds: form.elements.breeds.value.trim() || null,
        registration_number: form.elements.registration_number.value.trim() || null,
        description: form.elements.description.value.trim() || null,
        profile_image_url: profileImageUrl,
        updated_at: new Date().toISOString(),
      };
      if (!currentProfile.user_id) values.approval_status = "pending";

      const { data, error } = await client
        .from("breeder_profiles")
        .upsert(values, { onConflict: "user_id" })
        .select("*")
        .single();
      if (error) throw error;

      currentProfile = data;
      showMessage(message, "Profile saved successfully.", "success");
    } catch (error) {
      showMessage(message, error?.message || "Your profile could not be saved.", "error");
    } finally {
      setButtonLoading(button, false);
    }
  });
})();
