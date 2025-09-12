// ============================
// 🌟 Team starts the hunt
// ============================
function setTeamId() {
    const teamId = document.getElementById("teamId").value.trim();

    if (teamId === "") {
        alert("Please enter a valid Team ID");
        return;
    }

    localStorage.setItem("teamId", teamId);
    window.location.href = "task1.html"; // Start from Task 1
}

// ============================
// 🌟 Navigate between tasks
// ============================
function goToTask(taskNumber) {
    window.location.href = `task${taskNumber}.html`;
}

// ============================
// 🌟 Save team progress
// ============================
function saveProgress(taskNumber, isCompleted = false) {
    const teamId = localStorage.getItem("teamId");
    if (!teamId) {
        alert("Team ID not found! Please restart.");
        window.location.href = "index.html";
        return;
    }

    const dbRef = firebase.database().ref("teams/" + teamId);

    dbRef.once("value").then(snapshot => {
        let data = snapshot.val() || {};
        let completedTasks = data.completedTasks || 0;

        if (isCompleted) {
            completedTasks = Math.max(completedTasks, taskNumber); // update progress
        }

        let progress = `${completedTasks}/5`;

        dbRef.update({
            progress: progress,
            completedTasks: completedTasks
        });

        if (taskNumber < 5) {
            goToTask(taskNumber + 1);
        } else {
            alert("🎉 Congratulations! You have finished all tasks!");
        }
    });
}

// ============================
// 🌟 Fetch leaderboard
// ============================
function loadLeaderboard() {
    const dbRef = firebase.database().ref("teams");
    dbRef.on("value", (snapshot) => {
        const data = [];
        snapshot.forEach((childSnapshot) => {
            const val = childSnapshot.val();
            data.push({
                teamId: childSnapshot.key,
                time: val.time ? Number(val.time) : null,
                progress: val.progress ? val.progress : "0/5"
            });
        });
        updateLeaderboard(data);
    });
}

// ============================
// 🌟 Update leaderboard
// ============================
function updateLeaderboard(data) {
    // Split teams into with-time and without-time
    const withTime = data.filter(entry => entry.time !== null && !isNaN(entry.time));
    const withoutTime = data.filter(entry => entry.time === null || isNaN(entry.time));

    // Sort with-time by ascending time
    withTime.sort((a, b) => a.time - b.time);

    // Sort without-time by progress (descending)
    withoutTime.sort((a, b) => {
        const aProgress = parseInt(a.progress.split("/")[0]);
        const bProgress = parseInt(b.progress.split("/")[0]);
        if (bProgress !== aProgress) {
            return bProgress - aProgress; // higher progress first
        }
        return a.teamId.localeCompare(b.teamId); // tie-breaker by teamId
    });

    // Merge both lists
    const leaderboard = [...withTime, ...withoutTime];

    // Assign ranks in sequence
    leaderboard.forEach((entry, index) => {
        entry.rank = index + 1;
    });

    // Render leaderboard
    const tableBody = document.getElementById("leaderboardBody");
    if (!tableBody) return; // avoid errors if leaderboard page not loaded
    tableBody.innerHTML = "";

    leaderboard.forEach(entry => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${entry.rank}</td>
            <td>${entry.teamId}</td>
            <td>${entry.progress}</td>
            <td>${entry.time !== null ? entry.time : "-"}</td>
        `;
        tableBody.appendChild(row);
    });
}
