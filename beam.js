/* ==========================================================
   YOUNG VAMP LIFE — vgpu.sh Hero Prism (1:1 Replica)
   Obsidian Glass Gem-Cut Prism · Volumetric Laser · Vibrant Rainbow
   Runs at 60 FPS everywhere (with or without Hardware Acceleration)
   ========================================================== */

(function () {
    "use strict";

    const canvas = document.getElementById("beam-canvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // prism-canvas'i kapatiyoruz (tek bir tuvalde mukemmel compositing)
    const prismCanvas = document.getElementById("prism-canvas");
    if (prismCanvas) prismCanvas.style.display = "none";

    /* ---------- durum ve girdi ---------- */

    let width = 0;
    let height = 0;
    let dpr = 1;

    const pointer = {
        x: 0.85,
        y: 0.82,
        targetX: 0.85,
        targetY: 0.82,
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
            size: 0.7 + Math.random() * 1.5,
            speedX: (Math.random() - 0.5) * 0.00015,
            speedY: -0.00008 - Math.random() * 0.00025,
            baseAlpha: 0.15 + Math.random() * 0.45,
            phase: Math.random() * Math.PI * 2
        });
    }

    function renderDust(t, lightPath) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";

        for (let i = 0; i < dust.length; i++) {
            const p = dust[i];
            p.x += p.speedX;
            p.y += p.speedY;
            if (p.y < 0) p.y = 1;
            if (p.x < 0) p.x = 1;
            if (p.x > 1) p.x = 0;

            const px = p.x * width;
            const py = p.y * height;

            // Isik demetinin yakinindaysa parildasin
            let boost = 1;
            if (lightPath) {
                const distToBeam = Math.abs((py - lightPath.y0) - (lightPath.slope * (px - lightPath.x0)));
                if (distToBeam < 45) {
                    boost = 1 + (1 - distToBeam / 45) * 2.5;
                }
            }

            const flicker = Math.sin(t * 1.8 + p.phase) * 0.35 + 0.65;
            const alpha = Math.min(1, p.baseAlpha * flicker * boost);

            ctx.fillStyle = `rgba(220, 240, 255, ${alpha})`;
            ctx.beginPath();
            ctx.arc(px, py, p.size * (boost > 1.2 ? 1.3 : 1), 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    /* ---------- renk spektrumu tanımı ---------- */

    const RAINBOW_STOPS = [
        { stop: 0.00, r: 255, g: 0,   b: 40  }, // Kirmizi
        { stop: 0.16, r: 255, g: 85,  b: 0   }, // Turuncu
        { stop: 0.32, r: 255, g: 215, b: 0   }, // Sari
        { stop: 0.50, r: 0,   g: 235, b: 70  }, // Yesil
        { stop: 0.68, r: 0,   g: 210, b: 255 }, // Turkuaz
        { stop: 0.84, r: 0,   g: 65,  b: 255 }, // Mavi
        { stop: 1.00, r: 100, g: 0,   b: 240 }  // Mor
    ];

    /* ---------- ana çizim fonksiyonu ---------- */

    let lastTime = 0;

    function render(now) {
        requestAnimationFrame(render);

        if (document.hidden) return;

        const delta = lastTime ? Math.min(60, now - lastTime) : 16;
        lastTime = now;
        const t = now * 0.001;

        // Sahne kaydirilip gorunmez olduysa cizme
        const fade = parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue("--scene-fade")
        ) || 0;
        if (fade <= 0.001) return;

        // Pointer yumusatma (smooth lerp)
        const ease = 1 - Math.exp(-delta * 0.009);
        pointer.x += (pointer.targetX - pointer.x) * ease;
        pointer.y += (pointer.targetY - pointer.y) * ease;

        // Kullanici henuz fareyi oynatmadıysa hafif sinematik salinim
        let aimParam = 0.68;
        let sourceYOffset = 0;
        if (!pointer.everMoved) {
            aimParam = 0.66 + Math.sin(t * 0.9) * 0.05;
            sourceYOffset = Math.sin(t * 1.2) * 20;
        } else {
            aimParam = 0.45 + (1 - pointer.y) * 0.45;
            aimParam = Math.max(0.25, Math.min(0.85, aimParam));
        }

        // Tuvali temizle
        ctx.clearRect(0, 0, width, height);

        /* ==========================================================
           1. PRİZMA GEOMETRİSİ (vgpu.sh Eşkenar Elmas-Kesim Prizma)
           ========================================================== */

        const isCompact = width < 900;
        // Desktop'ta sag tarafta, mobilde ortada
        const cx = (isCompact ? 0.5 : 0.66) * width;
        const cy = 0.5 * height;

        // Esit kenar ucgen yuksekligi ve genisligi
        const prismH = Math.min(height * 0.56, isCompact ? 340 : 480);
        const prismW = prismH * 1.1547; // tam eskenar oran (2 / sqrt(3))

        // Dış Üçgen (Outer Silhouette)
        const T0 = { x: cx, y: cy - prismH * 0.52 };
        const L0 = { x: cx - prismW * 0.5, y: cy + prismH * 0.48 };
        const R0 = { x: cx + prismW * 0.5, y: cy + prismH * 0.48 };

        // Agirlik merkezi (Centroid)
        const G = { x: cx, y: cy + prismH * 0.1467 };

        // Orta Pah Ridge (Mid Chamfer Crease - %86 olcek)
        const scaleMid = 0.855;
        const T1 = { x: G.x + (T0.x - G.x) * scaleMid, y: G.y + (T0.y - G.y) * scaleMid };
        const L1 = { x: G.x + (L0.x - G.x) * scaleMid, y: G.y + (L0.y - G.y) * scaleMid };
        const R1 = { x: G.x + (R0.x - G.x) * scaleMid, y: G.y + (R0.y - G.y) * scaleMid };

        // Ic Cekirdek (Inner Recessed Obsidian Core - %74 olcek)
        const scaleInner = 0.74;
        const T2 = { x: G.x + (T0.x - G.x) * scaleInner, y: G.y + (T0.y - G.y) * scaleInner };
        const L2 = { x: G.x + (L0.x - G.x) * scaleInner, y: G.y + (L0.y - G.y) * scaleInner };
        const R2 = { x: G.x + (R0.x - G.x) * scaleInner, y: G.y + (R0.y - G.y) * scaleInner };

        /* ==========================================================
           2. OPTİK HESAPLAMA (Işın ve Kırılma Yolları)
           vgpu.sh mantığı: Beyaz ışık sağdan girer, gökkuşağı sola çıkar
           ========================================================== */

        // Sag kenarda carpma noktasi (T0 -> R0)
        const hitRight = {
            x: T0.x + (R0.x - T0.x) * aimParam,
            y: T0.y + (R0.y - T0.y) * aimParam
        };

        // Beyaz isigin baslangic noktasi (ekranin sag alt kosesi / sag disi)
        const sourceAngle = 0.62; // radyan
        const sourceDist = Math.max(300, width * 0.35);
        const source = {
            x: hitRight.x + Math.cos(sourceAngle) * sourceDist,
            y: hitRight.y + Math.sin(sourceAngle) * sourceDist + sourceYOffset
        };

        // Sol kenardan cikis noktasi (L0 -> T0)
        // Optik kirilma ile cam icinde hafif yukari kayarak sola cikar
        const exitParam = Math.max(0.28, Math.min(0.82, 1 - aimParam * 0.85 + 0.08));
        const exitLeft = {
            x: L0.x + (T0.x - L0.x) * exitParam,
            y: L0.y + (T0.y - L0.y) * exitParam
        };

        // Gökkuşağı yayılım uzunluğu (ekranın soluna kadar kesintisiz)
        const rainbowLength = Math.max(380, exitLeft.x + 80);
        const rainbowAngle = Math.PI + 0.08; // yataydan hafif asagi sola

        /* ==========================================================
           3. ÇİZİM: GELEN BEYAZ LAZER (Sağ Alttan Giriş)
           ========================================================== */

        // 3a. Genis Hacimsel Atmosfer Parlamasi
        ctx.save();
        ctx.globalCompositeOperation = "lighter";

        const beamGlow = ctx.createLinearGradient(source.x, source.y, hitRight.x, hitRight.y);
        beamGlow.addColorStop(0, "rgba(220, 240, 255, 0)");
        beamGlow.addColorStop(0.35, "rgba(200, 230, 255, 0.08)");
        beamGlow.addColorStop(1, "rgba(255, 255, 255, 0.22)");

        ctx.strokeStyle = beamGlow;
        ctx.lineWidth = 44;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(hitRight.x, hitRight.y);
        ctx.stroke();

        // 3b. Orta Yumusak Parlama
        ctx.strokeStyle = "rgba(230, 245, 255, 0.45)";
        ctx.lineWidth = 18;
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(hitRight.x, hitRight.y);
        ctx.stroke();

        // 3c. Yogun Beyaz Cekirdek
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 6.5;
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(hitRight.x, hitRight.y);
        ctx.stroke();

        ctx.restore();

        /* ==========================================================
           4. ÇİZİM: SOLA ÇIKAN GÖKKUŞAĞI YELPAZESİ (vgpu.sh Signature)
           ========================================================== */

        ctx.save();
        ctx.globalCompositeOperation = "lighter";

        // Gökkuşağı şeridinin çıkış ve varış noktaları
        const fanSpread = 72; // sola dogru acilma payi
        const startH = 22;     // cam cikisindaki kalinlik

        // 4a. Hacimsel Renk Doygunluğu (Geniş Yumuşak Renk Alanı)
        for (let i = 0; i < RAINBOW_STOPS.length; i++) {
            const stop = RAINBOW_STOPS[i];
            const frac = i / (RAINBOW_STOPS.length - 1); // 0 (kirmizi) -> 1 (mor)

            // Cikis noktasindaki dikey ofset
            const yStart = (frac - 0.5) * startH;
            const x0 = exitLeft.x;
            const y0 = exitLeft.y + yStart;

            // Varistaki dikey yayilim
            const yEnd = (frac - 0.5) * (startH + fanSpread);
            const x1 = exitLeft.x + Math.cos(rainbowAngle) * rainbowLength;
            const y1 = exitLeft.y + Math.sin(rainbowAngle) * rainbowLength + yEnd;

            // Ana canli renk hüzmesi
            const col = `rgb(${stop.r}, ${stop.g}, ${stop.b})`;
            const grad = ctx.createLinearGradient(x0, y0, x1, y1);
            grad.addColorStop(0, `rgba(${stop.r}, ${stop.g}, ${stop.b}, 0.95)`);
            grad.addColorStop(0.35, `rgba(${stop.r}, ${stop.g}, ${stop.b}, 0.85)`);
            grad.addColorStop(0.75, `rgba(${stop.r}, ${stop.g}, ${stop.b}, 0.65)`);
            grad.addColorStop(1, `rgba(${stop.r}, ${stop.g}, ${stop.b}, 0)`);

            // Genis isilti
            ctx.strokeStyle = grad;
            ctx.lineWidth = 14;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.lineTo(x1, y1);
            ctx.stroke();

            // Yogun cekirdek
            ctx.strokeStyle = col;
            ctx.lineWidth = 4.5;
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.lineTo(x1, y1);
            ctx.stroke();
        }

        // 4b. Cikis Anindaki Beyaz Isik Parlamasi (Gokkusaginin baslangicindaki beyaz gecis)
        const exitWhite = ctx.createRadialGradient(exitLeft.x, exitLeft.y, 0, exitLeft.x, exitLeft.y, 45);
        exitWhite.addColorStop(0, "rgba(255, 255, 255, 1)");
        exitWhite.addColorStop(0.35, "rgba(255, 255, 255, 0.7)");
        exitWhite.addColorStop(0.7, "rgba(200, 235, 255, 0.2)");
        exitWhite.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = exitWhite;
        ctx.beginPath();
        ctx.arc(exitLeft.x, exitLeft.y, 45, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        /* ==========================================================
           5. ÇİZİM: ELMAS KESİM OBSİDİYAN PRİZMA (vgpu.sh Gem Body)
           ========================================================== */

        ctx.save();

        // 5a. Dış Katman ve Arka Taban (Derin cam zemin)
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "rgba(4, 7, 14, 0.96)";
        ctx.beginPath();
        ctx.moveTo(T0.x, T0.y);
        ctx.lineTo(L0.x, L0.y);
        ctx.lineTo(R0.x, R0.y);
        ctx.closePath();
        ctx.fill();

        // 5b. Pah Eğim Fasetleri (Bevel Chamfer Slopes - Derin Kristal Yansımaları)
        // Sol Pah Faseti
        const leftSlope = ctx.createLinearGradient(T0.x, T0.y, L1.x, L1.y);
        leftSlope.addColorStop(0, "rgba(45, 65, 105, 0.65)");
        leftSlope.addColorStop(0.5, "rgba(18, 28, 48, 0.7)");
        leftSlope.addColorStop(1, "rgba(35, 52, 85, 0.65)");
        ctx.fillStyle = leftSlope;
        ctx.beginPath();
        ctx.moveTo(T0.x, T0.y);
        ctx.lineTo(L0.x, L0.y);
        ctx.lineTo(L1.x, L1.y);
        ctx.lineTo(T1.x, T1.y);
        ctx.closePath();
        ctx.fill();

        // Sağ Pah Faseti (Lazerin vurduğu faset - ışık yansıması içerir)
        const rightSlope = ctx.createLinearGradient(T0.x, T0.y, R1.x, R1.y);
        rightSlope.addColorStop(0, "rgba(60, 90, 145, 0.75)");
        rightSlope.addColorStop(0.45, "rgba(120, 160, 220, 0.85)"); // lazer parlamasi
        rightSlope.addColorStop(1, "rgba(25, 40, 70, 0.7)");
        ctx.fillStyle = rightSlope;
        ctx.beginPath();
        ctx.moveTo(T0.x, T0.y);
        ctx.lineTo(R0.x, R0.y);
        ctx.lineTo(R1.x, R1.y);
        ctx.lineTo(T1.x, T1.y);
        ctx.closePath();
        ctx.fill();

        // Alt Taban Faseti
        const botSlope = ctx.createLinearGradient(L0.x, L0.y, R1.x, R1.y);
        botSlope.addColorStop(0, "rgba(15, 24, 42, 0.7)");
        botSlope.addColorStop(0.5, "rgba(8, 14, 25, 0.85)");
        botSlope.addColorStop(1, "rgba(22, 35, 60, 0.7)");
        ctx.fillStyle = botSlope;
        ctx.beginPath();
        ctx.moveTo(L0.x, L0.y);
        ctx.lineTo(R0.x, R0.y);
        ctx.lineTo(R1.x, R1.y);
        ctx.lineTo(L1.x, L1.y);
        ctx.closePath();
        ctx.fill();

        // 5c. Köşe Elmas Kesim Fasetleri (Corner Caps)
        ctx.fillStyle = "rgba(85, 120, 185, 0.55)";
        // Tepe köşe
        ctx.beginPath();
        ctx.moveTo(T0.x, T0.y);
        ctx.lineTo(T0.x - 14, T0.y + 22);
        ctx.lineTo(T1.x, T1.y);
        ctx.lineTo(T0.x + 14, T0.y + 22);
        ctx.closePath();
        ctx.fill();

        // 5d. İç Çekirdek (Deep Obsidian Core - vgpu.sh'taki simsiyah merkez)
        ctx.fillStyle = "rgba(2, 4, 8, 0.98)";
        ctx.beginPath();
        ctx.moveTo(T2.x, T2.y);
        ctx.lineTo(L2.x, L2.y);
        ctx.lineTo(R2.x, R2.y);
        ctx.closePath();
        ctx.fill();

        // 5e. İç Kırılma Işık Şeridi (Camın içinden geçen gökkuşağı demeti)
        // Yalnızca prizma gövdesi içine maskelenerek çizilir
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(T0.x, T0.y);
        ctx.lineTo(L0.x, L0.y);
        ctx.lineTo(R0.x, R0.y);
        ctx.closePath();
        ctx.clip();

        ctx.globalCompositeOperation = "lighter";

        // Cam ici renkli dispersiyon bandi (hitRight -> exitLeft)
        for (let i = 0; i < RAINBOW_STOPS.length; i++) {
            const stop = RAINBOW_STOPS[i];
            const frac = i / (RAINBOW_STOPS.length - 1);

            const yR = (frac - 0.5) * 8;
            const yL = (frac - 0.5) * 22;

            const inGrad = ctx.createLinearGradient(hitRight.x, hitRight.y + yR, exitLeft.x, exitLeft.y + yL);
            inGrad.addColorStop(0, "rgba(255, 255, 255, 0.9)"); // giriste saf beyaz
            inGrad.addColorStop(0.35, `rgba(${stop.r}, ${stop.g}, ${stop.b}, 0.8)`);
            inGrad.addColorStop(1, `rgba(${stop.r}, ${stop.g}, ${stop.b}, 0.95)`); // cikista tam renk

            ctx.strokeStyle = inGrad;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(hitRight.x, hitRight.y + yR);
            ctx.lineTo(exitLeft.x, exitLeft.y + yL);
            ctx.stroke();
        }

        // Cam ici beyaz isik cekirdegi
        const innerCore = ctx.createLinearGradient(hitRight.x, hitRight.y, exitLeft.x, exitLeft.y);
        innerCore.addColorStop(0, "rgba(255, 255, 255, 1)");
        innerCore.addColorStop(0.5, "rgba(240, 250, 255, 0.85)");
        innerCore.addColorStop(1, "rgba(255, 255, 255, 0.9)");

        ctx.strokeStyle = innerCore;
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(hitRight.x, hitRight.y);
        ctx.lineTo(exitLeft.x, exitLeft.y);
        ctx.stroke();

        ctx.restore();

        // 5f. Keskin Kristal Çizgiler (vgpu.sh Elmas Kenar Hatları)
        ctx.globalCompositeOperation = "source-over";

        // Dış Kenar Hatları (Sharp Chrome Outer Rims)
        ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(T0.x, T0.y);
        ctx.lineTo(L0.x, L0.y);
        ctx.lineTo(R0.x, R0.y);
        ctx.closePath();
        ctx.stroke();

        // Orta Pah Çizgisi (Chamfer Crease)
        ctx.strokeStyle = "rgba(180, 215, 255, 0.4)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(T1.x, T1.y);
        ctx.lineTo(L1.x, L1.y);
        ctx.lineTo(R1.x, R1.y);
        ctx.closePath();
        ctx.stroke();

        // İç Çekirdek Kenarı
        ctx.strokeStyle = "rgba(120, 160, 230, 0.25)";
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(T2.x, T2.y);
        ctx.lineTo(L2.x, L2.y);
        ctx.lineTo(R2.x, R2.y);
        ctx.closePath();
        ctx.stroke();

        // Köşe bağlantı pah çizgileri
        ctx.strokeStyle = "rgba(220, 240, 255, 0.45)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(T0.x, T0.y); ctx.lineTo(T1.x, T1.y);
        ctx.moveTo(L0.x, L0.y); ctx.lineTo(L1.x, L1.y);
        ctx.moveTo(R0.x, R0.y); ctx.lineTo(R1.x, R1.y);
        ctx.stroke();

        // 5g. Giriş Noktası Lazer Parlaması (Hit Lens Flare)
        ctx.globalCompositeOperation = "lighter";
        const hitFlare = ctx.createRadialGradient(hitRight.x, hitRight.y, 0, hitRight.x, hitRight.y, 36);
        hitFlare.addColorStop(0, "rgba(255, 255, 255, 1)");
        hitFlare.addColorStop(0.3, "rgba(220, 245, 255, 0.7)");
        hitFlare.addColorStop(0.7, "rgba(160, 210, 255, 0.2)");
        hitFlare.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = hitFlare;
        ctx.beginPath();
        ctx.arc(hitRight.x, hitRight.y, 36, 0, Math.PI * 2);
        ctx.fill();

        // 5h. Tepe Uç Noktası Elmas Parıltısı
        const apexSpark = ctx.createRadialGradient(T0.x, T0.y, 0, T0.x, T0.y, 14);
        apexSpark.addColorStop(0, "rgba(255, 255, 255, 1)");
        apexSpark.addColorStop(0.4, "rgba(200, 230, 255, 0.5)");
        apexSpark.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = apexSpark;
        ctx.beginPath();
        ctx.arc(T0.x, T0.y, 14, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        /* ==========================================================
           6. ORTAM PARÇACIKLARI (Dust Motes)
           ========================================================== */

        const beamSlope = (hitRight.y - source.y) / (hitRight.x - source.x);
        renderDust(t, { x0: hitRight.x, y0: hitRight.y, slope: beamSlope });
    }

    requestAnimationFrame(render);
})();
