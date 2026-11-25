
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let vortices = [];
let particles = [];
let reynolds = 1000;
let vortexStrength = 5.0;
let cascadeRate = 0.5;
let mouseDown = false;

class Vortex {
    constructor(x, y, strength, radius) {
        this.x = x;
        this.y = y;
        this.strength = strength;
        this.radius = radius;
        this.age = 0;
        this.maxAge = 500;
    }

    update(dt) {
        this.age += dt;

        // Vortex merging and splitting (energy cascade)
        vortices.forEach((other) => {
            if (other !== this) {
                const dx = other.x - this.x;
                const dy = other.y - this.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < this.radius + other.radius && dist > 0) {
                    // Vortex-vortex interaction
                    const force =
                        (this.strength * other.strength) / (dist * dist + 100);
                    const angle = Math.atan2(dy, dx);

                    this.x -= Math.cos(angle) * force * 0.1;
                    this.y -= Math.sin(angle) * force * 0.1;
                }
            }
        });

        // Dissipation based on Reynolds number
        const viscosity = 1.0 / reynolds;
        this.strength *= 1 - viscosity * 0.01;
        this.radius *= 1 - viscosity * 0.001;

        // Boundary conditions
        if (
            this.x < 0 ||
            this.x > canvas.width ||
            this.y < 0 ||
            this.y > canvas.height
        ) {
            this.strength *= 0.95;
        }
    }

    getVelocity(x, y) {
        const dx = x - this.x;
        const dy = y - this.y;
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq);

        if (dist < 1) return { vx: 0, vy: 0 };

        const circulation = this.strength / (2 * Math.PI * distSq);
        return {
            vx: -circulation * dy,
            vy: circulation * dx,
        };
    }

    split() {
        if (this.radius > 20 && Math.random() < cascadeRate * 0.01) {
            const angle = Math.random() * Math.PI * 2;
            const offset = this.radius * 0.5;

            vortices.push(
                new Vortex(
                    this.x + Math.cos(angle) * offset,
                    this.y + Math.sin(angle) * offset,
                    this.strength * 0.5,
                    this.radius * 0.7
                )
            );

            vortices.push(
                new Vortex(
                    this.x - Math.cos(angle) * offset,
                    this.y - Math.sin(angle) * offset,
                    this.strength * 0.5,
                    this.radius * 0.7
                )
            );

            return true;
        }
        return false;
    }
}

class Particle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.trail = [];
        this.maxTrail = 50;
        this.life = 1.0;
    }

    update() {
        let vx = 0,
            vy = 0;

        vortices.forEach((vortex) => {
            const vel = vortex.getVelocity(this.x, this.y);
            vx += vel.vx;
            vy += vel.vy;
        });

        this.x += vx * 2;
        this.y += vy * 2;

        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > this.maxTrail) {
            this.trail.shift();
        }

        this.life -= 0.005;

        if (
            this.x < 0 ||
            this.x > canvas.width ||
            this.y < 0 ||
            this.y > canvas.height
        ) {
            this.life = 0;
        }
    }
}

function addVortex(x, y) {
    const sign = Math.random() > 0.5 ? 1 : -1;
    vortices.push(
        new Vortex(x, y, vortexStrength * sign, 30 + Math.random() * 20)
    );
}

function addRandomTurbulence() {
    for (let i = 0; i < 20; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        addVortex(x, y);
    }
}

function spawnParticles() {
    while (particles.length < 500) {
        particles.push(
            new Particle(
                Math.random() * canvas.width,
                Math.random() * canvas.height
            )
        );
    }
}

function calculateEnergy() {
    let energy = 0;
    let enstrophy = 0;

    vortices.forEach((v) => {
        energy += v.strength * v.strength * v.radius;
        enstrophy += v.strength * v.strength;
    });

    return { energy: energy.toFixed(2), enstrophy: enstrophy.toFixed(2) };
}

function animate() {
    ctx.fillStyle = "rgba(14, 22, 32, 0.1)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Update vortices
    vortices = vortices.filter((v) => {
        v.update(1);
        return v.strength > 0.1 && v.radius > 5 && v.age < v.maxAge;
    });

    // Handle vortex splitting (energy cascade)
    const toSplit = [];
    vortices.forEach((v, i) => {
        if (v.split()) {
            toSplit.push(i);
        }
    });
    toSplit.reverse().forEach((i) => vortices.splice(i, 1));

    // Update particles
    particles.forEach((p) => p.update());
    particles = particles.filter((p) => p.life > 0);

    // Draw vortex fields
    vortices.forEach((v) => {
        const gradient = ctx.createRadialGradient(
            v.x,
            v.y,
            0,
            v.x,
            v.y,
            v.radius * 2
        );
        const intensity = Math.min(1, Math.abs(v.strength) / 10);
        const color =
            v.strength > 0
                ? `rgba(255, 122, 69, ${intensity * 0.3})`
                : `rgba(255, 0, 65, ${intensity * 0.3})`;

        gradient.addColorStop(0, color);
        gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

        ctx.fillStyle = gradient;
        ctx.fillRect(
            v.x - v.radius * 2,
            v.y - v.radius * 2,
            v.radius * 4,
            v.radius * 4
        );

        // Draw vortex core
        ctx.strokeStyle = v.strength > 0 ? "#ff7a45" : "#7fd0ff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(v.x, v.y, v.radius, 0, Math.PI * 2);
        ctx.stroke();

        // Draw rotation indicator
        const angle = Date.now() * 0.001 * v.strength * 0.1;
        ctx.beginPath();
        ctx.moveTo(v.x, v.y);
        ctx.lineTo(
            v.x + Math.cos(angle) * v.radius,
            v.y + Math.sin(angle) * v.radius
        );
        ctx.stroke();
    });

    // Draw particles
    particles.forEach((p) => {
        ctx.strokeStyle = `rgba(255, 122, 69, ${p.life})`;
        ctx.lineWidth = 1;
        ctx.beginPath();

        for (let i = 1; i < p.trail.length; i++) {
            if (i === 1) {
                ctx.moveTo(p.trail[i - 1].x, p.trail[i - 1].y);
            }
            ctx.lineTo(p.trail[i].x, p.trail[i].y);
        }
        ctx.stroke();
    });

    // Update stats
    const stats = calculateEnergy();
    document.getElementById("vortex-count").textContent = vortices.length;
    document.getElementById("energy").textContent = stats.energy;
    document.getElementById("enstrophy").textContent = stats.enstrophy;
    document.getElementById("re-display").textContent = reynolds;

    spawnParticles();

    requestAnimationFrame(animate);
}

canvas.addEventListener("mousedown", (e) => {
    mouseDown = true;
    addVortex(e.clientX, e.clientY);
});

canvas.addEventListener("mouseup", () => {
    mouseDown = false;
});

canvas.addEventListener("mousemove", (e) => {
    if (mouseDown && Math.random() > 0.7) {
        addVortex(e.clientX, e.clientY);
    }
});

document.getElementById("reynolds").addEventListener("input", (e) => {
    reynolds = parseInt(e.target.value);
    document.getElementById("reynolds-val").textContent = reynolds;
});

document.getElementById("strength").addEventListener("input", (e) => {
    vortexStrength = parseFloat(e.target.value);
    document.getElementById("strength-val").textContent =
        vortexStrength.toFixed(1);
});

document.getElementById("cascade").addEventListener("input", (e) => {
    cascadeRate = parseFloat(e.target.value);
    document.getElementById("cascade-val").textContent =
        cascadeRate.toFixed(1);
});

document.getElementById("reset").addEventListener("click", () => {
    vortices = [];
    particles = [];
});

document.getElementById("random").addEventListener("click", () => {
    addRandomTurbulence();
});

animate();