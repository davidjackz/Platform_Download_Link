const initialPayload = window.__INITIAL_DASHBOARD__ || { dashboardData: {}, uptime: 0 };

const languageLabels = {
  en: "English",
  km: "Khmer",
};

const panelMeta = {
  overview: {
    title: "Dashboard",
    subtitle: "Overview of users, downloads, moderation, and donations.",
  },
  users: {
    title: "Users",
    subtitle: "Search, review, and moderate every stored Telegram user.",
  },
  donations: {
    title: "Donations",
    subtitle: "Track donation records, payment status, and donor activity.",
  },
};

const appState = {
  dashboard: initialPayload.dashboardData,
  uptimeSeconds: Math.floor(initialPayload.uptime || 0),
  activePanel: "overview",
};

const els = {
  sidebar: document.getElementById("sidebar"),
  sidebarBackdrop: document.getElementById("sidebarBackdrop"),
  sidebarToggle: document.getElementById("sidebarToggle"),
  panelTitle: document.getElementById("panelTitle"),
  panelSubtitle: document.getElementById("panelSubtitle"),
  generatedAt: document.getElementById("generatedAt"),
  topGeneratedAt: document.getElementById("topGeneratedAt"),
  moderationState: document.getElementById("moderationState"),
  healthState: document.getElementById("healthState"),
  uptimeValue: document.getElementById("uptimeValue"),
  footerMeta: document.getElementById("footerMeta"),
  topDonationStat: document.getElementById("topDonationStat"),
  socketDot: document.getElementById("socketDot"),
  socketStatusText: document.getElementById("socketStatusText"),
  heroSummary: document.getElementById("heroSummary"),
  statsGrid: document.getElementById("statsGrid"),
  platformBreakdown: document.getElementById("platformBreakdown"),
  mediaBreakdown: document.getElementById("mediaBreakdown"),
  languageBreakdown: document.getElementById("languageBreakdown"),
  donationStatusBreakdown: document.getElementById("donationStatusBreakdown"),
  donationCurrencyBreakdown: document.getElementById("donationCurrencyBreakdown"),
  activeUsersSnapshot: document.getElementById("activeUsersSnapshot"),
  recentDownloadsList: document.getElementById("recentDownloadsList"),
  recentDonationsList: document.getElementById("recentDonationsList"),
  activeUsersList: document.getElementById("activeUsersList"),
  topUsersList: document.getElementById("topUsersList"),
  usersResultsMeta: document.getElementById("usersResultsMeta"),
  usersTableBody: document.getElementById("usersTableBody"),
  mobileUsersList: document.getElementById("mobileUsersList"),
  donationsResultsMeta: document.getElementById("donationsResultsMeta"),
  donationStatsGrid: document.getElementById("donationStatsGrid"),
  donationsTableBody: document.getElementById("donationsTableBody"),
  mobileDonationsList: document.getElementById("mobileDonationsList"),
  toast: document.getElementById("toast"),
  usersSearch: document.getElementById("usersSearch"),
  usersSort: document.getElementById("usersSort"),
  usersStatusFilter: document.getElementById("usersStatusFilter"),
  usersLanguageFilter: document.getElementById("usersLanguageFilter"),
  usersDayFilter: document.getElementById("usersDayFilter"),
  donationsSearch: document.getElementById("donationsSearch"),
  donationsSort: document.getElementById("donationsSort"),
  donationsStatusFilter: document.getElementById("donationsStatusFilter"),
  donationsCurrencyFilter: document.getElementById("donationsCurrencyFilter"),
  donationsDayFilter: document.getElementById("donationsDayFilter"),
  navButtons: Array.from(document.querySelectorAll("[data-panel-target]")),
  panelViews: Array.from(document.querySelectorAll(".panel-view")),
};

let downloadsChart;
let signupsChart;
let donationsChart;
let toastTimer;

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatNumber(value = 0) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

function formatCompact(value = 0) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value || 0);
}

function formatDate(dateValue, includeTime = true) {
  if (!dateValue) {
    return "No data";
  }

  const options = includeTime
    ? { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
    : { month: "short", day: "numeric", year: "numeric" };

  return new Date(dateValue).toLocaleString("en-US", options);
}

function formatRelative(dateValue) {
  if (!dateValue) {
    return "just now";
  }

  const diff = Date.now() - new Date(dateValue).getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatUptime(totalSeconds = 0) {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

function formatCurrencyAmount(currencyCode, amount = 0) {
  if (currencyCode === "usd") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount || 0);
  }

  return `៛ ${new Intl.NumberFormat("en-US").format(amount || 0)}`;
}

function getLanguageLabel(code) {
  return languageLabels[code] || code || "Unknown";
}

function getPlatformLabel(value) {
  if (!value) {
    return "Unknown";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getMediaLabel(value) {
  return value === "audio" ? "Audio / MP3" : "Video";
}

function getLinkHref(url) {
  return /^https?:\/\//i.test(url || "") ? url : "#";
}

function truncate(value = "", maxLength = 54) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

function matchesDayFilter(dateValue, filterValue) {
  if (filterValue === "all") {
    return true;
  }

  if (!dateValue) {
    return false;
  }

  const days = Number(filterValue);
  if (!Number.isFinite(days) || days <= 0) {
    return true;
  }

  const diff = Date.now() - new Date(dateValue).getTime();
  return diff <= days * 24 * 60 * 60 * 1000;
}

function getDonationStatusMeta(status) {
  const map = {
    pending: { label: "Pending", className: "tag-warn" },
    success: { label: "Success", className: "tag" },
    failed: { label: "Failed", className: "tag-danger" },
    expired: { label: "Expired", className: "tag-soft" },
    unsupported: { label: "Unsupported", className: "tag-soft" },
    auth_error: { label: "Auth error", className: "tag-danger" },
  };

  return map[status] || { label: status || "Unknown", className: "tag-soft" };
}

function showToast(message, type = "info") {
  els.toast.textContent = message;
  els.toast.className = "toast show";
  els.toast.style.background = type === "error" ? "rgba(127, 29, 29, 0.96)" : "rgba(9, 17, 30, 0.96)";

  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    els.toast.className = "toast";
  }, 2600);
}

function openSidebar() {
  els.sidebar.classList.add("open");
  els.sidebarBackdrop.classList.add("show");
}

function closeSidebar() {
  els.sidebar.classList.remove("open");
  els.sidebarBackdrop.classList.remove("show");
}

function setActivePanel(panel) {
  appState.activePanel = panel;
  const meta = panelMeta[panel] || panelMeta.overview;

  els.panelTitle.textContent = meta.title;
  els.panelSubtitle.textContent = meta.subtitle;

  els.navButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.panelTarget === panel);
  });

  els.panelViews.forEach((view) => {
    view.classList.toggle("active", view.dataset.panel === panel);
  });

  closeSidebar();
}

function renderHeroSummary(stats = {}) {
  const cards = [
    { label: "Blocked users", value: formatNumber(stats.blockedUsers || 0), hint: "Moderation state" },
    { label: "USD donated", value: formatCurrencyAmount("usd", stats.totalDonatedUsd || 0), hint: "Successful USD donations" },
    { label: "KHR donated", value: formatCurrencyAmount("khr", stats.totalDonatedKhr || 0), hint: "Successful KHR donations" },
  ];

  els.heroSummary.innerHTML = cards.map((card) => `
    <article class="hero-mini-card">
      <span>${escapeHtml(card.label)}</span>
      <strong>${escapeHtml(card.value)}</strong>
      <small>${escapeHtml(card.hint)}</small>
    </article>
  `).join("");
}

function buildStatsCards(stats = {}) {
  const cards = [
    { label: "Total downloads", value: formatNumber(stats.totalDownloads), hint: "All successful deliveries", icon: "ph-fill ph-download-simple" },
    { label: "Requests", value: formatNumber(stats.linkRequests), hint: "Links submitted by users", icon: "ph-fill ph-link" },
    { label: "Failures", value: formatNumber(stats.failedDownloads), hint: "Requests that did not finish", icon: "ph-fill ph-warning-circle" },
    { label: "Success rate", value: `${stats.successRate || 0}%`, hint: "Successful downloads versus requests", icon: "ph-fill ph-chart-line-up" },
    { label: "Users", value: formatNumber(stats.totalUsers), hint: "Stored Telegram users", icon: "ph-fill ph-users-three" },
    { label: "Active now", value: formatNumber(stats.activeNow), hint: "Seen in the last five minutes", icon: "ph-fill ph-radio-button" },
    { label: "Total donations", value: formatNumber(stats.totalDonations), hint: "All donation records", icon: "ph-fill ph-hand-heart" },
    { label: "Paid donations", value: `${formatNumber(stats.successfulDonations)} • ${stats.donationSuccessRate || 0}%`, hint: "Completed payments", icon: "ph-fill ph-currency-circle-dollar" },
  ];

  els.statsGrid.innerHTML = cards.map((card) => `
    <article class="stat-card">
      <div class="stat-head">
        <div>
          <div class="stat-kicker">${escapeHtml(card.label)}</div>
          <div class="stat-value">${escapeHtml(card.value)}</div>
        </div>
        <div class="stat-icon">
          <i class="${card.icon}"></i>
        </div>
      </div>
      <div class="stat-foot">${escapeHtml(card.hint)}</div>
    </article>
  `).join("");
}

function renderBreakdown(container, items = [], formatter = (value) => value) {
  if (!items.length) {
    container.innerHTML = '<div class="empty-state">No data yet.</div>';
    return;
  }

  const peak = Math.max(...items.map((item) => item.count || 0), 1);

  container.innerHTML = items.map((item) => `
    <article class="stack-item">
      <div class="stack-row">
        <strong>${escapeHtml(item.label)}</strong>
        <span class="tag-soft">${escapeHtml(formatter(item.count || 0))}</span>
      </div>
      <div class="stack-bar">
        <span style="width:${Math.max(8, ((item.count || 0) / peak) * 100)}%"></span>
      </div>
    </article>
  `).join("");
}

function renderActiveSnapshot(users = []) {
  if (!users.length) {
    els.activeUsersSnapshot.innerHTML = '<div class="empty-state">No active users right now.</div>';
    return;
  }

  els.activeUsersSnapshot.innerHTML = users.slice(0, 5).map((user) => `
    <article class="stack-item compact">
      <div class="stack-row">
        <strong>${escapeHtml(user.name)}</strong>
        <span class="tag-soft">${formatNumber(user.downloads || 0)}</span>
      </div>
      <div class="user-subtext">${user.username ? `@${escapeHtml(user.username)}` : `ID ${escapeHtml(user.id)}`}</div>
    </article>
  `).join("");
}

function renderRecentDownloads(items = []) {
  if (!items.length) {
    els.recentDownloadsList.innerHTML = '<div class="empty-state">No recent download activity.</div>';
    return;
  }

  els.recentDownloadsList.innerHTML = items.map((item) => `
    <article class="feed-item">
      <div class="feed-head">
        <div>
          <strong>${escapeHtml(item.name || "Unknown user")}</strong>
          <div class="subtext">${item.username ? `@${escapeHtml(item.username)}` : "Telegram user"} • ${formatDate(item.createdAt)}</div>
        </div>
        <span class="${item.status === "failed" ? "tag-danger" : "tag"}">${escapeHtml(item.status)}</span>
      </div>
      <p>${escapeHtml(item.title || "Media request")}</p>
      <div class="tag-row">
        <span class="tag-soft">${escapeHtml(getPlatformLabel(item.platform))}</span>
        <span class="tag-soft">${escapeHtml(getMediaLabel(item.mediaType))}</span>
        <span class="tag-soft">${escapeHtml(getLanguageLabel(item.language))}</span>
      </div>
      ${item.sourceUrl ? `
        <div class="tag-row">
          <a class="link-pill" href="${escapeHtml(getLinkHref(item.sourceUrl))}" target="_blank" rel="noreferrer noopener">
            <i class="ph ph-link-simple"></i>
            ${escapeHtml(truncate(item.sourceUrl, 58))}
          </a>
        </div>
      ` : ""}
      ${item.errorMessage ? `<p class="subtext">${escapeHtml(item.errorMessage)}</p>` : ""}
    </article>
  `).join("");
}

function renderRecentDonations(items = []) {
  if (!items.length) {
    els.recentDonationsList.innerHTML = '<div class="empty-state">No donation records yet.</div>';
    return;
  }

  els.recentDonationsList.innerHTML = items.map((item) => {
    const statusMeta = getDonationStatusMeta(item.status);

    return `
      <article class="feed-item">
        <div class="feed-head">
          <div>
            <strong>${escapeHtml(item.name || "Unknown user")}</strong>
            <div class="subtext">${item.username ? `@${escapeHtml(item.username)}` : `ID ${escapeHtml(item.telegramId)}`} • ${formatDate(item.createdAt)}</div>
          </div>
          <span class="${statusMeta.className}">${escapeHtml(statusMeta.label)}</span>
        </div>
        <p>${escapeHtml(formatCurrencyAmount(item.currencyCode, item.amount))} • ${escapeHtml((item.currencyCode || "").toUpperCase())}</p>
        <div class="tag-row">
          <span class="tag-soft">${escapeHtml(item.billNumber || "No bill")}</span>
          ${item.paidAt ? `<span class="tag-soft">Paid ${escapeHtml(formatRelative(item.paidAt))}</span>` : ""}
        </div>
        ${item.errorMessage ? `<p class="subtext">${escapeHtml(item.errorMessage)}</p>` : ""}
      </article>
    `;
  }).join("");
}

function renderActiveUsers(users = []) {
  if (!users.length) {
    els.activeUsersList.innerHTML = '<div class="empty-state">No active users in the last five minutes.</div>';
    return;
  }

  els.activeUsersList.innerHTML = users.map((user) => `
    <article class="feed-item">
      <div class="feed-head">
        <div>
          <strong>${escapeHtml(user.name)}</strong>
          <div class="subtext">${user.username ? `@${escapeHtml(user.username)}` : `ID ${escapeHtml(user.id)}`} • ${formatRelative(user.lastSeen)}</div>
        </div>
        ${user.isBlocked ? '<span class="tag-danger">Blocked</span>' : '<span class="tag">Active</span>'}
      </div>
      <div class="tag-row">
        <span class="tag-soft">${escapeHtml(getLanguageLabel(user.preferredLanguage))}</span>
        <span class="tag-soft">${formatNumber(user.downloads || 0)} downloads</span>
        <span class="tag-soft">${formatNumber(user.donationsCount || 0)} donations</span>
      </div>
      ${user.lastLink ? `
        <div class="tag-row">
          <a class="link-pill" href="${escapeHtml(getLinkHref(user.lastLink))}" target="_blank" rel="noreferrer noopener">
            <i class="ph ph-link-simple"></i>
            ${escapeHtml(truncate(user.lastLink, 44))}
          </a>
        </div>
      ` : ""}
    </article>
  `).join("");
}

function renderTopUsers(users = []) {
  if (!users.length) {
    els.topUsersList.innerHTML = '<div class="empty-state">No top user data yet.</div>';
    return;
  }

  els.topUsersList.innerHTML = users.map((user, index) => `
    <article class="feed-item">
      <div class="feed-head">
        <div>
          <strong>#${index + 1} ${escapeHtml(user.name)}</strong>
          <div class="subtext">${user.username ? `@${escapeHtml(user.username)}` : `ID ${escapeHtml(user.telegramId)}`}</div>
        </div>
        <span class="tag">${formatCompact(user.downloads || 0)}</span>
      </div>
      <div class="tag-row">
        <span class="tag-soft">${formatNumber(user.linkRequests || 0)} requests</span>
        <span class="tag-soft">${formatNumber(user.donationsCount || 0)} donations</span>
        <span class="tag-soft">${formatCurrencyAmount("usd", user.totalDonatedUsd || 0)}</span>
      </div>
    </article>
  `).join("");
}

function buildActionButton(user) {
  const action = user.isBlocked ? "unblock" : "block";
  const className = user.isBlocked ? "unblock" : "block";
  const label = user.isBlocked ? "Unblock user" : "Block user";

  return `
    <button
      class="action-button ${className}"
      data-block-action="${action}"
      data-telegram-id="${user.telegramId}">
      ${label}
    </button>
  `;
}

function getUsersList() {
  const query = (els.usersSearch.value || "").trim().toLowerCase();
  const sortValue = els.usersSort.value || "activity_desc";
  const statusFilter = els.usersStatusFilter.value || "all";
  const languageFilter = els.usersLanguageFilter.value || "all";
  const dayFilter = els.usersDayFilter.value || "all";

  const filtered = (appState.dashboard.users || []).filter((user) => {
    const matchesSearch = !query || [
      user.name,
      user.username,
      String(user.telegramId || ""),
      user.lastLink,
    ].filter(Boolean).some((value) => String(value).toLowerCase().includes(query));

    const matchesStatus = statusFilter === "all"
      || (statusFilter === "blocked" ? user.isBlocked : !user.isBlocked);
    const matchesLanguage = languageFilter === "all" || user.preferredLanguage === languageFilter;
    const matchesDay = matchesDayFilter(user.lastActive || user.joinedAt, dayFilter);

    return matchesSearch && matchesStatus && matchesLanguage && matchesDay;
  });

  const sorters = {
    activity_desc: (a, b) => new Date(b.lastActive || 0) - new Date(a.lastActive || 0),
    downloads_desc: (a, b) => (b.downloads || 0) - (a.downloads || 0),
    requests_desc: (a, b) => (b.linkRequests || 0) - (a.linkRequests || 0),
    donations_desc: (a, b) => (b.donationsCount || 0) - (a.donationsCount || 0),
    joined_desc: (a, b) => new Date(b.joinedAt || 0) - new Date(a.joinedAt || 0),
  };

  return filtered.sort(sorters[sortValue] || sorters.activity_desc);
}

function renderUsers() {
  const users = getUsersList();
  els.usersResultsMeta.textContent = `${formatNumber(users.length)} users`;

  if (!users.length) {
    els.usersTableBody.innerHTML = `
      <tr>
        <td colspan="9">
          <div class="empty-state">No users matched the current filters.</div>
        </td>
      </tr>
    `;
    els.mobileUsersList.innerHTML = '<div class="empty-state">No users matched the current filters.</div>';
    return;
  }

  els.usersTableBody.innerHTML = users.map((user) => `
    <tr>
      <td>
        <div class="user-line"><strong>${escapeHtml(user.name)}</strong></div>
        <div class="user-subtext">${user.username ? `@${escapeHtml(user.username)}` : `ID ${escapeHtml(user.telegramId)}`}</div>
        <div class="user-subtext">Joined ${formatDate(user.joinedAt, false)}</div>
      </td>
      <td>
        <strong>${escapeHtml(getLanguageLabel(user.preferredLanguage))}</strong>
        <div class="user-subtext">${user.lastPlatform ? escapeHtml(getPlatformLabel(user.lastPlatform)) : "No recent platform"}</div>
      </td>
      <td>
        <strong>${formatNumber(user.linkRequests || 0)}</strong>
        <div class="user-subtext">${formatNumber(user.failedDownloads || 0)} failed</div>
      </td>
      <td>
        <strong>${formatNumber(user.downloads || 0)}</strong>
        <div class="user-subtext">${formatNumber(user.videoDownloads || 0)} video • ${formatNumber(user.audioDownloads || 0)} audio</div>
      </td>
      <td>
        <strong>${formatNumber(user.donationsCount || 0)}</strong>
        <div class="user-subtext">${formatCurrencyAmount("usd", user.totalDonatedUsd || 0)} • ${formatCurrencyAmount("khr", user.totalDonatedKhr || 0)}</div>
      </td>
      <td>
        <strong>${formatDate(user.lastActive)}</strong>
        <div class="user-subtext">${user.lastDonationAt ? `Last donation ${formatRelative(user.lastDonationAt)}` : "No donation yet"}</div>
      </td>
      <td>
        ${user.lastLink ? `
          <a class="link-pill" href="${escapeHtml(getLinkHref(user.lastLink))}" target="_blank" rel="noreferrer noopener">
            <i class="ph ph-link-simple"></i>
            ${escapeHtml(truncate(user.lastLink, 38))}
          </a>
        ` : '<span class="user-subtext">No link submitted</span>'}
      </td>
      <td>
        <div class="tag-row">
          ${user.isBlocked ? '<span class="tag-danger">Blocked</span>' : '<span class="tag">Allowed</span>'}
          ${user.lastMediaType ? `<span class="tag-soft">${escapeHtml(getMediaLabel(user.lastMediaType))}</span>` : ""}
        </div>
      </td>
      <td>${buildActionButton(user)}</td>
    </tr>
  `).join("");

  els.mobileUsersList.innerHTML = users.map((user) => `
    <article class="responsive-card">
      <div class="feed-head">
        <div>
          <strong>${escapeHtml(user.name)}</strong>
          <div class="subtext">${user.username ? `@${escapeHtml(user.username)}` : `ID ${escapeHtml(user.telegramId)}`}</div>
        </div>
        ${user.isBlocked ? '<span class="tag-danger">Blocked</span>' : '<span class="tag">Allowed</span>'}
      </div>
      <div class="tag-row">
        <span class="tag-soft">${escapeHtml(getLanguageLabel(user.preferredLanguage))}</span>
        <span class="tag-soft">${formatNumber(user.downloads || 0)} downloads</span>
        <span class="tag-soft">${formatNumber(user.donationsCount || 0)} donations</span>
      </div>
      <div class="tag-row">
        <span class="tag-soft">${formatCurrencyAmount("usd", user.totalDonatedUsd || 0)}</span>
        <span class="tag-soft">${formatCurrencyAmount("khr", user.totalDonatedKhr || 0)}</span>
      </div>
      <p class="subtext">Active ${formatRelative(user.lastActive)}${user.lastPlatform ? ` • ${escapeHtml(getPlatformLabel(user.lastPlatform))}` : ""}</p>
      ${user.lastLink ? `
        <div class="tag-row">
          <a class="link-pill" href="${escapeHtml(getLinkHref(user.lastLink))}" target="_blank" rel="noreferrer noopener">
            <i class="ph ph-link-simple"></i>
            ${escapeHtml(truncate(user.lastLink, 42))}
          </a>
        </div>
      ` : ""}
      ${buildActionButton(user)}
    </article>
  `).join("");
}

function getDonationsList() {
  const query = (els.donationsSearch.value || "").trim().toLowerCase();
  const sortValue = els.donationsSort.value || "created_desc";
  const statusFilter = els.donationsStatusFilter.value || "all";
  const currencyFilter = els.donationsCurrencyFilter.value || "all";
  const dayFilter = els.donationsDayFilter.value || "all";

  const filtered = (appState.dashboard.donations || []).filter((donation) => {
    const matchesSearch = !query || [
      donation.name,
      donation.username,
      donation.billNumber,
      donation.md5,
      String(donation.telegramId || ""),
    ].filter(Boolean).some((value) => String(value).toLowerCase().includes(query));

    const matchesStatus = statusFilter === "all" || donation.status === statusFilter;
    const matchesCurrency = currencyFilter === "all" || donation.currencyCode === currencyFilter;
    const matchesDay = matchesDayFilter(donation.createdAt, dayFilter);

    return matchesSearch && matchesStatus && matchesCurrency && matchesDay;
  });

  const sorters = {
    created_desc: (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
    created_asc: (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0),
    amount_desc: (a, b) => (b.amount || 0) - (a.amount || 0),
    amount_asc: (a, b) => (a.amount || 0) - (b.amount || 0),
    paid_desc: (a, b) => new Date(b.paidAt || 0) - new Date(a.paidAt || 0),
  };

  return filtered.sort(sorters[sortValue] || sorters.created_desc);
}

function renderDonationStats(stats = {}) {
  const cards = [
    { label: "All donations", value: formatNumber(stats.totalDonations || 0), hint: "All records" },
    { label: "Pending", value: formatNumber(stats.pendingDonations || 0), hint: "Awaiting payment" },
    { label: "Paid", value: formatNumber(stats.successfulDonations || 0), hint: "Successful payments" },
    { label: "Expired", value: formatNumber(stats.expiredDonations || 0), hint: "Expired QR sessions" },
    { label: "USD total", value: formatCurrencyAmount("usd", stats.totalDonatedUsd || 0), hint: "Paid USD" },
    { label: "KHR total", value: formatCurrencyAmount("khr", stats.totalDonatedKhr || 0), hint: "Paid KHR" },
  ];

  els.donationStatsGrid.innerHTML = cards.map((card) => `
    <article class="mini-stat-card">
      <span>${escapeHtml(card.label)}</span>
      <strong>${escapeHtml(card.value)}</strong>
      <small>${escapeHtml(card.hint)}</small>
    </article>
  `).join("");
}

function renderDonations() {
  const donations = getDonationsList();
  els.donationsResultsMeta.textContent = `${formatNumber(donations.length)} donations`;

  if (!donations.length) {
    els.donationsTableBody.innerHTML = `
      <tr>
        <td colspan="8">
          <div class="empty-state">No donation records matched the current filters.</div>
        </td>
      </tr>
    `;
    els.mobileDonationsList.innerHTML = '<div class="empty-state">No donation records matched the current filters.</div>';
    return;
  }

  els.donationsTableBody.innerHTML = donations.map((donation) => {
    const statusMeta = getDonationStatusMeta(donation.status);

    return `
      <tr>
        <td>
          <div class="user-line"><strong>${escapeHtml(donation.name || "Unknown user")}</strong></div>
          <div class="user-subtext">${donation.username ? `@${escapeHtml(donation.username)}` : `ID ${escapeHtml(donation.telegramId)}`}</div>
          <div class="user-subtext">${escapeHtml(getLanguageLabel(donation.preferredLanguage))}</div>
        </td>
        <td>
          <strong>${escapeHtml(formatCurrencyAmount(donation.currencyCode, donation.amount))}</strong>
          <div class="user-subtext">${escapeHtml((donation.currencyCode || "").toUpperCase())}</div>
        </td>
        <td>
          <span class="${statusMeta.className}">${escapeHtml(statusMeta.label)}</span>
        </td>
        <td>${formatDate(donation.createdAt)}</td>
        <td>${donation.paidAt ? formatDate(donation.paidAt) : '<span class="user-subtext">Not paid</span>'}</td>
        <td>${donation.expiresAt ? formatDate(donation.expiresAt) : '<span class="user-subtext">No expiry</span>'}</td>
        <td>
          <div class="user-subtext">${escapeHtml(donation.billNumber || "No bill")}</div>
          <div class="user-subtext mono">${escapeHtml(truncate(donation.md5 || "-", 26))}</div>
        </td>
        <td>
          <div class="tag-row">
            ${donation.transactionHash ? `<span class="tag-soft mono">${escapeHtml(truncate(donation.transactionHash, 18))}</span>` : ""}
            ${donation.paywayLink ? `
              <a class="link-pill" href="${escapeHtml(getLinkHref(donation.paywayLink))}" target="_blank" rel="noreferrer noopener">
                <i class="ph ph-link-simple"></i>
                PayWay
              </a>
            ` : ""}
          </div>
          ${donation.errorMessage ? `<p class="subtext">${escapeHtml(donation.errorMessage)}</p>` : ""}
        </td>
      </tr>
    `;
  }).join("");

  els.mobileDonationsList.innerHTML = donations.map((donation) => {
    const statusMeta = getDonationStatusMeta(donation.status);

    return `
      <article class="responsive-card">
        <div class="feed-head">
          <div>
            <strong>${escapeHtml(donation.name || "Unknown user")}</strong>
            <div class="subtext">${donation.username ? `@${escapeHtml(donation.username)}` : `ID ${escapeHtml(donation.telegramId)}`}</div>
          </div>
          <span class="${statusMeta.className}">${escapeHtml(statusMeta.label)}</span>
        </div>
        <div class="tag-row">
          <span class="tag-soft">${escapeHtml(formatCurrencyAmount(donation.currencyCode, donation.amount))}</span>
          <span class="tag-soft">${escapeHtml(donation.billNumber || "No bill")}</span>
        </div>
        <p class="subtext">Created ${formatRelative(donation.createdAt)}${donation.paidAt ? ` • Paid ${formatRelative(donation.paidAt)}` : ""}</p>
        <div class="tag-row">
          ${donation.transactionHash ? `<span class="tag-soft mono">${escapeHtml(truncate(donation.transactionHash, 18))}</span>` : ""}
          ${donation.paywayLink ? `
            <a class="link-pill" href="${escapeHtml(getLinkHref(donation.paywayLink))}" target="_blank" rel="noreferrer noopener">
              <i class="ph ph-link-simple"></i>
              PayWay
            </a>
          ` : ""}
        </div>
        ${donation.errorMessage ? `<p class="subtext">${escapeHtml(donation.errorMessage)}</p>` : ""}
      </article>
    `;
  }).join("");
}

function createGradient(context, colorA, colorB) {
  const gradient = context.createLinearGradient(0, 0, 0, 320);
  gradient.addColorStop(0, colorA);
  gradient.addColorStop(1, colorB);
  return gradient;
}

function getChartBaseOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: "#334155",
          font: { family: "Manrope", size: 12 },
        },
      },
      tooltip: {
        backgroundColor: "#09111e",
        titleColor: "#ffffff",
        bodyColor: "#d8e5ff",
        padding: 12,
      },
    },
    scales: {
      x: {
        ticks: {
          color: "#64748b",
          font: { family: "Manrope", size: 11 },
        },
        grid: { display: false },
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: "#64748b",
          font: { family: "Manrope", size: 11 },
        },
        grid: {
          color: "rgba(148, 163, 184, 0.16)",
        },
      },
    },
  };
}

function upsertCharts(charts = {}) {
  const downloadsContext = document.getElementById("downloadsChart").getContext("2d");
  const signupsContext = document.getElementById("signupsChart").getContext("2d");
  const donationsContext = document.getElementById("donationsChart").getContext("2d");

  const labels = charts.labels || [];
  const baseOptions = getChartBaseOptions();

  const downloadsData = {
    labels,
    datasets: [
      {
        label: "Downloads",
        data: charts.downloads || [],
        borderColor: "#0f766e",
        backgroundColor: createGradient(downloadsContext, "rgba(15, 118, 110, 0.28)", "rgba(15, 118, 110, 0.02)"),
        fill: true,
        tension: 0.35,
        borderWidth: 3,
        pointRadius: 3,
      },
      {
        label: "Failures",
        data: charts.failures || [],
        borderColor: "#dc2626",
        backgroundColor: "rgba(220, 38, 38, 0.04)",
        fill: false,
        tension: 0.35,
        borderWidth: 2,
        pointRadius: 3,
      },
    ],
  };

  const signupsData = {
    labels,
    datasets: [
      {
        label: "New users",
        data: charts.signups || [],
        borderRadius: 12,
        borderSkipped: false,
        backgroundColor: createGradient(signupsContext, "rgba(14, 165, 233, 0.92)", "rgba(6, 182, 212, 0.65)"),
      },
    ],
  };

  const donationsData = {
    labels,
    datasets: [
      {
        label: "Created",
        data: charts.donationsCreated || [],
        borderColor: "#f97316",
        backgroundColor: createGradient(donationsContext, "rgba(249, 115, 22, 0.24)", "rgba(249, 115, 22, 0.02)"),
        fill: true,
        tension: 0.35,
        borderWidth: 3,
        pointRadius: 3,
      },
      {
        label: "Paid",
        data: charts.donationsPaid || [],
        borderColor: "#16a34a",
        backgroundColor: "rgba(22, 163, 74, 0.05)",
        fill: false,
        tension: 0.35,
        borderWidth: 2,
        pointRadius: 3,
      },
    ],
  };

  if (!downloadsChart) {
    downloadsChart = new Chart(downloadsContext, {
      type: "line",
      data: downloadsData,
      options: baseOptions,
    });
  } else {
    downloadsChart.data = downloadsData;
    downloadsChart.update();
  }

  if (!signupsChart) {
    signupsChart = new Chart(signupsContext, {
      type: "bar",
      data: signupsData,
      options: {
        ...baseOptions,
        plugins: {
          ...baseOptions.plugins,
          legend: { display: false },
        },
      },
    });
  } else {
    signupsChart.data = signupsData;
    signupsChart.update();
  }

  if (!donationsChart) {
    donationsChart = new Chart(donationsContext, {
      type: "line",
      data: donationsData,
      options: baseOptions,
    });
  } else {
    donationsChart.data = donationsData;
    donationsChart.update();
  }
}

function renderMeta(stats = {}, generatedAt) {
  const failedDownloads = stats.failedDownloads || 0;
  const failedDonations = stats.failedDonationStates || 0;
  const unhealthy = failedDownloads > Math.max(5, (stats.totalDownloads || 0) / 2)
    || failedDonations > Math.max(3, (stats.totalDonations || 0) / 2);

  els.generatedAt.textContent = formatRelative(generatedAt);
  els.topGeneratedAt.textContent = formatRelative(generatedAt);
  els.moderationState.textContent = `${formatNumber(stats.blockedUsers || 0)} blocked`;
  els.healthState.textContent = unhealthy ? "Needs attention" : "Healthy";
  els.footerMeta.textContent = `Updated ${formatRelative(generatedAt)} • ${formatNumber(stats.totalDownloads || 0)} downloads • ${formatNumber(stats.totalDonations || 0)} donations`;
  els.topDonationStat.textContent = `${formatNumber(stats.successfulDonations || 0)} paid`;
}

function renderDashboard(payload = {}) {
  appState.dashboard = payload;

  renderHeroSummary(payload.stats || {});
  buildStatsCards(payload.stats || {});
  renderBreakdown(els.platformBreakdown, payload.breakdowns?.platforms || [], formatCompact);
  renderBreakdown(els.mediaBreakdown, payload.breakdowns?.mediaTypes || [], formatCompact);
  renderBreakdown(els.languageBreakdown, payload.breakdowns?.languages || [], formatCompact);
  renderBreakdown(els.donationStatusBreakdown, payload.breakdowns?.donationStatuses || [], formatCompact);
  renderBreakdown(els.donationCurrencyBreakdown, payload.breakdowns?.donationCurrencies || [], formatCompact);
  renderActiveSnapshot(payload.activeUsers || []);
  renderRecentDownloads(payload.recentDownloads || []);
  renderRecentDonations(payload.recentDonations || []);
  renderActiveUsers(payload.activeUsers || []);
  renderTopUsers(payload.topUsers || []);
  renderUsers();
  renderDonationStats(payload.stats || {});
  renderDonations();
  upsertCharts(payload.charts || {});
  renderMeta(payload.stats || {}, payload.generatedAt);
}

async function handleBlockAction(button) {
  const telegramId = button.dataset.telegramId;
  const action = button.dataset.blockAction;
  const endpoint = `/api/users/${telegramId}/${action}`;

  button.disabled = true;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(payload.message || "Request failed");
    }

    showToast(action === "block" ? "User blocked successfully." : "User unblocked successfully.");
  } catch (error) {
    console.error(error);
    showToast(error.message || "Unable to update user status.", "error");
  } finally {
    button.disabled = false;
  }
}

function startUptimeTicker() {
  els.uptimeValue.textContent = formatUptime(appState.uptimeSeconds);

  window.setInterval(() => {
    appState.uptimeSeconds += 1;
    els.uptimeValue.textContent = formatUptime(appState.uptimeSeconds);
  }, 1000);
}

function bindFilters() {
  [
    els.usersSearch,
    els.usersSort,
    els.usersStatusFilter,
    els.usersLanguageFilter,
    els.usersDayFilter,
  ].forEach((element) => {
    const eventName = element.tagName === "INPUT" ? "input" : "change";
    element.addEventListener(eventName, () => renderUsers());
  });

  [
    els.donationsSearch,
    els.donationsSort,
    els.donationsStatusFilter,
    els.donationsCurrencyFilter,
    els.donationsDayFilter,
  ].forEach((element) => {
    const eventName = element.tagName === "INPUT" ? "input" : "change";
    element.addEventListener(eventName, () => renderDonations());
  });
}

document.addEventListener("click", (event) => {
  const navButton = event.target.closest("[data-panel-target]");
  if (navButton) {
    setActivePanel(navButton.dataset.panelTarget);
    return;
  }

  const blockButton = event.target.closest("[data-block-action]");
  if (blockButton) {
    handleBlockAction(blockButton);
  }
});

els.sidebarToggle.addEventListener("click", openSidebar);
els.sidebarBackdrop.addEventListener("click", closeSidebar);

const socket = io();

socket.on("connect", () => {
  els.socketDot.classList.remove("offline");
  els.socketStatusText.textContent = "Live sync connected";
});

socket.on("disconnect", () => {
  els.socketDot.classList.add("offline");
  els.socketStatusText.textContent = "Live sync disconnected";
});

socket.on("update_stats", (payload) => {
  renderDashboard(payload);
});

bindFilters();
renderDashboard(appState.dashboard);
startUptimeTicker();
