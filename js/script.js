document.addEventListener("DOMContentLoaded", () => {
    // =========================================================
    // PIPELINE NETWORK BACKGROUND
    // A drifting node graph with data "pulses" that hop from node
    // to node, like jobs moving through an ML pipeline.
    // The canvas element and class name are unchanged.
    // =========================================================

    const canvas = document.querySelector(".digital-clouds");
    const ctx = canvas?.getContext("2d", { alpha: true });

    if (canvas && ctx) {
        const reducedMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        );
        const finePointer = window.matchMedia("(pointer: fine)");

        let width = 0;
        let height = 0;
        let dpr = 1;
        let frame = null;
        let lastFrame = 0;
        let elapsed = 0;
        let linkDistance = 150;
        let nodes = [];
        let pulses = [];
        let adjacency = [];
        let links = [];
        let pulseTimer = 0;
        const mouse = { x: 0, y: 0, active: false };

        // Same colour family as the previous background.
        const palette = [
            [25, 90, 255],   // blue
            [0, 195, 255],   // cyan
            [0, 235, 200],   // teal
            [125, 225, 255], // ice
        ];

        const settings = {
            density: 0.00014,   // nodes per pixel of screen area
            minNodes: 70,
            maxNodes: 190,
            maxPulses: 36,
            pulseInterval: 0.6, // seconds between new pulses
            mouseRadius: 190,
            linkOpacity: 0.3,
        };

        const clamp = (value, min, max) =>
            Math.max(min, Math.min(max, value));

        const rgba = (color, alpha) =>
            `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${Math.max(0, alpha)})`;

        function createNodes() {
            const total = clamp(
                Math.round(width * height * settings.density),
                settings.minNodes,
                settings.maxNodes
            );

            nodes = [];
            pulses = [];

            for (let i = 0; i < total; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 2 + Math.random() * 5; // px per second
                const depth = Math.random();

                nodes.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    depth,
                    radius: 0.75 + depth * 1.0,
                    color: palette[Math.floor(Math.random() * palette.length)],
                    phase: Math.random() * Math.PI * 2,
                    // A few "hub" nodes read as services in the pipeline.
                    hub: Math.random() < 0.12,
                });
            }
        }

        function resizeCanvas() {
            width = window.innerWidth;
            height = window.innerHeight;
            dpr = Math.min(window.devicePixelRatio || 1, 1.5);
            linkDistance = clamp(width * 0.12, 105, 170);

            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            createNodes();
            buildLinks();
            renderStatic();
        }

        function moveNodes(dt) {
            const margin = 40;

            nodes.forEach((node) => {
                node.x += node.vx * dt;
                node.y += node.vy * dt;

                // Wrap around the edges so density stays even.
                if (node.x < -margin) node.x = width + margin;
                if (node.x > width + margin) node.x = -margin;
                if (node.y < -margin) node.y = height + margin;
                if (node.y > height + margin) node.y = -margin;
            });
        }

        // Find every pair of nearby nodes, plus an adjacency list so
        // pulses know where they can hop next.
        function buildLinks() {
            links = [];
            adjacency = nodes.map(() => []);

            const maxSq = linkDistance * linkDistance;

            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    const dx = nodes[i].x - nodes[j].x;
                    const dy = nodes[i].y - nodes[j].y;
                    const distSq = dx * dx + dy * dy;

                    if (distSq < maxSq) {
                        const dist = Math.sqrt(distSq);
                        links.push({ a: i, b: j, dist });
                        adjacency[i].push(j);
                        adjacency[j].push(i);
                    }
                }
            }
        }

        function spawnPulse() {
            if (!links.length || pulses.length >= settings.maxPulses) return;

            const link = links[Math.floor(Math.random() * links.length)];
            const forward = Math.random() < 0.5;
            const from = forward ? link.a : link.b;
            const to = forward ? link.b : link.a;

            pulses.push({
                from,
                to,
                t: 0,
                speed: 30 + Math.random() * 25, // px per second
                hops: 0,
                maxHops: 2 + Math.floor(Math.random() * 4),
                color: palette[Math.floor(Math.random() * palette.length)],
            });
        }

        function updatePulses(dt) {
            for (let i = pulses.length - 1; i >= 0; i--) {
                const pulse = pulses[i];
                const a = nodes[pulse.from];
                const b = nodes[pulse.to];
                const dist = Math.hypot(b.x - a.x, b.y - a.y);

                // Drop pulses whose link has stretched too far.
                if (dist > linkDistance * 1.2 || dist < 1) {
                    pulses.splice(i, 1);
                    continue;
                }

                pulse.t += (pulse.speed * dt) / dist;

                if (pulse.t >= 1) {
                    const options = adjacency[pulse.to].filter(
                        (index) => index !== pulse.from
                    );

                    pulse.hops += 1;

                    if (options.length && pulse.hops < pulse.maxHops) {
                        pulse.from = pulse.to;
                        pulse.to = options[
                            Math.floor(Math.random() * options.length)
                        ];
                        pulse.t = 0;
                    } else {
                        pulses.splice(i, 1);
                    }
                }
            }
        }

        // Fades the network slightly toward the bottom of the viewport.
        function verticalFade(y) {
            return 1 - clamp(y / Math.max(height, 1), 0, 1) * 0.4;
        }

        function drawLinks() {
            ctx.lineWidth = 1;

            links.forEach((link) => {
                const a = nodes[link.a];
                const b = nodes[link.b];
                const closeness = 1 - link.dist / linkDistance;
                let alpha = Math.pow(closeness, 1.4) * settings.linkOpacity;

                alpha *= verticalFade((a.y + b.y) / 2);

                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.strokeStyle = rgba(a.color, alpha);
                ctx.stroke();
            });
        }

        function drawMouseLinks() {
            if (!mouse.active || !finePointer.matches) return;

            nodes.forEach((node) => {
                const dist = Math.hypot(mouse.x - node.x, mouse.y - node.y);

                if (dist < settings.mouseRadius) {
                    const alpha = (1 - dist / settings.mouseRadius) * 0.55;

                    ctx.beginPath();
                    ctx.moveTo(mouse.x, mouse.y);
                    ctx.lineTo(node.x, node.y);
                    ctx.strokeStyle = rgba(palette[3], alpha);
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            });
        }

        function drawNodes(time) {
            nodes.forEach((node) => {
                const twinkle = 0.7 + Math.sin(time * 0.9 + node.phase) * 0.3;
                const fade = verticalFade(node.y);
                const alpha = (0.12 + node.depth * 0.25) * twinkle * fade;
                const radius = node.hub ? node.radius * 1.7 : node.radius;

                // Soft halo
                ctx.beginPath();
                ctx.arc(node.x, node.y, radius * 4, 0, Math.PI * 2);
                ctx.fillStyle = rgba(node.color, alpha * 0.08);
                ctx.fill();

                if (node.hub) {
                    // Hubs get a thin ring, like a service boundary.
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, radius * 2.6, 0, Math.PI * 2);
                    ctx.strokeStyle = rgba(node.color, alpha * 0.35);
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }

                // Core
                ctx.beginPath();
                ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
                ctx.fillStyle = rgba(node.color, alpha);
                ctx.fill();
            });
        }

        function drawPulses() {
            pulses.forEach((pulse) => {
                const a = nodes[pulse.from];
                const b = nodes[pulse.to];

                // Ease in and out along each hop.
                const t = pulse.t;
                const x = a.x + (b.x - a.x) * t;
                const y = a.y + (b.y - a.y) * t;

                const tailT = Math.max(0, t - 0.22);
                const tx = a.x + (b.x - a.x) * tailT;
                const ty = a.y + (b.y - a.y) * tailT;

                const edge = Math.sin(t * Math.PI); // 0 at ends, 1 mid-link
                const alpha = (0.20 + edge * 0.40) * verticalFade(y);

                // Trail
                const gradient = ctx.createLinearGradient(tx, ty, x, y);
                gradient.addColorStop(0, rgba(pulse.color, 0));
                gradient.addColorStop(1, rgba(pulse.color, alpha * 0.6));

                ctx.beginPath();
                ctx.moveTo(tx, ty);
                ctx.lineTo(x, y);
                ctx.strokeStyle = gradient;
                ctx.lineWidth = 1.6;
                ctx.stroke();

                // Glow
                ctx.beginPath();
                ctx.arc(x, y, 7, 0, Math.PI * 2);
                ctx.fillStyle = rgba(pulse.color, alpha * 0.03);
                ctx.fill();

                // Head
                ctx.beginPath();
                ctx.arc(x, y, 2, 0, Math.PI * 2);
                ctx.fillStyle = rgba([220, 245, 255], alpha);
                ctx.fill();
            });
        }

        function drawScene(time) {
            ctx.clearRect(0, 0, width, height);
            ctx.save();
            ctx.globalCompositeOperation = "screen";

            drawLinks();
            drawMouseLinks();
            drawNodes(time);
            drawPulses();

            ctx.restore();
        }

        function renderStatic() {
            drawScene(elapsed);
        }

        function render(timestamp) {
            frame = null;

            if (!width || !height || document.hidden) return;

            const delta = lastFrame
                ? Math.min(timestamp - lastFrame, 32)
                : 16;
            const dt = delta * 0.001;

            lastFrame = timestamp;
            elapsed += dt;

            moveNodes(dt);
            buildLinks();

            pulseTimer += dt;
            while (pulseTimer > settings.pulseInterval) {
                pulseTimer -= settings.pulseInterval;
                spawnPulse();
            }

            updatePulses(dt);
            drawScene(elapsed);

            if (!reducedMotion.matches) {
                frame = requestAnimationFrame(render);
            }
        }

        function startAnimation() {
            if (
                frame !== null ||
                document.hidden ||
                reducedMotion.matches
            ) {
                return;
            }

            lastFrame = 0;
            frame = requestAnimationFrame(render);
        }

        function stopAnimation() {
            if (frame !== null) {
                cancelAnimationFrame(frame);
                frame = null;
            }
        }

        canvas.setAttribute("aria-hidden", "true");

        window.addEventListener("resize", resizeCanvas, {
            passive: true,
        });

        if (finePointer.matches) {
            window.addEventListener("pointermove", (event) => {
                mouse.x = event.clientX;
                mouse.y = event.clientY;
                mouse.active = true;
            }, { passive: true });

            document.addEventListener("pointerleave", () => {
                mouse.active = false;
            }, { passive: true });
        }

        document.addEventListener("visibilitychange", () => {
            if (document.hidden) {
                stopAnimation();
            } else {
                startAnimation();
            }
        });

        reducedMotion.addEventListener("change", () => {
            stopAnimation();

            if (reducedMotion.matches) {
                renderStatic();
            } else {
                startAnimation();
            }
        });

        resizeCanvas();
        startAnimation();
    }

    // =========================================================
    // NAVIGATION — PRESERVED
    // =========================================================

    const navLinks = document.querySelectorAll(".nav-links a");
    const sections = document.querySelectorAll("main section[id]");

    navLinks.forEach((link) => {
        link.addEventListener("click", (event) => {
            const targetId = link.getAttribute("href");

            if (!targetId || !targetId.startsWith("#")) return;

            const target = document.querySelector(targetId);

            if (!target) return;

            event.preventDefault();

            target.scrollIntoView({
                behavior: "smooth",
                block: "start",
            });
        });
    });

    const updateActiveNav = () => {
        const scrollPosition = window.scrollY + 160;
        let currentSection = "";

        sections.forEach((section) => {
            const sectionTop = section.offsetTop;
            const sectionBottom = sectionTop + section.offsetHeight;

            if (
                scrollPosition >= sectionTop &&
                scrollPosition < sectionBottom
            ) {
                currentSection = section.id;
            }
        });

        navLinks.forEach((link) => {
            const targetId = link.getAttribute("href");

            link.classList.toggle(
                "active",
                targetId === `#${currentSection}`
            );
        });
    };

    window.addEventListener("scroll", updateActiveNav, {
        passive: true,
    });

    updateActiveNav();
});