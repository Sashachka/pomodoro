// --- Timer durations for each mode (in SECONDS) ---
// These are just the starting values; the inputs can change them.
const DURATIONS = {
  work: 25 * 60,
  short: 5 * 60,
  long: 15 * 60,
};

// --- State ---
let mode = "work";          // "work" | "short" | "long"
let timeLeft = DURATIONS[mode]; // seconds remaining
let intervalId = null;      // set when running, null when stopped
let completed = 0;          // number of finished work sessions

// --- Elements ---
const clockEl = document.getElementById("clock");
const startBtn = document.getElementById("start");
const resetBtn = document.getElementById("reset");
const countEl = document.getElementById("count");
const modeBtns = document.querySelectorAll(".mode-btn");

// Minutes + seconds boxes that follow whatever mode is active.
const minutesInput = document.getElementById("minutes-input");
const secondsInput = document.getElementById("seconds-input");
const durationLabel = document.getElementById("duration-label");

// The label text shown above the boxes for each mode.
const LABELS = {
  work: "Work",
  short: "Short break",
  long: "Long break",
};

// Friendly names used in the celebration message.
const MODE_NAMES = {
  work: "work session",
  short: "short break",
  long: "long break",
};

// --- Display helpers ---
// Turn a number of seconds into a "MM:SS" string.
function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function render() {
  const text = formatTime(timeLeft);
  clockEl.textContent = text;
  document.title = `${text} — Pomodoro`;
}

function setMode(newMode) {
  mode = newMode;
  timeLeft = DURATIONS[mode];
  stop();

  // Update the active button and body background
  modeBtns.forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
  document.body.className = mode;

  syncInput();
  render();
}

// Point the boxes at the current mode: label, and minutes/seconds split.
function syncInput() {
  const total = DURATIONS[mode];
  durationLabel.textContent = LABELS[mode];
  minutesInput.value = Math.floor(total / 60);
  secondsInput.value = total % 60;
}

// --- Read the two boxes, validate, and store total seconds for this mode ---
function applyInput() {
  const minutes = Number(minutesInput.value); // .value is a string → make it a number
  const seconds = Number(secondsInput.value);

  // Reject blanks, letters (NaN), and negatives in either box.
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds) ||
      minutes < 0 || seconds < 0) {
    syncInput(); // put the last good values back
    return;
  }

  const total = Math.round(minutes * 60 + seconds);

  // A timer of zero makes no sense — reject and restore.
  if (total <= -1) {
    syncInput();
    return;
  }

  DURATIONS[mode] = total;

  // If the timer isn't running, refresh the clock so the new time shows now.
  if (intervalId === null) {
    timeLeft = total;
  }

  // Re-fill the boxes from the stored value so e.g. 90s tidies up to 1:30.
  syncInput();
  render();
}

// --- Start / pause / stop ---
function start() {
  if (intervalId !== null) {
    // Currently running → pause
    stop();
    return;
  }

  intervalId = setInterval(tick, 1000);
  startBtn.textContent = "Pause";
}

function stop() {
  clearInterval(intervalId);
  intervalId = null;
  startBtn.textContent = "Start";
}

function tick() {
  timeLeft--;
  render();

  if (timeLeft <= 0) {
    finishSession();
  }
}

function finishSession() {
  stop();
  beep();

  // Capture what just finished BEFORE setMode() switches the mode away.
  const finishedMode = mode;
  const finishedSeconds = DURATIONS[mode];

  if (mode === "work") {
    completed++;
    countEl.textContent = completed;
    // After every 4 work sessions, take a long break
    setMode(completed % 4 === 0 ? "long" : "short");
  } else {
    setMode("work");
  }

  celebrate(finishedSeconds, finishedMode);
}

// --- Sound: a short beep using the Web Audio API (no audio file needed) ---
function beep() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "sine";
  osc.frequency.value = 880;
  gain.gain.value = 0.2;
  osc.start();
  osc.stop(ctx.currentTime + 0.4);
}

// --- Celebration: fireworks + a pop-up message ------------------------------

const canvas = document.getElementById("fx");
const ctx = canvas.getContext("2d");
const toastEl = document.getElementById("toast");

// Keep the canvas the size of the window.
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// One spark of a firework.
class Particle {
  constructor(x, y, radius, color, velocity) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.color = color;
    this.velocity = velocity;
    this.alpha = 1;
    this.gravity = 0.03;
    this.friction = 0.99;
  }

  draw() {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 20;
    ctx.shadowColor = this.color;
    ctx.fill();
    ctx.closePath();
    ctx.restore();
  }

  update() {
    this.draw();
    this.velocity.x *= this.friction;
    this.velocity.y *= this.friction;
    this.velocity.y += this.gravity;
    this.x += this.velocity.x;
    this.y += this.velocity.y;
    this.alpha -= 0.01;
  }
}

let particles = [];

function animateFireworks() {
  requestAnimationFrame(animateFireworks);

  if (particles.length === 0) {
    // No sparks left — wipe the canvas fully clean so no faint residue
    // ("silhouette") lingers from the fading trails.
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  // Fade the previous frame toward transparent (not black), so the canvas
  // stays see-through over the page while still leaving glowing trails.
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = "source-over";

  particles.forEach((particle, i) => {
    if (particle.alpha <= 0) {
      particles.splice(i, 1);
    } else {
      particle.update();
    }
  });
}
animateFireworks();

// Explode a ring of sparks at (x, y).
function launchFirework(x, y) {
  const particleCount = 200;
  const angleIncrement = (Math.PI * 2) / particleCount;
  const baseHue = Math.random() * 360;

  for (let i = 0; i < particleCount; i++) {
    const speed = Math.random() * 6;
    particles.push(
      new Particle(x, y, Math.random() * 2 + 1,
        `hsl(${baseHue + i * 2}, 70%, 60%)`,
        {
          x: Math.cos(angleIncrement * i) * speed,
          y: Math.sin(angleIncrement * i) * speed,
        }
      )
    );
  }
}

let toastTimer = null;

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 4000);
}

// Fire off a few bursts and show the finished-session message.
function celebrate(seconds, finishedMode) {
  showToast(`The ${formatTime(seconds)} ${MODE_NAMES[finishedMode]} is finished! Let's continue :3`);

  launchFirework(window.innerWidth / 2, window.innerHeight / 3);
  setTimeout(() => launchFirework(window.innerWidth * 0.3, window.innerHeight * 0.4), 250);
  setTimeout(() => launchFirework(window.innerWidth * 0.7, window.innerHeight * 0.35), 450);
}

// Greet the user on load — a different message for first-timers vs. returners.
function greetUser() {
  let returning = false;

  // localStorage persists per-site across visits. It can throw in private
  // mode or some file:// setups, so guard it — worst case we just say hello.
  try {
    returning = localStorage.getItem("pomodoroVisited") === "yes";
    localStorage.setItem("pomodoroVisited", "yes");
  } catch (e) {
    // Storage unavailable — fall back to the first-time greeting.
  }

  if (returning) {
    showToast("Welcome back! Ready for another round? :3");
  } else {
    showToast("Welcome to your Pomodoro timer! Let's focus :3");
  }
}

// --- Wire up events ---
startBtn.addEventListener("click", start);

resetBtn.addEventListener("click", () => {
  stop();
  timeLeft = DURATIONS[mode];
  render();
});

modeBtns.forEach((btn) => {
  btn.addEventListener("click", () => setMode(btn.dataset.mode));
});

// When either box changes, validate and apply it to the current mode.
minutesInput.addEventListener("change", applyInput);
secondsInput.addEventListener("change", applyInput);

// --- Initial paint ---
document.body.className = mode;
syncInput();
render();

// Small delay so the page settles first, then the greeting pops in smoothly.
setTimeout(greetUser, 400);
