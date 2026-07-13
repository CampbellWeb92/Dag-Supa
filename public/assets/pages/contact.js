"use strict";

(function initialiseContactForm() {
  const form = document.querySelector("#contactForm");
  const notice = document.querySelector("#contactNotice");
  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = form.elements.name.value.trim();
    const email = form.elements.email.value.trim();
    const message = form.elements.message.value.trim();
    const contactEmail = String(window.DAG_CONTACT_EMAIL || "infocampbellweb@gmail.com").trim();
    const subject = encodeURIComponent(`Dag website enquiry from ${name}`);
    const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\n${message}`);

    notice.textContent = "Your email app is opening with the message prepared.";
    window.location.href = `mailto:${encodeURIComponent(contactEmail)}?subject=${subject}&body=${body}`;
  });
})();
