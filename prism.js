/* ==========================================================
   yvl — animated glass prism
   inspired by the vgpu.sh hero scene
   ========================================================== */

import * as THREE from "./three.module.min.js";

const canvas = document.getElementById("prism-canvas");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (canvas) {
    try {
        initPrism(canvas, reduceMotion);
    } catch (error) {
        console.warn("Prism background disabled:", error);
        canvas.style.display = "none";
    }
}

function initPrism(canvas, still) {
    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: "high-performance"
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.setClearColor(0x000000, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.transmissionResolutionScale = 0.8;

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

    const glass = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        metalness: 0,
        roughness: 0.04,
        transmission: 1,
        thickness: 1.55,
        ior: 1.52,
        dispersion: 5.5,
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

    /* ---------- rainbow beam ---------- */

    const beamMaterial = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: {
            uTime: { value: 0 }
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

            vec3 hsv2rgb(vec3 c) {
                vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
                vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
                return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
            }

            void main() {
                vec2 uv = vUv;

                vec3 color = hsv2rgb(vec3(mix(0.0, 0.82, uv.y), 0.88, 1.0));

                float band = smoothstep(0.0, 0.26, uv.y) * smoothstep(1.0, 0.74, uv.y);
                float ends = smoothstep(0.0, 0.1, uv.x) * smoothstep(1.0, 0.9, uv.x);
                float core = exp(-pow((uv.y - 0.5) * 4.8, 2.0));
                float shimmer = 0.9 + 0.1 * sin(uv.x * 9.0 - uTime * 0.7 + uv.y * 6.0);

                float alpha = band * ends * (0.12 + core * 0.25) * shimmer;
                color = mix(color, vec3(1.0), core * 0.2);

                gl_FragColor = vec4(color, alpha);
            }
        `
    });

    const beam = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 1.55), beamMaterial);
    beam.position.set(3.25, 0.15, -3.2);
    beam.rotation.z = -0.23;
    scene.add(beam);

    const streakMaterial = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: /* glsl */ `
            varying vec2 vUv;
            void main() {
                float line = pow(1.0 - smoothstep(0.0, 1.0, abs(vUv.y - 0.5) * 2.0), 3.0);
                float ends = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
                gl_FragColor = vec4(vec3(1.0), line * ends * 0.2);
            }
        `
    });

    const streak = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 0.11), streakMaterial);
    streak.position.set(3.35, 0.44, -3.05);
    streak.rotation.z = -0.23;
    scene.add(streak);

    /* ---------- ambient details ---------- */

    const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(8.5, 8.5),
        new THREE.MeshBasicMaterial({
            map: createGlowTexture(),
            transparent: true,
            opacity: 0.14,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        })
    );
    glow.position.set(1.4, 0, -4.2);
    scene.add(glow);

    const particleCount = 42;
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
        wheel: 0,
        baseX: 0,
        baseY: 0,
        scale: 1
    };

    function layout() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const compact = width < 900;

        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();

        const visibleHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * camera.position.z;
        const halfWidth = visibleHeight * camera.aspect * 0.5;
        const xFraction = compact ? 0.88 : 0.74;

        state.baseX = (xFraction * 2 - 1) * halfWidth;
        state.baseY = compact ? -0.2 : 0.02;
        state.scale = compact
            ? Math.min(0.5, height / 1550)
            : Math.min(1, Math.max(0.88, width / 1600));

        prismRig.position.set(state.baseX, state.baseY, 0);
        prismRig.scale.setScalar(state.scale);
        glow.position.set(state.baseX, state.baseY, -4.2);

        beam.position.y = compact ? -0.28 : 0.12;
        streak.position.y = compact ? 0.02 : 0.44;
    }

    function updateScene(time) {
        const scroll = window.scrollY || 0;
        const scrollTurn = Math.min(scroll * 0.0012, 0.5);

        const pointerX = still ? 0 : state.pointerX;
        const pointerY = still ? 0 : state.pointerY;

        if (!still) {
            state.wheel *= 0.94;
        }

        prism.rotation.y = 0.28 + Math.sin(time * 0.24) * 0.18 + pointerX * 0.26 + scrollTurn + state.wheel;
        prism.rotation.x = -0.1 + Math.sin(time * 0.19) * 0.06 + pointerY * 0.11;
        prism.rotation.z = -0.04 + Math.sin(time * 0.14) * 0.035;

        prismRig.position.x = state.baseX + pointerX * 0.1;
        prismRig.position.y = state.baseY + Math.sin(time * 0.55) * 0.045 - Math.min(scroll * 0.0006, 0.2) - state.wheel * 0.08;

        beamMaterial.uniforms.uTime.value = time;
        beam.rotation.z = -0.25 + Math.sin(time * 0.11) * 0.02;
        streak.rotation.z = -0.25 + Math.sin(time * 0.11 + 0.3) * 0.015;
        particles.rotation.z = Math.sin(time * 0.05) * 0.025;
    }

    function render() {
        renderer.render(scene, camera);
    }

    layout();

    if (still) {
        updateScene(0);
        render();
        window.addEventListener("resize", () => {
            layout();
            updateScene(0);
            render();
        }, { passive: true });
        return;
    }

    window.addEventListener("resize", () => {
        layout();
    }, { passive: true });

    window.addEventListener("scroll", () => {
        state.scroll = window.scrollY || 0;
    }, { passive: true });

    window.addEventListener("wheel", (event) => {
        state.wheel = THREE.MathUtils.clamp(state.wheel + event.deltaY * 0.0011, -0.65, 0.65);
    }, { passive: true });

    window.addEventListener("pointermove", (event) => {
        state.targetX = (event.clientX / window.innerWidth) * 2 - 1;
        state.targetY = (event.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });

    let frameId = 0;
    let running = true;
    const clock = new THREE.Clock();

    function frame() {
        if (!running) return;
        frameId = requestAnimationFrame(frame);

        state.pointerX += (state.targetX - state.pointerX) * 0.045;
        state.pointerY += (state.targetY - state.pointerY) * 0.045;

        updateScene(clock.getElapsedTime());
        render();
    }

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            running = false;
            cancelAnimationFrame(frameId);
        } else {
            running = true;
            clock.getDelta();
            frame();
        }
    });

    frame();
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
