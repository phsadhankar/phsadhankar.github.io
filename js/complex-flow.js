const cvs = document.getElementById("flowCanvas");
const ctx = cvs.getContext("2d");

function setupCanvas() {
    cvs.width = window.innerWidth;
    cvs.height = window.innerHeight;
}
setupCanvas();
window.addEventListener("resize", () => {
    setupCanvas();
    initParticles();
});

let flowType = "uniform";
let strength = 1.0;
let angle = 0;
let particleCount = 150;
let particles = [];

class Complex {
    constructor(re, im) {
        this.re = re;
        this.im = im;
    }

    add(c) {
        return new Complex(this.re + c.re, this.im + c.im);
    }

    sub(c) {
        return new Complex(this.re - c.re, this.im - c.im);
    }

    mul(c) {
        return new Complex(
            this.re * c.re - this.im * c.im,
            this.re * c.im + this.im * c.re
        );
    }

    div(c) {
        const denom = c.re * c.re + c.im * c.im;
        if (denom === 0) return new Complex(0, 0);
        return new Complex(
            (this.re * c.re + this.im * c.im) / denom,
            (this.im * c.re - this.re * c.im) / denom
        );
    }

    abs() {
        return Math.sqrt(this.re * this.re + this.im * this.im);
    }

    arg() {
        return Math.atan2(this.im, this.re);
    }

    log() {
        return new Complex(Math.log(this.abs()), this.arg());
    }

    pow(n) {
        const r = Math.pow(this.abs(), n);
        const theta = this.arg() * n;
        return new Complex(r * Math.cos(theta), r * Math.sin(theta));
    }
}

function getVelocity(z) {
    const angleRad = (angle * Math.PI) / 180;
    const rotation = new Complex(Math.cos(angleRad), Math.sin(angleRad));

    switch (flowType) {
        case "uniform":
            return rotation.mul(new Complex(strength, 0));

        case "source":
            const mag = z.abs();
            if (mag < 0.01) return new Complex(0, 0);
            return new Complex(z.re / (mag * mag), z.im / (mag * mag)).mul(
                new Complex(strength, 0)
            );

        case "vortex":
            const r = z.abs();
            if (r < 0.01) return new Complex(0, 0);
            return new Complex(-z.im / (r * r), z.re / (r * r)).mul(
                new Complex(strength, 0)
            );

        case "dipole":
            const zSq = z.pow(2);
            return new Complex(-strength, 0).div(zSq);

        case "corner":
            return z.mul(new Complex(strength * 2, 0));

        case "cylinder":
            const R = 0.5;
            const uniform = rotation.mul(new Complex(strength, 0));
            const rAbs = z.abs();
            if (rAbs < R) return new Complex(0, 0);
            const cylinder = new Complex(R * R, 0).div(z.pow(2)).mul(uniform);
            return uniform.sub(cylinder);

        case "stagnation":
            return new Complex(z.re * strength, -z.im * strength);

        default:
            return new Complex(0, 0);
    }
}

class Particle {
    constructor() {
        this.reset();
    }

    reset() {
        // Distribute particles across entire screen
        const aspect = cvs.width / cvs.height;
        const range = 4;
        this.x = (Math.random() - 0.5) * range * aspect;
        this.y = (Math.random() - 0.5) * range;
        this.trail = [];
        this.maxTrail = 40;
    }

    update(dt) {
        const z = new Complex(this.x, this.y);
        const w = getVelocity(z);

        this.x += w.re * dt;
        this.y += w.im * dt;

        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > this.maxTrail) {
            this.trail.shift();
        }

        const dist = Math.sqrt(this.x * this.x + this.y * this.y);
        const aspect = cvs.width / cvs.height;
        const rangeX = 5 * aspect;
        const rangeY = 5;

        if (
            Math.abs(this.x) > rangeX ||
            Math.abs(this.y) > rangeY ||
            (flowType === "cylinder" && dist < 0.5)
        ) {
            this.reset();
        }
    }
}

function screenToComplex(x, y) {
    const aspect = cvs.width / cvs.height;
    const scale = Math.min(cvs.width, cvs.height) / 6;
    const cx = cvs.width / 2;
    const cy = cvs.height / 2;

    return {
        re: (x - cx) / scale,
        im: -(y - cy) / scale,
    };
}

function complexToScreen(z) {
    const scale = Math.min(cvs.width, cvs.height) / 6;
    const cx = cvs.width / 2;
    const cy = cvs.height / 2;

    return {
        x: cx + z.re * scale,
        y: cy - z.im * scale,
    };
}

function initParticles() {
    particles = [];
    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
    }
}

function drawStreamlines() {
    const aspect = cvs.width / cvs.height;
    const numLines = Math.floor(20 * aspect);
    const rangeY = 4;

    for (let i = 0; i < numLines; i++) {
        const startY = -rangeY + (i / numLines) * (rangeY * 2);

        ctx.beginPath();
        ctx.strokeStyle = "rgba(20, 32, 43, 0.2)";
        ctx.lineWidth = 1;

        let z = new Complex(-4 * aspect, startY);
        const pos = complexToScreen(z);
        ctx.moveTo(pos.x, pos.y);

        for (let step = 0; step < 300; step++) {
            const w = getVelocity(z);
            const mag = w.abs();

            if (mag < 0.001) break;

            const dt = 0.02 / Math.max(0.1, mag);
            z = z.add(new Complex(w.re * dt, w.im * dt));

            const pos = complexToScreen(z);

            if (Math.abs(z.re) > 5 * aspect || Math.abs(z.im) > 5) break;
            if (flowType === "cylinder" && z.abs() < 0.5) break;

            ctx.lineTo(pos.x, pos.y);
        }

        ctx.stroke();
    }
}

function drawVectorField() {
    const step = 60;

    for (let px = step / 2; px < cvs.width; px += step) {
        for (let py = step / 2; py < cvs.height; py += step) {
            const complex = screenToComplex(px, py);
            const z = new Complex(complex.re, complex.im);
            const w = getVelocity(z);

            const mag = w.abs();
            const angle = Math.atan2(w.im, w.re);

            const len = Math.min(step * 0.35, mag * 8);
            const color = Math.min(255, mag * 80);

            ctx.strokeStyle = `rgba(29, 95, 167, ${0.28 + Math.min(0.65, color / 320)})`;
            ctx.lineWidth = 1.5;

            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px + len * Math.cos(angle), py - len * Math.sin(angle));
            ctx.stroke();

            // Arrow head
            const headLen = 4;
            const headAngle = 0.5;
            const endX = px + len * Math.cos(angle);
            const endY = py - len * Math.sin(angle);

            ctx.beginPath();
            ctx.moveTo(endX, endY);
            ctx.lineTo(
                endX - headLen * Math.cos(angle - headAngle),
                endY + headLen * Math.sin(angle - headAngle)
            );
            ctx.moveTo(endX, endY);
            ctx.lineTo(
                endX - headLen * Math.cos(angle + headAngle),
                endY + headLen * Math.sin(angle + headAngle)
            );
            ctx.stroke();
        }
    }
}

function drawObstacles() {
    if (flowType === "cylinder") {
        const center = complexToScreen(new Complex(0, 0));
        const scale = Math.min(cvs.width, cvs.height) / 6;

        ctx.fillStyle = "#eff4e6";
        ctx.strokeStyle = "#14202b";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(center.x, center.y, 0.5 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }
}

function animate() {
    ctx.fillStyle = "rgba(228, 236, 217, 0.32)";
    ctx.fillRect(0, 0, cvs.width, cvs.height);

    drawStreamlines();
    drawVectorField();
    drawObstacles();

    particles.forEach((p) => {
        p.update(0.05);

        ctx.strokeStyle = "rgba(214, 58, 34, 0.85)";
        ctx.lineWidth = 2;
        ctx.beginPath();

        p.trail.forEach((point, i) => {
            const pos = complexToScreen(new Complex(point.x, point.y));
            if (i === 0) ctx.moveTo(pos.x, pos.y);
            else ctx.lineTo(pos.x, pos.y);
        });
        ctx.stroke();

        const pos = complexToScreen(new Complex(p.x, p.y));
        ctx.fillStyle = "#d63a22";
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
        ctx.fill();
    });

    requestAnimationFrame(animate);
}

document.getElementById("flowType").addEventListener("change", (e) => {
    flowType = e.target.value;
    initParticles();
});

document
    .getElementById("strengthSlider")
    .addEventListener("input", (e) => {
        strength = parseFloat(e.target.value);
        document.getElementById("strengthVal").textContent =
            strength.toFixed(1);
    });

document.getElementById("angleSlider").addEventListener("input", (e) => {
    angle = parseFloat(e.target.value);
    document.getElementById("angleVal").textContent = angle + "°";
});

document
    .getElementById("particleSlider")
    .addEventListener("input", (e) => {
        particleCount = parseInt(e.target.value);
        document.getElementById("particleVal").textContent = particleCount;
        initParticles();
    });

document
    .getElementById("resetBtn")
    .addEventListener("click", initParticles);

initParticles();
animate();