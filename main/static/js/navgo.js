(function () {
    let light = false;
    const themeBtn = document.getElementById("themeToggle");
    if (themeBtn) {
        themeBtn.addEventListener("click", () => {
            light = !light;
            document.documentElement.setAttribute(
                "data-theme",
                light ? "light" : "",
            );
            themeBtn.setAttribute(
                "aria-label",
                light ? "Switch to dark theme" : "Switch to light theme",
            );
        });
    }

    const hamburger = document.getElementById("hamburger");
    const sidebar = document.getElementById("sidebar");
    if (hamburger && sidebar) {
        hamburger.addEventListener("click", () => {
            const open = sidebar.classList.toggle("open");
            hamburger.setAttribute("aria-expanded", open);
        });

        document.addEventListener("click", (e) => {
            if (
                window.innerWidth <= 860 &&
                sidebar.classList.contains("open") &&
                !sidebar.contains(e.target) &&
                !hamburger.contains(e.target)
            ) {
                sidebar.classList.remove("open");
                hamburger.setAttribute("aria-expanded", "false");
            }
        });
    }

    window.showToast = function (msg, color) {
        const t = document.getElementById("toast");
        if (!t) return;
        t.textContent = "✓ " + msg;
        t.style.borderColor = color ? `${color}55` : "";
        t.style.color = color || "";
        t.classList.add("show");
        clearTimeout(window._toastTimer);
        window._toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
    };

    const page = window.location.pathname.split("/").pop();
    document.querySelectorAll(".sb-link").forEach((link) => {
        const href = link.getAttribute("href");
        if (href && href === page) {
            link.classList.add("active");
            link.setAttribute("aria-current", "page");
        }
    });
})();

/* ══════════════════════════════════════════════════
   NOTIFICATION SYSTEM
   Auto-runs on every page that includes navgo.js.
   Requires the bell HTML in the topnav (see below).

   HTML TO ADD to your topnav .nav-r div,
   right before the theme toggle button:

   <div class="notif-wrap" id="notifWrap">
     <button class="notif-btn" id="notifBtn"
             aria-label="Notifications" aria-expanded="false"
             aria-haspopup="true">
       🔔
       <span class="notif-badge" id="notifBadge" aria-live="polite"></span>
     </button>
     <div class="notif-dropdown" id="notifDropdown" role="menu">
       <div class="notif-header">
         <span class="notif-header-title">NOTIFICATIONS</span>
         <button class="notif-mark-all" id="notifMarkAll">MARK ALL READ</button>
       </div>
       <div class="notif-list" id="notifList"></div>
       <div class="notif-footer">
         <a href="#" class="notif-footer-link">ALL CAUGHT UP</a>
       </div>
     </div>
   </div>

══════════════════════════════════════════════════ */

(function () {
    /* ── Type config — icon + label for each notif type ── */
    const NOTIF_CONFIG = {
        bao_restock: { icon: "📦", label: "BAO RESTOCK" },
        clinic: { icon: "🏥", label: "CLINIC" },
        sc_reserved: { icon: "🔖", label: "SC RESERVED" },
        sc_contacted: { icon: "💬", label: "SC CONTACT" },
    };

    /* ── CSRF helper ── */
    function getCookie(name) {
        let v = null;
        if (document.cookie) {
            document.cookie.split(";").forEach((c) => {
                c = c.trim();
                if (c.startsWith(name + "="))
                    v = decodeURIComponent(c.slice(name.length + 1));
            });
        }
        return v;
    }

    /* ── Element refs ── */
    const btn = document.getElementById("notifBtn");
    const badge = document.getElementById("notifBadge");
    const dropdown = document.getElementById("notifDropdown");
    const list = document.getElementById("notifList");
    const markAll = document.getElementById("notifMarkAll");

    /* If the bell HTML isn't on this page, do nothing */
    if (!btn || !dropdown || !list) return;

    /* ── Toggle dropdown ── */
    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const open = dropdown.classList.toggle("open");
        btn.setAttribute("aria-expanded", open);
    });

    /* ── Close when clicking outside ── */
    document.addEventListener("click", (e) => {
        const wrap = document.getElementById("notifWrap");
        if (wrap && !wrap.contains(e.target)) {
            dropdown.classList.remove("open");
            btn.setAttribute("aria-expanded", "false");
        }
    });

    /* ── Mark all read ── */
    if (markAll) {
        markAll.addEventListener("click", (e) => {
            e.stopPropagation();
            fetch("/notifications/mark-read/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": getCookie("csrftoken"),
                },
                body: JSON.stringify({ id: "all" }),
            })
                .then((r) => r.json())
                .then((data) => {
                    if (data.ok) {
                        renderNotifications([]);
                        updateBadge(0);
                    }
                })
                .catch(() => {});
        });
    }

    /* ── Mark single notification read + navigate ── */
    function markRead(notifId, link) {
        fetch("/notifications/mark-read/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": getCookie("csrftoken"),
            },
            body: JSON.stringify({ id: notifId }),
        })
            .then((r) => r.json())
            .then(() => {
                if (link) window.location.href = link;
            })
            .catch(() => {
                if (link) window.location.href = link;
            });
    }

    /* ── Update badge count ── */
    function updateBadge(count) {
        if (!badge) return;
        if (count > 0) {
            badge.textContent = count > 9 ? "9+" : count;
            badge.classList.add("visible");
            btn.classList.add("has-unread");
            btn.setAttribute(
                "aria-label",
                `${count} unread notification${count > 1 ? "s" : ""}`,
            );
        } else {
            badge.textContent = "";
            badge.classList.remove("visible");
            btn.classList.remove("has-unread");
            btn.setAttribute("aria-label", "Notifications — none unread");
        }
    }

    /* ── Render notification list into dropdown ── */
    function renderNotifications(notifications) {
        list.innerHTML = "";

        if (!notifications || notifications.length === 0) {
            list.innerHTML = `
        <div class="notif-empty">
          <div class="notif-empty-icon">🔔</div>
          <p class="notif-empty-text">YOU'RE ALL CAUGHT UP.<br/>NO NEW NOTIFICATIONS.</p>
        </div>`;
            return;
        }

        notifications.forEach((n) => {
            const cfg = NOTIF_CONFIG[n.type] || { icon: "📌", label: "INFO" };
            const item = document.createElement("div");
            // NEW: Add a read class if the notification is already read
            item.className = "notif-item" + (n.is_read ? " notif-read" : "");
            
            // NEW: Apply inline opacity if read
            if (n.is_read) item.style.opacity = "0.5";
            item.setAttribute("role", "menuitem");
            item.setAttribute("tabindex", "0");
            item.setAttribute("aria-label", n.message);

            item.innerHTML = `
        <div class="notif-icon ${n.type}" aria-hidden="true">${cfg.icon}</div>
        <div class="notif-body">
          <p class="notif-msg">${n.message}</p>
          <span class="notif-time">${cfg.label} · ${n.created_at}</span>
        </div>`;

            /* Click → mark read and navigate */
            const go = () => markRead(n.id, n.link || null);
            item.addEventListener("click", go);
            item.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    go();
                }
            });

            list.appendChild(item);
        });
    }

    /* ── Fetch notifications from Django ── */
    function fetchNotifications() {
        fetch("/notifications/")
            .then((r) => r.json())
            .then((data) => {
                const count = data.count || 0;
                updateBadge(count);
                renderNotifications(data.notifications || []);
            })
            .catch(() => {
                /* Silently fail — user might not be logged in */
            });
    }

    /* ── Run on page load ── */
    fetchNotifications();

    /* ── Refresh every 60 seconds while page is open ── */
    setInterval(fetchNotifications, 60000);
})();
