"use strict";

function openModal(modal) {
  if (!modal) return;
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  const focusable = modal.querySelector("button, input, textarea, a");
  if (focusable) focusable.focus();
}

function closeModal(modal) {
  if (!modal) return;
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

document.addEventListener("DOMContentLoaded", () => {
  document
    .querySelectorAll(".modal")
    .forEach((modal) => modal.setAttribute("aria-hidden", "true"));

  document.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", () =>
      closeModal(button.closest(".modal")),
    );
  });

  document.querySelectorAll(".modal").forEach((modal) => {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeModal(modal);
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape")
      document.querySelectorAll(".modal.show").forEach(closeModal);
  });

  const bidModal = document.getElementById("bidModal");
  const bidForm = document.getElementById("bidForm");

  document.querySelectorAll("[data-bid]").forEach((button) => {
    button.addEventListener("click", () => {
      const dogId = button.dataset.bid;
      const dogName = button.dataset.name;
      const price = Number(button.dataset.price || 0);
      document.getElementById("bidDogId").value = dogId;
      document.getElementById("bidDog").value = dogName;
      document.getElementById("bidAmount").value = price;
      document.getElementById("bidAmount").min = Math.max(
        1,
        Math.floor(price * 0.5),
      );
      document.getElementById("bidMessageBox").textContent = "";
      openModal(bidModal);
    });
  });

  if (bidForm) {
    bidForm.addEventListener("submit", (event) => {
      event.preventDefault();
      document.getElementById("bidMessageBox").textContent =
        "Thank you. Your bid has been recorded in this demonstration.";
      bidForm.reset();
      setTimeout(() => closeModal(bidModal), 1400);
    });
  }

  // Static breeder pages are visual previews and are not connected to a
  // Supabase dog record. Keep the button on the page and never submit,
  // redirect or mark a dog sold. Real checkout runs on dog.html?id=... .
  document.querySelectorAll("[data-buy]").forEach((button) => {
    button.setAttribute("type", "button");
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      let notice = button.parentElement?.querySelector(".demo-paypal-notice");
      if (!notice) {
        notice = document.createElement("p");
        notice.className = "form-message info demo-paypal-notice";
        notice.textContent =
          "This is a sample listing. PayPal checkout is available on live dogs added by a registered breeder.";
        button.parentElement?.appendChild(notice);
      }
    });
  });
});

