let light = false;
const themeBtn = document.getElementById("themeToggle");
themeBtn.addEventListener("click", () => {
    light = !light;
    document.documentElement.setAttribute("data-theme", light ? "light" : "");
    themeBtn.setAttribute(
        "aria-label",
        light ? "Switch to dark theme" : "Switch to light theme",
    );
});

const hamburger = document.getElementById("hamburger");
const mobileMenu = document.getElementById("mobileMenu");
hamburger.addEventListener("click", () => {
    const open = mobileMenu.classList.toggle("open");
    hamburger.setAttribute("aria-expanded", open);
});
function closeMenu() {
    mobileMenu.classList.remove("open");
    hamburger.setAttribute("aria-expanded", "false");
}

const observer = new IntersectionObserver(
    (entries) => {
        entries.forEach((e) => {
            if (e.isIntersecting) {
                e.target.classList.add("visible");
                observer.unobserve(e.target);
            }
        });
    },
    { threshold: 0.12 },
);

document.querySelectorAll(".fade-in").forEach((el, i) => {
    el.style.transitionDelay = (i % 4) * 0.08 + "s";
    observer.observe(el);
});

document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
        const target = document.querySelector(a.getAttribute("href"));
        if (target) {
            e.preventDefault();
            target.scrollIntoView({ behavior: "smooth" });
            closeMenu();
        }
    });
});
