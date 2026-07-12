"use strict";

const PAYPAL_USERNAME = "REPLACE";

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

  const paymentModal = document.getElementById("paymentModal");
  document.querySelectorAll("[data-buy]").forEach((button) => {
    const id = button.dataset.buy;
    const card = button.closest("[data-dog-id]");
    if (localStorage.getItem(`dag-sold-${id}`) === "true") markSold(card);

    button.addEventListener("click", () => {
      const name = button.dataset.name;
      const price = Number(button.dataset.price || 0);
      document.getElementById("paymentTitle").textContent = `Pay for ${name}`;
      document.getElementById("paymentMessage").textContent =
        `Secure payment amount: R${price.toLocaleString("en-ZA")}`;
      document.getElementById("paypalButtons").innerHTML = `
        <a class="btn btn-paypal payment-link" href="https://paypal.me/${PAYPAL_USERNAME}/${price}" target="_blank" rel="noopener">Continue to PayPal</a>
        <button class="btn btn-green demo-confirm" type="button">Demo: Confirm Successful Payment</button>`;
      openModal(paymentModal);
      document.querySelector(".demo-confirm").addEventListener("click", () => {
        localStorage.setItem(`dag-sold-${id}`, "true");
        markSold(card);
        document.getElementById("paymentMessage").textContent =
          "Payment confirmed in this demonstration. The dog is now marked Sold.";
        document.getElementById("paypalButtons").innerHTML = "";
      });
    });
  });
});

function markSold(card) {
  if (!card) return;
  card.classList.add("sold");
  const badge = card.querySelector(".badge");
  if (badge) badge.textContent = "Sold";
  card.querySelectorAll("button").forEach((button) => {
    button.disabled = true;
    button.textContent = "Sold";
  });
}
