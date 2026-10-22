/* ==========================================================
   YOUNG VAMP LIFE — vgpu.sh Obsidian Glass Prism Engine
   Volumetric Laser · Spectral Rainbow · 3D Parallax · Dust Motes
   Fluid 60 FPS across all devices (with or without Hardware Acceleration)
   ========================================================== */

(function () {
    "use strict";

    const canvas = document.getElementById("beam-canvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    const poster = document.getElementById("prism-poster");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* ---------- durum ve boyutlar ---------- */

    let width = 0;
    let height = 0;
    let dpr = 1;

    const pointer = {
        x: 0.82,
        y: 0.78,
        targetX: 0.82,
        targetY: 0.78,
        active: false,
        everMoved: false
    };

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

    function setPointer(e) {
        pointer.targetX = Math.max(0, Math.min(1, e.clientX / width));
        pointer.targetY = Math.max(0, Math.min(1, e.clientY / height));
        pointer.active = true;
        pointer.everMoved = true;
    }

    window.addEventListener("pointermove", setPointer, { passive: true });
    window.addEventListener("pointerdown", setPointer, { passive: true });
    window.addEventListener("touchmove", (e) => {
        if (e.touches && e.touches[0]) setPointer(e.touches[0]);
    }, { passive: true });

    /* ---------- kaydırma solması ---------- */

    function applyScroll() {
        const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        const progress = Math.min(1, (window.scrollY || 0) / max);
        const fade = Math.max(0, Math.min(1, 1 - progress * 1.25));
        document.documentElement.style.setProperty("--scene-fade", fade.toFixed(3));
        window.__scrollProgress = progress;
    }

    window.addEventListener("scroll", applyScroll, { passive: true });
    applyScroll();

    /* ---------- ortam toz parçacıkları (dust motes) ---------- */

    const DUST_COUNT = 45;
    const dust = [];
    for (let i = 0; i < DUST_COUNT; i++) {
        dust.push({
            x: Math.random(),
            y: Math.random(),
            size: 0.7 + Math.random() * 1.6,
            speedX: (Math.random() - 0.5) * 0.00018,
            speedY: -0.00008 - Math.random() * 0.00028,
            baseAlpha: 0.18 + Math.random() * 0.45,
            phase: Math.random() * Math.PI * 2
        });
    }

    function renderDust(time, beamP1, beamP2) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";

        for (let i = 0; i < dust.length; i++) {
            const p = dust[i];
            if (!reduceMotion) {
                p.x += p.speedX;
                p.y += p.speedY;
                if (p.y < 0) p.y = 1;
                if (p.x < 0) p.x = 1;
                if (p.x > 1) p.x = 0;
            }

            const sx = p.x * width;
            const sy = p.y * height;

            // Isin cizgisine yakinlik kontrolu (isiktan gecerken parlama)
            let boost = 1;
            if (beamP1 && beamP2) {
                const distToBeam = distToSegment(sx, sy, beamP1.x, beamP1.y, beamP2.x, beamP2.y);
                if (distToBeam < 35) {
                    boost = 1 + (1 - distToBeam / 35) * 4.5;
                }
            }

            // Gökkuşağı alanında da parıldama
            if (sx < width * 0.52 && sy > height * 0.45 && sy < height * 0.90) {
                boost = Math.max(boost, 2.2);
            }

            const twinkle = 0.7 + 0.3 * Math.sin(time * 2.5 + p.phase);
            const alpha = Math.min(1, p.baseAlpha * twinkle * boost);

            ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(sx, sy, p.size * (boost > 1.5 ? 1.4 : 1), 0, Math.PI * 2);
            ctx.fill();

            if (boost > 2.0) {
                ctx.fillStyle = `rgba(180, 225, 255, ${(alpha * 0.35).toFixed(3)})`;
                ctx.beginPath();
                ctx.arc(sx, sy, p.size * 3.2, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.restore();
    }

    function distToSegment(px, py, x1, y1, x2, y2) {
        const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
        if (l2 === 0) return Math.hypot(px - x1, py - y1);
        let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
    }

    /* ---------- vgpu.sh spectral gökkuşağı renkleri ---------- */
    // Alan Zucconi / CIEXYZ tabanlı saf spektrum renkleri
    const RAINBOW_STOPS = [
        { r: 255, g: 30,  b: 30  }, // 700nm derin kırmızı
        { r: 255, g: 95,  b: 0   }, // 630nm turuncu
        { r: 255, g: 215, b: 0   }, // 580nm sarı
        { r: 20,  g: 240, b: 60  }, // 530nm zümrüt yeşil
        { r: 0,   g: 245, b: 255 }, // 490nm turkuaz / camgöbeği
        { r: 35,  g: 90,  b: 255 }, // 450nm kobalt mavi
        { r: 160, g: 20,  b: 255 }  // 400nm saf mor / violet
    ];

    /* ---------- ana animasyon döngüsü (60 fps) ---------- */

    let lastTime = 0;
    let curX = pointer.x;
    let curY = pointer.y;

    function frame(now) {
        requestAnimationFrame(frame);

        const delta = Math.min(0.1, (now - lastTime) * 0.001 || 0.016);
        lastTime = now;
        const time = now * 0.001;

        // Pointer yumuşatma (inertia lerp)
        if (!reduceMotion && !pointer.everMoved) {
            // Mouse henüz hareket etmediyse vgpu.sh gibi yumuşak organik salınım
            pointer.targetX = 0.82 + Math.sin(time * 0.6) * 0.06;
            pointer.targetY = 0.78 + Math.cos(time * 0.45) * 0.05;
        }

        curX += (pointer.targetX - curX) * 0.055;
        curY += (pointer.targetY - curY) * 0.055;

        // 3D Parallax Derinlik Hareketi (Arka Plan Kristal Sahnesi)
        const parallaxX = (curX - 0.5) * -22;
        const parallaxY = (curY - 0.5) * -14;
        const breath = reduceMotion ? 0 : Math.sin(time * 0.8) * 0.012;

        if (poster) {
            poster.style.transform = `translate3d(${parallaxX.toFixed(2)}px, ${parallaxY.toFixed(2)}px, 0) scale(${(1.025 + breath).toFixed(4)})`;
        }

        // Tuvali temizle
        ctx.clearRect(0, 0, width, height);

        /* ==========================================================
           1. PRİZMA VE IŞIK GEOMETRİSİ KOORDİNATLARI
           vgpu.sh birebir: Prizma ekran ortası-hafif sağda, ışık sağ alttan girer
           ========================================================== */

        const isMobile = width < 768;
        // Prizma merkezi (parallax ile hafif hareketli)
        const prismCenterX = width * (isMobile ? 0.50 : 0.525) + parallaxX * 0.4;
        const prismCenterY = height * (isMobile ? 0.44 : 0.420) + parallaxY * 0.4;

        // Kristal boyut ölçeği
        const crystalScale = Math.min(width, height) * (isMobile ? 0.38 : 0.28);

        // Işığın kristal sağ yüzeyine çarpma noktası (giriş)
        const hitRight = {
            x: prismCenterX + crystalScale * 0.28,
            y: prismCenterY + crystalScale * 0.12
        };

        // Gelen lazer kaynağı (mouse koordinatlarına bağlı sağ alt)
        const source = {
            x: width * (0.68 + curX * 0.32),
            y: height * (0.58 + curY * 0.42)
        };

        // Gökkuşağı çıkış noktası (sol yüz)
        const exitLeft = {
            x: prismCenterX - crystalScale * 0.24,
            y: prismCenterY + crystalScale * 0.22
        };

        // Gökkuşağının sol alt köşeye doğru yayılımı
        const rainbowTarget = {
            x: -width * 0.08,
            y: height * 0.82
        };

        /* ==========================================================
           2. GELEN HACİMSEL BEYAZ LAZER IŞINI (vgpu.sh Volumetric Laser)
           ========================================================== */

        ctx.save();
        ctx.globalCompositeOperation = "lighter";

        // Nefes alan lazer nabzı (organic harmonic pulse)
        const laserPulse = 1.0 + Math.sin(time * 2.8) * 0.12;

        // 2a. Geniş Yumuşak Hacimsel Atmosfer Işıltısı
        const beamGlow = ctx.createLinearGradient(source.x, source.y, hitRight.x, hitRight.y);
        beamGlow.addColorStop(0, "rgba(200, 230, 255, 0.0)");
        beamGlow.addColorStop(0.3, `rgba(180, 220, 255, ${(0.07 * laserPulse).toFixed(3)})`);
        beamGlow.addColorStop(0.8, `rgba(220, 240, 255, ${(0.18 * laserPulse).toFixed(3)})`);
        beamGlow.addColorStop(1, `rgba(255, 255, 255, ${(0.32 * laserPulse).toFixed(3)})`);

        ctx.strokeStyle = beamGlow;
        ctx.lineWidth = Math.min(75, width * 0.06);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(hitRight.x, hitRight.y);
        ctx.stroke();

        // 2b. Orta Düzey Parlak Işık Hüzmesi
        ctx.strokeStyle = `rgba(220, 242, 255, ${(0.42 * laserPulse).toFixed(3)})`;
        ctx.lineWidth = 18;
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(hitRight.x, hitRight.y);
        ctx.stroke();

        // 2c. Yoğun Akkor Beyaz Lazer Çekirdeği
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 4.8;
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(hitRight.x, hitRight.y);
        ctx.stroke();

        /* ==========================================================
           3. KRİSTAL YÜZEYİNDE PARILDAYAN ODAK LENS PARLAMASI (Glint / Flare)
           ========================================================== */

        const flarePulse = 0.85 + Math.sin(time * 4.2) * 0.25;

        // Odak dairesel parlama (radial bloom disk)
        const hitFlare = ctx.createRadialGradient(hitRight.x, hitRight.y, 0, hitRight.x, hitRight.y, 45);
        hitFlare.addColorStop(0, `rgba(255, 255, 255, ${(0.95 * flarePulse).toFixed(3)})`);
        hitFlare.addColorStop(0.25, `rgba(220, 245, 255, ${(0.65 * flarePulse).toFixed(3)})`);
        hitFlare.addColorStop(0.6, `rgba(150, 210, 255, ${(0.18 * flarePulse).toFixed(3)})`);
        hitFlare.addColorStop(1, "rgba(150, 210, 255, 0)");

        ctx.fillStyle = hitFlare;
        ctx.beginPath();
        ctx.arc(hitRight.x, hitRight.y, 45, 0, Math.PI * 2);
        ctx.fill();

        // Anamorfik yatay ışık çizgisi (diffraction spike)
        const streakGrad = ctx.createLinearGradient(hitRight.x - 70, hitRight.y, hitRight.x + 70, hitRight.y);
        streakGrad.addColorStop(0, "rgba(255, 255, 255, 0)");
        streakGrad.addColorStop(0.5, `rgba(255, 255, 255, ${(0.75 * flarePulse).toFixed(3)})`);
        streakGrad.addColorStop(1, "rgba(255, 255, 255, 0)");

        ctx.strokeStyle = streakGrad;
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(hitRight.x - 70, hitRight.y);
        ctx.lineTo(hitRight.x + 70, hitRight.y);
        ctx.stroke();

        ctx.restore();

        /* ==========================================================
           4. SOLA ÇIKAN CANLI SPEKTRAL GÖKKUŞAĞI DALGASI (Alan Zucconi 1:1)
           ========================================================== */

        ctx.save();
        ctx.globalCompositeOperation = "lighter";

        const rainbowWave = time * 2.2;
        const totalStops = RAINBOW_STOPS.length;
        const ribbonSpread = Math.min(110, height * 0.14); // açılma kalınlığı
        const startH = 18; // çıkıştaki dar genişlik

        for (let i = 0; i < totalStops; i++) {
            const stop = RAINBOW_STOPS[i];
            const frac = i / (totalStops - 1); // 0 (kırmızı) -> 1 (mor)

            // Çıkış ve varış noktalarında dikey ofset
            const y0 = exitLeft.y + (frac - 0.5) * startH;
            const x0 = exitLeft.x;

            const y1 = rainbowTarget.y + (frac - 0.5) * ribbonSpread;
            const x1 = rainbowTarget.x;

            // Dinamik kromatik dalga ışıltısı (spektrum boyunca hareket eden ışıltı)
            const wave = 0.88 + 0.18 * Math.sin(rainbowWave - frac * Math.PI * 2);

            const col = `rgb(${stop.r}, ${stop.g}, ${stop.b})`;
            const grad = ctx.createLinearGradient(x0, y0, x1, y1);
            grad.addColorStop(0, `rgba(${stop.r}, ${stop.g}, ${stop.b}, ${(0.92 * wave).toFixed(3)})`);
            grad.addColorStop(0.35, `rgba(${stop.r}, ${stop.g}, ${stop.b}, ${(0.80 * wave).toFixed(3)})`);
            grad.addColorStop(0.70, `rgba(${stop.r}, ${stop.g}, ${stop.b}, ${(0.55 * wave).toFixed(3)})`);
            grad.addColorStop(1, `rgba(${stop.r}, ${stop.g}, ${stop.b}, 0.0)`);

            // Geniş hacimsel parıltı bandı
            ctx.strokeStyle = grad;
            ctx.lineWidth = 15;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.lineTo(x1, y1);
            ctx.stroke();

            // Canlı doygun çekirdek bandı
            ctx.strokeStyle = col;
            ctx.lineWidth = 3.6;
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.lineTo(x1, y1);
            ctx.stroke();
        }

        // Çıkış noktasındaki akkor beyaz kırılma parlaklığı
        const exitWhite = ctx.createRadialGradient(exitLeft.x, exitLeft.y, 0, exitLeft.x, exitLeft.y, 40);
        exitWhite.addColorStop(0, "rgba(255, 255, 255, 0.95)");
        exitWhite.addColorStop(0.3, "rgba(255, 255, 255, 0.65)");
        exitWhite.addColorStop(0.7, "rgba(210, 240, 255, 0.2)");
        exitWhite.addColorStop(1, "rgba(210, 240, 255, 0)");

        ctx.fillStyle = exitWhite;
        ctx.beginPath();
        ctx.arc(exitLeft.x, exitLeft.y, 40, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        /* ==========================================================
           5. ORTAM TOZ PARÇACIKLARI (Dust Motes)
           ========================================================== */

        renderDust(time, source, hitRight);
    }

    requestAnimationFrame(frame);
})();
