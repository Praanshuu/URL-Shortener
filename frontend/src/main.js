import "./style.css";
import { Clerk } from "@clerk/clerk-js";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8001";
const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  throw new Error("Add VITE_CLERK_PUBLISHABLE_KEY to your .env file");
}

// Load @clerk/ui bundle — required for mountSignIn / mountSignUp
const clerkDomain = atob(publishableKey.split("_")[2]).slice(0, -1);
await new Promise((resolve, reject) => {
  const script = document.createElement("script");
  script.src = `https://${clerkDomain}/npm/@clerk/ui@1/dist/ui.browser.js`;
  script.async = true;
  script.crossOrigin = "anonymous";
  script.onload = resolve;
  script.onerror = () => reject(new Error("Failed to load @clerk/ui bundle"));
  document.head.appendChild(script);
});

// ─── DOM refs ──────────────────────────────────────────────────────────────
const authButtons       = document.getElementById("auth-buttons");
const userBtnContainer  = document.getElementById("user-button-container");
const authOverlay       = document.getElementById("auth-overlay");
const clerkAuthContainer = document.getElementById("clerk-auth-container");
const btnLogin          = document.getElementById("btn-login");
const btnRegister       = document.getElementById("btn-register");
const registerLinkNotif = document.getElementById("register-link-notif");
const guestNotification = document.getElementById("guest-notification");
const btnShorten        = document.getElementById("btn-shorten");
const linkInput         = document.getElementById("link-input");
const shortenedUrlDisplay = document.getElementById("shortened-url-display");
const shortenedLink     = document.getElementById("shortened-link");
const copyBtn           = document.getElementById("copy-btn");
const linksTableBody    = document.getElementById("links-table-body");
const autoPasteToggle   = document.getElementById("auto-paste-toggle");
const toast             = document.getElementById("toast");

// ─── Toast ──────────────────────────────────────────────────────────────────
function showToast(msg, type = "success") {
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  setTimeout(() => { toast.className = "toast hidden"; }, 3000);
}

// ─── Clerk init ─────────────────────────────────────────────────────────────
const clerk = new Clerk(publishableKey);
await clerk.load({
  ui: { ClerkUI: window.__internal_ClerkUICtor },
});

function updateAuthUI() {
  if (clerk.user) {
    authButtons.classList.add("hidden");
    userBtnContainer.classList.remove("hidden");
    userBtnContainer.innerHTML = "";
    clerk.mountUserButton(userBtnContainer);
    guestNotification.classList.add("hidden");
    populateLinksTable();
  } else {
    authButtons.classList.remove("hidden");
    userBtnContainer.classList.add("hidden");
    guestNotification.classList.remove("hidden");
    linksTableBody.innerHTML = `
      <tr id="empty-table-row">
        <td colspan="6" class="empty-state">
          <span>Sign in to view your shortened links.</span>
        </td>
      </tr>`;
  }
}

// ─── Auth overlay helpers ────────────────────────────────────────────────────
function openAuthOverlay(mode = "signIn") {
  authOverlay.classList.remove("hidden");
  clerkAuthContainer.innerHTML = "";
  if (mode === "signIn") {
    clerk.mountSignIn(clerkAuthContainer);
  } else {
    clerk.mountSignUp(clerkAuthContainer);
  }
}

function closeAuthOverlay(e) {
  if (e.target === authOverlay) {
    authOverlay.classList.add("hidden");
    clerkAuthContainer.innerHTML = "";
  }
}

btnLogin.addEventListener("click", () => openAuthOverlay("signIn"));
btnRegister.addEventListener("click", () => openAuthOverlay("signUp"));
registerLinkNotif?.addEventListener("click", (e) => { e.preventDefault(); openAuthOverlay("signUp"); });
authOverlay.addEventListener("click", closeAuthOverlay);

// Clerk fires this on any auth change (sign in, sign out)
clerk.addListener(({ user }) => {
  if (user) {
    authOverlay.classList.add("hidden");
    clerkAuthContainer.innerHTML = "";
  }
  updateAuthUI();
});

updateAuthUI();

// ─── API helper (attaches Clerk JWT) ────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const token = await clerk.session?.getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };
  return fetch(`${API_BASE_URL}${path}`, { ...options, headers });
}

// ─── Shorten URL ────────────────────────────────────────────────────────────
async function shortenLink() {
  if (!clerk.user) {
    openAuthOverlay("signIn");
    showToast("Please sign in to shorten links.", "error");
    return;
  }

  const url = linkInput.value.trim();
  if (!url) { showToast("Please enter a valid URL.", "error"); return; }

  btnShorten.disabled = true;
  btnShorten.textContent = "Shortening...";

  try {
    const res = await apiFetch("/url", {
      method: "POST",
      body: JSON.stringify({ url }),
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Server error");

    // Always use the current domain + /r/ prefix for the result display
    const displayUrl = `${window.location.origin}/r/${data.short_id}`;
    shortenedLink.innerHTML = `<a href="${displayUrl}" target="_blank">${displayUrl}</a>`;
    shortenedUrlDisplay.classList.remove("hidden");
    linkInput.value = "";
    showToast("Link shortened! 🎉");
    populateLinksTable();
  } catch (err) {
    showToast(err.message || "Failed to shorten URL.", "error");
  } finally {
    btnShorten.disabled = false;
    btnShorten.textContent = "Shorten Now!";
  }
}

// ─── Populate table ──────────────────────────────────────────────────────────
async function populateLinksTable() {
  if (!clerk.user) return;

  linksTableBody.innerHTML = `<tr><td colspan="6" class="empty-state loading-state">Loading...</td></tr>`;

  try {
    const res = await apiFetch("/url/all");
    if (!res.ok) throw new Error("Failed to fetch links");
    const data = await res.json();

    linksTableBody.innerHTML = "";

    if (!data.length) {
      linksTableBody.innerHTML = `<tr><td colspan="6" class="empty-state">No links yet. Shorten your first URL above!</td></tr>`;
      return;
    }

    data.forEach(link => addRowToTable(link));
  } catch (err) {
    linksTableBody.innerHTML = `<tr><td colspan="6" class="empty-state error-state">${err.message}</td></tr>`;
  }
}

// ─── Add row ─────────────────────────────────────────────────────────────────
function addRowToTable(link) {
  const row = document.createElement("tr");
  const date = new Date(link.created_at).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
  const displayOriginal = link.redirect_url.length > 40
    ? link.redirect_url.slice(0, 40) + "…"
    : link.redirect_url;

  // Always construct the short URL from the current domain so it's never localhost
  const shortUrl = `${window.location.origin}/r/${link.short_id}`;

  row.innerHTML = `
    <td>
      <a href="${shortUrl}" target="_blank" class="short-link-cell">${shortUrl}</a>
      <button class="copy-row-btn icon-btn" title="Copy" data-url="${shortUrl}">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
          <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1z"/>
          <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0z"/>
        </svg>
      </button>
    </td>
    <td title="${link.redirect_url}"><a href="${link.redirect_url}" target="_blank" class="orig-link">${displayOriginal}</a></td>
    <td class="clicks-cell">${link.click_count || 0}</td>
    <td><span class="status status-active">● Active</span></td>
    <td class="date-col">${date}</td>
    <td>
      <button class="icon-btn analytics-btn" data-shortid="${link.short_id}" title="Analytics">📊</button>
    </td>`;

  row.querySelector(".copy-row-btn").addEventListener("click", function () {
    navigator.clipboard.writeText(this.dataset.url);
    showToast("Copied to clipboard!");
  });

  row.querySelector(".analytics-btn").addEventListener("click", function () {
    const clicks = row.querySelector(".clicks-cell").textContent;
    showToast(`📊 ${this.dataset.shortid}: ${clicks} click(s)`);
  });

  linksTableBody.appendChild(row);
}

// ─── Copy button on shortened result ────────────────────────────────────────
copyBtn?.addEventListener("click", () => {
  const link = shortenedLink.querySelector("a")?.href;
  if (link) { navigator.clipboard.writeText(link); showToast("Copied!"); }
});

// ─── Auto Paste ──────────────────────────────────────────────────────────────
autoPasteToggle?.addEventListener("change", async function () {
  if (this.checked) {
    try {
      const text = await navigator.clipboard.readText();
      if (text.startsWith("http")) {
        linkInput.value = text;
        showToast("Pasted from clipboard!");
      }
    } catch {
      showToast("Clipboard access denied.", "error");
      this.checked = false;
    }
  }
});

// ─── Shorten on click & Enter ────────────────────────────────────────────────
btnShorten.addEventListener("click", shortenLink);
linkInput.addEventListener("keydown", (e) => { if (e.key === "Enter") shortenLink(); });
