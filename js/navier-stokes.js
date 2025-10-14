const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const N = 128; // The simulation grid size (N x N)

// Function to set canvas size to fill the window
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

// Set initial size and listen for window resize events
resizeCanvas();
window.addEventListener('resize', resizeCanvas);


let u = Array(N)
    .fill()
    .map(() => Array(N).fill(0));
let v = Array(N)
    .fill()
    .map(() => Array(N).fill(0));
let u_prev = Array(N)
    .fill()
    .map(() => Array(N).fill(0));
let v_prev = Array(N)
    .fill()
    .map(() => Array(N).fill(0));
let dens = Array(N)
    .fill()
    .map(() => Array(N).fill(0));
let dens_prev = Array(N)
    .fill()
    .map(() => Array(N).fill(0));

let viscosity = 0.00001;
let vorticity = 50;
let running = true;

let mouseX = 0,
    mouseY = 0;
let pmouseX = 0,
    pmouseY = 0;
let mouseDown = false;


// FIX: Mouse events now calculate the grid position based on the current
// canvas size (which is the full window size).
canvas.addEventListener("mousedown", (e) => {
    const SCALE_X = canvas.width / N;
    const SCALE_Y = canvas.height / N;
    mouseDown = true;
    pmouseX = mouseX = e.clientX / SCALE_X;
    pmouseY = mouseY = e.clientY / SCALE_Y;
});

canvas.addEventListener("mouseup", () => {
    mouseDown = false;
});

canvas.addEventListener("mousemove", (e) => {
    const SCALE_X = canvas.width / N;
    const SCALE_Y = canvas.height / N;
    pmouseX = mouseX;
    pmouseY = mouseY;
    mouseX = e.clientX / SCALE_X;
    mouseY = e.clientY / SCALE_Y;
});

document.getElementById("viscosity").addEventListener("input", (e) => {
    viscosity = parseFloat(e.target.value);
    document.getElementById("visc-val").textContent = viscosity.toFixed(6);
});

document.getElementById("vorticity").addEventListener("input", (e) => {
    vorticity = parseFloat(e.target.value);
    document.getElementById("vort-val").textContent = vorticity;
});

document.getElementById("reset").addEventListener("click", () => {
    u = Array(N)
        .fill()
        .map(() => Array(N).fill(0));
    v = Array(N)
        .fill()
        .map(() => Array(N).fill(0));
    dens = Array(N)
        .fill()
        .map(() => Array(N).fill(0));
});

document.getElementById("toggle").addEventListener("click", () => {
    running = !running;
    document.getElementById("toggle").textContent = running ? "Pause/Resume" : "Resume";
});

function IX(i, j) {
    i = Math.max(0, Math.min(N - 1, i));
    j = Math.max(0, Math.min(N - 1, j));
    return i + j * N;
}

function addSource(x, s, dt) {
    for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
            x[i][j] += dt * s[i][j];
        }
    }
}

function diffuse(b, x, x0, diff, dt) {
    const a = dt * diff * N * N;
    for (let k = 0; k < 20; k++) {
        for (let i = 1; i < N - 1; i++) {
            for (let j = 1; j < N - 1; j++) {
                x[i][j] =
                    (x0[i][j] +
                        a * (x[i - 1][j] + x[i + 1][j] + x[i][j - 1] + x[i][j + 1])) /
                    (1 + 4 * a);
            }
        }
        setBoundary(b, x);
    }
}

function advect(b, d, d0, u, v, dt) {
    const dt0 = dt * N;
    for (let i = 1; i < N - 1; i++) {
        for (let j = 1; j < N - 1; j++) {
            let x = i - dt0 * u[i][j];
            let y = j - dt0 * v[i][j];

            x = Math.max(0.5, Math.min(N - 1.5, x));
            y = Math.max(0.5, Math.min(N - 1.5, y));

            const i0 = Math.floor(x);
            const i1 = i0 + 1;
            const j0 = Math.floor(y);
            const j1 = j0 + 1;

            const s1 = x - i0;
            const s0 = 1 - s1;
            const t1 = y - j0;
            const t0 = 1 - t1;

            d[i][j] =
                s0 * (t0 * d0[i0][j0] + t1 * d0[i0][j1]) +
                s1 * (t0 * d0[i1][j0] + t1 * d0[i1][j1]);
        }
    }
    setBoundary(b, d);
}

function project(u, v, p, div) {
    for (let i = 1; i < N - 1; i++) {
        for (let j = 1; j < N - 1; j++) {
            div[i][j] =
                (-0.5 * (u[i + 1][j] - u[i - 1][j] + v[i][j + 1] - v[i][j - 1])) /
                N;
            p[i][j] = 0;
        }
    }
    setBoundary(0, div);
    setBoundary(0, p);

    for (let k = 0; k < 20; k++) {
        for (let i = 1; i < N - 1; i++) {
            for (let j = 1; j < N - 1; j++) {
                p[i][j] =
                    (div[i][j] +
                        p[i - 1][j] +
                        p[i + 1][j] +
                        p[i][j - 1] +
                        p[i][j + 1]) /
                    4;
            }
        }
        setBoundary(0, p);
    }

    for (let i = 1; i < N - 1; i++) {
        for (let j = 1; j < N - 1; j++) {
            u[i][j] -= 0.5 * N * (p[i + 1][j] - p[i - 1][j]);
            v[i][j] -= 0.5 * N * (p[i][j + 1] - p[i][j - 1]);
        }
    }
    setBoundary(1, u);
    setBoundary(2, v);
}

function setBoundary(b, x) {
    for (let i = 1; i < N - 1; i++) {
        x[0][i] = b === 1 ? -x[1][i] : x[1][i];
        x[N - 1][i] = b === 1 ? -x[N - 2][i] : x[N - 2][i];
        x[i][0] = b === 2 ? -x[i][1] : x[i][1];
        x[i][N - 1] = b === 2 ? -x[i][N - 2] : x[i][N - 2];
    }
    x[0][0] = 0.5 * (x[1][0] + x[0][1]);
    x[0][N - 1] = 0.5 * (x[1][N - 1] + x[0][N - 2]);
    x[N - 1][0] = 0.5 * (x[N - 2][0] + x[N - 1][1]);
    x[N - 1][N - 1] = 0.5 * (x[N - 2][N - 1] + x[N - 1][N - 2]);
}

function velocityStep(u, v, u0, v0, visc, dt) {
    // FIX: Correctly add sources (u0 and v0) to the main velocity arrays (u and v)
    addSource(u, u0, dt);
    addSource(v, v0, dt);

    [u0, u] = [u, u0];
    diffuse(1, u, u0, visc, dt);
    [v0, v] = [v, v0];
    diffuse(2, v, v0, visc, dt);

    project(u, v, u0, v0);

    [u0, u] = [u, u0];
    [v0, v] = [v, v0];

    advect(1, u, u0, u0, v0, dt);
    advect(2, v, v0, u0, v0, dt);

    project(u, v, u0, v0);
}

function densityStep(x, x0, u, v, diff, dt) {
    addSource(x, x0, dt);
    [x0, x] = [x, x0];
    diffuse(0, x, x0, diff, dt);
    [x0, x] = [x, x0];
    advect(0, x, x0, u, v, dt);
}

function addForces() {
    if (mouseDown) {
        const dx = mouseX - pmouseX;
        const dy = mouseY - pmouseY;
        const length = Math.sqrt(dx * dx + dy * dy);

        if (length > 0.1) {
            const x = Math.floor(mouseX);
            const y = Math.floor(mouseY);

            if (x > 0 && x < N - 1 && y > 0 && y < N - 1) {
                const force = vorticity * 0.1;
                u_prev[x][y] += dx * force;
                v_prev[x][y] += dy * force;
                dens_prev[x][y] += 200;
            }
        }
    }
}

function render() {
    // FIX: Calculate separate SCALE_X and SCALE_Y based on current canvas size
    const SCALE_X = canvas.width / N;
    const SCALE_Y = canvas.height / N;

    const imageData = ctx.createImageData(canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
            const vel = Math.sqrt(u[i][j] * u[i][j] + v[i][j] * v[i][j]);
            const d = dens[i][j];

            const color = Math.min(255, (vel * 100 + d) * 2);

            // FIX: Use SCALE_X and SCALE_Y to determine the size of the pixel block
            const startX = Math.floor(i * SCALE_X);
            const startY = Math.floor(j * SCALE_Y);
            const endX = Math.floor((i + 1) * SCALE_X);
            const endY = Math.floor((j + 1) * SCALE_Y);

            for (let px = startX; px < endX; px++) {
                for (let py = startY; py < endY; py++) {
                    const idx = (py * canvas.width + px) * 4;
                    data[idx] = 0;
                    data[idx + 1] = color;
                    data[idx + 2] = color * 0.5;
                    data[idx + 3] = 255;
                }
            }
        }
    }

    ctx.putImageData(imageData, 0, 0);
}

function update() {
    if (running) {
        addForces();
        // The original code used 0.1 for dt in both steps, keeping that for stability
        velocityStep(u, v, u_prev, v_prev, viscosity, 0.1);
        densityStep(dens, dens_prev, u, v, 0, 0.1);

        for (let i = 0; i < N; i++) {
            for (let j = 0; j < N; j++) {
                u_prev[i][j] = 0;
                v_prev[i][j] = 0;
                dens_prev[i][j] = 0;
                dens[i][j] *= 0.99;
            }
        }
    }

    render();
    requestAnimationFrame(update);
}

update();