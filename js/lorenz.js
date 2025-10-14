
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let sigma = 10.0;
let rho = 28.0;
let beta = 8.0 / 3.0;
let speed = 1.0;
let running = true;

let rotX = 0.5;
let rotY = 0.3;
let rotZ = 0;
let mouseDown = false;
let lastX = 0,
    lastY = 0;

class Particle {
    constructor(x, y, z, color) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.trail = [];
        this.maxTrail = 3000;
        this.color = color;
    }

    update(dt) {
        const dx = sigma * (this.y - this.x);
        const dy = this.x * (rho - this.z) - this.y;
        const dz = this.x * this.y - beta * this.z;

        this.x += dx * dt;
        this.y += dy * dt;
        this.z += dz * dt;

        this.trail.push({ x: this.x, y: this.y, z: this.z });
        if (this.trail.length > this.maxTrail) {
            this.trail.shift();
        }
    }
}

const particles = [new Particle(0.1, 0, 0, "#00ff41")];

function rotateX(y, z, angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
        y: y * cos - z * sin,
        z: y * sin + z * cos,
    };
}

function rotateY(x, z, angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
        x: x * cos + z * sin,
        z: -x * sin + z * cos,
    };
}

function rotateZ(x, y, angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
        x: x * cos - y * sin,
        y: x * sin + y * cos,
    };
}

function project(x, y, z) {
    let point = { x, y, z };

    let temp = rotateX(point.y, point.z, rotX);
    point.y = temp.y;
    point.z = temp.z;

    temp = rotateY(point.x, point.z, rotY);
    point.x = temp.x;
    point.z = temp.z;

    temp = rotateZ(point.x, point.y, rotZ);
    point.x = temp.x;
    point.y = temp.y;

    const scale = 400 / (400 + point.z);
    return {
        x: canvas.width / 2 + point.x * scale * 8,
        y: canvas.height / 2 - point.y * scale * 8,
        scale: scale,
    };
}

let lastTime = Date.now();
let frameCount = 0;
let fpsTime = Date.now();

function animate() {
    const now = Date.now();
    const dt = ((now - lastTime) / 1000) * speed * 0.5;
    lastTime = now;

    ctx.fillStyle = "rgba(10, 14, 39, 0.1)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (running) {
        particles.forEach((particle) => {
            for (let i = 0; i < 5; i++) {
                particle.update(dt);
            }
        });
    }

    let totalPoints = 0;
    particles.forEach((particle) => {
        totalPoints += particle.trail.length;

        for (let i = 1; i < particle.trail.length; i++) {
            const p1 = project(
                particle.trail[i - 1].x,
                particle.trail[i - 1].y,
                particle.trail[i - 1].z
            );
            const p2 = project(
                particle.trail[i].x,
                particle.trail[i].y,
                particle.trail[i].z
            );

            const alpha = i / particle.trail.length;
            ctx.strokeStyle =
                particle.color +
                Math.floor(alpha * 255)
                    .toString(16)
                    .padStart(2, "0");
            ctx.lineWidth = 1 + alpha * 1.5;

            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
        }

        const head = project(particle.x, particle.y, particle.z);
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(head.x, head.y, 3, 0, 2 * Math.PI);
        ctx.fill();
    });

    document.getElementById("point-count").textContent = totalPoints;

    frameCount++;
    if (now - fpsTime > 1000) {
        document.getElementById("fps").textContent = frameCount;
        frameCount = 0;
        fpsTime = now;
    }

    requestAnimationFrame(animate);
}

canvas.addEventListener("mousedown", (e) => {
    mouseDown = true;
    lastX = e.clientX;
    lastY = e.clientY;
});

canvas.addEventListener("mouseup", () => {
    mouseDown = false;
});

canvas.addEventListener("mousemove", (e) => {
    if (mouseDown) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;

        rotY += dx * 0.005;
        rotX += dy * 0.005;

        lastX = e.clientX;
        lastY = e.clientY;
    }
});

document.getElementById("sigma").addEventListener("input", (e) => {
    sigma = parseFloat(e.target.value);
    document.getElementById("sigma-val").textContent = sigma.toFixed(1);
});

document.getElementById("rho").addEventListener("input", (e) => {
    rho = parseFloat(e.target.value);
    document.getElementById("rho-val").textContent = rho.toFixed(1);
});

document.getElementById("beta").addEventListener("input", (e) => {
    beta = parseFloat(e.target.value);
    document.getElementById("beta-val").textContent = beta.toFixed(2);
});

document.getElementById("speed").addEventListener("input", (e) => {
    speed = parseFloat(e.target.value);
    document.getElementById("speed-val").textContent = speed.toFixed(1);
});

document.getElementById("reset").addEventListener("click", () => {
    particles.length = 0;
    particles.push(new Particle(0.1, 0, 0, "#00ff41"));
    document.getElementById("particle-count").textContent =
        particles.length;
});

document.getElementById("add-particle").addEventListener("click", () => {
    const colors = ["#00ff41", "#00aaff", "#ff00aa", "#ffaa00", "#aa00ff"];
    const color = colors[particles.length % colors.length];
    const offset = (Math.random() - 0.5) * 0.2;
    particles.push(new Particle(0.1 + offset, offset, offset, color));
    document.getElementById("particle-count").textContent =
        particles.length;
});

document.getElementById("toggle").addEventListener("click", () => {
    running = !running;
    document.getElementById("toggle").textContent = running
        ? "Pause"
        : "Resume";
});

animate();