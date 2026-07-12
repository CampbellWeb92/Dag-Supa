const form = document.querySelector("#contactForm");
const notice = document.querySelector("#contactNotice");

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const name = form.elements.name.value.trim();
  const email = form.elements.email.value.trim();
  const message = form.elements.message.value.trim();
  const subject = encodeURIComponent(`Dag website enquiry from ${name}`);
  const body = encodeURIComponent(
    `Name: ${name}\nEmail: ${email}\n\n${message}`,
  );

  notice.textContent =
    "Your email app is opening. Send the prepared message to complete your enquiry.";
  window.location.href = `mailto:support@dag.example?subject=${subject}&body=${body}`;
});
