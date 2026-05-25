function showPage(name) {
    document
        .querySelectorAll(".page-panel")
        .forEach((p) => p.classList.remove("active"));
    document.querySelectorAll('.sb-link[id^="nav-"]').forEach((l) => {
        l.classList.remove("active");
        l.removeAttribute("aria-current");
    });
    document.getElementById("page-" + name).classList.add("active");
    const nav = document.getElementById("nav-" + name);
    if (nav) {
        nav.classList.add("active");
        nav.setAttribute("aria-current", "page");
    }
    document.title =
        "LSPU NavGO | " + name.charAt(0).toUpperCase() + name.slice(1);
    window.scrollTo(0, 0);
    const sb = document.getElementById("sidebar");
    if (sb) sb.classList.remove("open");
}

function switchRecTab(tab) {
    document.getElementById("panel-bao").style.display =
        tab === "bao" ? "block" : "none";
    document.getElementById("panel-clinic").style.display =
        tab === "clinic" ? "block" : "none";
    document
        .getElementById("rec-tab-bao")
        .classList.toggle("active", tab === "bao");
    document
        .getElementById("rec-tab-clinic")
        .classList.toggle("active", tab === "clinic");
    document
        .getElementById("rec-tab-bao")
        .setAttribute("aria-selected", tab === "bao");
    document
        .getElementById("rec-tab-clinic")
        .setAttribute("aria-selected", tab === "clinic");
}

function setFilter(btn, panel, status) {
    btn.closest(".filter-row")
        .querySelectorAll(".filter-btn")
        .forEach((b) => {
            b.classList.remove("active");
            b.setAttribute("aria-pressed", "false");
        });
    btn.classList.add("active");
    btn.setAttribute("aria-pressed", "true");
    document
        .getElementById(panel + "-tbody")
        .querySelectorAll("tr")
        .forEach((r) => {
            r.style.display =
                status === "all" || r.dataset.status === status ? "" : "none";
        });
}

function openModal(id, items, date, status, studentId, studentName) {
    document.getElementById("modal-info").innerHTML = `
    <div class="modal-row"><span class="modal-k">RECORD ID</span><span class="modal-v">${id}</span></div>
    <div class="modal-row"><span class="modal-k">DETAILS</span><span class="modal-v">${items}</span></div>
    <div class="modal-row"><span class="modal-k">DATE</span><span class="modal-v">${date}</span></div>
    <div class="modal-row"><span class="modal-k">STATUS</span><span class="modal-v">${status}</span></div>
    <div class="modal-row"><span class="modal-k">STUDENT ID</span><span class="modal-v">${studentId}</span></div>
    <div class="modal-row"><span class="modal-k">STUDENT NAME</span><span class="modal-v">${studentName}</span></div>`;
    
    document.getElementById("modalOverlay").classList.add("open");
}
document.getElementById("modalOverlay").addEventListener("click", function (e) {
    if (e.target === this) this.classList.remove("open");
});



// Helper function to get Django's CSRF token from cookies
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}


// Variable to hold the image data before saving
// Variable to hold the image data before saving
let pfpBase64 = null; 

// Converts, RESIZES, and previews the uploaded file
function previewPFP(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        // Create an image object to get the original dimensions
        const img = new Image();
        img.onload = function() {
            // Create a canvas to resize the image
            const canvas = document.createElement('canvas');
            const MAX_SIZE = 300; // 300px is perfect for a profile avatar
            let width = img.width;
            let height = img.height;

            // Calculate new dimensions while keeping the aspect ratio
            if (width > height) {
                if (width > MAX_SIZE) {
                    height *= MAX_SIZE / width;
                    width = MAX_SIZE;
                }
            } else {
                if (height > MAX_SIZE) {
                    width *= MAX_SIZE / height;
                    height = MAX_SIZE;
                }
            }

            // Set canvas size and draw the shrunk image
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // Compress to WebP format for maximum efficiency (tiny file size)
            pfpBase64 = canvas.toDataURL('image/webp', 0.8);

            // Update the UI Preview
            const avatarDiv = document.getElementById('avatarPreview');
            avatarDiv.style.backgroundImage = `url('${pfpBase64}')`;
            avatarDiv.style.backgroundSize = 'cover';
            avatarDiv.style.backgroundPosition = 'center';
            avatarDiv.style.color = 'transparent'; 
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    showToast("Successfully changed your profile picture. Dont forget to save changes!");
}


async function saveProfile() {
    const payload = {
        yearLevel: document.getElementById('yearLevel').value,
        course: document.getElementById('course').value, 
        section: document.getElementById('section').value,
        firstName: document.getElementById('firstName').value,
        lastName: document.getElementById('lastName').value,
        contactNum: document.getElementById('contactNum').value,
        curPw: document.getElementById('curPw').value,
        newPw: document.getElementById('newPw').value,
        confPw: document.getElementById('confPw').value,
        pfp: pfpBase64
    };

    try {
        const response = await fetch('/profile/update/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken') // Vital for Django POST requests
            },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();

        if (data.ok) {
            showToast(data.message);
            // Clear passwords after successful save so they don't accidentally resubmit them
            document.getElementById('curPw').value = '';
            document.getElementById('newPw').value = '';
            document.getElementById('confPw').value = '';
        } else {
            showToast("⚠️ " + data.error);
        }
    } catch (error) {
        showToast("⚠️ An error occurred while saving.");
        console.error("Profile Save Error:", error);
    }
}


function clearProfileForm() {
    ["firstName", "lastName", "contactNum", "curPw", "newPw", "confPw"].forEach(
        (id) => {
            document.getElementById(id).value = "";
        },
    );
}

const validPages = ["dashboard", "profile", "records"];
const hash = window.location.hash.replace("#", "");
showPage(validPages.includes(hash) ? hash : "dashboard");
