/* ==========================================================
   yvl — discord.gg/yvl
   ========================================================== */

(function () {
    "use strict";

    const html = document.documentElement;
    const DISCORD_URL = "https://discord.gg/yvl";

    /* ---------- giriş ekranı ---------- */

    const enter = document.getElementById("enter");

    function enterSite() {
        if (html.classList.contains("entered")) return;
        html.classList.add("entered");
        try {
            sessionStorage.setItem("yvl:entered", "1");
        } catch (e) {
            /* gizli mod: sorun değil */
        }
    }

    if (enter && !html.classList.contains("entered")) {
        enter.addEventListener("click", enterSite);
        enter.addEventListener("keydown", function (event) {
            if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
                event.preventDefault();
                enterSite();
            }
        });
    }

    /* ---------- link kopyala ---------- */

    const copyButton = document.getElementById("copy");
    const toast = document.getElementById("toast");
    let toastTimer = null;

    function showToast(message) {
        if (!toast) return;
        toast.textContent = message;
        toast.classList.add("show");
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(function () {
            toast.classList.remove("show");
        }, 1900);
    }

    function fallbackCopy(text) {
        const field = document.createElement("textarea");
        field.value = text;
        field.setAttribute("readonly", "");
        field.style.position = "fixed";
        field.style.top = "-1000px";
        field.style.opacity = "0";
        document.body.appendChild(field);
        field.select();
        field.setSelectionRange(0, field.value.length);

        let ok = false;
        try {
            ok = document.execCommand("copy");
        } catch (e) {
            ok = false;
        }

        document.body.removeChild(field);
        return ok;
    }

    function copyLink() {
        const done = function () {
            showToast("link kopyalandı");
            if (copyButton) {
                copyButton.classList.add("copied");
                window.setTimeout(function () {
                    copyButton.classList.remove("copied");
                }, 900);
            }
        };

        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(DISCORD_URL).then(done).catch(function () {
                if (fallbackCopy(DISCORD_URL)) done();
                else showToast("kopyalanamadı");
            });
        } else if (fallbackCopy(DISCORD_URL)) {
            done();
        } else {
            showToast("kopyalanamadı");
        }
    }

    if (copyButton) {
        copyButton.addEventListener("click", copyLink);
    }

    /* ---------- imleç ışığı ---------- */

    const cursor = document.getElementById("cursor");
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (cursor && finePointer && !reducedMotion) {
        let currentX = window.innerWidth / 2;
        let currentY = window.innerHeight / 2;
        let targetX = currentX;
        let targetY = currentY;
        let rafId = null;

        function renderCursor() {
            currentX += (targetX - currentX) * 0.12;
            currentY += (targetY - currentY) * 0.12;
            cursor.style.transform =
                "translate3d(" + currentX + "px, " + currentY + "px, 0) translate(-50%, -50%)";

            if (Math.abs(targetX - currentX) > 0.4 || Math.abs(targetY - currentY) > 0.4) {
                rafId = window.requestAnimationFrame(renderCursor);
            } else {
                rafId = null;
            }
        }

        window.addEventListener(
            "pointermove",
            function (event) {
                if (event.pointerType !== "mouse") return;
                targetX = event.clientX;
                targetY = event.clientY;
                document.body.classList.add("pointer");
                if (rafId === null) rafId = window.requestAnimationFrame(renderCursor);
            },
            { passive: true }
        );

        document.addEventListener("mouseleave", function () {
            document.body.classList.remove("pointer");
        });
    }

    /* ---------- kartlara hafif eğim (yalnızca masaüstü) ---------- */

    if (finePointer && !reducedMotion) {
        const cards = document.querySelectorAll(".profile");

        cards.forEach(function (card) {
            card.addEventListener("pointermove", function (event) {
                if (event.pointerType !== "mouse") return;
                const rect = card.getBoundingClientRect();
                const x = (event.clientX - rect.left) / rect.width - 0.5;
                const y = (event.clientY - rect.top) / rect.height - 0.5;
                card.style.transform =
                    "perspective(900px) rotateX(" + (-y * 1.6).toFixed(2) + "deg) rotateY(" +
                    (x * 1.6).toFixed(2) + "deg)";
            });

            card.addEventListener("pointerleave", function () {
                card.style.transform = "";
            });
        });
    }
})();
