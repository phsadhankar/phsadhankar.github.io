const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// FIX 1: Add responsive resizing
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

resizeCanvas();
window.addEventListener("resize", resizeCanvas);

const N = 128;
let u = Array(N)
    .fill()
    .map(() => Array(N).fill(0));
let u_prev = Array(N)
    .fill()
    .map(() => Array(N).fill(0));
let v = Array(N)
    .fill()
    .map(() => Array(N).fill(0)); // For reaction-diffusion

let pdeType = "heat";
let alpha = 0.1;
let dt = 0.1;
let boundary = "dirichlet";
let running = true;
let simTime = 0;

let mouseDown = false;
let mouseX = 0,
    mouseY = 0;

const equations = {
    heat: "∂u/∂t = α∇²u",
    wave: "∂²u/∂t² = c²∇²u",
    laplace: "∇²u = 0",
    poisson: "∇²u = f(x,y)",
    diffusion: "∂u/∂t = D∇²u + f(u,v)",
};

function laplacian(arr, i, j) {
    const dx = 1.0;
    return (
        (arr[i + 1][j] +
            arr[i - 1][j] +
            arr[i][j + 1] +
            arr[i][j - 1] -
            4 * arr[i][j]) /
        (dx * dx)
    );
}

function applyBoundary(arr) {
    for (let i = 0; i < N; i++) {
        if (boundary === "dirichlet") {
            arr[0][i] = 0;
            arr[N - 1][i] = 0;
            arr[i][0] = 0;
            arr[i][N - 1] = 0;
        } else if (boundary === "neumann") {
            arr[0][i] = arr[1][i];
            arr[N - 1][i] = arr[N - 2][i];
            arr[i][0] = arr[i][1];
            arr[i][N - 1] = arr[i][N - 2];
        } else if (boundary === "periodic") {
            arr[0][i] = arr[N - 2][i];
            arr[N - 1][i] = arr[1][i];
            arr[i][0] = arr[i][N - 2];
            arr[i][N - 1] = arr[i][1];
        }
    }
}

function solveHeat() {
    for (let i = 1; i < N - 1; i++) {
        for (let j = 1; j < N - 1; j++) {
            const lap = laplacian(u_prev, i, j);
            u[i][j] = u_prev[i][j] + alpha * dt * lap;
        }
    }
    applyBoundary(u);
    [u, u_prev] = [u_prev, u];
}

function solveWave() {
    const c = 1.0; // Wave speed
    for (let i = 1; i < N - 1; i++) {
        for (let j = 1; j < N - 1; j++) {
            const lap = laplacian(u_prev, i, j);
            const new_u = 2 * u_prev[i][j] - u[i][j] + c * c * dt * dt * lap;
            u[i][j] = new_u;
        }
    }
    applyBoundary(u);
    // Swap arrays
    const temp = u_prev;
    u_prev = u;
    u = temp;
}

function solveLaplace() {
    // Jacobi iteration for Laplace equation
    for (let iter = 0; iter < 5; iter++) {
        for (let i = 1; i < N - 1; i++) {
            for (let j = 1; j < N - 1; j++) {
                u[i][j] =
                    0.25 *
                    (u_prev[i + 1][j] +
                        u_prev[i - 1][j] +
                        u_prev[i][j + 1] +
                        u_prev[i][j - 1]);
            }
        }
        applyBoundary(u);
        [u, u_prev] = [u_prev, u];
    }
}

function solvePoisson() {
    // Poisson with source term
    for (let iter = 0; iter < 5; iter++) {
        for (let i = 1; i < N - 1; i++) {
            for (let j = 1; j < N - 1; j++) {
                // The source term is approximated for a Gaussian source at center
                const source = Math.exp(
                    -((i - N / 2) * (i - N / 2) + (j - N / 2) * (j - N / 2)) / 200
                );
                // Corrected: u_new = 0.25 * (u_neighbors - source * (dx*dx))
                u[i][j] =
                    0.25 *
                    (u_prev[i + 1][j] +
                        u_prev[i - 1][j] +
                        u_prev[i][j + 1] +
                        u_prev[i][j - 1] -
                        source);
            }
        }
        applyBoundary(u);
        [u, u_prev] = [u_prev, u];
    }
}

function solveReactionDiffusion() {
    // Gray-Scott model
    const Du = 0.16;
    const Dv = 0.08;
    const F = 0.06;
    const k = 0.062;

    for (let i = 1; i < N - 1; i++) {
        for (let j = 1; j < N - 1; j++) {
            const lapU = laplacian(u_prev, i, j);
            const lapV = laplacian(v, i, j);

            const uvv = u_prev[i][j] * v[i][j] * v[i][j];

            u[i][j] =
                u_prev[i][j] + dt * (Du * lapU - uvv + F * (1 - u_prev[i][j]));
            v[i][j] = v[i][j] + dt * (Dv * lapV + uvv - (F + k) * v[i][j]);

            u[i][j] = Math.max(0, Math.min(1, u[i][j]));
            v[i][j] = Math.max(0, Math.min(1, v[i][j]));
        }
    }
    applyBoundary(u);
    [u, u_prev] = [u_prev, u];
}

function step() {
    switch (pdeType) {
        case "heat":
            solveHeat();
            break;
        case "wave":
            solveWave();
            break;
        case "laplace":
            solveLaplace();
            break;
        case "poisson":
            solvePoisson();
            break;
        case "diffusion":
            solveReactionDiffusion();
            break;
    }
    simTime += dt;
}

function calculateStats() {
    let maxVal = 0;
    let energy = 0;

    for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
            maxVal = Math.max(maxVal, Math.abs(u_prev[i][j]));
            energy += u_prev[i][j] * u_prev[i][j];
        }
    }

    return { maxVal, energy };
}

function render() {
    const imageData = ctx.createImageData(canvas.width, canvas.height);
    const data = imageData.data;

    // Calculate separate scales to fill the screen
    const SCALE_X = canvas.width / N;
    const SCALE_Y = canvas.height / N;

    let maxVal = 0;
    for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
            maxVal = Math.max(maxVal, Math.abs(u_prev[i][j]));
        }
    }

    for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
            const val = u_prev[i][j];
            const normalized = maxVal > 0 ? val / maxVal : 0;

            const a = Math.round(Math.min(1, Math.abs(normalized)) * 225);
            const r = normalized >= 0 ? 214 : 29;
            const g = normalized >= 0 ? 58 : 95;
            const b = normalized >= 0 ? 34 : 167;

            // Use SCALE_X and SCALE_Y for correct drawing
            const startX = Math.floor(i * SCALE_X);
            const startY = Math.floor(j * SCALE_Y);
            const endX = Math.floor((i + 1) * SCALE_X);
            const endY = Math.floor((j + 1) * SCALE_Y);

            for (let px = startX; px < endX && px < canvas.width; px++) {
                for (let py = startY; py < endY && py < canvas.height; py++) {
                    const idx = (py * canvas.width + px) * 4;
                    data[idx] = r;
                    data[idx + 1] = g;
                    data[idx + 2] = b;
                    data[idx + 3] = a;
                }
            }
        }
    }

    ctx.putImageData(imageData, 0, 0);
}

function animate() {
    if (running) {
        step();

        const stats = calculateStats();
        document.getElementById("time").textContent = simTime.toFixed(2);
        document.getElementById("max-val").textContent =
            stats.maxVal.toFixed(4);
        document.getElementById("energy").textContent =
            stats.energy.toFixed(2);
    }

    render();
    requestAnimationFrame(animate);
}

function addHeat(x, y, value) {
    // Map mouse coordinates to grid indices
    const i = Math.floor((x / canvas.width) * N);
    const j = Math.floor((y / canvas.height) * N);

    if (i >= 0 && i < N && j >= 0 && j < N) {
        for (let di = -2; di <= 2; di++) {
            for (let dj = -2; dj <= 2; dj++) {
                const ni = i + di;
                const nj = j + dj;
                if (ni >= 0 && ni < N && nj >= 0 && nj < N) {
                    u_prev[ni][nj] += value * Math.exp(-(di * di + dj * dj) / 2);
                    if (pdeType === "diffusion") {
                        v[ni][nj] = 0.25;
                    }
                }
            }
        }
    }
}

canvas.addEventListener("mousedown", (e) => {
    mouseDown = true;
    mouseX = e.clientX;
    mouseY = e.clientY;
    addHeat(mouseX, mouseY, 1.0);
});

canvas.addEventListener("mouseup", () => {
    mouseDown = false;
});

canvas.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (mouseDown) {
        addHeat(mouseX, mouseY, 0.5);
    }
});

document.getElementById("pde-type").addEventListener("change", (e) => {
    pdeType = e.target.value;
    document.getElementById("equation-display").textContent =
        equations[pdeType];
    // Reset the field when switching PDE types for stability
    document.getElementById("reset").click();
    if (pdeType === "diffusion") {
        for (let i = 0; i < N; i++) {
            for (let j = 0; j < N; j++) {
                u_prev[i][j] = 1.0;
                v[i][j] = 0;
            }
        }
    }
});

document.getElementById("alpha").addEventListener("input", (e) => {
    alpha = parseFloat(e.target.value);
    document.getElementById("alpha-val").textContent = alpha.toFixed(2);
});

document.getElementById("dt").addEventListener("input", (e) => {
    dt = parseFloat(e.target.value);
    document.getElementById("dt-val").textContent = dt.toFixed(2);
});

document.getElementById("boundary").addEventListener("change", (e) => {
    boundary = e.target.value;
});

document.getElementById("reset").addEventListener("click", () => {
    u = Array(N)
        .fill()
        .map(() => Array(N).fill(0));
    u_prev = Array(N)
        .fill()
        .map(() => Array(N).fill(0));
    v = Array(N)
        .fill()
        .map(() => Array(N).fill(0));
    simTime = 0;
});

document.getElementById("toggle").addEventListener("click", () => {
    running = !running;
});

document.getElementById("preset").addEventListener("click", () => {
    for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
            u_prev[i][j] =
                Math.sin((i * Math.PI) / N) * Math.sin((j * Math.PI) / N);
            if (pdeType === "diffusion") {
                u_prev[i][j] = 1.0;
                if (Math.abs(i - N / 2) < 10 && Math.abs(j - N / 2) < 10) {
                    v[i][j] = 0.25;
                }
            }
        }
    }
});

animate();