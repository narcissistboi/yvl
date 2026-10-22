/* ==========================================================
   yvl — animated glass prism
   inspired by the vgpu.sh hero scene
   ========================================================== */

import * as THREE from "./three.module.min.js";

const canvas = document.getElementById("prism-canvas");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// "3d" = three.js sahnesi, "2d" = ekran karti olmayan cihazlar icin
window.__sceneMode = "3d";
window.__prismQuality = 2;
window.__refreshRate = 60;

/* ---------- ekran yenileme hizini olc ---------- */
// 60 / 120 / 144 / 180 Hz ekranlarda animasyon ekranin hizinda olmali
function detectRefreshRate() {
    return new Promise((resolve) => {
        const samples = [];
        let last = 0;

        function tick(now) {
            if (last) samples.push(now - last);
            last = now;

            if (samples.length < 24) {
                requestAnimationFrame(tick);
                return;
            }

            samples.sort((a, b) => a - b);
            const median = samples[Math.floor(samples.length / 2)];
            const hz = Math.round(1000 / median);
            resolve(Math.max(30, Math.min(240, hz)));
        }

        requestAnimationFrame(tick);
    });
}

/* ---------- cihaz yetenegini olc ---------- */
// 2 = guclu, 1 = orta, 0 = zayif, -1 = yazilim renderer (2d mod)
function detectDeviceTier() {
    // veri tasarrufu / pil modu
    const connection = navigator.connection;
    if (connection && (connection.saveData || /2g/.test(connection.effectiveType || ""))) {
        return 0;
    }

    // yazilim renderer (swiftshader / llvmpipe) -> ekran karti yok
    let weakGpu = false;
    try {
        const probe = document.createElement("canvas");
        const gl = probe.getContext("webgl2") || probe.getContext("webgl");
        if (!gl) return -1;

        const info = gl.getExtension("WEBGL_debug_renderer_info");
        const renderer = String(
            info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
        );

        // donanim hizlandirma kapaliyken chrome swiftshader kullanir
        // 3D'yi kapatmak yerine hafif 3D (tier 0) modunda calistir
        if (/swiftshader|llvmpipe|softwarerasterizer|software|basic render|mesa offscreen|angle \(software/i.test(renderer)) {
            weakGpu = true;
            return 0;
        }

        // zayif entegre GPU tespiti (Intel UHD/HD, eski Radeon, vb.)
        if (/intel.*(uhd|hd graphics|hd \d)|radeon.*(vega\s*[3-8]|r[2-5])|mali|adreno\s*[2-5]/i.test(renderer)) {
            weakGpu = true;
        }
    } catch (error) {
        /* tarayici desteklemiyorsa varsayilana devam */
    }

    const cores = navigator.hardwareConcurrency || 4;
    const memory = navigator.deviceMemory || 4;
    const mobile = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);

    if (mobile || cores <= 4 || memory < 4) return weakGpu ? 0 : 1;
    if (weakGpu) return 0;
    return 2;
}

/* ---------- lite mod ---------- */
// yazilim render / zayif cihaz: 2d katman da sadelestirilir
function enableLiteMode() {
    window.__liteMode = true;
    document.documentElement.classList.add("lite");
}

if (canvas) {
    const tier = detectDeviceTier();

    if (tier < 0) {
        // ekran karti yok: 2d mod, webgl hic denenmez
        window.__sceneMode = "2d";
        canvas.style.display = "none";
        enableLiteMode();
    } else {
        if (tier === 0) enableLiteMode();

        try {
            initPrism(canvas, reduceMotion, tier);
        } catch (error) {
            console.warn("Prism background disabled:", error);
            canvas.style.display = "none";
            window.__sceneMode = "2d";
            enableLiteMode();
        }
    }

    detectRefreshRate().then((hz) => {
        window.__refreshRate = hz;
    });
}

function initPrism(canvas, still, tier) {
    const deviceRatio = window.devicePixelRatio || 1;

    const renderer = new THREE.WebGLRenderer({
        canvas,
        // yuksek cozunurluklu ekranlarda MSAA pahali; kapatiyoruz
        antialias: deviceRatio < 1.5,
        alpha: false,
        powerPreference: "high-performance"
    });

    renderer.setPixelRatio(Math.min(deviceRatio, 1.25));
    renderer.setClearColor(0x000000, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    // transmission hedefi dengeli tutulur
    renderer.transmissionResolutionScale = 0.5;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.FogExp2(0x000000, 0.045);
    scene.environment = createStudioEnvironment(renderer);

    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
    camera.position.set(0, 0.05, 7.3);

    /* ---------- glass prism ---------- */

    const prismRig = new THREE.Group();
    scene.add(prismRig);

    const shape = new THREE.Shape();
    shape.moveTo(0, 1.92);
    shape.lineTo(-0.99, -1.16);
    shape.lineTo(0.99, -1.16);
    shape.closePath();

    const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: 0.76,
        bevelEnabled: true,
        bevelThickness: 0.075,
        bevelSize: 0.075,
        bevelSegments: 4,
        curveSegments: 1
    });
    geometry.center();

    /* ---------- 2d ışık katmanı için prizma geometrisi ---------- */
    // ön yüzün üç köşesini sahne uzayında tutuyoruz; ışık katmanı bunları
    // ekrana yansıtıp giriş/çıkış noktalarını buradan hesaplıyor

    geometry.computeBoundingBox();

    const bounds = geometry.boundingBox;
    const offsetX = (bounds.min.x + bounds.max.x) * 0.5;
    const offsetY = (bounds.min.y + bounds.max.y) * 0.5;
    const frontZ = bounds.max.z;

    const frontCorners = [
        new THREE.Vector3(0 - offsetX, 1.92 - offsetY, frontZ),
        new THREE.Vector3(-0.99 - offsetX, -1.16 - offsetY, frontZ),
        new THREE.Vector3(0.99 - offsetX, -1.16 - offsetY, frontZ)
    ];

    const projected = [
        new THREE.Vector3(),
        new THREE.Vector3(),
        new THREE.Vector3()
    ];

    function publishFrame(time) {
        scene.updateMatrixWorld(true);

        // kamera matrisleri ilk karede henuz guncel olmayabiliyor
        camera.updateMatrixWorld();
        camera.matrixWorldInverse.copy(camera.matrixWorld).invert();

        const frameWidth = canvas.clientWidth;
        const frameHeight = canvas.clientHeight;

        for (let i = 0; i < 3; i++) {
            projected[i]
                .copy(frontCorners[i])
                .applyMatrix4(prism.matrixWorld)
                .project(camera);
        }

        window.__prismGeometry = {
            time,
            width: frameWidth,
            height: frameHeight,
            corners: [
                {
                    x: (projected[0].x * 0.5 + 0.5) * frameWidth,
                    y: (-projected[0].y * 0.5 + 0.5) * frameHeight
                },
                {
                    x: (projected[1].x * 0.5 + 0.5) * frameWidth,
                    y: (-projected[1].y * 0.5 + 0.5) * frameHeight
                },
                {
                    x: (projected[2].x * 0.5 + 0.5) * frameWidth,
                    y: (-projected[2].y * 0.5 + 0.5) * frameHeight
                }
            ]
        };
    }

    const glass = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        metalness: 0,
        roughness: 0.04,
        transmission: 1,
        thickness: 1.55,
        ior: 1.52,
        // dispersion acikken transmission shader'i 3 ornekli donguye giriyor
        // (her piksel icin 3x maliyet). Gökkuşağı artık 2d isik katmaninda.
        dispersion: 0,
        iridescence: 1,
        iridescenceIOR: 1.35,
        iridescenceThicknessRange: [100, 680],
        clearcoat: 1,
        clearcoatRoughness: 0.035,
        envMapIntensity: 2.1,
        transparent: true,
        opacity: 1,
        side: THREE.DoubleSide,
        depthWrite: false
    });

    const prism = new THREE.Mesh(geometry, glass);
    prism.rotation.set(-0.1, 0.28, -0.04);
    prismRig.add(prism);

    const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry, 40),
        new THREE.LineBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.22,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        })
    );
    edges.renderOrder = 3;
    prism.add(edges);

    const rim = new THREE.Mesh(
        geometry,
        new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            vertexShader: /* glsl */ `
                varying vec3 vNormal;
                varying vec3 vView;
                varying vec3 vLocal;

                void main() {
                    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
                    vNormal = normalize(normalMatrix * normal);
                    vView = normalize(-viewPosition.xyz);
                    vLocal = position;
                    gl_Position = projectionMatrix * viewPosition;
                }
            `,
            fragmentShader: /* glsl */ `
                varying vec3 vNormal;
                varying vec3 vView;
                varying vec3 vLocal;

                void main() {
                    float fresnel = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.6);

                    vec3 tint = 0.62 + 0.38 * cos(6.28318 * (vec3(0.0, 0.33, 0.66) + vLocal.y * 0.35 + vLocal.x * 0.2));
                    vec3 color = mix(vec3(1.0), tint, 0.42);

                    gl_FragColor = vec4(color, fresnel * 0.42);
                }
            `
        })
    );
    rim.scale.setScalar(1.004);
    rim.renderOrder = 2;
    prism.add(rim);

    /* ---------- eski sabit isin plane'i kaldirildi ---------- */
    /* 2d isik katmani (beam.js) bu isin govdesini kendisi cizer;
       eski sabit rainbow plane'i ile ayni seyi cift ciziyordu. */

    /* ---------- ambient details ---------- */

    const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(8.5, 8.5),
        new THREE.MeshBasicMaterial({
            map: createGlowTexture(),
            transparent: true,
            opacity: 0.035,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        })
    );
    glow.position.set(1.4, 0, -4.2);
    scene.add(glow);

    const particleCount = 24;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 9;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 5;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 4;
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const particles = new THREE.Points(
        particleGeometry,
        new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.017,
            transparent: true,
            opacity: 0.3,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true
        })
    );
    scene.add(particles);

    /* ---------- lights ---------- */

    scene.environmentIntensity = 1.2;
    scene.add(new THREE.AmbientLight(0xffffff, 0.35));

    const keyLight = new THREE.DirectionalLight(0xffffff, 3.6);
    keyLight.position.set(-3, 4.5, 5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x8fb4ff, 1.7);
    fillLight.position.set(4, -1.5, 3);
    scene.add(fillLight);

    const rimLight = new THREE.PointLight(0xff3b64, 24, 14, 2);
    rimLight.position.set(-2.6, -0.8, 2.2);
    scene.add(rimLight);

    const coolLight = new THREE.PointLight(0x4f7dff, 18, 14, 2);
    coolLight.position.set(3.2, 1.4, 1.8);
    scene.add(coolLight);

    /* ---------- response ---------- */

    const state = {
        pointerX: 0,
        pointerY: 0,
        targetX: 0,
        targetY: 0,
        scroll: 0,
        scrollProgress: 0,
        pointerMoved: false,
        wheel: 0,
        baseX: 0,
        baseY: 0,
        scale: 1
    };

    /* ---------- kaydırma ---------- */

    function applyScroll() {
        // kaydırma ilerlemesi beam.js tarafindan tutulur (her iki modda da calisir)
        const progress = window.__scrollProgress || 0;

        state.scroll = window.scrollY || 0;
        state.scrollProgress = progress;
    }

    function layout() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const compact = width < 900;

        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();

        const visibleHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * camera.position.z;
        const halfWidth = visibleHeight * camera.aspect * 0.5;
        const xFraction = compact ? 0.88 : 0.66;

        state.baseX = (xFraction * 2 - 1) * halfWidth;
        state.baseY = compact ? -0.2 : 0.02;
        state.scale = compact
            ? Math.min(0.5, height / 1550)
            : Math.min(1, Math.max(0.88, width / 1600));

        prismRig.position.set(state.baseX, state.baseY, 0);
        prismRig.scale.setScalar(state.scale);
        glow.position.set(state.baseX, state.baseY, -4.2);
    }

    function updateScene(time) {
        const progress = state.scrollProgress;
        const scrollTurn = progress * 0.45;

        const pointerX = still ? 0 : state.pointerX;
        const pointerY = still ? 0 : state.pointerY;

        if (!still) {
            state.wheel *= 0.94;
        }

        prism.rotation.y = 0.28 + Math.sin(time * 0.24) * 0.18 + pointerX * 0.26 + scrollTurn + state.wheel;
        prism.rotation.x = -0.1 + Math.sin(time * 0.19) * 0.06 + pointerY * 0.11;
        prism.rotation.z = -0.04 + Math.sin(time * 0.14) * 0.035;

        prismRig.position.x = state.baseX + pointerX * 0.1;
        prismRig.position.y = state.baseY
            + Math.sin(time * 0.55) * 0.045
            + progress * 2.1
            - state.wheel * 0.08;

        // kaydırma ile birlikte prizma hafifçe uzaklaşır
        prismRig.scale.setScalar(state.scale * (1 - progress * 0.12));

        particles.rotation.z = Math.sin(time * 0.05) * 0.025;
        publishFrame(time);
    }

    function render() {
        renderer.render(scene, camera);
    }

    layout();
    applyScroll();

    // cihaz yetenegine gore baslangic kalitesi
    if (typeof tier === "number" && tier < 2) {
        applyQuality(tier);
    }

    if (still) {
        updateScene(0);
        render();
        window.addEventListener("resize", () => {
            layout();
            applyScroll();
            updateScene(0);
            render();
        }, { passive: true });
        window.addEventListener("scroll", () => {
            applyScroll();
            updateScene(0);
            render();
        }, { passive: true });
        return;
    }

    window.addEventListener("resize", () => {
        layout();
        applyScroll();
    }, { passive: true });

    window.addEventListener("scroll", () => {
        applyScroll();
    }, { passive: true });

    window.addEventListener("wheel", (event) => {        state.wheel = THREE.MathUtils.clamp(state.wheel + event.deltaY * 0.0011, -0.65, 0.65);
    }, { passive: true });

    window.addEventListener("pointermove", (event) => {
        state.targetX = (event.clientX / window.innerWidth) * 2 - 1;
        state.targetY = (event.clientY / window.innerHeight) * 2 - 1;
        state.pointerMoved = true;
    }, { passive: true });

    let frameId = 0;
    let running = true;
    const clock = new THREE.Clock();

    /* ---------- uyarlanabilir kalite ---------- */

    // Her seviyede transmission: 1 ve opacity: 1 korunur (cam asla buğulanmaz)
    // Kalite tasarrufu çözünürlük ölçeği ve iridescence ile sağlanır
    const qualityPresets = {
        2: { pixelRatio: () => Math.min(deviceRatio, 1.25), transmission: 1, scale: 0.5, iridescence: 1, opacity: 1 },
        1: { pixelRatio: () => Math.min(deviceRatio, 1), transmission: 1, scale: 0.35, iridescence: 0.5, opacity: 1 },
        0: { pixelRatio: () => 0.75, transmission: 1, scale: 0.25, iridescence: 0.2, opacity: 1 }
    };

    const quality = {
        level: 2,
        samples: 0,
        slow: 0,
        warmup: 0
    };

    function applyQuality(level) {
        level = Math.max(0, Math.min(2, level));
        if (level === quality.level) return;
        quality.level = level;

        const preset = qualityPresets[level];
        renderer.setPixelRatio(preset.pixelRatio());
        renderer.transmissionResolutionScale = preset.scale;
        glass.transmission = 1;
        glass.opacity = 1;
        glass.iridescence = preset.iridescence;
        glass.needsUpdate = true;

        window.__prismQuality = level;
        layout();
    }

    function monitorPerformance(delta) {
        // Ilk 25 kareyi (shader derleme ve baslangic yuklemesi) olcume dahil etme
        if (quality.warmup < 25) {
            quality.warmup++;
            return;
        }

        quality.samples++;
        if (delta > 32) quality.slow++; // 32ms = 30fps altina dusus

        if (quality.samples < 25) return;

        const slowRatio = quality.slow / quality.samples;
        quality.samples = 0;
        quality.slow = 0;

        window.__prismQuality = quality.level;

        // Karelerin yarisindan fazlasi 30fps altina duserse kaliteyi kademeli dusur
        if (slowRatio > 0.5 && quality.level > 0) {
            applyQuality(quality.level - 1);
        } else if (slowRatio > 0.65 && quality.level === 0) {
            // En dusuk seviye de yetmiyorsa akici 2d moda gec
            switchTo2D();
        }
    }

    function switchTo2D() {
        if (window.__sceneMode === "2d") return;

        window.__sceneMode = "2d";
        enableLiteMode();
        running = false;
        cancelAnimationFrame(frameId);
        canvas.style.display = "none";
    }

    // kare siniri ekranin yenileme hizina gore (60/120/144/180Hz)
    function frameLimit() {
        return 1000 / (window.__refreshRate || 60);
    }

    let lastFrame = 0;

    function frame(now) {
        if (!running) return;
        frameId = requestAnimationFrame(frame);

        // sahne tamamen kaybolduysa (alt bos bolum) render etme
        if (state.scrollProgress > 0.995 && !state.pointerMoved) {
            lastFrame = now;
            return;
        }

        if (now - lastFrame < frameLimit()) return;
        const delta = lastFrame ? Math.min(100, now - lastFrame) : 16;
        lastFrame = now;

        // yumuşatma kare hızından bağımsız: her fps'te ayni his
        const ease = 1 - Math.exp(-delta * 0.009);

        state.pointerX += (state.targetX - state.pointerX) * ease;
        state.pointerY += (state.targetY - state.pointerY) * ease;

        updateScene(clock.getElapsedTime());
        render();

        monitorPerformance(delta);
    }

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            running = false;
            cancelAnimationFrame(frameId);
        } else {
            running = true;
            clock.getDelta();
            lastFrame = 0;
            requestAnimationFrame(frame);
        }
    });

    requestAnimationFrame(frame);
}

/* ---------- generated textures ---------- */

function createStudioEnvironment(renderer) {
    const textureCanvas = document.createElement("canvas");
    textureCanvas.width = 1024;
    textureCanvas.height = 512;

    const context = textureCanvas.getContext("2d");
    context.fillStyle = "#000";
    context.fillRect(0, 0, textureCanvas.width, textureCanvas.height);

    context.globalCompositeOperation = "lighter";
    context.filter = "blur(28px)";

    const lights = [
        { x: 155, y: 20, width: 90, height: 472, color: "rgba(60, 100, 255, 0.5)" },
        { x: 470, y: 10, width: 74, height: 492, color: "rgba(255, 255, 255, 0.92)" },
        { x: 650, y: 120, width: 44, height: 272, color: "rgba(0, 255, 190, 0.24)" },
        { x: 806, y: 40, width: 104, height: 432, color: "rgba(255, 38, 90, 0.42)" }
    ];

    for (const light of lights) {
        context.fillStyle = light.color;
        context.fillRect(light.x, light.y, light.width, light.height);
    }

    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.colorSpace = THREE.SRGBColorSpace;

    const pmrem = new THREE.PMREMGenerator(renderer);
    const target = pmrem.fromEquirectangular(texture);

    texture.dispose();
    pmrem.dispose();

    return target.texture;
}

function createGlowTexture() {
    const textureCanvas = document.createElement("canvas");
    textureCanvas.width = 256;
    textureCanvas.height = 256;

    const context = textureCanvas.getContext("2d");
    const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0, "rgba(255, 255, 255, 0.7)");
    gradient.addColorStop(0.35, "rgba(170, 210, 255, 0.22)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 256);

    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}
