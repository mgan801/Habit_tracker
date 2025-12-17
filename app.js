// ---------- Utilities ----------
const fmtDate = (d) => d.toISOString().split("T")[0];
const parseYYYYMMDD = (s) => new Date(s + "T00:00:00");

function getMonthDays(year, month) {
  const days = [];
  const first = new Date(year, month, 1);
  const nextMonth = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= nextMonth; day++) {
    days.push(new Date(year, month, day));
  }
  return days;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}

// ---------- Storage ----------
let habits = JSON.parse(localStorage.getItem("habits")) || [
  { name: "Read 20 Pages", completedDates: [] },
  { name: "Workout", completedDates: [] }
];

function saveHabits() {
  localStorage.setItem("habits", JSON.stringify(habits));
}

function addHabit(name) {
  if (!name) return;
  if (habits.some(h => h.name.toLowerCase() === name.toLowerCase())) return;
  habits.push({ name, completedDates: [] });
  saveHabits();
  render();
}

// ---------- Streaks and metrics ----------
function getCurrentStreak(habit) {
  // Count consecutive days ending today
  const today = new Date();
  const set = new Set(habit.completedDates);
  let streak = 0;
  for (let i = 0; ; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = fmtDate(d);
    if (set.has(key)) streak++;
    else break;
  }
  return streak;
}

function getMonthlyCompletion(habit, days) {
  const set = new Set(habit.completedDates);
  let done = 0;
  for (const d of days) if (set.has(fmtDate(d))) done++;
  const pct = days.length ? Math.round((done / days.length) * 100) : 0;
  return { done, total: days.length, pct };
}

// ---------- Toggle logic ----------
function toggleDay(habitIndex, dateStr, checked) {
  const habit = habits[habitIndex];
  const idx = habit.completedDates.indexOf(dateStr);
  if (checked && idx === -1) {
    habit.completedDates.push(dateStr);
  } else if (!checked && idx !== -1) {
    habit.completedDates.splice(idx, 1);
  }
  saveHabits();
  // Update only the metrics row pieces instead of full re-render for speed:
  updateHabitMetrics(habitIndex);
}

function updateHabitMetrics(habitIndex) {
  const habit = habits[habitIndex];
  const { days } = currentView;
  const streakEl = document.querySelector(`#streak-${habitIndex}`);
  const completionEl = document.querySelector(`#completion-${habitIndex}`);
  if (streakEl) streakEl.textContent = `${getCurrentStreak(habit)}-day streak`;
  if (completionEl) {
    const { pct, done, total } = getMonthlyCompletion(habit, days);
    completionEl.textContent = `${pct}% (${done}/${total})`;
  }
}

// ---------- View state ----------
const today = new Date();
let currentView = {
  year: today.getFullYear(),
  month: today.getMonth(), // 0-11
  get days() { return getMonthDays(this.year, this.month); }
};

// ---------- Rendering ----------
function renderMonthLabel() {
  const label = document.getElementById("monthLabel");
  const dt = new Date(currentView.year, currentView.month, 1);
  const monthName = dt.toLocaleString(undefined, { month: "long", year: "numeric" });
  label.textContent = monthName;
}

function renderGrid() {
  const table = document.getElementById("habitGrid");
  const days = currentView.days;

  // Build header
  const thead = `
    <thead>
      <tr>
        <th class="habit-name">Habit</th>
        ${days.map(d => `<th title="${fmtDate(d)}">${d.getDate()}</th>`).join("")}
        <th>Streak</th>
        <th>Month</th>
      </tr>
    </thead>
  `;

  // Build body rows
  const tbodyRows = habits.map((habit, hIdx) => {
    const set = new Set(habit.completedDates);
    const cells = days.map(d => {
      const dateStr = fmtDate(d);
      const isDone = set.has(dateStr);
      const isToday = isSameDay(d, today);
      return `
        <td class="day-cell ${isToday ? "today" : ""}">
          <input
            type="checkbox"
            class="checkbox"
            ${isDone ? "checked" : ""}
            data-habit="${hIdx}"
            data-date="${dateStr}"
            aria-label="${habit.name} on ${dateStr}"
          />
        </td>
      `;
    }).join("");

    const streak = getCurrentStreak(habit);
    const { pct, done, total } = getMonthlyCompletion(habit, days);

    return `
      <tr>
        <td class="habit-name">${habit.name}</td>
        ${cells}
        <td class="streak" id="streak-${hIdx}">${streak}-day streak</td>
        <td class="completion" id="completion-${hIdx}">${pct}% (${done}/${total})</td>
      </tr>
    `;
  }).join("");

  table.innerHTML = `${thead}<tbody>${tbodyRows}</tbody>`;
}

function bindEvents() {
  // Month navigation
  document.getElementById("prevMonthBtn").addEventListener("click", () => {
    currentView.month--;
    if (currentView.month < 0) { currentView.month = 11; currentView.year--; }
    render();
  });
  document.getElementById("nextMonthBtn").addEventListener("click", () => {
    currentView.month++;
    if (currentView.month > 11) { currentView.month = 0; currentView.year++; }
    render();
  });

  // Add habit
  document.getElementById("addHabitBtn").addEventListener("click", () => {
    const input = document.getElementById("habitNameInput");
    const name = input.value.trim();
    addHabit(name);
    input.value = "";
  });

  // Delegate day toggles
  document.getElementById("habitGrid").addEventListener("change", (e) => {
    const el = e.target;
    if (el.classList.contains("checkbox")) {
      const habitIndex = parseInt(el.getAttribute("data-habit"), 10);
      const dateStr = el.getAttribute("data-date");
      toggleDay(habitIndex, dateStr, el.checked);
    }
  });

  // Export / Import
  document.getElementById("exportBtn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ habits }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `habits-${fmtDate(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  document.getElementById("importFile").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const data = JSON.parse(text);
    if (Array.isArray(data.habits)) {
      habits = data.habits.map(h => ({
        name: h.name,
        completedDates: Array.isArray(h.completedDates) ? h.completedDates : []
      }));
      saveHabits();
      render();
    }
    e.target.value = "";
  });
}

function render() {
  renderMonthLabel();
  renderGrid();
}

// ---------- Init ----------
document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  render();
});