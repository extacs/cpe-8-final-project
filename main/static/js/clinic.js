const MONTHS = [
    "JANUARY",
    "FEBRUARY",
    "MARCH",
    "APRIL",
    "MAY",
    "JUNE",
    "JULY",
    "AUGUST",
    "SEPTEMBER",
    "OCTOBER",
    "NOVEMBER",
    "DECEMBER",
];

const ALL_SLOTS = [
    "8:00 AM",
    "8:30 AM",
    "9:00 AM",
    "9:30 AM",
    "10:00 AM",
    "10:30 AM",
    "1:00 PM",
    "1:30 PM",
    "2:00 PM",
    "2:30 PM",
    "3:00 PM",
    "3:30 PM",
];

const today = new Date();
let viewYear = today.getFullYear();
let viewMonth = today.getMonth();
let selService = null;
let selDate = null;
let selTime = null;

//  caching of slot data per date-string: { "2025-05-08": [slot objects] }
const slotCache = {};

function showPanel(name) {
    document
        .querySelectorAll(".page-panel")
        .forEach((p) => p.classList.remove("active"));
    document.getElementById("panel-" + name).classList.add("active");
    window.scrollTo(0, 0);
}

// CSRF helper (tokenized vulne, dont remove this part creds to that guy)
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

function selectService(s) {
    selService = s;
    document.querySelectorAll(".service-card").forEach((c) => {
        c.classList.remove("selected");
        c.setAttribute("aria-pressed", "false");
    });
    document.getElementById("card-" + s).classList.add("selected");
    document.getElementById("card-" + s).setAttribute("aria-pressed", "true");
    updateSteps();
    updateSummary();
}

function changeMonth(dir) {
    viewMonth += dir;
    if (viewMonth > 11) {
        viewMonth = 0;
        viewYear++;
    }
    if (viewMonth < 0) {
        viewMonth = 11;
        viewYear--;
    }
    renderCal();
}

function renderCal() {
    document.getElementById("calMonth").textContent =
        MONTHS[viewMonth] + " " + viewYear;
    const first = new Date(viewYear, viewMonth, 1).getDay();
    const days = new Date(viewYear, viewMonth + 1, 0).getDate();
    const wrap = document.querySelector(".cal-grid");

    wrap.querySelectorAll(".cal-day").forEach((el) => el.remove());

    for (let i = 0; i < first; i++) {
        const d = document.createElement("div");
        d.className = "cal-day empty";
        wrap.appendChild(d);
    }

    for (let d = 1; d <= days; d++) {
        const dt = new Date(viewYear, viewMonth, d);
        const isPast =
            dt <
            new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
        const isToday =
            d === today.getDate() &&
            viewMonth === today.getMonth() &&
            viewYear === today.getFullYear();

        const el = document.createElement("div");
        el.className = "cal-day";
        el.textContent = d;
        el.setAttribute("role", "gridcell");

        if (isToday) el.classList.add("today");
        if (isPast || isWeekend) {
            el.classList.add(isPast ? "past" : "disabled");
            el.setAttribute("aria-disabled", "true");
        } else {
            el.setAttribute(
                "aria-label",
                "Select " + MONTHS[viewMonth] + " " + d,
            );
            el.setAttribute("tabindex", "0");
            el.addEventListener("click", () => pickDate(d, el));
            el.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    pickDate(d, el);
                }
            });
        }

        if (
            selDate &&
            selDate.d === d &&
            selDate.m === viewMonth &&
            selDate.y === viewYear
        ) {
            el.classList.add("selected");
        }
        wrap.appendChild(el);
    }
}

function pickDate(d, el) {
    selDate = { d, m: viewMonth, y: viewYear };
    selTime = null;

    document
        .querySelectorAll(".cal-day")
        .forEach((c) => c.classList.remove("selected"));
    el.classList.add("selected");

    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

    updateSteps();
    updateSummary();

    const timeSection = document.getElementById("timeSection");
    const timeGrid = document.getElementById("timeGrid");
    timeSection.style.display = "block";
    timeGrid.innerHTML =
        '<div style="font-family:var(--font-px);font-size:6px;color:var(--c-dim);padding:12px;letter-spacing:.1em;">LOADING SLOTS...</div>';

    if (slotCache[dateStr]) {
        renderTimeSlots(slotCache[dateStr]);
        return;
    }

    fetch(`/clinic/slots/?date=${dateStr}`)
        .then((r) => r.json())
        .then((data) => {
            slotCache[dateStr] = data.slots;
            renderTimeSlots(data.slots);
        })
        .catch(() => {
            const fallback = ALL_SLOTS.map((t) => ({
                time: t,
                count: 0,
                max: 3,
                full: false,
            }));
            renderTimeSlots(fallback);
        });
}

function renderTimeSlots(slots) {
    const grid = document.getElementById("timeGrid");
    grid.innerHTML = "";

    slots.forEach((slot) => {
        const btn = document.createElement("div");
        btn.className = "time-slot" + (slot.full ? " full" : "");
        btn.setAttribute("role", "button");
        btn.setAttribute("tabindex", slot.full ? "-1" : "0");
        btn.setAttribute(
            "aria-label",
            slot.full ? slot.time + " — fully booked" : "Select " + slot.time,
        );

        const spotsLeft = slot.max - slot.count;
        const spotsText = slot.full
            ? "FULL"
            : spotsLeft === 1
              ? "1 LEFT"
              : "OPEN";

        btn.innerHTML = `${slot.time}<span class="ts-spots">${spotsText}</span>`;

        if (!slot.full) {
            btn.addEventListener("click", () => pickTime(slot.time, btn));
            btn.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    pickTime(slot.time, btn);
                }
            });
        }
        grid.appendChild(btn);
    });
}

function pickTime(t, el) {
    selTime = t;
    document
        .querySelectorAll(".time-slot")
        .forEach((s) => s.classList.remove("selected"));
    el.classList.add("selected");
    updateSteps();
    updateSummary();
}

function updateSteps() {
    if (selService) document.getElementById("s1").className = "step done";
    if (selDate) document.getElementById("s2").className = "step done";
    if (selTime) document.getElementById("s3").className = "step cur";
    else if (selDate) document.getElementById("s2").className = "step cur";
}

function updateSummary() {
    const body = document.getElementById("sumBody");
    const svcLabels = {
        checkup: "Physical Check-up",
        records: "Medical Record Processing",
    };
    const dateStr = selDate
        ? `${MONTHS[selDate.m]} ${selDate.d}, ${selDate.y}`
        : "Not selected";
    const allSet = selService && selDate && selTime;

    /* Student info injected by Django into data attributes on <body> */
    const studentId = document.body.dataset.studentId || "—";
    const studentSec = document.body.dataset.studentSec || "—";

    body.innerHTML = `
        <div class="sum-row">
            <span class="sr-icon" aria-hidden="true">🩺</span>
            <div><p class="sr-label">SERVICE</p>
            <p class="sr-val">${selService ? svcLabels[selService] : "Not selected"}</p></div>
        </div>
        <div class="sum-row">
            <span class="sr-icon" aria-hidden="true">📅</span>
            <div><p class="sr-label">DATE</p><p class="sr-val">${dateStr}</p></div>
        </div>
        <div class="sum-row">
            <span class="sr-icon" aria-hidden="true">⏰</span>
            <div><p class="sr-label">TIME SLOT</p><p class="sr-val">${selTime || "Not selected"}</p></div>
        </div>
        <div class="autofill-note">
            <p class="an-label">FROM YOUR PROFILE</p>
            <div class="an-row"><span class="an-k">Student ID</span><span class="an-v">${studentId}</span></div>
            <div class="an-row"><span class="an-k">Section</span><span class="an-v">${studentSec || "—"}</span></div>
        </div>
        <div class="notice-box">⚡ BRING YOUR APPOINTMENT SLIP AND A VALID SCHOOL ID ON THE DAY.</div>
        <button class="confirm-btn" ${allSet ? "" : "disabled"} aria-disabled="${!allSet}"
                onclick="confirmBooking()">
            <span class="cb-sh" aria-hidden="true"></span>▶ CONFIRM APPOINTMENT
        </button>`;
}

function confirmBooking() {
    if (!selService || !selDate || !selTime) return;

    const confirmBtn = document.querySelector(".confirm-btn");
    if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.textContent = "⏳ BOOKING...";
    }

    const dateStr = `${selDate.y}-${String(selDate.m + 1).padStart(2, "0")}-${String(selDate.d).padStart(2, "0")}`;

    fetch("/clinic/book/", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": getCookie("csrftoken"),
        },
        body: JSON.stringify({
            service: selService,
            date: dateStr,
            time_slot: selTime,
        }),
    })
        .then((r) => r.json())
        .then((data) => {
            if (!data.ok) {
                showToast("Booking failed: " + (data.error || "Unknown error"));
                if (confirmBtn) {
                    confirmBtn.disabled = false;
                    confirmBtn.textContent = "▶ CONFIRM APPOINTMENT";
                }

                if (data.error && data.error.includes("full")) {
                    const dateStr2 = `${selDate.y}-${String(selDate.m + 1).padStart(2, "0")}-${String(selDate.d).padStart(2, "0")}`;
                    delete slotCache[dateStr2];
                    pickDate(
                        selDate.d,
                        document.querySelector(".cal-day.selected"),
                    );
                }
                return;
            }

            /* ── Populate the appointment slip ── */
            document.getElementById("apptIdDisplay").textContent =
                "APPT " + data.appt_number;
            document.getElementById("formApptId").textContent =
                "APPT " + data.appt_number;
            document.getElementById("bookedDate").textContent = data.booked_at;
            document.getElementById("genTs").textContent = data.booked_at;
            document.getElementById("slipService").textContent = data.service;
            document.getElementById("slipDate").textContent = data.date;
            document.getElementById("slipTime").textContent = data.time_slot;

            const sid = document.body.dataset.studentId || "—";
            const name = document.body.dataset.studentName || "—";
            const sec = document.body.dataset.studentSec || "—";

            const sidEl = document.getElementById("slipStudentId");
            const nameEl = document.getElementById("slipStudentName");
            const secEl = document.getElementById("slipStudentSec");
            if (sidEl) sidEl.textContent = sid;
            if (nameEl) nameEl.textContent = name;
            if (secEl) secEl.textContent = sec;

            delete slotCache[dateStr];

            showPanel("slip");
        })
        .catch((err) => {
            console.error("Clinic booking error:", err);
            showToast("Connection error. Please try again.");
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.textContent = "▶ CONFIRM APPOINTMENT";
            }
        });
}

function resetAndSchedule() {
    selService = null;
    selDate = null;
    selTime = null;

    document.querySelectorAll(".service-card").forEach((c) => {
        c.classList.remove("selected");
        c.setAttribute("aria-pressed", "false");
    });
    document.getElementById("timeSection").style.display = "none";
    document.getElementById("s1").className = "step cur";
    document.getElementById("s2").className = "step next";
    document.getElementById("s3").className = "step next";
    renderCal();
    updateSummary();
    showPanel("schedule");
}

document.querySelectorAll(".service-card").forEach((c) => {
    c.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            c.click();
        }
    });
});

renderCal();
updateSummary();
