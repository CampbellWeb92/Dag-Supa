"use strict";

const form = document.querySelector("#contactForm");
const notice = document.querySelector("#contactNotice");
const supportEmail = String(window.DAG_SUPPORT_EMAIL || "").trim();
const supportPhone = String(window.DAG_SUPPORT_PHONE || "").trim();

const emailLink = document.querySelector("#supportEmail");
const phoneLink = document.querySelector("#supportPhone");
if (emailLink) {
  emailLink.textContent = supportEmail || "Email address not configured";
  emailLink.href = supportEmail ? `mailto:${supportEmail}` : "contact.html";
}
if (phoneLink) {
  phoneLink.textContent = supportPhone || "Phone number not configured";
  phoneLink.href = supportPhone ? `tel:${supportPhone.replace(/\s+/g, "")}` : "contact.html";
}

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!supportEmail) {
    notice.textContent = "The support email has not been configured in assets/supabase-config.js.";
    notice.className = "notice form-message show error";
    return;
  }
  const name = form.elements.name.value.trim();
  const email = form.elements.email.value.trim();
  const message = form.elements.message.value.trim();
  const subject = encodeURIComponent(`Dag website enquiry from ${name}`);
  const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\n${message}`);
  notice.textContent = "Your email app is opening. Send the prepared message to complete your enquiry.";
  notice.className = "notice form-message show success";
  window.location.assign(`mailto:${supportEmail}?subject=${subject}&body=${body}`);
});
