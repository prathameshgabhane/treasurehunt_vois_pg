/* ===================================================================
   Full script.js for Treasure Hunt App
   - Paste Firebase config into firebaseConfig below
   - This file provides team login, task navigation, time tracking,
     progress saving, leaderboard with ranking rules, and admin tools.
   =================================================================== */

/* =========================
   Firebase initialization
   ========================= */
// TODO: replace with your real Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBzIQZ_sj3m95_bEP16yzyyDL37cZjUZd0",
  authDomain: "treasure-hunt-game-1f9e6.firebaseapp.com",
  projectId: "treasure-hunt-game-1f9e6",
  storageBucket: "treasure-hunt-game-1f9e6.firebasestorage.app",
  messagingSenderId: "662097284199",
  appId: "1:662097284199:web:e2cbd6b3ff7bb219fa18c2",
  measurementId: "G-5BF32EW0CT"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

/* =========================
   Constants & utilities
   ========================= */
const TOTAL_TASKS = 5;
const LEADERBOARD_POLL_INTERVAL_MS = 5000; // admin/autorefresh interval

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function parseProgressString(progressStr) {
  // progressStr like "3/5". Return integer (3). If malformed, return 0
  if (!progressStr || typeof progressStr !== "string") return 0;
  const parts = progressStr.split("/");
  const v = parseInt(parts[0], 10);
  return isNaN(v) ? 0 : v;
}

function downloadFile(filename, content, mime = 'text/csv') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, 500);
}

/* =========================
   Team login & validation
   ========================= */
function setTeamId() {
  const input = document.getElementById('teamId');
  if (!input) {
    console.error("No #teamId element found on page.");
    return;
  }
  const teamId = input.value.trim();
  if (!teamId) {
    alert("Please enter a valid Team ID.");
    return;
  }

  // Store locally for session use
  localStorage.setItem('teamId', teamId);

  // Optionally create the team node if not exists
  const teamRef = db.ref(`teams/${teamId}`);
  teamRef.once('value').then(snap => {
    if (!snap.exists()) {
      // seed minimal structure
      teamRef.set({
        createdAt: nowSeconds(),
        progress: "0/" + TOTAL_TASKS,
        completedTasks: 0
      }).then(() => {
        window.location.href = 'ghdybt.html';
      });
    } else {
      window.location.href = 'ghdybt.html';
    }
  }).catch(err => {
    console.error("Error creating/reading team node:", err);
    alert("Error accessing database.");
  });
}

/* =========================
   Navigation helpers
   ========================= */
function goToTask(n) {
  if (!n || n < 1 || n > TOTAL_TASKS) {
    console.warn("Invalid task number:", n);
    return;
  }
  window.location.href = `task${n}.html`;
}

/* =========================
   Timer handling per-team
   - We store startTime on DB when team starts (if not already started).
   - When team finishes (i.e., completes all tasks), we store timeTakenSeconds.
   - Also allow manual stop/save (admin or finish page).
   ========================= */
function startTimerIfNeeded(teamId) {
  if (!teamId) return;
  const teamRef = db.ref(`teams/${teamId}`);
  teamRef.transaction(current => {
    if (current === null) {
      return {
        createdAt: nowSeconds(),
        startedAt: nowSeconds(),
        progress: "0/" + TOTAL_TASKS,
        completedTasks: 0
      };
    }
    // If not started, set startedAt
    if (!current.startedAt) {
      current.startedAt = nowSeconds();
    }
    return current;
  }, (err, committed, snapshot) => {
    if (err) {
      console.error("startTimerIfNeeded transaction error:", err);
    }
  });
}

function stopTimerAndSave(teamId) {
  if (!teamId) return Promise.reject("No teamId");
  const teamRef = db.ref(`teams/${teamId}`);
  return teamRef.once('value').then(snap => {
    const data = snap.val() || {};
    if (!data.startedAt) {
      // no start time => cannot compute duration
      return Promise.resolve(null);
    }
    // If time already saved, keep it (don't override unless admin)
    if (data.time && typeof data.time === 'number') {
      return Promise.resolve(data.time);
    }
    const duration = nowSeconds() - Number(data.startedAt);
    return teamRef.update({ time: Number(duration) }).then(() => duration);
  });
}

/* =========================
   Save progress/answers logic
   - saveAnswer stores an answer keyed by task number
   - saveProgress updates completedTasks & progress string
   - when completedTasks == TOTAL_TASKS, it finalizes time (if not set)
   ========================= */
function saveAnswer(taskNumber, answerObj) {
  const teamId = localStorage.getItem('teamId');
  if (!teamId) {
    alert("Team ID not found. Please login again.");
    window.location.href = 'index.html';
    return;
  }
  const answerRef = db.ref(`teams/${teamId}/answers/task${taskNumber}`);
  return answerRef.set({
    ...answerObj,
    savedAt: nowSeconds()
  });
}

function saveProgress(taskNumber, markCompleted = true) {
  const teamId = localStorage.getItem('teamId');
  if (!teamId) {
    alert("Team ID not found. Please login again.");
    window.location.href = 'index.html';
    return;
  }

  const teamRef = db.ref(`teams/${teamId}`);

  return teamRef.transaction(current => {
    if (!current) {
      current = { createdAt: nowSeconds(), startedAt: nowSeconds(), completedTasks: 0, progress: `0/${TOTAL_TASKS}` };
    }
    let completed = current.completedTasks ? Number(current.completedTasks) : 0;
    if (markCompleted && taskNumber > completed) {
      completed = taskNumber;
    }
    current.completedTasks = completed;
    current.progress = `${completed}/${TOTAL_TASKS}`;
    // If all tasks completed and time not already set, set time
    if (completed >= TOTAL_TASKS && !current.time) {
      // If startedAt exists, store elapsed; otherwise set time to 0
      if (current.startedAt) {
        current.time = nowSeconds() - Number(current.startedAt);
      } else {
        current.time = 0;
      }
    }
    return current;
  }, (err, committed, snapshot) => {
    if (err) {
      console.error("saveProgress transaction error:", err);
    }
  });
}

/* =========================
   Leaderboard rendering & ranking logic
   Rules:
     - Teams with numeric `time` sorted ascending (least time first).
     - Teams without time sorted by progress (descending).
     - Ties by teamId (alphabetical).
     - Ranks sequential across merged list.
   ========================= */
let leaderboardListenerRef = null;

function loadLeaderboard(onUpdateCallback) {
  // If a listener is already attached, detach first
  if (leaderboardListenerRef) {
    leaderboardListenerRef.off();
  }
  leaderboardListenerRef = db.ref('teams');
  leaderboardListenerRef.on('value', (snapshot) => {
    const data = [];
    snapshot.forEach(childSnap => {
      const val = childSnap.val() || {};
      data.push({
        teamId: childSnap.key,
        time: (val.time !== undefined && val.time !== null && !isNaN(val.time)) ? Number(val.time) : null,
        progress: val.progress ? String(val.progress) : `0/${TOTAL_TASKS}`,
        completedTasks: val.completedTasks ? Number(val.completedTasks) : parseProgressString(val.progress),
        raw: val
      });
    });

    const leaderboard = computeLeaderboardRanking(data);
    if (typeof onUpdateCallback === 'function') {
      onUpdateCallback(leaderboard);
    } else {
      renderLeaderboardTable(leaderboard);
    }
  }, (err) => {
    console.error("loadLeaderboard error:", err);
  });
}

function computeLeaderboardRanking(rows) {
  // Defensive copy
  const entries = rows.map(r => ({ ...r }));
  const withTime = entries.filter(e => e.time !== null && !isNaN(e.time));
  const withoutTime = entries.filter(e => e.time === null || isNaN(e.time));

  // Sort withTime: ascending by time, tie -> progress desc -> teamId
  withTime.sort((a, b) => {
    if (a.time !== b.time) return a.time - b.time;
    const aProg = parseProgressString(a.progress);
    const bProg = parseProgressString(b.progress);
    if (bProg !== aProg) return bProg - aProg;
    return a.teamId.localeCompare(b.teamId);
  });

  // Sort withoutTime: by progress descending, tie -> teamId
  withoutTime.sort((a, b) => {
    const aProg = parseProgressString(a.progress);
    const bProg = parseProgressString(b.progress);
    if (bProg !== aProg) return bProg - aProg;
    return a.teamId.localeCompare(b.teamId);
  });

  // Merge
  const merged = [...withTime, ...withoutTime];

  // Assign ranks sequentially; if you want blank ranks for no-time teams replace with null
  merged.forEach((entry, idx) => {
    entry.rank = idx + 1;
  });

  return merged;
}

/* Render into table element #leaderboardBody if present */
function renderLeaderboardTable(leaderboard) {
  const tableBody = document.getElementById('leaderboardBody');
  if (!tableBody) {
    // If table not present, maybe this page doesn't show leaderboard
    return;
  }
  tableBody.innerHTML = '';

  leaderboard.forEach(entry => {
    const tr = document.createElement('tr');
    const timeDisplay = (entry.time !== null && entry.time !== undefined) ? formatTimeSeconds(entry.time) + ` (${entry.time}s)` : '-';
    tr.innerHTML = `
      <td>${entry.rank}</td>
      <td>${escapeHtml(entry.teamId)}</td>
      <td>${escapeHtml(entry.progress)}</td>
      <td>${timeDisplay}</td>
    `;
    tableBody.appendChild(tr);
  });
}

/* Format seconds to hh:mm:ss simple display */
function formatTimeSeconds(s) {
  if (s === null || s === undefined || isNaN(s)) return '-';
  s = Number(s);
  const hours = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const parts = [];
  if (hours > 0) parts.push(String(hours).padStart(2, '0'));
  parts.push(String(mins).padStart(2, '0'));
  parts.push(String(secs).padStart(2, '0'));
  return parts.join(':');
}

/* Small HTML sanitizer for teamId display */
function escapeHtml(unsafe) {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* =========================
   Admin tools
   - resetTeam(teamId): clears progress/time/answers
   - exportLeaderboardCSV(): pulls leaderboard and downloads csv
   - adminRefresh(): manual refresh render in admin table
   ========================= */
function resetTeam(teamId) {
  if (!teamId) {
    alert("No teamId provided to reset.");
    return;
  }
  if (!confirm(`Reset data for ${teamId}? This will remove answers, progress and times.`)) return;

  const teamRef = db.ref(`teams/${teamId}`);
  teamRef.remove().then(() => {
    alert(`Team ${teamId} reset.`);
  }).catch(err => {
    console.error("Reset error:", err);
    alert("Reset failed, check console.");
  });
}

function exportLeaderboardCSV() {
  // get snapshot once
  db.ref('teams').once('value').then(snapshot => {
    const rows = [];
    snapshot.forEach(child => {
      const val = child.val() || {};
      rows.push({
        teamId: child.key,
        progress: val.progress || `0/${TOTAL_TASKS}`,
        completedTasks: val.completedTasks || parseProgressString(val.progress),
        time: (val.time !== undefined && val.time !== null) ? Number(val.time) : ''
      });
    });

    const ranked = computeLeaderboardRanking(rows);
    // Build CSV
    const header = ['Rank', 'TeamId', 'Progress', 'CompletedTasks', 'TimeSeconds', 'TimeDisplay'];
    const csvRows = [header.join(',')];
    ranked.forEach(r => {
      const timeDisplay = (r.time !== null && r.time !== '') ? formatTimeSeconds(r.time) : '';
      csvRows.push([r.rank, `"${r.teamId}"`, `"${r.progress}"`, r.completedTasks, r.time, `"${timeDisplay}"`].join(','));
    });
    const csvContent = csvRows.join('\n');
    downloadFile('leaderboard_export.csv', csvContent, 'text/csv');
  });
}

let adminPollHandle = null;
function adminStartAutoRefresh() {
  if (adminPollHandle) return; // already running
  adminPollHandle = setInterval(() => {
    adminRefresh();
  }, LEADERBOARD_POLL_INTERVAL_MS);
}
function adminStopAutoRefresh() {
  if (!adminPollHandle) return;
  clearInterval(adminPollHandle);
  adminPollHandle = null;
}

function adminRefresh() {
  // Fill an admin table with extra details - element id #adminTableBody
  db.ref('teams').once('value').then(snapshot => {
    const rows = [];
    snapshot.forEach(child => {
      const val = child.val() || {};
      rows.push({
        teamId: child.key,
        progress: val.progress || `0/${TOTAL_TASKS}`,
        completedTasks: val.completedTasks || parseProgressString(val.progress),
        time: (val.time !== undefined && val.time !== null) ? Number(val.time) : null,
        startedAt: val.startedAt || null,
        raw: val
      });
    });

    const ranked = computeLeaderboardRanking(rows);
    const tbody = document.getElementById('adminTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    ranked.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.rank}</td>
        <td>${escapeHtml(r.teamId)}</td>
        <td>${escapeHtml(r.progress)}</td>
        <td>${r.time !== null ? formatTimeSeconds(r.time) + ' (' + r.time + 's)' : '-'}</td>
        <td>${r.startedAt ? new Date(r.startedAt * 1000).toLocaleString() : '-'}</td>
        <td>
          <button onclick="resetTeam('${r.teamId}')">Reset</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  });
}

/* =========================
   Page specific bindings
   - On pages that have specific elements we auto-bind.
   - Use HTML element IDs:
     - index.html: #teamId input, #startBtn button (calls setTeamId)
     - task pages: #answerInput, #saveBtn, #nextBtn, #finishBtn
     - leaderboard.html: table with #leaderboardBody
     - admin.html: #adminTableBody, #exportBtn, #autoRefreshBtn
   ========================= */
function bindIndexPage() {
  const startBtn = document.getElementById('startBtn');
  if (startBtn) {
    startBtn.addEventListener('click', setTeamId);
  }
  // If there's previously stored Team ID, show it
  const stored = localStorage.getItem('teamId');
  const input = document.getElementById('teamId');
  if (stored && input) input.value = stored;
}

function bindTaskPage(taskNumber) {
  // Start timer if needed
  const teamId = localStorage.getItem('teamId');
  if (!teamId) {
    alert("Team ID not set. Redirecting to home.");
    window.location.href = 'index.html';
    return;
  }
  startTimerIfNeeded(teamId);

  // UI elements
  const saveBtn = document.getElementById('saveBtn');
  const nextBtn = document.getElementById('nextBtn');
  const finishBtn = document.getElementById('finishBtn');

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const answerInput = document.getElementById('answerInput');
      const answerText = answerInput ? answerInput.value.trim() : '';
      saveAnswer(taskNumber, { answer: answerText })
        .then(() => alert('Answer saved.'))
        .catch(err => { console.error(err); alert('Save failed.'); });
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      // mark task completed
      saveProgress(taskNumber, true).then(() => {
        if (taskNumber < TOTAL_TASKS) {
          goToTask(taskNumber + 1);
        } else {
          alert("That was the last task.");
        }
      });
    });
  }

  if (finishBtn) {
    finishBtn.addEventListener('click', () => {
      // mark all completed and stop timer
      saveProgress(TOTAL_TASKS, true).then(() => {
        stopTimerAndSave(teamId).then(duration => {
          alert('Finished! Your time: ' + (duration !== null ? formatTimeSeconds(duration) : 'N/A'));
          window.location.href = 'dashboard.html';
        });
      });
    });
  }
}

function bindLeaderboardPage() {
  // Load leaderboard and render
  loadLeaderboard(renderLeaderboardTable);
  // If you want auto-refresh via DB listener, it's already live - no polling needed.
}

function bindAdminPage() {
  const exportBtn = document.getElementById('exportBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const autoToggleBtn = document.getElementById('autoRefreshBtn');

  if (exportBtn) exportBtn.addEventListener('click', exportLeaderboardCSV);
  if (refreshBtn) refreshBtn.addEventListener('click', adminRefresh);
  if (autoToggleBtn) {
    autoToggleBtn.addEventListener('click', () => {
      if (adminPollHandle) {
        adminStopAutoRefresh();
        autoToggleBtn.textContent = 'Start Auto Refresh';
      } else {
        adminStartAutoRefresh();
        autoToggleBtn.textContent = 'Stop Auto Refresh';
      }
    });
  }

  // initial refresh to fill table
  adminRefresh();
  // start DB listener for leaderboard view as well (if you want live updates)
  loadLeaderboard(() => { adminRefresh(); });
}

/* Attach to window for onclick references in HTML buttons (if using inline handlers) */
window.setTeamId = setTeamId;
window.goToTask = goToTask;
window.saveAnswer = saveAnswer;
window.saveProgress = saveProgress;
window.startTimerIfNeeded = startTimerIfNeeded;
window.stopTimerAndSave = stopTimerAndSave;
window.loadLeaderboard = loadLeaderboard;
window.resetTeam = resetTeam;
window.exportLeaderboardCSV = exportLeaderboardCSV;
window.adminRefresh = adminRefresh;

/* =========================
   Small logic to auto-bind depending on page content
   Call this on page load
   ========================= */
document.addEventListener('DOMContentLoaded', () => {
  try {
    // index page detection
    if (document.getElementById('startBtn') && document.getElementById('teamId')) {
      bindIndexPage();
    }

    // Task pages - expecting an element like <body data-task="1">
    const body = document.body;
    if (body && body.dataset && body.dataset.task) {
      const t = parseInt(body.dataset.task, 10);
      if (!isNaN(t) && t >= 1 && t <= TOTAL_TASKS) {
        bindTaskPage(t);
      }
    }

    // Leaderboard page
    if (document.getElementById('leaderboardBody')) {
      bindLeaderboardPage();
    }

    // Admin page
    if (document.getElementById('adminTableBody')) {
      bindAdminPage();
    }
  } catch (err) {
    console.error("Error during auto-bind:", err);
  }
});

