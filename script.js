const toggle = document.querySelector(".nav-toggle");
const menu = document.querySelector("#nav-links");

function setMenu(open) {
  menu.classList.toggle("is-open", open);
  toggle.setAttribute("aria-expanded", String(open));
  toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  toggle.textContent = open ? "✕" : "☰";
}

toggle.addEventListener("click", () => {
  const isOpen = toggle.getAttribute("aria-expanded") === "true";
  setMenu(!isOpen);
});

// close the menu after tapping a link
menu.addEventListener("click", (event) => {
  if (event.target.closest("a")) setMenu(false);
});

// close with the Escape key
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setMenu(false);
});

// reset if the window is widened past the mobile breakpoint
window.matchMedia("(min-width: 901px)").addEventListener("change", (event) => {
  if (event.matches) setMenu(false);
});
