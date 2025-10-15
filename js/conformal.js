const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let mappingType = "identity";
let gridRes = 20;
let animSpeed = 1.0;
let animating = true;
let time = 0;

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
    exp() {
        const r = Math.exp(this.re);
        return new Complex(r * Math.cos(this.im), r * Math.sin(this.im));
    }
    log() {
        return new Complex(Math.log(this.abs()), this.arg());
    }
    pow(n) {
        const r = Math.pow(this.abs(), n);
        const theta = this.arg() * n;
        return new Complex(r * Math.cos(theta), r * Math.sin(theta));
    }
    sin() {
        return new Complex(
            Math.sin(this.re) * Math.cosh(this.im),
            Math.cos(this.re) * Math.sinh(this.im)
        );
    }
}

function applyMapping(z) {
    const t = time * 0.5;
    const interp = (Math.sin(t) + 1) / 2;

    switch (mappingType) {
        case "identity":
            return z;

        case "square":
            const sq = z.pow(2);
            return new Complex(
                z.re + (sq.re - z.re) * interp,
                z.im + (sq.im - z.im) * interp
            );

        case "cube":
            const cube = z.pow(3).mul(new Complex(0.1, 0));
            return new Complex(
                z.re + (cube.re - z.re) * interp,
                z.im + (cube.im - z.im) * interp
            );

        case "inverse":
            if (z.abs() < 0.01) return new Complex(0, 0);
            const inv = new Complex(1, 0).div(z);
            return new Complex(
                z.re + (inv.re - z.re) * interp,
                z.im + (inv.im - z.im) * interp
            );

        case "exp":
            const exp = z.exp().mul(new Complex(0.2, 0));
            return new Complex(
                z.re + (exp.re - z.re) * interp,
                z.im + (exp.im - z.im) * interp
            );

        case "log":
            if (z.abs() < 0.01) return new Complex(0, 0);
            const log = z.log();
            return new Complex(
                z.re + (log.re - z.re) * interp,
                z.im + (log.im - z.im) * interp
            );

        case "mobius":
            const mob = z.add(new Complex(1, 0)).div(z.add(new Complex(0, 1)));
            return new Complex(
                z.re + (mob.re - z.re) * interp,
                z.im + (mob.im - z.im) * interp
            );

        case "joukowsky":
            if (z.abs() < 0.01) return new Complex(0, 0);
            const jouk = z.add(new Complex(1, 0).div(z));
            return new Complex(
                z.re + (jouk.re - z.re) * interp,
                z.im + (jouk.im - z.im) * interp
            );

        case "sin":
            const sine = z.sin();
            return new Complex(
                z.re + (sine.re - z.re) * interp,
                z.im + (sine.im - z.im) * interp
            );

        default:
            return z;
    }
}

function complexToScreen(z, side) {
    const scale = Math.min(canvas.width, canvas.height) / 8;
    const offsetX =
        side === "left" ? canvas.width * 0.25 : canvas.width * 0.75;
    const offsetY = canvas.height / 2;

    return {
        x: offsetX + z.re * scale,
        y: offsetY - z.im * scale,
    };
}

function drawGrid(side) {
    const range = 3;
    const step = (range * 2) / gridRes;

    // Draw vertical lines
    for (let i = 0; i <= gridRes; i++) {
        const x = -range + i * step;
        ctx.beginPath();
        ctx.strokeStyle =
            side === "left"
                ? "rgba(0, 255, 65, 0.3)"
                : "rgba(0, 170, 255, 0.5)";
        ctx.lineWidth = 1;

        for (let j = 0; j <= gridRes; j++) {
            const y = -range + j * step;
            const z = new Complex(x, y);
            const w = side === "left" ? z : applyMapping(z);
            const pos = complexToScreen(w, side);

            if (j === 0) ctx.moveTo(pos.x, pos.y);
            else ctx.lineTo(pos.x, pos.y);
        }
        ctx.stroke();
    }

    // Draw horizontal lines
    for (let j = 0; j <= gridRes; j++) {
        const y = -range + j * step;
        ctx.beginPath();
        ctx.strokeStyle =
            side === "left"
                ? "rgba(0, 255, 65, 0.3)"
                : "rgba(0, 170, 255, 0.5)";
        ctx.lineWidth = 1;

        for (let i = 0; i <= gridRes; i++) {
            const x = -range + i * step;
            const z = new Complex(x, y);
            const w = side === "left" ? z : applyMapping(z);
            const pos = complexToScreen(w, side);

            if (i === 0) ctx.moveTo(pos.x, pos.y);
            else ctx.lineTo(pos.x, pos.y);
        }
        ctx.stroke();
    }
}

function drawCircles(side) {
    const circles = [0.5, 1, 1.5, 2, 2.5];

    circles.forEach((radius) => {
        ctx.beginPath();
        ctx.strokeStyle =
            side === "left"
                ? "rgba(255, 170, 0, 0.4)"
                : "rgba(255, 170, 0, 0.6)";
        ctx.lineWidth = 2;

        const numPoints = 100;
        for (let i = 0; i <= numPoints; i++) {
            const theta = (i / numPoints) * Math.PI * 2;
            const z = new Complex(
                radius * Math.cos(theta),
                radius * Math.sin(theta)
            );
            const w = side === "left" ? z : applyMapping(z);
            const pos = complexToScreen(w, side);

            if (i === 0) ctx.moveTo(pos.x, pos.y);
            else ctx.lineTo(pos.x, pos.y);
        }
        ctx.stroke();
    });
}

function drawAxes(side) {
    const offsetX =
        side === "left" ? canvas.width * 0.25 : canvas.width * 0.75;
    const offsetY = canvas.height / 2;

    ctx.strokeStyle = "rgba(0, 255, 65, 0.5)";
    ctx.lineWidth = 2;

    // Real axis
    ctx.beginPath();
    ctx.moveTo(offsetX - 200, offsetY);
    ctx.lineTo(offsetX + 200, offsetY);
    ctx.stroke();

    // Imaginary axis
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY - 200);
    ctx.lineTo(offsetX, offsetY + 200);
    ctx.stroke();

    // Labels
    ctx.fillStyle = "#00ff41";
    ctx.font = "12px Courier New";
    ctx.fillText(
        side === "left" ? "z-plane" : "w-plane",
        offsetX - 40,
        offsetY - 220
    );
    ctx.font = "10px Courier New";
    ctx.fillText("Re", offsetX + 210, offsetY + 5);
    ctx.fillText("Im", offsetX + 5, offsetY - 210);
}

function drawArrow() {
    const midX = canvas.width / 2;
    const midY = canvas.height / 2;

    ctx.strokeStyle = "#00ff41";
    ctx.fillStyle = "#00ff41";
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.moveTo(midX - 50, midY);
    ctx.lineTo(midX + 50, midY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(midX + 50, midY);
    ctx.lineTo(midX + 40, midY - 10);
    ctx.lineTo(midX + 40, midY + 10);
    ctx.closePath();
    ctx.fill();

    ctx.font = "14px Courier New";
    ctx.fillText("f(z)", midX - 15, midY - 20);
}

function animate() {
    ctx.fillStyle = "#0a0e27";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw domain (z-plane)
    drawAxes("left");
    drawGrid("left");
    drawCircles("left");

    // Draw arrow
    drawArrow();

    // Draw range (w-plane)
    drawAxes("right");
    drawGrid("right");
    drawCircles("right");

    if (animating) {
        time += 0.02 * animSpeed;
    }

    requestAnimationFrame(animate);
}

document
    .getElementById("mapping-type")
    .addEventListener("change", (e) => {
        mappingType = e.target.value;
        time = 0;
    });

document.getElementById("grid-res").addEventListener("input", (e) => {
    gridRes = parseInt(e.target.value);
    document.getElementById("grid-val").textContent = gridRes;
});

document.getElementById("speed").addEventListener("input", (e) => {
    animSpeed = parseFloat(e.target.value);
    document.getElementById("speed-val").textContent = animSpeed.toFixed(1);
});

document.getElementById("toggle-anim").addEventListener("click", () => {
    animating = !animating;
    document.getElementById("toggle-anim").textContent = animating
        ? "Pause Animation"
        : "Resume Animation";
});

document.getElementById("reset").addEventListener("click", () => {
    time = 0;
});

animate();