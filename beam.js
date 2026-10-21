/* ==========================================================
   2d ışık + yansıma katmanı  —  seçenek A prototipi
   prizma geometrisi three.js sahnesinden gelir (prism.js)
   ========================================================== */

(function () {
    "use strict";

    const canvas = document.getElementById("beam-canvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* ---------- optik sabitler ---------- */
    // vgpu hero prizmasının "stylized" preseti: n(l) = base + strength / l^2
    const DISPERSION_BASE = 1.245;
    const DISPERSION_STRENGTH = 0.06;
    const GLASS_IOR = 1.52;
    const DISPERSION_GAIN = 2.3;

    const WAVELENGTHS = [408, 436, 464, 492, 520, 548, 576, 604, 632, 664, 692];

    /* ---------- durum ---------- */

    const pointer = {
        x: 0.62,
        y: 0.48,
        targetX: 0.62,
        targetY: 0.48,
        active: false
    };

    const toggles = { beam: true, reflection: true, caustic: true };
    window.__beam = {
        toggles,
        // test/demo yardimcilari
        setPointer(x, y) {
            pointer.targetX = x;
            pointer.targetY = y;
            pointer.x = x;
            pointer.y = y;
            pointer.active = true;
        },
        draw() {
            const geometry = window.__prismGeometry;
            if (geometry) drawBeam(geometry);
        }
    };

    // demo paneli anahtarlari
    document.querySelectorAll("[data-toggle]").forEach((button) => {
        button.addEventListener("click", () => {
            const key = button.getAttribute("data-toggle");
            if (!(key in toggles)) return;
            toggles[key] = !toggles[key];
            button.classList.toggle("is-on", toggles[key]);
        });
    });

    let width = 0;
    let height = 0;
    let dpr = 1;

    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = Math.max(1, Math.round(width * dpr));
        canvas.height = Math.max(1, Math.round(height * dpr));
        canvas.style.width = width + "px";
        canvas.style.height = height + "px";
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resize();
    window.addEventListener("resize", resize, { passive: true });

    /* ---------- yardımcılar ---------- */

    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
    const mix = (a, b, t) => a + (b - a) * t;
    const smoothstep = (e0, e1, x) => {
        const t = clamp((x - e0) / (e1 - e0), 0, 1);
        return t * t * (3 - 2 * t);
    };

    function wavelengthToRgb(nm) {
        let r = 0;
        let g = 0;
        let b = 0;

        if (nm >= 380 && nm < 440) {
            r = -(nm - 440) / 60;
            b = 1;
        } else if (nm < 490) {
            g = (nm - 440) / 50;
            b = 1;
        } else if (nm < 510) {
            g = 1;
            b = -(nm - 510) / 20;
        } else if (nm < 580) {
            r = (nm - 510) / 70;
            g = 1;
        } else if (nm < 645) {
            r = 1;
            g = -(nm - 645) / 65;
        } else {
            r = 1;
        }

        let f = 1;
        if (nm >= 380 && nm < 420) f = 0.3 + 0.7 * ((nm - 380) / 40);
        else if (nm > 700) f = 0.3 + 0.7 * ((780 - nm) / 80);

        return [r * f, g * f, b * f];
    }

    function refractiveIndex(nm) {
        const um = nm / 1000;
        return DISPERSION_BASE + DISPERSION_STRENGTH / (um * um);
    }

    // ışın yüzeye çarparken kırılma (vektör formu)
    function refract(ix, iy, nx, ny, eta) {
        const dot = ix * nx + iy * ny;
        const k = 1 - eta * eta * (1 - dot * dot);
        if (k < 0) return null;
        const s = eta * dot - Math.sqrt(k);
        return { x: eta * ix + s * nx, y: eta * iy + s * ny };
    }

    // ışın doğru parçası kesişimi
    function raySegment(px, py, dx, dy, ax, ay, bx, by) {
        const ex = bx - ax;
        const ey = by - ay;
        const denom = dx * ey - dy * ex;
        if (Math.abs(denom) < 1e-9) return null;
        const t = ((ax - px) * ey - (ay - py) * ex) / denom;
        const u = ((ax - px) * dy - (ay - py) * dx) / denom;
        if (t < 0 || u < 0 || u > 1) return null;
        return { t, u, x: px + dx * t, y: py + dy * t };
    }

    // üçüncü nokta dışarıda kalacak şekilde kenar normali
    function outwardNormal(ax, ay, bx, by, cx, cy) {
        let nx = by - ay;
        let ny = -(bx - ax);
        const len = Math.hypot(nx, ny) || 1;
        nx /= len;
        ny /= len;
        const mx = (ax + bx) * 0.5;
        const my = (ay + by) * 0.5;
        if ((cx - mx) * nx + (cy - my) * ny > 0) {
            nx = -nx;
            ny = -ny;
        }
        return { x: nx, y: ny };
    }

    // rgb 0-1 araliginda beklenir
    function rgba(rgb, a) {
        const c = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));
        return `rgba(${c(rgb[0])},${c(rgb[1])},${c(rgb[2])},${a})`;
    }

    /* ---------- çizim ---------- */

    function glowLine(x0, y0, x1, y1, rgb, alpha, core, hot, fadeIn) {
        ctx.lineCap = "round";

        const makeStyle = (a) => {
            if (!fadeIn) return rgba(rgb, a);
            const g = ctx.createLinearGradient(x0, y0, x1, y1);
            g.addColorStop(0, rgba(rgb, 0));
            g.addColorStop(0.22, rgba(rgb, a));
            g.addColorStop(1, rgba(rgb, a));
            return g;
        };

        ctx.strokeStyle = makeStyle(alpha * 0.07);
        ctx.lineWidth = core * 9;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();

        ctx.strokeStyle = makeStyle(alpha * 0.16);
        ctx.lineWidth = core * 3.2;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();

        ctx.strokeStyle = makeStyle(alpha * 0.85);
        ctx.lineWidth = core;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();

        if (hot) {
            ctx.strokeStyle = makeStyle(alpha * 0.5);
            ctx.lineWidth = core * 0.42;
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.lineTo(x1, y1);
            ctx.stroke();
        }
    }

    function softBlob(x, y, radius, rgb, alpha) {
        const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
        g.addColorStop(0, rgba(rgb, alpha));
        g.addColorStop(0.35, rgba(rgb, alpha * 0.35));
        g.addColorStop(1, rgba(rgb, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawBeam(frame) {
        ctx.clearRect(0, 0, width, height);
        if (!frame || !frame.corners) return;

        const T = frame.corners[0];
        const L = frame.corners[1];
        const R = frame.corners[2];

        const prismW = Math.max(40, Math.hypot(R.x - L.x, R.y - L.y));
        const prismTop = Math.min(T.y, L.y, R.y);
        const prismBottom = Math.max(T.y, L.y, R.y);
        const prismH = Math.max(40, prismBottom - prismTop);
        const prismCx = (L.x + R.x + T.x) / 3;
        const prismCy = (prismTop + prismBottom) / 2;

        // pointer yumuşatma
        pointer.x += (pointer.targetX - pointer.x) * 0.08;
        pointer.y += (pointer.targetY - pointer.y) * 0.08;

        /* ---------- optik çözüm ---------- */

        // vgpu mantığı: yükseklik kaynağı (lamba) oynatır, genişlik çarpma noktasını seçer
        // ölçüler prizmanın kendi kutusuna göre normalize edilir; böylece ışık
        // ekranın nereye gelirse gelsin prizmanın üstünden geçer
        const relX = clamp((pointer.x * width - L.x) / Math.max(1, prismW), 0, 1);
        const relY = clamp((pointer.y * height - prismTop) / Math.max(1, prismH), 0, 1);

        const aimT = 0.22 + 0.56 * relX;
        const aim = { x: mix(L.x, T.x, aimT), y: mix(L.y, T.y, aimT) };

        // kaynak dikeyde sınırlı: giris acisi cok dik olmasin
        const sourceTargetY = mix(prismBottom + prismH * 0.1, prismTop - prismH * 0.1, 1 - relY);
        const source = {
            x: L.x - prismW * 0.62,
            y: clamp(sourceTargetY, aim.y - prismH * 0.2, aim.y + prismH * 0.2)
        };

        const d0x = aim.x - source.x;
        const d0y = aim.y - source.y;
        const d0len = Math.hypot(d0x, d0y) || 1;
        const dir0 = { x: d0x / d0len, y: d0y / d0len };

        const nEntry = outwardNormal(L.x, L.y, T.x, T.y, R.x, R.y);
        const inside = refract(dir0.x, dir0.y, nEntry.x, nEntry.y, 1 / GLASS_IOR)
            || { x: dir0.x, y: dir0.y };

        // cam içindeki yolun çıkış noktası
        let exit = null;
        let exitEdge = null;

        const hitRight = raySegment(aim.x, aim.y, inside.x, inside.y, T.x, T.y, R.x, R.y);
        const hitBottom = raySegment(aim.x, aim.y, inside.x, inside.y, L.x, L.y, R.x, R.y);

        if (hitRight && hitBottom) {
            exit = hitRight.t <= hitBottom.t ? hitRight : hitBottom;
            exitEdge = hitRight.t <= hitBottom.t ? "right" : "bottom";
        } else if (hitRight) {
            exit = hitRight;
            exitEdge = "right";
        } else if (hitBottom) {
            exit = hitBottom;
            exitEdge = "bottom";
        }

        if (!exit) {
            exit = { x: mix(aim.x, R.x, 0.5), y: mix(aim.y, R.y, 0.5) };
            exitEdge = "right";
        }

        const nExit = exitEdge === "right"
            ? outwardNormal(T.x, T.y, R.x, R.y, L.x, L.y)
            : outwardNormal(L.x, L.y, R.x, R.y, T.x, T.y);

        const nAvg = refractiveIndex(550);
        const baseOut = refract(inside.x, inside.y, -nExit.x, -nExit.y, GLASS_IOR / nAvg)
            || { x: inside.x, y: inside.y };
        const baseAngle = Math.atan2(baseOut.y, baseOut.x);

        // yelpaze ekrandan tasmasin
        const room = Math.max(140, width - exit.x - 16);
        const fanLength = clamp(Math.min(prismW * 0.8, room), 150, 430);

        /* ---------- çizim katmanları ---------- */

        ctx.globalCompositeOperation = "lighter";

        if (toggles.beam) {
            // duvardaki geniş ışık sızıntısı
            const spill = ctx.createLinearGradient(source.x, source.y, aim.x, aim.y);
            spill.addColorStop(0, "rgba(255,255,255,0)");
            spill.addColorStop(0.55, "rgba(190,205,255,0.018)");
            spill.addColorStop(1, "rgba(210,220,255,0.045)");
            ctx.strokeStyle = spill;
            ctx.lineWidth = prismH * 0.5;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(source.x, source.y);
            ctx.lineTo(aim.x, aim.y);
            ctx.stroke();

            // gelen beyaz ışın
            glowLine(source.x, source.y, aim.x, aim.y, [1, 1, 1], 0.85, 1.5, true, true);

            // cam içindeki yol
            glowLine(aim.x, aim.y, exit.x, exit.y, [1, 1, 1], 0.95, 2.1, true);

            // çıkış yelpazesi: önce saydam bir spektrum tabakası
            const extremeAngles = WAVELENGTHS.map((nm) => {
                const index = refractiveIndex(nm);
                return baseAngle + ((index - nAvg) / nAvg) * DISPERSION_GAIN;
            });
            const lowAngle = Math.min(...extremeAngles);
            const highAngle = Math.max(...extremeAngles);

            const sheetStart = { x: exit.x, y: exit.y };
            const sheetEndLow = {
                x: exit.x + Math.cos(lowAngle) * fanLength,
                y: exit.y + Math.sin(lowAngle) * fanLength
            };
            const sheetEndHigh = {
                x: exit.x + Math.cos(highAngle) * fanLength,
                y: exit.y + Math.sin(highAngle) * fanLength
            };

            const sheet = ctx.createLinearGradient(sheetStart.x, sheetStart.y, sheetEndLow.x, sheetEndLow.y);
            sheet.addColorStop(0, "rgba(255,255,255,0.16)");
            sheet.addColorStop(0.45, "rgba(190,215,255,0.07)");
            sheet.addColorStop(1, "rgba(255,255,255,0)");

            ctx.fillStyle = sheet;
            ctx.beginPath();
            ctx.moveTo(sheetStart.x, sheetStart.y);
            ctx.lineTo(sheetEndLow.x, sheetEndLow.y);
            ctx.lineTo(sheetEndHigh.x, sheetEndHigh.y);
            ctx.closePath();
            ctx.fill();

            for (let i = 0; i < WAVELENGTHS.length; i++) {
                const nm = WAVELENGTHS[i];
                const rgb = wavelengthToRgb(nm);
                const index = refractiveIndex(nm);
                const delta = (index - nAvg) / nAvg;
                const angle = baseAngle + delta * DISPERSION_GAIN;

                const ex = exit.x + Math.cos(angle) * fanLength;
                const ey = exit.y + Math.sin(angle) * fanLength;

                const g = ctx.createLinearGradient(exit.x, exit.y, ex, ey);
                g.addColorStop(0, rgba(rgb, 0.66));
                g.addColorStop(0.35, rgba(rgb, 0.36));
                g.addColorStop(1, rgba(rgb, 0));

                ctx.strokeStyle = g;
                ctx.lineWidth = 6;
                ctx.lineCap = "round";
                ctx.beginPath();
                ctx.moveTo(exit.x, exit.y);
                ctx.lineTo(ex, ey);
                ctx.stroke();

                ctx.strokeStyle = rgba(rgb, 0.55);
                ctx.lineWidth = 1.1;
                ctx.beginPath();
                ctx.moveTo(exit.x, exit.y);
                ctx.lineTo(ex, ey);
                ctx.stroke();
            }

            // giriş ve çıkış parlamaları
            softBlob(aim.x, aim.y, prismH * 0.12, [1, 1, 1], 0.3);
            softBlob(exit.x, exit.y, prismH * 0.1, [1, 1, 1], 0.28);
        }

        if (toggles.caustic) {
            // çıkış huzmesinin düştüğü duvar lekesi
            const spotX = exit.x + Math.cos(baseAngle) * fanLength * 0.72;
            const spotY = exit.y + Math.sin(baseAngle) * fanLength * 0.72;
            softBlob(spotX, spotY, prismH * 0.95, [0.59, 0.67, 1], 0.07);
            softBlob(spotX, spotY, prismH * 0.4, [1, 0.94, 0.86], 0.06);

            for (let i = 0; i < WAVELENGTHS.length; i++) {
                const nm = WAVELENGTHS[i];
                const rgb = wavelengthToRgb(nm);
                const index = refractiveIndex(nm);
                const angle = baseAngle + ((index - nAvg) / nAvg) * DISPERSION_GAIN;
                const sx = exit.x + Math.cos(angle) * fanLength * 0.66;
                const sy = exit.y + Math.sin(angle) * fanLength * 0.66;
                softBlob(sx, sy, prismH * 0.34, rgb, 0.07);
            }
        }

        /* ---------- hover yansıması ---------- */

        if (toggles.reflection) {
            const px = pointer.x * width;
            const py = pointer.y * height;

            // fareye en yakın cam noktası
            let best = null;
            let bestDist = Infinity;
            const edges = [[L, T], [T, R], [R, L]];

            for (const [a, b] of edges) {
                const ex = b.x - a.x;
                const ey = b.y - a.y;
                const len2 = ex * ex + ey * ey || 1;
                const t = clamp(((px - a.x) * ex + (py - a.y) * ey) / len2, 0, 1);
                const qx = a.x + ex * t;
                const qy = a.y + ey * t;
                const d = Math.hypot(px - qx, py - qy);
                if (d < bestDist) {
                    bestDist = d;
                    best = { x: qx, y: qy, t };
                }
            }

            const near = 1 - smoothstep(prismH * 0.2, prismH * 1.7, bestDist);
            const strength = near * 1.0;

            if (strength > 0.01) {
                // cam üstündeki yumuşak spekülar parlama
                const gx = mix(best.x, prismCx, 0.3);
                const gy = mix(best.y, prismCy, 0.3);
                softBlob(gx, gy, prismH * 0.75, [0.84, 0.89, 1], 0.34 * strength);
                softBlob(gx, gy, prismH * 0.2, [1, 1, 1], 0.42 * strength);

                // stüdyo ışığı çizgisi gibi uzun, yumuşak parlama
                ctx.save();
                ctx.translate(gx, gy);
                ctx.rotate(-0.42);
                ctx.scale(1, 0.1);
                const streak = ctx.createRadialGradient(0, 0, 0, 0, 0, prismW * 0.55);
                streak.addColorStop(0, `rgba(255,255,255,${0.5 * strength})`);
                streak.addColorStop(0.45, `rgba(225,235,255,${0.16 * strength})`);
                streak.addColorStop(1, "rgba(255,255,255,0)");
                ctx.fillStyle = streak;
                ctx.beginPath();
                ctx.arc(0, 0, prismW * 0.55, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();

                // cam kenarında kenar parlaması
                ctx.strokeStyle = `rgba(255,255,255,${0.5 * strength})`;
                ctx.lineWidth = 1.8;
                ctx.beginPath();
                ctx.moveTo(best.x, best.y);
                ctx.lineTo(mix(best.x, prismCx, 0.22), mix(best.y, prismCy, 0.22));
                ctx.stroke();

                // kenarda spektral parıltı (prizmanın kırılma hissi)
                const rimLength = prismH * 0.42;
                const rimX = mix(best.x, prismCx, 0.1);
                const rimY = mix(best.y, prismCy, 0.1);
                const rim = ctx.createLinearGradient(rimX, rimY, rimX + rimLength * 0.5, rimY + rimLength);
                rim.addColorStop(0, `rgba(255,255,255,${0.5 * strength})`);
                rim.addColorStop(0.35, `rgba(120,180,255,${0.3 * strength})`);
                rim.addColorStop(0.7, `rgba(255,120,190,${0.22 * strength})`);
                rim.addColorStop(1, "rgba(255,255,255,0)");
                ctx.strokeStyle = rim;
                ctx.lineWidth = 2.6;
                ctx.lineCap = "round";
                ctx.beginPath();
                ctx.moveTo(rimX, rimY);
                ctx.lineTo(rimX + rimLength * 0.5, rimY + rimLength);
                ctx.stroke();
            }
        }

        ctx.globalCompositeOperation = "source-over";
    }

    /* ---------- girdi ---------- */

    window.addEventListener("pointermove", (event) => {
        pointer.targetX = event.clientX / Math.max(1, window.innerWidth);
        pointer.targetY = event.clientY / Math.max(1, window.innerHeight);
        pointer.active = true;
    }, { passive: true });

    window.addEventListener("pointerleave", () => {
        pointer.active = false;
    }, { passive: true });

    // dokunmatik / hareketsiz durumda otomatik pointer (vgpu davranışı)
    function autoPointer(time) {
        if (pointer.active && !reduceMotion) return;
        const phase = (time / 18) * Math.PI * 2;
        pointer.targetX = 0.5 + Math.cos(phase) * 0.34;
        pointer.targetY = 0.5 + Math.sin(phase) * 0.34;
    }

    function tick(time) {
        autoPointer(time);

        // prizma geometrisi three.js sahnesinden gelir
        const geometry = window.__prismGeometry;
        if (geometry) {
            try {
                drawBeam(geometry);
            } catch (error) {
                console.warn("Isik katmani durdu:", error);
            }
        }

        requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
})();
