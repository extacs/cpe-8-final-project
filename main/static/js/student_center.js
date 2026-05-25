let currentCat = "all";
let currentSort = "newest";
let currentTab = "browse";
let currentImgB64 =
    null; /* base64 string from FileReader (read using AJAX to JSON, ok)*/

// CSRF helper
function getCookie(name) {
    let val = null;
    if (document.cookie) {
        document.cookie.split(";").forEach((c) => {
            c = c.trim();
            if (c.startsWith(name + "="))
                val = decodeURIComponent(c.slice(name.length + 1));
        });
    }
    return val;
}

function switchTab(tab) {
    currentTab = tab;
    document
        .getElementById("tab-browse")
        .classList.toggle("active", tab === "browse");
    document
        .getElementById("tab-mine")
        .classList.toggle("active", tab === "mine");
    document
        .getElementById("tab-browse")
        .setAttribute("aria-selected", tab === "browse");
    document
        .getElementById("tab-mine")
        .setAttribute("aria-selected", tab === "mine");
    document.getElementById("panel-browse").style.display =
        tab === "browse" ? "block" : "none";
    document.getElementById("panel-mine").style.display =
        tab === "mine" ? "block" : "none";

    if (tab === "mine") loadMyListings();
}

function setCat(btn, cat) {
    document.querySelectorAll(".fb").forEach((b) => {
        b.classList.remove("active");
        b.setAttribute("aria-pressed", "false");
    });
    btn.classList.add("active");
    btn.setAttribute("aria-pressed", "true");
    currentCat = cat;
    loadListings();
}

function filterListings() {
    loadListings();
}

function loadListings() {
    const q = (document.getElementById("searchInput").value || "").trim();
    const sort = document.getElementById("sortSelect").value || "newest";
    currentSort = sort;

    const params = new URLSearchParams({ cat: currentCat, q, sort });
    const grid = document.getElementById("listingsGrid");
    grid.innerHTML =
        '<div style="grid-column:1/-1;text-align:center;padding:40px;font-family:var(--font-px);font-size:6px;color:var(--c-dim);letter-spacing:.1em;">LOADING...</div>';

    fetch(`/student-center/listings/?${params}`)
        .then((r) => r.json())
        .then((data) => renderListings(data.listings || []))
        .catch(() => {
            grid.innerHTML =
                '<div style="grid-column:1/-1;text-align:center;padding:40px;font-family:var(--font-px);font-size:6px;color:#f08080;letter-spacing:.1em;">FAILED TO LOAD LISTINGS.</div>';
        });
}

const CAT_ICONS = {
    books: "📚",
    uniform: "👔",
    electronics: "💻",
    merch: "🎽",
    food: "🍱",
    services: "🛠",
    other: "📦",
};
const CAT_LABELS = {
    books: "Books / Modules",
    uniform: "Uniform / Clothing",
    electronics: "Electronics",
    merch: "Merch / Accessories",
    food: "Food / Snacks",
    services: "Services",
    other: "Other",
};

function renderListings(listings) {
    const grid = document.getElementById("listingsGrid");
    grid.innerHTML = "";

    if (listings.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1;">
                <div class="es-icon" aria-hidden="true">🔍</div>
                <p class="es-title">NO LISTINGS FOUND</p>
                <p class="es-sub">Try a different search or category.</p>
            </div>`;
        return;
    }

    listings.forEach((item) => {
        const isFree = item.is_free || item.condition === "For Free";
        const priceStr = isFree
            ? "FREE"
            : `₱${parseFloat(item.price).toLocaleString()}`;
        const isSold = item.status === "sold";
        const isReserved = item.status === "reserved";

        const statusChip = isSold
            ? '<span class="status-chip sc-sold">SOLD</span>'
            : isReserved
              ? '<span class="status-chip sc-reserved">RESERVED</span>'
              : '<span class="status-chip sc-available">AVAILABLE</span>';

        const eventChip = item.is_event
            ? `<span class="status-chip sc-event" style="margin-left:4px;">⚡ EVENT</span>`
            : "";

        const imgContent = item.image_base64
            ? `<img src="${item.image_base64}" alt="${item.title}" style="width:100%;height:100%;object-fit:cover;display:block;"/>`
            : `<span class="lc-img-placeholder">${CAT_ICONS[item.category] || "📦"}</span>`;

        const soldOverlay = isSold
            ? `<div class="sold-overlay"><div class="sold-stamp">SOLD</div></div>`
            : "";

        const actionBtns = isSold
            ? `<button class="lc-btn sold-btn" disabled>UNAVAILABLE</button>`
            : isReserved
              ? `<button class="lc-btn contact" onclick="event.stopPropagation();contactSeller(${item.id},'${item.poster_name}')">💬 CONTACT</button>`
              : `<button class="lc-btn reserve" onclick="event.stopPropagation();reserveItem(${item.id},this)">🔖 RESERVE</button>
                   <button class="lc-btn contact" onclick="event.stopPropagation();contactSeller(${item.id},'${item.poster_name}')">💬 CONTACT</button>`;

        const eventCd = item.is_event
            ? `<div class="event-countdown" id="ev-cd-${item.id}">⏱ EVENT LISTING</div>`
            : "";

        const avatarHtml = item.poster_pfp
        ? `<div class="lc-avatar" style="background-image: url('${item.poster_pfp}'); background-size: cover; background-position: center; color: transparent;"></div>`
        : `<div class="lc-avatar">${item.poster_name ? item.poster_name[0].toUpperCase() : "?"}</div>`;

        const card = document.createElement("div");
        card.className = `listing-card${item.is_event ? " event-item" : ""}${isSold ? " sold" : ""}`;
        card.setAttribute("role", "listitem");
        card.setAttribute("tabindex", "0");
        card.innerHTML = `
            <div class="lc-img">${imgContent}${soldOverlay}</div>
            <div class="lc-status">${statusChip}${eventChip}</div>
            <div class="lc-body">
                <p class="lc-cat">${CAT_LABELS[item.category] || item.category}${item.is_event && item.event_label ? " · " + item.event_label : ""}</p>
                <h3 class="lc-title">${item.title}</h3>
                <p class="lc-desc">${item.description || ""}</p>
                <div class="lc-meta">
                    <span class="lc-price${isFree ? " free" : ""}">${priceStr}</span>
                    <span class="lc-cond">${item.condition}</span>
                </div>
                <div class="lc-poster">
                    ${avatarHtml}
                    <span class="lc-name">${item.poster_name}</span>
                    <span class="lc-time" style="margin-left:auto;">${item.time_ago}</span>
                </div>
            </div>
            ${eventCd}
            <div class="lc-actions">${actionBtns}</div>`;

        card.addEventListener("click", () => openDetail(item));
        card.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openDetail(item);
            }
        });
        grid.appendChild(card);
    });
}


function loadMyListings() {
    const wrap = document.getElementById("myListingsWrap");
    wrap.innerHTML =
        '<div style="font-family:var(--font-px);font-size:6px;color:var(--c-dim);padding:20px;letter-spacing:.1em;">LOADING...</div>';

    fetch("/student-center/my-listings/")
        .then((r) => r.json())
        .then((data) => renderMyListings(data.listings || []))
        .catch(() => {
            wrap.innerHTML =
                '<div style="font-family:var(--font-px);font-size:6px;color:#f08080;padding:20px;letter-spacing:.1em;">FAILED TO LOAD.</div>';
        });
}

function renderMyListings(listings) {
    const wrap = document.getElementById("myListingsWrap");
    wrap.innerHTML = "";

    if (listings.length === 0) {
        wrap.innerHTML = `
            <div class="empty-state">
                <div class="es-icon" aria-hidden="true">📦</div>
                <p class="es-title">NO LISTINGS YET</p>
                <p class="es-sub">Hit "Post Item" to start selling.</p>
            </div>`;
        return;
    }

    listings.forEach((item) => {
        const isFree = item.is_free || item.condition === "For Free";
        const priceStr = isFree
            ? "FREE"
            : `₱${parseFloat(item.price).toLocaleString()}`;
        const statusCol =
            item.status === "sold"
                ? "#f08080"
                : item.status === "reserved"
                  ? "#e6b800"
                  : "var(--c-lime)";

        const imgContent = item.image_base64
            ? `<img src="${item.image_base64}" alt="${item.title}" style="width:100%;height:100%;object-fit:cover;border-radius:4px;"/>`
            : `<span>${CAT_ICONS[item.category] || "📦"}</span>`;

        const row = document.createElement("div");
        row.className = "my-listing-row";
        row.setAttribute("role", "listitem");
        row.innerHTML = `
            <div class="ml-thumb">${imgContent}</div>
            <div class="ml-body">
                <p class="ml-title">${item.title}</p>
                <p class="ml-meta">${priceStr} · ${item.condition} ·
                    <span style="color:${statusCol};font-family:var(--font-px);font-size:5px;">${item.status.toUpperCase()}</span>
                    · ${item.time_ago}
                </p>
            </div>
            <div class="ml-actions">
                ${
                    item.status === "available" || item.status === "reserved"
                        ? `<button class="ml-btn mark-sold" onclick="markSold(${item.id},this)">✓ MARK SOLD</button>`
                        : ""
                }
                <button class="ml-btn danger" onclick="deleteListing(${item.id},this)">✕ DELETE</button>
            </div>`;
        wrap.appendChild(row);
    });
}


function reserveItem(id, btn) {
    btn.disabled = true;
    fetch("/student-center/reserve/", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": getCookie("csrftoken"),
        },
        body: JSON.stringify({ listing_id: id }),
    })
        .then((r) => r.json())
        .then((data) => {
            if (data.ok) {
                showToast(
                    "Item reserved! Contact the seller to arrange meetup.",
                );
                loadListings();
            } else {
                showToast(data.error || "Could not reserve item.");
                btn.disabled = false;
            }
        })
        .catch(() => {
            showToast("Connection error.");
            btn.disabled = false;
        });
}


function markSold(id, btn) {
    btn.disabled = true;
    fetch("/student-center/mark-sold/", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": getCookie("csrftoken"),
        },
        body: JSON.stringify({ listing_id: id }),
    })
        .then((r) => r.json())
        .then((data) => {
            if (data.ok) {
                showToast("Listing marked as sold!");
                loadMyListings();
            } else {
                showToast(data.error || "Failed.");
                btn.disabled = false;
            }
        })
        .catch(() => {
            showToast("Connection error.");
            btn.disabled = false;
        });
}


function deleteListing(id, btn) {
    if (!confirm("Delete this listing? This cannot be undone.")) return;
    btn.disabled = true;
    fetch("/student-center/delete-listing/", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": getCookie("csrftoken"),
        },
        body: JSON.stringify({ listing_id: id }),
    })
        .then((r) => r.json())
        .then((data) => {
            if (data.ok) {
                showToast("Listing deleted.");
                loadMyListings();
            } else {
                showToast(data.error || "Failed.");
                btn.disabled = false;
            }
        })
        .catch(() => {
            showToast("Connection error.");
            btn.disabled = false;
        });
}


function contactSeller(id, name) {
    showToast(`Sending contact notification to ${name}...`);
    
    fetch("/student-center/contact/", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": getCookie("csrftoken"),
        },
        body: JSON.stringify({ listing_id: id }),
    })
        .then((r) => r.json())
        .then((data) => {
            if (data.ok) {
                showToast(`Seller ${name} has been notified!`);
            } else {
                showToast(data.error || "Could not contact seller.");
            }
        })
        .catch(() => {
            showToast("Connection error.");
        });
}

/* ══════════════════════════════════════════════
   POST item modal
══════════════════════════════════════════════ */
function openPostModal() {
    currentImgB64 = null;
    document.getElementById("imgPreview").style.display = "none";
    document.getElementById("uploadPlaceholder").style.display = "block";
    document.getElementById("uploadArea").classList.remove("has-img");
    ["p-title", "p-desc", "p-price", "p-contact"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });
    const freeToggle = document.getElementById("p-free");
    if (freeToggle) freeToggle.checked = false;
    const priceField = document.getElementById("p-price");
    if (priceField) priceField.disabled = false;
    const eventToggle = document.getElementById("p-event");
    if (eventToggle) eventToggle.checked = false;
    const eventLabel = document.getElementById("p-event-label");
    if (eventLabel) {
        eventLabel.style.display = "none";
    }
    document.getElementById("postModal").classList.add("open");
}

function closePostModal(force = false) {
    if (!force) {
        const title = (document.getElementById("p-title").value || "").trim();
        const desc = (document.getElementById("p-desc").value || "").trim();
        const hasImage = currentImgB64 !== null;

        if (title || desc || hasImage) {
            const discard = confirm("Discard your post? (pls dont) Any unsaved details will be lost.");
            if (!discard) {
                return; 
            }
        }
    }
    
    document.getElementById("postModal").classList.remove("open");
}

function previewImg(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
        showToast("Image must be under 5MB.");
        return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
        currentImgB64 = ev.target.result; /* data:image/jpeg;base64,... */
        const preview = document.getElementById("imgPreview");
        preview.src = currentImgB64;
        preview.style.display = "block";
        document.getElementById("uploadPlaceholder").style.display = "none";
        document.getElementById("uploadArea").classList.add("has-img");
    };
    reader.readAsDataURL(file);
}

function toggleFree(cb) {
    const priceInput = document.getElementById("p-price");
    if (priceInput) priceInput.disabled = cb.checked;
    if (cb.checked && priceInput) priceInput.value = "";
}

function toggleEventLabel(cb) {
    const labelWrap = document.getElementById("p-event-label");
    if (labelWrap) labelWrap.style.display = cb.checked ? "flex" : "none";
}


function submitPost() {
    const title = (document.getElementById("p-title").value || "").trim();
    const cat = document.getElementById("p-cat").value;
    const cond = document.getElementById("p-cond").value;
    const isFree =
        document.getElementById("p-free").checked || cond === "For Free";
    const price = isFree
        ? 0
        : parseFloat(document.getElementById("p-price").value) || 0;
    const desc = (document.getElementById("p-desc").value || "").trim();
    const contact = (document.getElementById("p-contact").value || "").trim();
    const isEvent = document.getElementById("p-event").checked;
    const evLabelEl = document.getElementById("p-event-label-input");
    const evLabel = evLabelEl ? (evLabelEl.value || "").trim() : "";

    if (!title) {
        showToast("Please enter an item title.");
        return;
    }
    if (!desc) {
        showToast("Please add a description.");
        return;
    }
    if (!isFree && cond !== "For Free" && price <= 0) {
        showToast("Please enter a price, or mark the item as free.");
        return;
    }

    const submitBtn = document.querySelector("#postModal .btn-post");
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "⏳ POSTING...";
    }

    fetch("/student-center/post-listing/", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": getCookie("csrftoken"),
        },
        body: JSON.stringify({
            title,
            category: cat,
            condition: cond,
            price,
            is_free: isFree,
            description: desc,
            contact,
            is_event: isEvent,
            event_label: evLabel,
            image_base64: currentImgB64 || null,
        }),
    })
        .then((r) => r.json())
        .then((data) => {
            if (data.ok) {
                closePostModal(true);
                if (data.pending_approval) {
                    showToast(
                        "Event listing submitted — pending staff approval.",
                    );
                } else {
                    showToast("Listing posted successfully!");
                }
                loadListings();
            } else {
                showToast(data.error || "Failed to post listing.");
            }
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = "▶ POST LISTING";
            }
        })
        .catch(() => {
            showToast("Connection error.");
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = "▶ POST LISTING";
            }
        });
}

/* ══════════════════════════════════════════════
   DETAIL modal
══════════════════════════════════════════════ */
function openDetail(item) {
    const isFree = item.is_free || item.condition === "For Free";
    const priceStr = isFree
        ? "FREE"
        : `₱${parseFloat(item.price).toLocaleString()}`;

    const imgContent = item.image_base64
        ? `<img src="${item.image_base64}" alt="${item.title}" style="width:100%;height:100%;object-fit:cover;"/>`
        : `<span style="font-size:64px;opacity:.3;">${CAT_ICONS[item.category] || "📦"}</span>`;

    const isSold = item.status === "sold";
    const isReserved = item.status === "reserved";

    const actionBtns = isSold
        ? `<button class="dm-btn secondary" disabled style="opacity:.4;cursor:not-allowed;">UNAVAILABLE</button>`
        : `<button class="dm-btn primary" onclick="reserveItem(${item.id},this);closeDetailModal()">🔖 RESERVE</button>
           <button class="dm-btn secondary" onclick="contactSeller(${item.id},'${item.poster_name}');closeDetailModal()">💬 CONTACT SELLER</button>`;

    const detailAvatarHtml = item.poster_pfp
        ? `<div class="dm-seller-avatar" style="background-image: url('${item.poster_pfp}'); background-size: cover; background-position: center; color: transparent;"></div>`
        : `<div class="dm-seller-avatar">${item.poster_name ? item.poster_name[0].toUpperCase() : "?"}</div>`;

    document.getElementById("detailContent").innerHTML = `
        <div class="dm-img">${imgContent}</div>
        <div class="dm-body">
            <p class="dm-cat">${CAT_LABELS[item.category] || item.category}${item.is_event ? " · ⚡ EVENT DROP" : ""}</p>
            <h3 class="dm-title">${item.title}</h3>
            <p class="dm-price${isFree ? " free" : ""}">${priceStr}</p>
            <p class="dm-desc">${item.description || "—"}</p>
            <div class="dm-meta-grid">
                <div class="dm-meta-item"><p class="dmi-label">CONDITION</p><p class="dmi-val">${item.condition}</p></div>
                <div class="dm-meta-item"><p class="dmi-label">STATUS</p><p class="dmi-val" style="text-transform:capitalize;">${item.status}</p></div>
                <div class="dm-meta-item"><p class="dmi-label">CATEGORY</p><p class="dmi-val">${CAT_LABELS[item.category] || item.category}</p></div>
                <div class="dm-meta-item"><p class="dmi-label">POSTED</p><p class="dmi-val">${item.time_ago}</p></div>
            </div>
            ${item.contact ? `<div class="dm-meta-item" style="margin-bottom:18px;"><p class="dmi-label">CONTACT</p><p class="dmi-val">${item.contact}</p></div>` : ""}
            <div class="dm-seller">
                ${detailAvatarHtml}
                <div><p class="dm-seller-name">${item.poster_name}</p>
                <p class="dm-seller-info">LSPU Student · Direct contact for meetup</p></div>
            </div>
            <div class="dm-actions">${actionBtns}</div>
        </div>`;

    document.getElementById("detailModal").classList.add("open");
}

function closeDetailModal() {
    document.getElementById("detailModal").classList.remove("open");
}

/* ══════════════════════════════════════════════
   MODERATOR app modal
══════════════════════════════════════════════ */
function openModApplyModal() {
    document.getElementById("modApplyModal").classList.add("open");
}
function closeModApplyModal() {
    document.getElementById("modApplyModal").classList.remove("open");
}

function submitModApplication() {
    const reason = (document.getElementById("mod-reason").value || "").trim();
    if (!reason || reason.length < 30) {
        showToast(
            "Please write at least 30 characters explaining why you want to be a moderator.",
        );
        return;
    }
    const btn = document.querySelector("#modApplyModal .btn-post");
    if (btn) {
        btn.disabled = true;
        btn.textContent = "⏳ SUBMITTING...";
    }

    fetch("/student-center/apply-moderator/", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": getCookie("csrftoken"),
        },
        body: JSON.stringify({ reason }),
    })
        .then((r) => r.json())
        .then((data) => {
            if (data.ok) {
                closeModApplyModal();
                showToast("Application submitted! Staff will review it soon.");
                const applyBtn = document.getElementById("modApplyBtn");
                if (applyBtn) {
                    applyBtn.disabled = true;
                    applyBtn.textContent = "⏳ APPLICATION PENDING";
                }
            } else {
                showToast(data.error || "Failed to submit application.");
            }
            if (btn) {
                btn.disabled = false;
                btn.textContent = "▶ SUBMIT APPLICATION";
            }
        })
        .catch(() => {
            showToast("Connection error.");
            if (btn) {
                btn.disabled = false;
                btn.textContent = "▶ SUBMIT APPLICATION";
            }
        });
}

/* ══════════════════════════════════════════════
   close modal (funcs)
══════════════════════════════════════════════ */
["postModal", "detailModal", "modApplyModal"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener("mousedown", function (e) {
            if (e.target === this) {
                if (id === "postModal") {
                    closePostModal();
                } else {
                    this.classList.remove("open");
                }
            }
        });
    }
});


/* ══════════════════════════════════════════════
   SMART uRl routing (for notif)
══════════════════════════════════════════════ */
window.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const listingId = params.get('listing_id');
    const buyerId = params.get('buyer_id');

    if (action && listingId && buyerId) {

        fetch("/student-center/get-user-card/", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") },
            body: JSON.stringify({ listing_id: listingId, buyer_id: buyerId }),
        })
        .then(r => r.json())
        .then(data => {
            if (!data.ok) return showToast(data.error);

            if (action === 'view_contact') {
                const av = document.getElementById('uc-avatar');
                if (data.pfp) {
                    av.style.backgroundImage = `url('${data.pfp}')`;
                    av.style.backgroundSize = 'cover';
                    av.style.color = 'transparent';
                } else {
                    av.textContent = data.username.charAt(0).toUpperCase();
                }
                document.getElementById('uc-username').textContent = data.username;
                document.getElementById('uc-fullname').textContent = data.full_name;
                document.getElementById('uc-item').textContent = data.listing_title;
                document.getElementById('uc-email').textContent = data.email;
                document.getElementById('uc-contact').textContent = data.contact;
                document.getElementById('userCardModal').classList.add('open');

            } else if (action === 'review_reserve') {
                document.getElementById('rr-username').textContent = data.username;
                document.getElementById('rr-item').textContent = data.listing_title;
                document.getElementById('rr-fullname').textContent = data.full_name;
                document.getElementById('rr-email').textContent = data.email;
                document.getElementById('rr-contact').textContent = data.contact;
                document.getElementById('rr-listing-id').value = listingId;
                document.getElementById('reserveReviewModal').classList.add('open');
            }
        });

        window.history.replaceState({}, document.title, window.location.pathname);
    }
});

/* ══════════════════════════════════════════════
   RESPOND TO RESERVATION (Accept/Reject)
══════════════════════════════════════════════ */
function respondReservation(action) {
    const listingId = document.getElementById('rr-listing-id').value;
    
    fetch("/student-center/respond-reserve/", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") },
        body: JSON.stringify({ listing_id: listingId, action: action }),
    })
    .then(r => r.json())
    .then(data => {
        if (data.ok) {
            document.getElementById('reserveReviewModal').classList.remove('open');
            showToast(data.msg);
            loadListings(); // Refresh grid
            if (currentTab === 'mine') loadMyListings();
        } else {
            showToast(data.error);
        }
    });
}


["userCardModal", "reserveReviewModal"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener("mousedown", function (e) {
            if (e.target === this) this.classList.remove("open");
        });
    }
});


loadListings();
