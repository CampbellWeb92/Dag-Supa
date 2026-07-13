"use strict";

/**
 * Shared site header and footer.
 * Edit the navigation links in NAVIGATION_LINKS below.
 */
const NAVIGATION_LINKS = [
  { page: "home", href: "index.html", label: "Home" },
  { page: "breeders", href: "breeders.html", label: "Breeders" },
  { page: "how", href: "how-it-works.html", label: "How It Works" },
  { page: "contact", href: "contact.html", label: "Contact" },
  { page: "register", href: "register.html", label: "Register as Breeder" },
  { page: "login", href: "login.html", label: "Breeder Login" },
];

const DOG_LOGO = `
  <svg class="brand-logo" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    <path d="M17 24c-7-7-9-15-5-18 5-3 13 4 17 10 2-1 5-2 8-2s6 1 8 2c4-6 12-13 17-10 4 3 2 11-5 18 1 3 2 6 2 10 0 14-12 24-27 24S5 48 5 34c0-4 1-7 2-10h10Z" fill="currentColor" />
    <circle cx="24" cy="34" r="3" fill="#fff" />
    <circle cx="40" cy="34" r="3" fill="#fff" />
    <path d="M27 43c2 3 8 3 10 0" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" />
  </svg>
`;

function createNavigation(activePage) {
  return NAVIGATION_LINKS.map(({ page, href, label }) => {
    const activeAttributes =
      activePage === page ? ' class="active" aria-current="page"' : "";

    return `<a href="${href}"${activeAttributes}>${label}</a>`;
  }).join("");
}

function renderLayout(activePage = "") {
  const headerTarget = document.querySelector("[data-site-header]");
  const footerTarget = document.querySelector("[data-site-footer]");

  if (headerTarget) {
    headerTarget.innerHTML = `
      <header class="site-header">
        <div class="container nav-wrap">
          <a href="index.html" class="brand" aria-label="Dag home">
            ${DOG_LOGO}
            <span class="brand-name">Dag</span>
          </a>

          <button
            class="menu-toggle"
            type="button"
            aria-label="Open navigation"
            aria-expanded="false"
            aria-controls="main-navigation"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>

          <nav class="site-nav" id="main-navigation" aria-label="Main navigation">
            ${createNavigation(activePage)}
          </nav>
        </div>
      </header>
    `;

    initialiseMobileMenu(headerTarget);
  }

  if (footerTarget) {
    footerTarget.innerHTML = `
      <footer class="site-footer">
        <div class="container footer-grid">
          <div>
            <a href="index.html" class="brand footer-brand">
              ${DOG_LOGO}
              <span class="brand-name">Dag</span>
            </a>
            <p>Helping responsible breeders connect with caring dog lovers.</p>
          </div>

          <div>
            <h3>Explore</h3>
            <a href="breeders.html">Breeders</a>
            <a href="how-it-works.html">How It Works</a>
            <a href="contact.html">Contact</a>
          </div>

          <div>
            <h3>Breeders</h3>
            <a href="register.html">Register as a Breeder</a>
            <a href="login.html">Breeder Login</a>
          </div>
        </div>

        <div class="container footer-bottom">
          © ${new Date().getFullYear()} Dag. All rights reserved.
        </div>
      </footer>
    `;
  }
}

function initialiseMobileMenu(headerTarget) {
  const toggle = headerTarget.querySelector(".menu-toggle");
  const navigation = headerTarget.querySelector(".site-nav");

  if (!toggle || !navigation) return;

  const closeMenu = () => {
    navigation.classList.remove("open");
    toggle.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
  };

  toggle.addEventListener("click", () => {
    const isOpen = navigation.classList.toggle("open");
    toggle.classList.toggle("open", isOpen);
    toggle.setAttribute("aria-expanded", String(isOpen));
  });

  navigation.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });

  document.addEventListener("click", (event) => {
    if (!headerTarget.contains(event.target)) closeMenu();
  });
}
