// 🌟 Team starts the hunt
function setTeamId() {
    const teamId = document.getElementById("teamId").value.trim();

    if (teamId === "") {
        alert("⚠️ Please enter your Team ID to begin.");
        return;
    }

    // Store team ID in browser memory
    localStorage.setItem("teamId", teamId);

    // Redirect to Task 1 page
    window.location.href = "ghdybt.html";
}

// 🛠️ Admin accesses dashboard
function goToAdmin() {
    window.location.href = "admin.html";
}