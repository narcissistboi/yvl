/* ==========================================================
   YOUNG VAMP LIFE — vgpu.sh 1:1 Obsidian Glass 3D Prism Engine
   Rounded Tetrahedron · Analytic Studio Reflections · Volumetric Laser
   Alan Zucconi Spectral Rainbow · 3D Lens Flare · Space Dust Motes
   Fluid 60 FPS with or without Hardware Acceleration
   ========================================================== */

import * as THREE from "./three.module.min.js";

(function () {
    "use strict";

    const canvas = document.getElementById("prism-canvas");
    if (!canvas) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* ==========================================================
       1. ÜÇ BOYUTLU YUVARLATILMIŞ TETRAHEDRON GEOMETRİSİ (vgpu.sh)
       4 düz yüzey, 6 silindirik pah (fillet) ve 4 küresel köşe kapağı
       ========================================================== */

    function createRoundedTetrahedron(edge, radius, segments = 10) {
        const height = edge * Math.sqrt(2 / 3);
        const inradius = height / 4;
        const baseRadius = edge / Math.sqrt(3);

        const corners = [
            [0, 0, height - inradius],
            ...[90, 210, 330].map((deg) => {
                const a = (deg * Math.PI) / 180;
                return [Math.cos(a) * baseRadius, Math.sin(a) * baseRadius, -inradius];
            })
        ];

        const vecNorm = (v) => {
            const l = Math.hypot(v[0], v[1], v[2]);
            return l > 0 ? [v[0] / l, v[1] / l, v[2] / l] : [0, 0, 0];
        };
        const vecScale = (v, s) => [v[0] * s, v[1] * s, v[2] * s];
        const vecAdd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
        const vecSub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
        const vecDot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
        const vecCross = (a, b) => [
            a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0]
        ];

        const faces = corners.map((c) => vecScale(vecNorm(c), -1));
        const centres = corners.map((c) => vecScale(c, (inradius - radius) / inradius));

        const vertices = [];
        const normals = [];
        const indices = [];

        function addVertex(centre, normal) {
            vertices.push(...vecAdd(centre, vecScale(normal, radius)));
            normals.push(...normal);
            return vertices.length / 3 - 1;
        }

        function addTriangle(a, b, d) {
            const vA = [vertices[a * 3], vertices[a * 3 + 1], vertices[a * 3 + 2]];
            const vB = [vertices[b * 3], vertices[b * 3 + 1], vertices[b * 3 + 2]];
            const vD = [vertices[d * 3], vertices[d * 3 + 1], vertices[d * 3 + 2]];
            const facing = vecCross(vecSub(vB, vA), vecSub(vD, vA));
            const outward = [
                normals[a * 3] + normals[b * 3] + normals[d * 3],
                normals[a * 3 + 1] + normals[b * 3 + 1] + normals[d * 3 + 1],
                normals[a * 3 + 2] + normals[b * 3 + 2] + normals[d * 3 + 2]
            ];
            if (vecDot(facing, outward) >= 0) {
                indices.push(a, b, d);
            } else {
                indices.push(a, d, b);
            }
        }

        function blend(directions, weights) {
            let s = [0, 0, 0];
            for (let i = 0; i < directions.length; i++) {
                s = vecAdd(s, vecScale(directions[i], weights[i]));
            }
            return vecNorm(s);
        }

        function others(...skip) {
            return [0, 1, 2, 3].filter((i) => !skip.includes(i));
        }

        // Düz Yüzeyler (Flat Faces)
        faces.forEach((normal, face) => {
            const [a, b, d] = others(face).map((i) => addVertex(centres[i], normal));
            addTriangle(a, b, d);
        });

        // Silindirik Pahlar (Bevel Rails)
        const pairs = [];
        for (let a = 0; a < 4; a++) {
            for (let b = a + 1; b < 4; b++) pairs.push([a, b]);
        }

        pairs.forEach(([k, l]) => {
            const [i, j] = others(k, l);
            const rails = [];
            for (let t = 0; t <= segments; t++) {
                const normal = blend([faces[k], faces[l]], [segments - t, t]);
                rails.push([addVertex(centres[i], normal), addVertex(centres[j], normal)]);
            }
            for (let t = 0; t < segments; t++) {
                const [pA, pB] = rails[t];
                const [nA, nB] = rails[t + 1];
                addTriangle(pA, pB, nB);
                addTriangle(pA, nB, nA);
            }
        });

        // Küresel Köşe Kapakları (Spherical Corner Caps)
        centres.forEach((centre, corner) => {
            const around = others(corner).map((face) => faces[face]);
            const grid = [];
            for (let u = 0; u <= segments; u++) {
                const row = [];
                for (let v = 0; v <= segments - u; v++) {
                    const w = segments - u - v;
                    row.push(addVertex(centre, blend(around, [w, u, v])));
                }
                grid.push(row);
            }
            for (let u = 0; u < segments; u++) {
                for (let v = 0; v < segments - u; v++) {
                    addTriangle(grid[u][v], grid[u + 1][v], grid[u][v + 1]);
                    if (u + v + 1 < segments) {
                        addTriangle(grid[u + 1][v], grid[u + 1][v + 1], grid[u][v + 1]);
                    }
                }
            }
        });

        const geom = new THREE.BufferGeometry();
        geom.setAttribute("position", new THREE.BufferAttribute(new Float32Array(vertices), 3));
        geom.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(normals), 3));
        geom.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));
        return geom;
    }

    /* ==========================================================
       2. THREE.JS SAHNE, KAMERA VE RENDERER KURULUMU
       vgpu.sh gibi Orthographic kamera ile tam optik simetri
       ========================================================== */

    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: "high-performance"
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 1);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    let width = window.innerWidth;
    let height = window.innerHeight;

    const ZOOM_BASE = 80;
    let aspect = width / height;
    const camera = new THREE.OrthographicCamera(
        -aspect * (width / (2 * ZOOM_BASE)),
        aspect * (width / (2 * ZOOM_BASE)),
        height / (2 * ZOOM_BASE),
        -height / (2 * ZOOM_BASE),
        0.1,
        1000
    );
    camera.position.set(0, 0, 50);
    camera.lookAt(0, 0, 0);

    /* ==========================================================
       3. OBSİDİYAN CAM SHADER'I (vgpu.sh Analitik Stüdyo Yansıması)
       Krom yüzey vurguları, Schlick Fresnel, tek geçişli tam 60 FPS
       ========================================================== */

    const glassMaterial = new THREE.ShaderMaterial({
        transparent: false,
        uniforms: {
            uLightPos: { value: new THREE.Vector3(4.5, -2.2, 2.0) },
            uLightIntensity: { value: 2.2 },
            uTime: { value: 0 }
        },
        vertexShader: /* glsl */ `
            varying vec3 vNormal;
            varying vec3 vWorldPos;
            varying vec3 vViewPos;

            void main() {
                vNormal = normalize(normalMatrix * normal);
                vec4 worldPos = modelMatrix * vec4(position, 1.0);
                vWorldPos = worldPos.xyz;
                vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
                vViewPos = -mvPos.xyz;
                gl_Position = projectionMatrix * mvPos;
            }
        `,
        fragmentShader: /* glsl */ `
            varying vec3 vNormal;
            varying vec3 vWorldPos;
            varying vec3 vViewPos;

            uniform vec3 uLightPos;
            uniform float uLightIntensity;
            uniform float uTime;

            float panelLight(vec3 dir, vec3 pCenter, vec2 pSize, float pBrightness) {
                vec3 normal = -normalize(pCenter);
                float facing = dot(dir, normal);
                if (facing <= 0.0001) return 0.0;
                float t = dot(pCenter, normal) / facing;
                vec3 hit = dir * t - pCenter;
                vec3 ref = abs(normal.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
                vec3 u = normalize(cross(ref, normal));
                vec3 v = cross(normal, u);
                vec2 local = abs(vec2(dot(hit, u), dot(hit, v)));
                vec2 inside = smoothstep(pSize * 0.5 + 0.25, pSize * 0.5 - 0.25, local);
                return inside.x * inside.y * pBrightness;
            }

            vec3 domeLight(vec3 dir) {
                float y = dir.y;
                vec3 top = vec3(0.32, 0.35, 0.42);
                vec3 horizon = vec3(0.06, 0.06, 0.08);
                float a = abs(y);
                return y > 0.0 ? mix(horizon, top, pow(a, 0.7)) : mix(horizon, vec3(0.0), pow(a, 0.5));
            }

            vec3 darkStudio(vec3 dir) {
                float panels = panelLight(dir, vec3(-3.5, 4.0, 5.0), vec2(6.0, 4.0), 1.9)
                             + panelLight(dir, vec3(5.0, 0.0, -3.0), vec2(1.2, 7.0), 2.8)
                             + panelLight(dir, vec3(0.0, 6.0, 0.0), vec2(8.0, 1.2), 1.6);
                return domeLight(dir) + vec3(panels);
            }

            void main() {
                vec3 normal = normalize(vNormal);
                vec3 viewDir = normalize(cameraPosition - vWorldPos);
                float facing = clamp(dot(normal, viewDir), 0.0, 1.0);
                vec3 incident = -viewDir;

                // Schlick Fresnel (IOR = 1.62)
                float f0 = 0.056; // pow((1.62-1)/(1.62+1), 2)
                float fresnel = f0 + (1.0 - f0) * pow(1.0 - facing, 4.8);
                float clearcoat = 0.04 + 0.96 * pow(1.0 - facing, 5.0);

                // Analitik stüdyo yansıması (vgpu.sh softbox panels)
                vec3 reflected = reflect(incident, normal);
                vec3 env = darkStudio(reflected) * 2.0;

                // Derin parlak obsidiyan cam çekirdeği
                vec3 obsidian = vec3(0.015, 0.02, 0.03);

                // Yüzeye çarpan lazerin aynasal (specular) parlama noktası
                vec3 toLight = normalize(uLightPos - vWorldPos);
                vec3 halfway = normalize(toLight + viewDir);
                float spec = pow(max(dot(normal, halfway), 0.0), 48.0) * uLightIntensity;

                // Pahlı kenar (chamfer) parlaklık konturu
                float rim = pow(1.0 - facing, 3.2);
                vec3 rimColor = mix(vec3(0.9, 0.95, 1.0), vec3(0.4, 0.75, 1.0), 0.25) * rim * 0.95;

                vec3 color = mix(obsidian, env, fresnel) + env * clearcoat * 0.45 + vec3(spec * 0.9) + rimColor;
                gl_FragColor = vec4(color, 1.0);
            }
        `
    });

    const prismGeometry = createRoundedTetrahedron(Math.sqrt(3), 0.038, 10);
    const prismMesh = new THREE.Mesh(prismGeometry, glassMaterial);
    prismMesh.scale.setScalar(1.95);

    // vgpu.sh başlangıç duruşu: Düz üçgen yüzü dik bakar
    prismMesh.rotation.set(0, 0, 0);

    const prismGroup = new THREE.Group();
    prismGroup.add(prismMesh);
    scene.add(prismGroup);

    /* ==========================================================
       4. GELEN HACİMSEL LAZER IŞINI (Sağ Alttan Giriş)
       ========================================================== */

    const beamGeometry = new THREE.PlaneGeometry(1, 1);
    const beamMaterial = new THREE.ShaderMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        uniforms: {
            uTime: { value: 0 },
            uIntensity: { value: 2.2 }
        },
        vertexShader: /* glsl */ `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: /* glsl */ `
            varying vec2 vUv;
            uniform float uTime;
            uniform float uIntensity;

            void main() {
                float d = abs(vUv.x - 0.5) * 2.0;
                float core = exp(-d * d * 22.0);
                float halo = exp(-d * d * 3.8) * 0.45;
                float atmos = exp(-d * 1.8) * 0.14;

                float pulse = 0.92 + 0.08 * sin(uTime * 2.8);
                float along = smoothstep(0.0, 0.15, vUv.y);

                vec3 col = vec3(1.0) * core + vec3(0.7, 0.88, 1.0) * halo + vec3(0.5, 0.75, 1.0) * atmos;
                float alpha = (core + halo * 0.8 + atmos * 0.5) * along * uIntensity * pulse;
                gl_FragColor = vec4(col * alpha, alpha);
            }
        `
    });

    const beamMesh = new THREE.Mesh(beamGeometry, beamMaterial);
    scene.add(beamMesh);

    /* ==========================================================
       5. KRİSTAL ODAK LENS PARLAMASI (Glint / Star Flare)
       ========================================================== */

    const flareGeometry = new THREE.PlaneGeometry(1, 1);
    const flareMaterial = new THREE.ShaderMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        uniforms: {
            uTime: { value: 0 },
            uIntensity: { value: 2.5 }
        },
        vertexShader: /* glsl */ `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: /* glsl */ `
            varying vec2 vUv;
            uniform float uTime;
            uniform float uIntensity;

            void main() {
                vec2 p = vUv * 2.0 - 1.0;
                float r = length(p);
                float core = exp(-r * r * 35.0);
                float glow = exp(-r * 3.4) * 0.5;

                // Anamorfik yatay/dikey difraksiyon çizgisi
                float spikeH = exp(-abs(p.y) * 45.0) * exp(-abs(p.x) * 1.2) * 0.65;
                float spikeV = exp(-abs(p.x) * 45.0) * exp(-abs(p.y) * 1.8) * 0.35;

                float pulse = 0.85 + 0.15 * sin(uTime * 4.2);
                vec3 col = vec3(1.0) * core + vec3(0.75, 0.9, 1.0) * glow + vec3(0.9, 0.95, 1.0) * (spikeH + spikeV);
                float alpha = (core + glow + spikeH + spikeV) * uIntensity * pulse;
                gl_FragColor = vec4(col * alpha, alpha);
            }
        `
    });

    const flareMesh = new THREE.Mesh(flareGeometry, flareMaterial);
    scene.add(flareMesh);

    /* ==========================================================
       6. ALAN ZUCCONI SPEKTRAL GÖKKUŞAĞI ŞERİDİ (vgpu.sh Signature)
       Kırılma açısıyla sol alt köşeye kesintisiz yayılan ışık şeridi
       ========================================================== */

    const rainbowGeometry = new THREE.PlaneGeometry(1, 1);
    const rainbowMaterial = new THREE.ShaderMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        uniforms: {
            uTime: { value: 0 },
            uIntensity: { value: 2.8 }
        },
        vertexShader: /* glsl */ `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: /* glsl */ `
            varying vec2 vUv;
            uniform float uTime;
            uniform float uIntensity;

            vec3 bump3y(vec3 x, vec3 yoffset) {
                vec3 y = vec3(1.0) - x * x;
                return clamp(y - yoffset, 0.0, 1.0);
            }

            // Alan Zucconi / CIEXYZ analitik spektral dalgaboyu formülü (400 - 700nm)
            vec3 spectral_zucconi6(float w) {
                float x = clamp((w - 400.0) / 300.0, 0.0, 1.0);
                const vec3 c1 = vec3(3.54585104, 2.93225262, 2.41593945);
                const vec3 x1 = vec3(0.69549072, 0.49228336, 0.27699880);
                const vec3 y1 = vec3(0.02312639, 0.15225084, 0.52607955);
                const vec3 c2 = vec3(3.90307140, 3.21182957, 3.96587128);
                const vec3 x2 = vec3(0.11748627, 0.86755042, 0.66077860);
                const vec3 y2 = vec3(0.84897130, 0.88445281, 0.73949448);
                return bump3y(c1 * (x - x1), y1) + bump3y(c2 * (x - x2), y2);
            }

            void main() {
                // vUv.x: Spektrum boyunca (0 = kırmızı, 1 = mor)
                // vUv.y: Çıkıştan uzaklık (0 = prizma çıkışı, 1 = ekran kenarı)
                float wavelength = mix(700.0, 400.0, vUv.x);
                vec3 specColor = spectral_zucconi6(wavelength);

                // Canlı spektral dalga ışıltısı
                float wave = 0.92 + 0.12 * sin(uTime * 2.6 - vUv.y * 7.5);

                // Hacimsel şerit kenar yumuşatması
                float edge = smoothstep(0.0, 0.12, vUv.x) * (1.0 - smoothstep(0.88, 1.0, vUv.x));

                // Uzaklık solması
                float lengthFade = (1.0 - smoothstep(0.72, 1.0, vUv.y));

                // Çıkış noktasındaki akkor beyaz kırılma parlaklığı
                float exitWhite = exp(-vUv.y * 15.0) * 1.9;
                vec3 col = mix(specColor * 1.45, vec3(1.0), clamp(exitWhite, 0.0, 1.0));

                float alpha = edge * lengthFade * uIntensity * wave * (0.85 + exitWhite * 0.5);
                gl_FragColor = vec4(col * alpha, alpha);
            }
        `
    });

    const rainbowMesh = new THREE.Mesh(rainbowGeometry, rainbowMaterial);
    scene.add(rainbowMesh);

    /* ==========================================================
       7. UZAY TOZU PARÇACIKLARI (Dust Motes)
       ========================================================== */

    const particleCount = 55;
    const particlePositions = new Float32Array(particleCount * 3);
    const particleData = [];

    for (let i = 0; i < particleCount; i++) {
        particlePositions[i * 3] = (Math.random() - 0.5) * 18;
        particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 12;
        particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 6;
        particleData.push({
            speedX: (Math.random() - 0.5) * 0.003,
            speedY: -0.001 - Math.random() * 0.003,
            phase: Math.random() * Math.PI * 2
        });
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));

    const particleMaterial = new THREE.PointsMaterial({
        size: 0.12,
        color: 0xffffff,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    /* ==========================================================
       8. ETKİLEŞİM VE GİRDİ KONTROLLERİ (vgpu.sh Drag / Wheel / Aim)
       ========================================================== */

    const pointer = {
        x: 0.85,
        y: 0.78,
        targetX: 0.85,
        targetY: 0.78,
        dragging: false,
        dragStartX: 0,
        dragStartY: 0,
        rotVelocityX: 0,
        rotVelocityY: 0
    };

    function onPointerMove(e) {
        if (pointer.dragging) {
            const dx = e.clientX - pointer.dragStartX;
            const dy = e.clientY - pointer.dragStartY;
            pointer.dragStartX = e.clientX;
            pointer.dragStartY = e.clientY;
            pointer.rotVelocityY = dx * 0.006;
            pointer.rotVelocityX = dy * 0.006;
        } else {
            pointer.targetX = e.clientX / window.innerWidth;
            pointer.targetY = e.clientY / window.innerHeight;
        }
    }

    window.addEventListener("pointerdown", (e) => {
        pointer.dragging = true;
        pointer.dragStartX = e.clientX;
        pointer.dragStartY = e.clientY;
    });

    window.addEventListener("pointerup", () => {
        pointer.dragging = false;
    });

    window.addEventListener("pointermove", onPointerMove, { passive: true });

    window.addEventListener("wheel", (e) => {
        prismMesh.rotation.z += e.deltaY * 0.001;
    }, { passive: true });

    /* ==========================================================
       9. YENİDEN BOYUTLANDIRMA VE KAYDIRMA
       ========================================================== */

    function resize() {
        width = window.innerWidth;
        height = window.innerHeight;
        renderer.setSize(width, height, false);

        aspect = width / height;
        const compact = width < 768;

        const zoom = compact ? 65 : 85;
        const halfW = width / (2 * zoom);
        const halfH = height / (2 * zoom);

        camera.left = -halfW;
        camera.right = halfW;
        camera.top = halfH;
        camera.bottom = -halfH;
        camera.updateProjectionMatrix();

        // Prizma konumu: Ekran ortası (veya masaüstünde hafif sağ)
        prismGroup.position.set(compact ? 0 : 0.65, compact ? -0.2 : -0.1, 0);
    }

    resize();
    window.addEventListener("resize", resize, { passive: true });

    function applyScroll() {
        const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        const progress = Math.min(1, (window.scrollY || 0) / max);
        const fade = Math.max(0, Math.min(1, 1 - progress * 1.25));
        document.documentElement.style.setProperty("--scene-fade", fade.toFixed(3));
    }

    window.addEventListener("scroll", applyScroll, { passive: true });
    applyScroll();

    /* ==========================================================
       10. CANLI ANİMASYON DÖNGÜSÜ (60 FPS)
       ========================================================== */

    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);

        const delta = Math.min(0.1, clock.getDelta());
        const time = clock.getElapsedTime();

        // Shader uniform güncellemeleri
        glassMaterial.uniforms.uTime.value = time;
        beamMaterial.uniforms.uTime.value = time;
        flareMaterial.uniforms.uTime.value = time;
        rainbowMaterial.uniforms.uTime.value = time;

        // Pointer yumuşatma (inertia lerp)
        pointer.x += (pointer.targetX - pointer.x) * 0.05;
        pointer.y += (pointer.targetY - pointer.y) * 0.05;

        // Prizma dönüşü ve ataleti (Inertia + Organik Salınım)
        if (!reduceMotion) {
            prismMesh.rotation.y += pointer.rotVelocityY;
            prismMesh.rotation.x += pointer.rotVelocityX;
            pointer.rotVelocityX *= 0.93;
            pointer.rotVelocityY *= 0.93;

            if (!pointer.dragging) {
                // vgpu.sh idle drift: narin yüzen salınım
                prismMesh.rotation.y += Math.sin(time * 0.4) * 0.0012;
                prismMesh.rotation.x += Math.cos(time * 0.3) * 0.0008;
            }
        }

        /* ---------------- Işın Geometrisi Hesaplama ---------------- */

        // Prizmanın dünya konumu
        const pPos = prismGroup.position;

        // Giriş noktası: Prizmanın sağ yüzeyinde
        const hitX = pPos.x + 0.88;
        const hitY = pPos.y - 0.12;

        // Işık kaynağı: Sağ altta fareyi takip eder
        const srcX = pPos.x + 4.2 + (pointer.x - 0.5) * 1.8;
        const srcY = pPos.y - 3.2 + (pointer.y - 0.5) * 1.5;

        glassMaterial.uniforms.uLightPos.value.set(srcX, srcY, 2.0);

        // Lazer huzmesini konumlandır ve yönlendir
        const beamDx = hitX - srcX;
        const beamDy = hitY - srcY;
        const beamLen = Math.hypot(beamDx, beamDy);
        const beamAngle = Math.atan2(beamDy, beamDx);

        beamMesh.position.set((srcX + hitX) * 0.5, (srcY + hitY) * 0.5, 0.05);
        beamMesh.rotation.set(0, 0, beamAngle + Math.PI / 2);
        beamMesh.scale.set(0.65, beamLen, 1);

        // Odak parlamasını (flare) giriş noktasına yerleştir
        flareMesh.position.set(hitX, hitY, 0.1);
        flareMesh.scale.setScalar(1.6);

        // Çıkış noktası: Sol kenar
        const exitX = pPos.x - 0.88;
        const exitY = pPos.y + 0.08;

        // Gökkuşağı yayılımı: Sol alt köşeye doğru
        const rainbowTargetX = pPos.x - 7.5;
        const rainbowTargetY = pPos.y - 3.4;

        const rainDx = rainbowTargetX - exitX;
        const rainDy = rainbowTargetY - exitY;
        const rainLen = Math.hypot(rainDx, rainDy);
        const rainAngle = Math.atan2(rainDy, rainDx);

        rainbowMesh.position.set((exitX + rainbowTargetX) * 0.5, (exitY + rainbowTargetY) * 0.5, 0.05);
        rainbowMesh.rotation.set(0, 0, rainAngle - Math.PI / 2);
        rainbowMesh.scale.set(2.4, rainLen, 1);

        /* ---------------- Toz Parçacıkları Hareketi ---------------- */

        const positions = particleGeometry.attributes.position.array;
        for (let i = 0; i < particleCount; i++) {
            const p = particleData[i];
            positions[i * 3] += p.speedX;
            positions[i * 3 + 1] += p.speedY;

            if (positions[i * 3 + 1] < -6) positions[i * 3 + 1] = 6;
            if (positions[i * 3] < -9) positions[i * 3] = 9;
            if (positions[i * 3] > 9) positions[i * 3] = -9;
        }
        particleGeometry.attributes.position.needsUpdate = true;

        renderer.render(scene, camera);
    }

    requestAnimationFrame(animate);
})();
