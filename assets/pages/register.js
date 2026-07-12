import {
  isConfigured,
  setButtonLoading,
  showMessage,
  supabase,
} from "../auth.js";

const form = document.querySelector("#registerForm");
const message = document.querySelector("#message");
const warning = document.querySelector("#setupWarning");

if (!isConfigured) warning.hidden = false;

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!isConfigured) {
    showMessage(
      message,
      "Connect Supabase first using SETUP-GUIDE.txt.",
      "error",
    );
    return;
  }

  const password = form.elements.password.value;
  const confirmPassword = form.elements.confirmPassword.value;
  if (password !== confirmPassword) {
    showMessage(message, "The passwords do not match.", "error");
    return;
  }

  const button = form.querySelector('button[type="submit"]');
  setButtonLoading(button, true, "Creating account…");

  try {
    const metadata = {
      contact_name: form.elements.contactName.value.trim(),
      business_name: form.elements.businessName.value.trim(),
      phone: form.elements.phone.value.trim(),
      province: form.elements.province.value,
      town: form.elements.town.value.trim(),
      breeds: form.elements.breeds.value.trim(),
    };

    const email = form.elements.email.value.trim();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
        emailRedirectTo: new URL("login.html", window.location.href).href,
      },
    });

    if (error) throw error;

    // When email confirmation is disabled, a session exists and the profile can
    // be saved here. When confirmation is enabled, the database trigger in
    // supabase/schema.sql creates the pending profile safely.
    if (data.user && data.session) {
      const { error: profileError } = await supabase
        .from("breeder_profiles")
        .upsert(
          {
            user_id: data.user.id,
            email,
            ...metadata,
            approval_status: "pending",
          },
          { onConflict: "user_id" },
        );

      if (profileError) throw profileError;
    }

    form.reset();
    showMessage(
      message,
      "Account created. Check your email to confirm your address, then log in.",
      "success",
    );
  } catch (error) {
    showMessage(message, error.message || "Registration failed.", "error");
  } finally {
    setButtonLoading(button, false);
  }
});
