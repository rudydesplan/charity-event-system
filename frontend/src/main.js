import "./styles.css";

const appRoot =
  typeof document === "undefined" ? null : document.querySelector("#app");
const toast =
  typeof document === "undefined" ? null : document.querySelector("#toast");
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

let routeVersion = 0;
let toastTimer;

if (appRoot) {
  window.addEventListener("hashchange", renderRoute);
  document.addEventListener("DOMContentLoaded", () => {
    if (!window.location.hash) {
      window.history.replaceState(null, "", "#/");
    }
    renderRoute();
  });
}

async function renderRoute() {
  const version = ++routeVersion;
  const path = window.location.hash.slice(1) || "/";

  setActiveNavigation(path);
  renderLoading();

  try {
    if (path === "/") {
      await renderHome(version);
    } else if (path === "/register") {
      await renderRegistrationForm(version);
    } else if (path === "/participants") {
      await renderParticipants(version);
    } else if (/^\/registrations\/\d+$/.test(path)) {
      await renderRegistrationDetail(version, getRouteId(path));
    } else if (/^\/registrations\/\d+\/edit$/.test(path)) {
      await renderEditForm(version, getRouteId(path));
    } else {
      renderNotFound();
    }
  } catch (error) {
    if (version === routeVersion) {
      renderError(error);
    }
  }
}

async function renderHome(version) {
  const { event } = await requestJson("/api/event");
  if (version !== routeVersion) return;

  const eventDate = splitDate(event.date);
  const days = daysUntil(event.date);
  const registrationLabel = `${event.registrationCount} ${
    event.registrationCount === 1 ? "person is" : "people are"
  } already joining`;

  appRoot.innerHTML = `
    <section class="hero">
      <div class="hero-orbit orbit-one" aria-hidden="true"></div>
      <div class="hero-orbit orbit-two" aria-hidden="true"></div>
      <div class="hero-grid page-width">
        <div class="hero-copy">
          <p class="eyebrow light">Charity Fun Run · 2026</p>
          <h1 tabindex="-1">
            Move together.<br />
            <em>Make good happen.</em>
          </h1>
          <p class="hero-description">${escapeHtml(event.description)}</p>
          <div class="button-row">
            <a class="button button-coral" href="#/register">
              Save my place <span aria-hidden="true">→</span>
            </a>
            <a class="text-link light-link" href="#/participants">
              Meet the participants <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>

        <div class="hero-art" aria-label="${escapeHtml(formatDate(event.date))}">
          <div class="sun-disc">
            <span>${escapeHtml(eventDate.month)}</span>
            <strong>${escapeHtml(eventDate.day)}</strong>
            <small>${escapeHtml(eventDate.year)}</small>
          </div>
          <div class="run-track track-one"></div>
          <div class="run-track track-two"></div>
          <div class="runner-dot dot-one"></div>
          <div class="runner-dot dot-two"></div>
          <p>${escapeHtml(days)}</p>
        </div>
      </div>
    </section>

    <section class="event-strip">
      <div class="page-width event-strip-grid">
        <div class="event-strip-item">
          <span>01</span>
          <div>
            <small>When</small>
            <strong>${escapeHtml(formatDate(event.date))}</strong>
          </div>
        </div>
        <div class="event-strip-item">
          <span>02</span>
          <div>
            <small>Where</small>
            <strong>${escapeHtml(event.location)}</strong>
          </div>
        </div>
        <div class="event-strip-item">
          <span>03</span>
          <div>
            <small>Community</small>
            <strong>${escapeHtml(registrationLabel)}</strong>
          </div>
        </div>
      </div>
    </section>

    <section class="story-section page-width">
      <div class="section-kicker">
        <span>Why we move</span>
        <span class="kicker-line" aria-hidden="true"></span>
      </div>
      <div class="story-grid">
        <h2>A good day out.<br />A real difference.</h2>
        <div class="story-copy">
          <p>
            This is more than a finish line. It is a shared day of energy,
            generosity, and neighbourly spirit in support of projects close
            to home.
          </p>
          <p>
            Register in a minute, then come ready to move at your own pace
            alongside a community pulling in the same direction.
          </p>
          <a class="text-link dark-link" href="#/register">
            Join the run <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>
    </section>

    <section class="closing-banner">
      <div class="page-width closing-grid">
        <div>
          <p class="eyebrow">Your place is waiting</p>
          <h2>One form. One good decision.</h2>
        </div>
        <a class="button button-ink" href="#/register">
          Register for ${escapeHtml(event.name)}
          <span aria-hidden="true">→</span>
        </a>
      </div>
    </section>
  `;

  finishPage("GoodRun — Charity Fun Run");
}

async function renderRegistrationForm(version) {
  const { event } = await requestJson("/api/event");
  if (version !== routeVersion) return;

  appRoot.innerHTML = registrationFormMarkup(event);
  bindRegistrationForm();
  finishPage("Register — GoodRun");
}

async function renderParticipants(version) {
  const { registrations } = await requestJson("/api/registrations");
  if (version !== routeVersion) return;

  appRoot.innerHTML = `
    <section class="page-hero compact-hero">
      <div class="page-width">
        <p class="eyebrow light">The starting line</p>
        <div class="title-row">
          <h1 tabindex="-1">Our participants.</h1>
          <span class="count-pill">${registrations.length}</span>
        </div>
        <p>Meet the people moving for a stronger local community.</p>
      </div>
    </section>

    <section class="page-width participants-section">
      <div class="list-toolbar">
        <label class="search-field" for="participant-search">
          <span class="visually-hidden">Search participants</span>
          <span aria-hidden="true">⌕</span>
          <input
            id="participant-search"
            type="search"
            placeholder="Search by name or email"
            autocomplete="off"
          />
        </label>
        <a class="button button-coral small-button" href="#/register">
          Add participant <span aria-hidden="true">+</span>
        </a>
      </div>

      <div id="participant-list" class="participant-list" aria-live="polite">
        ${participantListMarkup(registrations)}
      </div>
    </section>
  `;

  const search = document.querySelector("#participant-search");
  search?.addEventListener("input", () => {
    const query = search.value.trim().toLowerCase();
    const filtered = registrations.filter((registration) =>
      `${registration.name} ${registration.email}`.toLowerCase().includes(query),
    );
    document.querySelector("#participant-list").innerHTML =
      participantListMarkup(filtered, Boolean(query));
  });

  finishPage("Participants — GoodRun");
}

async function renderRegistrationDetail(version, registrationId) {
  const { registration } = await requestJson(
    `/api/registrations/${registrationId}`,
  );
  if (version !== routeVersion) return;

  appRoot.innerHTML = `
    <section class="detail-page page-width">
      <a class="back-link" href="#/participants">
        <span aria-hidden="true">←</span> All participants
      </a>

      <div class="detail-heading">
        <div class="avatar avatar-large" aria-hidden="true">
          ${escapeHtml(initials(registration.name))}
        </div>
        <div>
          <p class="eyebrow">Registration #${registration.id}</p>
          <h1 tabindex="-1">${escapeHtml(registration.name)}</h1>
          <p>Registered ${escapeHtml(formatDate(registration.registeredAt))}</p>
        </div>
      </div>

      <div class="detail-grid">
        <article class="detail-card">
          <div class="card-heading">
            <div>
              <p class="eyebrow">Participant</p>
              <h2>Contact details</h2>
            </div>
            <span class="status-chip">
              <span aria-hidden="true">✓</span> Confirmed
            </span>
          </div>

          <dl class="data-list">
            <div>
              <dt>Email address</dt>
              <dd>
                <a href="mailto:${encodeURIComponent(registration.email)}">
                  ${escapeHtml(registration.email)}
                </a>
              </dd>
            </div>
            <div>
              <dt>Phone number</dt>
              <dd>
                <a href="tel:${escapeHtml(phoneHref(registration.phone))}">
                  ${escapeHtml(registration.phone)}
                </a>
              </dd>
            </div>
            <div>
              <dt>Registration date</dt>
              <dd>${escapeHtml(formatDate(registration.registeredAt))}</dd>
            </div>
          </dl>
        </article>

        <aside class="event-ticket">
          <p class="eyebrow light">Your event</p>
          <h2>${escapeHtml(registration.event.name)}</h2>
          <div class="ticket-date">
            <strong>${escapeHtml(splitDate(registration.event.date).day)}</strong>
            <span>
              ${escapeHtml(splitDate(registration.event.date).month)}<br />
              ${escapeHtml(splitDate(registration.event.date).year)}
            </span>
          </div>
          <p>${escapeHtml(formatDate(registration.event.date))}</p>
          <p>${escapeHtml(registration.event.location)}</p>
          <span class="ticket-cut ticket-cut-left" aria-hidden="true"></span>
          <span class="ticket-cut ticket-cut-right" aria-hidden="true"></span>
        </aside>
      </div>

      <div class="detail-actions">
        <a class="button button-ink" href="#/registrations/${registration.id}/edit">
          Edit registration <span aria-hidden="true">→</span>
        </a>
        <button class="danger-link" id="open-cancel-dialog" type="button">
          Cancel registration
        </button>
      </div>
    </section>

    <dialog class="cancel-dialog" id="cancel-dialog">
      <form method="dialog">
        <button class="dialog-close" value="close" aria-label="Close dialog">×</button>
        <p class="eyebrow">Please confirm</p>
        <h2>Cancel this registration?</h2>
        <p>
          ${escapeHtml(registration.name)} will be removed from the participant
          list. This action cannot be undone.
        </p>
        <div class="dialog-actions">
          <button class="button button-muted" value="close">Keep registration</button>
          <button class="button button-danger" id="confirm-cancel" value="default">
            Yes, cancel it
          </button>
        </div>
      </form>
    </dialog>
  `;

  const dialog = document.querySelector("#cancel-dialog");
  document
    .querySelector("#open-cancel-dialog")
    ?.addEventListener("click", () => dialog.showModal());
  document
    .querySelector("#confirm-cancel")
    ?.addEventListener("click", async (event) => {
      event.preventDefault();
      const button = event.currentTarget;
      setButtonPending(button, true, "Cancelling…");

      try {
        await requestJson(`/api/registrations/${registration.id}`, {
          method: "DELETE",
        });
        dialog.close();
        showToast("Registration cancelled.");
        window.location.hash = "#/participants";
      } catch (error) {
        setButtonPending(button, false);
        showToast(error.message, "error");
      }
    });

  finishPage(`${registration.name} — GoodRun`);
}

async function renderEditForm(version, registrationId) {
  const { registration } = await requestJson(
    `/api/registrations/${registrationId}`,
  );
  if (version !== routeVersion) return;

  appRoot.innerHTML = registrationFormMarkup(
    registration.event,
    registration,
  );
  bindRegistrationForm(registration);
  finishPage(`Edit ${registration.name} — GoodRun`);
}

function registrationFormMarkup(event, registration = null) {
  const isEditing = Boolean(registration);
  const values = registration || { name: "", email: "", phone: "" };
  const title = isEditing ? "Keep your details current." : "Your place starts here.";
  const actionLabel = isEditing ? "Save changes" : "Complete registration";
  const backHref = isEditing
    ? `#/registrations/${registration.id}`
    : "#/";
  const backLabel = isEditing ? "Back to registration" : "Back to event";

  return `
    <section class="form-page">
      <div class="page-width form-page-grid">
        <div class="form-intro">
          <a class="back-link light-link" href="${backHref}">
            <span aria-hidden="true">←</span> ${backLabel}
          </a>
          <p class="eyebrow light">
            ${isEditing ? "Edit registration" : "Join the movement"}
          </p>
          <h1 tabindex="-1">${title}</h1>
          <p>
            ${isEditing
              ? "Update the contact details for this registration."
              : "A few details are all we need to add you to the starting line."}
          </p>

          <div class="mini-event-card">
            <div class="mini-date">
              <strong>${escapeHtml(splitDate(event.date).day)}</strong>
              <span>${escapeHtml(splitDate(event.date).month)}</span>
            </div>
            <div>
              <small>You are ${isEditing ? "registered for" : "joining"}</small>
              <strong>${escapeHtml(event.name)}</strong>
              <span>${escapeHtml(event.location)}</span>
            </div>
          </div>
        </div>

        <div class="form-panel">
          <div class="form-progress" aria-hidden="true">
            <span class="active"></span><span></span><span></span>
          </div>
          <p class="form-step">${isEditing ? "Participant details" : "Step 1 of 1"}</p>
          <h2>${isEditing ? "Edit contact information" : "Tell us who is joining"}</h2>
          <p class="required-note">All fields are required.</p>

          <div id="form-error" class="form-error" role="alert" tabindex="-1" hidden></div>

          <form id="registration-form" novalidate>
            <div class="field">
              <label for="name">Full name</label>
              <input
                id="name"
                name="name"
                type="text"
                value="${escapeHtml(values.name)}"
                minlength="2"
                maxlength="100"
                autocomplete="name"
                placeholder="e.g. Alex Morgan"
                aria-describedby="name-error"
                required
              />
              <small id="name-error" class="field-error"></small>
            </div>

            <div class="field">
              <label for="email">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                value="${escapeHtml(values.email)}"
                maxlength="100"
                autocomplete="email"
                placeholder="alex@example.com"
                aria-describedby="email-error"
                required
              />
              <small id="email-error" class="field-error"></small>
            </div>

            <div class="field">
              <label for="phone">Phone number</label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value="${escapeHtml(values.phone)}"
                minlength="7"
                maxlength="20"
                autocomplete="tel"
                placeholder="+44 7700 900000"
                aria-describedby="phone-hint phone-error"
                required
              />
              <small id="phone-hint" class="field-hint">
                Include the country code when possible.
              </small>
              <small id="phone-error" class="field-error"></small>
            </div>

            <button class="button button-coral submit-button" type="submit">
              ${actionLabel} <span aria-hidden="true">→</span>
            </button>
          </form>
        </div>
      </div>
    </section>
  `;
}

function bindRegistrationForm(registration = null) {
  const form = document.querySelector("#registration-form");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearFormErrors(form);

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const data = Object.fromEntries(new FormData(form));
    const button = form.querySelector('button[type="submit"]');
    setButtonPending(
      button,
      true,
      registration ? "Saving…" : "Registering…",
    );

    try {
      const result = await requestJson(
        registration
          ? `/api/registrations/${registration.id}`
          : "/api/registrations",
        {
          method: registration ? "PUT" : "POST",
          body: JSON.stringify(data),
        },
      );

      showToast(
        registration
          ? "Registration updated."
          : "You are registered. See you there!",
      );
      window.location.hash = `#/registrations/${result.registration.id}`;
    } catch (error) {
      setButtonPending(button, false);
      displayFormErrors(form, error);
    }
  });
}

export function participantListMarkup(registrations, isFiltered = false) {
  if (!registrations.length) {
    return `
      <div class="empty-state">
        <span class="empty-mark" aria-hidden="true">G</span>
        <h2>${isFiltered ? "No participants found" : "The starting line is open"}</h2>
        <p>
          ${isFiltered
            ? "Try a different name or email address."
            : "Be the first person to register for this community event."}
        </p>
        ${
          isFiltered
            ? ""
            : '<a class="button button-ink" href="#/register">Register now →</a>'
        }
      </div>
    `;
  }

  return registrations
    .map(
      (registration) => `
        <article class="participant-row">
          <div class="participant-person">
            <span class="avatar" aria-hidden="true">
              ${escapeHtml(initials(registration.name))}
            </span>
            <div>
              <h2>${escapeHtml(registration.name)}</h2>
              <a href="mailto:${encodeURIComponent(registration.email)}">
                ${escapeHtml(registration.email)}
              </a>
            </div>
          </div>
          <div class="participant-meta">
            <small>Registered</small>
            <span>${escapeHtml(formatDate(registration.registeredAt))}</span>
          </div>
          <a
            class="round-link"
            href="#/registrations/${registration.id}"
            aria-label="View ${escapeHtml(registration.name)}'s registration"
          >
            <span aria-hidden="true">→</span>
          </a>
        </article>
      `,
    )
    .join("");
}

export async function requestJson(path, options = {}) {
  const headers = { Accept: "application/json", ...options.headers };
  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  let response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, { ...options, headers });
  } catch {
    throw new Error(
      "The event service is unavailable. Check that the backend server is running.",
    );
  }

  if (response.status === 204) return null;

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      payload.error?.message || "Something went wrong. Please try again.",
    );
    error.status = response.status;
    error.fields = payload.error?.fields || {};
    throw error;
  }

  return payload;
}

function renderLoading() {
  appRoot.innerHTML = `
    <section class="loading-page page-width" aria-label="Loading">
      <div class="skeleton skeleton-kicker"></div>
      <div class="skeleton skeleton-title"></div>
      <div class="skeleton skeleton-copy"></div>
      <div class="skeleton skeleton-card"></div>
    </section>
  `;
}

function renderError(error) {
  appRoot.innerHTML = `
    <section class="state-page page-width">
      <p class="eyebrow">Something interrupted the run</p>
      <h1 tabindex="-1">We could not load this page.</h1>
      <p>${escapeHtml(error.message)}</p>
      <button class="button button-ink" id="retry-button" type="button">
        Try again <span aria-hidden="true">↻</span>
      </button>
    </section>
  `;
  document.querySelector("#retry-button")?.addEventListener("click", renderRoute);
  finishPage("Unable to load — GoodRun");
}

function renderNotFound() {
  appRoot.innerHTML = `
    <section class="state-page page-width">
      <p class="eyebrow">404 · Wrong turn</p>
      <h1 tabindex="-1">This route has no finish line.</h1>
      <p>The page you asked for does not exist or may have moved.</p>
      <a class="button button-ink" href="#/">
        Return to the event <span aria-hidden="true">→</span>
      </a>
    </section>
  `;
  finishPage("Page not found — GoodRun");
}

function displayFormErrors(form, error) {
  const formError = document.querySelector("#form-error");
  formError.textContent = error.message;
  formError.hidden = false;

  Object.entries(error.fields || {}).forEach(([field, message]) => {
    const input = form.elements[field];
    const errorElement = document.querySelector(`#${field}-error`);
    if (input) input.setAttribute("aria-invalid", "true");
    if (errorElement) errorElement.textContent = message;
  });

  formError.focus();
}

function clearFormErrors(form) {
  const formError = document.querySelector("#form-error");
  formError.hidden = true;
  formError.textContent = "";
  form.querySelectorAll("[aria-invalid]").forEach((input) => {
    input.removeAttribute("aria-invalid");
  });
  form.querySelectorAll(".field-error").forEach((error) => {
    error.textContent = "";
  });
}

function setButtonPending(button, pending, label) {
  if (pending) {
    button.dataset.originalLabel = button.innerHTML;
    button.textContent = label;
    button.disabled = true;
  } else {
    button.innerHTML = button.dataset.originalLabel;
    button.disabled = false;
  }
}

function setActiveNavigation(path) {
  document.querySelectorAll("[data-nav]").forEach((link) => {
    const section = link.dataset.nav;
    const active =
      (section === "home" && path === "/") ||
      (section === "register" && path === "/register") ||
      (section === "participants" &&
        (path === "/participants" || path.startsWith("/registrations/")));

    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

function finishPage(title) {
  document.title = title;
  window.scrollTo({ top: 0, behavior: "instant" });
  window.requestAnimationFrame(() => appRoot.querySelector("h1")?.focus());
}

function showToast(message, type = "success") {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.className = `toast visible ${type}`;
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("visible");
  }, 4200);
}

function getRouteId(path) {
  return Number(path.match(/\d+/)?.[0]);
}

function splitDate(isoDate) {
  const date = parseDate(isoDate);
  return {
    day: new Intl.DateTimeFormat("en", { day: "2-digit" }).format(date),
    month: new Intl.DateTimeFormat("en", { month: "short" })
      .format(date)
      .toUpperCase(),
    year: new Intl.DateTimeFormat("en", { year: "numeric" }).format(date),
  };
}

export function formatDate(isoDate) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parseDate(isoDate));
}

function parseDate(isoDate) {
  return new Date(`${isoDate}T12:00:00Z`);
}

function daysUntil(isoDate) {
  const milliseconds = parseDate(isoDate).getTime() - Date.now();
  const days = Math.ceil(milliseconds / 86_400_000);
  if (days > 1) return `${days} days to go`;
  if (days === 1) return "Tomorrow";
  if (days === 0) return "Today is the day";
  return "The event has taken place";
}

export function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function phoneHref(phone) {
  return phone.replace(/[^\d+]/g, "");
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
