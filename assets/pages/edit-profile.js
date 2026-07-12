import {
  previewImage,
  requireUser,
  setButtonLoading,
  showMessage,
  supabase,
  uploadImage,
} from "../auth.js";

const user = await requireUser();
const form = document.querySelector("#profileForm");
const preview = document.querySelector("#preview");
const imageInput = document.querySelector("#profileImage");
const message = document.querySelector("#message");
let currentProfile = {};

previewImage(imageInput, preview);
if (user) await loadProfile();

async function loadProfile() {
  const { data, error } = await supabase
    .from("breeder_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    showMessage(message, error.message, "error");
    return;
  }

  currentProfile = data || {};
  const fields = [
    "contact_name",
    "business_name",
    "phone",
    "whatsapp",
    "province",
    "town",
    "breeds",
    "registration_number",
    "description",
  ];

  fields.forEach((fieldName) => {
    form.elements[fieldName].value = currentProfile[fieldName] || "";
  });

  if (currentProfile.profile_image_url) {
    preview.src = currentProfile.profile_image_url;
    preview.style.display = "block";
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = form.querySelector('button[type="submit"]');
  setButtonLoading(button, true);

  try {
    let profileImageUrl = currentProfile.profile_image_url || null;
    if (imageInput.files[0]) {
      profileImageUrl = await uploadImage(
        imageInput.files[0],
        `${user.id}/profile/profile`,
      );
    }

    const values = {
      user_id: user.id,
      email: user.email,
      contact_name: form.elements.contact_name.value.trim(),
      business_name: form.elements.business_name.value.trim(),
      phone: form.elements.phone.value.trim(),
      whatsapp: form.elements.whatsapp.value.trim(),
      province: form.elements.province.value.trim(),
      town: form.elements.town.value.trim(),
      breeds: form.elements.breeds.value.trim(),
      registration_number: form.elements.registration_number.value.trim(),
      description: form.elements.description.value.trim(),
      profile_image_url: profileImageUrl,
      approval_status: currentProfile.approval_status || "pending",
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("breeder_profiles")
      .upsert(values, { onConflict: "user_id" });

    if (error) throw error;
    currentProfile = { ...currentProfile, ...values };
    showMessage(message, "Profile saved successfully.", "success");
  } catch (error) {
    showMessage(message, error.message, "error");
  } finally {
    setButtonLoading(button, false);
  }
});
