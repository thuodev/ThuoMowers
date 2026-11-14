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

// ===== Gallery page: filter buttons =====
// (these guards mean the code does nothing on pages without a gallery)
const filterBar = document.querySelector(".filter-bar");

if (filterBar) {
  const filterButtons = filterBar.querySelectorAll(".filter-btn");
  const jobs = document.querySelectorAll(".gallery-page .before-after");

  filterBar.addEventListener("click", (event) => {
    const clicked = event.target.closest(".filter-btn");
    if (!clicked) return;

    const filter = clicked.dataset.filter;

    filterButtons.forEach((button) => {
      const isActive = button === clicked;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });

    jobs.forEach((job) => {
      job.hidden = filter !== "all" && job.dataset.category !== filter;
    });
  });
}
// ===== Before/after toggle (shared by the cards and the viewer) =====
function setPairView(pair, view) {
  pair.dataset.view = view;

  const arrow = pair.querySelector(".ba-arrow");
  if (!arrow) return;

  const showingBefore = view === "before";
  arrow.textContent = showingBefore ? "›" : "‹";
  arrow.setAttribute(
    "aria-label",
    showingBefore ? "Show the after photo" : "Show the before photo",
  );
}

document.querySelectorAll(".ba-pair").forEach((pair) => {
  pair.classList.add("is-slider");

  const arrow = document.createElement("button");
  arrow.type = "button";
  arrow.className = "ba-arrow";
  pair.append(arrow);

  setPairView(pair, "before");

  arrow.addEventListener("click", () => {
    setPairView(pair, pair.dataset.view === "before" ? "after" : "before");
  });
});

// ===== Gallery page: full-size photo viewer =====
const lightbox = document.querySelector("#lightbox");

if (lightbox) {
  const lightboxImg = lightbox.querySelector("#lightbox-img");
  const lightboxCaption = lightbox.querySelector("#lightbox-caption");
  const lightboxClose = lightbox.querySelector(".lightbox-close");

  // the arrow inside the viewer
  const lightboxArrow = document.createElement("button");
  lightboxArrow.type = "button";
  lightboxArrow.className = "lightbox-arrow";
  lightbox.append(lightboxArrow);

  let currentPair = null;

  // show the before or after photo of the current job
  function showInLightbox(view) {
    const index = view === "before" ? 0 : 1;
    const photoButton = currentPair.querySelectorAll(".photo-btn")[index];

    lightboxImg.src = photoButton.dataset.full;
    lightboxImg.alt = photoButton.querySelector("img").alt;
    lightboxCaption.textContent = photoButton.dataset.caption;

    lightbox.dataset.view = view;
    lightboxArrow.textContent = view === "before" ? "›" : "‹";
    lightboxArrow.setAttribute(
      "aria-label",
      view === "before" ? "Show the after photo" : "Show the before photo",
    );

    // keep the card behind the viewer in sync
    setPairView(currentPair, view);
  }

  function flipLightbox() {
    showInLightbox(lightbox.dataset.view === "before" ? "after" : "before");
  }

  // open when the visible photo of a card is clicked
  document.addEventListener("click", (event) => {
    const photoButton = event.target.closest(".photo-btn");
    if (!photoButton) return;

    currentPair = photoButton.closest(".ba-pair");
    showInLightbox(currentPair.dataset.view);
    lightbox.showModal();
  });

  lightboxArrow.addEventListener("click", flipLightbox);

  // left/right arrow keys flip the photo while the viewer is open
  document.addEventListener("keydown", (event) => {
    if (!lightbox.open) return;
    if (event.key === "ArrowRight" && lightbox.dataset.view === "before") {
      flipLightbox();
    }
    if (event.key === "ArrowLeft" && lightbox.dataset.view === "after") {
      flipLightbox();
    }
  });

  // close with the ✕ button
  lightboxClose.addEventListener("click", () => lightbox.close());

  // close when clicking the dark area outside the photo
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) lightbox.close();
  });

  // clear the image when closed, so the old photo never flashes on reopen
  lightbox.addEventListener("close", () => {
    lightboxImg.src = "";
    currentPair = null;
  });
}

// ===== Areas page: list and search =====
const areaResults = document.querySelector("#area-results");

if (areaResults && typeof AREAS !== "undefined") {
  const areaSearch = document.querySelector("#area-search");
  const areaStatus = document.querySelector("#area-status");
  const areaEmpty = document.querySelector("#area-empty");
  const areaEmptyLink = document.querySelector("#area-empty-link");

  // wraps the matching part of a name in <mark>, without using innerHTML,
  // so whatever a visitor types can never be run as code
  function highlight(text, query) {
    const fragment = document.createDocumentFragment();
    const start = query ? text.toLowerCase().indexOf(query) : -1;

    if (start === -1) {
      fragment.append(text);
      return fragment;
    }

    const end = start + query.length;
    const mark = document.createElement("mark");
    mark.textContent = text.slice(start, end);
    fragment.append(text.slice(0, start), mark, text.slice(end));
    return fragment;
  }

  function renderAreas(rawQuery) {
    const typed = rawQuery.trim();
    const query = typed.toLowerCase();
    let cardCount = 0;

    areaResults.replaceChildren();

    AREAS.forEach((area) => {
      const townMatches = area.town.toLowerCase().includes(query);
      const matchingEstates = area.estates.filter((estate) =>
        estate.toLowerCase().includes(query),
      );

      // skip towns that match nothing
      if (query && !townMatches && matchingEstates.length === 0) return;

      // a town match shows every estate; an estate match shows only those
      const estatesToShow =
        !query || townMatches ? area.estates : matchingEstates;

      const card = document.createElement("article");
      card.className = "area-card";

      const heading = document.createElement("h2");
      heading.append(highlight(area.town, query));
      card.append(heading);

      if (estatesToShow.length > 0) {
        const list = document.createElement("ul");
        list.className = "chip-list";

        estatesToShow.forEach((estate) => {
          const item = document.createElement("li");
          item.append(highlight(estate, query));
          list.append(item);
        });

        card.append(list);
      }

      areaResults.append(card);
      cardCount += 1;
    });

    // status line, read aloud by screen readers
    if (!query) {
      areaStatus.textContent = `Showing all ${AREAS.length} towns.`;
    } else if (cardCount > 0) {
      areaStatus.textContent = `${cardCount} ${cardCount === 1 ? "town matches" : "towns match"} “${typed}”.`;
    } else {
      areaStatus.textContent = `No results for “${typed}”.`;
    }

    // nothing found: offer WhatsApp, with the typed place in the message
    areaEmpty.hidden = cardCount > 0;
    if (cardCount === 0) {
      const message = `Hello Thuo Mowers, do you serve ${typed}?`;
      areaEmptyLink.href = `https://wa.me/254700000000?text=${encodeURIComponent(message)}`;
    }
  }

  areaSearch.addEventListener("input", () => renderAreas(areaSearch.value));
  renderAreas("");
}

// ===== Quote page =====
const quoteForm = document.querySelector("#quote-form");

if (quoteForm) {
  // placeholder: replace with the real number (country code, no + or spaces)
  const WHATSAPP_NUMBER = "254114071456";

  // --- town and estate suggestions, from areas-data.js ---
  const placeOptions = document.querySelector("#place-options");
  if (placeOptions && typeof AREAS !== "undefined") {
    AREAS.forEach((area) => {
      placeOptions.append(new Option(area.town));
      area.estates.forEach((estate) => {
        placeOptions.append(new Option(`${estate}, ${area.town}`));
      });
    });
  }

  // --- fields ---
  const fields = {
    name: quoteForm.querySelector("#q-name"),
    phone: quoteForm.querySelector("#q-phone"),
    place: quoteForm.querySelector("#q-place"),
    service: quoteForm.querySelector("#q-service"),
    size: quoteForm.querySelector("#q-size"),
    when: quoteForm.querySelector("#q-when"),
    notes: quoteForm.querySelector("#q-notes"),
    consent: quoteForm.querySelector("#q-consent"),
  };

  // Kenyan numbers: 07xx xxx xxx, 01xx xxx xxx, +2547..., 2547...
  // returns +254712345678 style, or null if it doesn't look right
  function normalisePhone(raw) {
    const cleaned = raw.replace(/[\s\-()]/g, "");
    const match = cleaned.match(/^(?:\+?254|0)([17]\d{8})$/);
    return match ? `+254${match[1]}` : null;
  }

  // each check returns an error message, or "" when the field is fine
  const checks = {
    name: () =>
      fields.name.value.trim().length < 2 ? "Please enter your name." : "",
    phone: () => {
      const value = fields.phone.value.trim();
      if (!value) return "Please enter your phone number.";
      if (!normalisePhone(value)) {
        return "That doesn't look right. Try a number like 0712 345 678.";
      }
      return "";
    },
    place: () =>
      fields.place.value.trim().length < 2
        ? "Please tell us your town and estate."
        : "",
    service: () => (!fields.service.value ? "Please choose a service." : ""),
    consent: () =>
      !fields.consent.checked
        ? "Please tick the box so we can reply to you."
        : "",
  };

  function showError(key, message) {
    const field = fields[key];
    const errorBox = quoteForm.querySelector(`#q-${key}-error`);

    field.setAttribute("aria-invalid", message ? "true" : "false");
    errorBox.textContent = message;
    errorBox.hidden = !message;
  }

  // returns true when everything is valid; focuses the first problem
  function validateAll() {
    let firstInvalid = null;

    Object.keys(checks).forEach((key) => {
      const message = checks[key]();
      showError(key, message);
      if (message && !firstInvalid) firstInvalid = fields[key];
    });

    if (firstInvalid) firstInvalid.focus();
    return !firstInvalid;
  }

  // clear a field's error as soon as the visitor fixes it
  Object.keys(checks).forEach((key) => {
    const eventName =
      key === "service" || key === "consent" ? "change" : "input";
    fields[key].addEventListener(eventName, () => {
      if (fields[key].getAttribute("aria-invalid") === "true") {
        showError(key, checks[key]());
      }
    });
  });

  // --- build the WhatsApp message ---
  function buildMessage() {
    const lines = [
      "Hello Thuo Mowers, I'd like a quote.",
      "",
      `Name: ${fields.name.value.trim()}`,
      `Phone: ${normalisePhone(fields.phone.value)}`,
      `Location: ${fields.place.value.trim()}`,
      `Service: ${fields.service.value}`,
    ];

    // optional fields only appear when filled in
    if (fields.size.value) lines.push(`Garden size: ${fields.size.value}`);
    if (fields.when.value) lines.push(`When: ${fields.when.value}`);
    if (fields.notes.value.trim()) {
      lines.push(`Notes: ${fields.notes.value.trim()}`);
    }

    return lines.join("\n");
  }

  quoteForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!validateAll()) return;

    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(buildMessage())}`;

    // open WhatsApp in a new tab
    window.open(url, "_blank", "noopener");

    // swap the form for the "one more tap" panel
    const sentPanel = document.querySelector("#quote-sent");
    document.querySelector("#quote-sent-link").href = url;
    quoteForm.hidden = true;
    sentPanel.hidden = false;
    sentPanel.focus();
    sentPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}
