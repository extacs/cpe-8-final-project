

            (function () {
                const wrap = document.getElementById("splashStars");
                if (!wrap) return;
                for (let i = 0; i < 28; i++) {
                    const s = document.createElement("div");
                    s.className = "star";
                    s.style.cssText = `left:${Math.random() * 100}%;top:${Math.random() * 100}%;--dur:${2 + Math.random() * 3}s;animation-delay:${Math.random() * 4}s;`;
                    wrap.appendChild(s);
                }
            })();

            (function () {
                fetch("/student-center/listings/?cat=all&q=&sort=ending")
                    .then((r) => r.json())
                    .then((data) => {
                        const events = (data.listings || []).filter(
                            (l) => l.is_event && l.status === "available",
                        );
                        if (events.length > 0) {
                            const banner =
                                document.getElementById("eventBanner");
                            if (banner) {
                                banner.style.display = "flex";
                                const titleEl =
                                    document.getElementById("eventBannerTitle");
                                const subEl =
                                    document.getElementById("eventBannerSub");
                                if (titleEl && events[0].event_label) {
                                    titleEl.textContent =
                                        "⚡ EVENT DROP — " +
                                        events[0].event_label.toUpperCase();
                                }
                                if (subEl) {
                                    subEl.textContent = `${events.length} active event listing${events.length > 1 ? "s" : ""} — posted by Student Center moderators`;
                                }
                            }
                        }
                    })
                    .catch(() => {});
            })();