// 🔥 Firebase-Enabled Treasure Hunt Game
// This version enables real-time multi-device data sharing

// 🚨 YOUR ACTUAL FIREBASE CONFIG (CONVERTED TO COMPAT FORMAT)
const firebaseConfig = {
  apiKey: "AIzaSyBzIQZ_sj3m95_bEP16yzyyDL37cZjUZd0",
  authDomain: "treasure-hunt-game-1f9e6.firebaseapp.com",
  projectId: "treasure-hunt-game-1f9e6",
  storageBucket: "treasure-hunt-game-1f9e6.firebasestorage.app",
  messagingSenderId: "662097284199",
  appId: "1:662097284199:web:e2cbd6b3ff7bb219fa18c2",
  measurementId: "G-5BF32EW0CT"
};

// Initialize Firebase//
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

class FirebaseTreasureHunt {
    constructor() {
        this.taskCodes = {
            1: "TC441",
            2: "TC242", 
            3: "TC803",
            4: "TC200",
            5: "WINNER"
        };
        
        this.clues = {
            1: "A place of passage, calm yet keen, where eyes unseen watch every scene.",
            2: "Shiny and proud, it waits on high,Where winners cheer and spirits fly(Right)",
            3: "If you lean down...you see the steps that move down 1 2 3.",
            4: "A space where minds connect and plans unfold, your next clue hides in plain sight. ((120+135) -200) /10",
            5: "🎊 CONGRATULATIONS! YOU WON! 🎊"
        };
        
        this.currentTeamId = null;
    }

    // 🔥 Firebase: Set team ID (creates team in Firestore if doesn't exist)
    async setTeamId(teamId) {
        if (!teamId || teamId.trim() === '') return false;
        
        teamId = teamId.trim().toUpperCase();
        this.currentTeamId = teamId;
        
        try {
            // Check if team exists, if not create it
            const teamRef = db.collection('teams').doc(teamId);
            const teamDoc = await teamRef.get();
            
            if (!teamDoc.exists) {
                // Create new team automatically (no pre-registration needed)
                await teamRef.set({
                    id: teamId,
                    completedTasks: 0,
                    currentTask: 1,
                    startTime: firebase.firestore.FieldValue.serverTimestamp(),
                    completionTime: null,
                    taskHistory: [],
                    status: 'active'
                });
                console.log(`🔥 Team ${teamId} created in Firebase`);
            }
            
            // Store current team in localStorage for session
            localStorage.setItem('currentTeamId', teamId);
            return true;
        } catch (error) {
            console.error('Error setting team ID:', error);
            return false;
        }
    }

    // 🔥 Firebase: Get current team ID
    getCurrentTeamId() {
        return this.currentTeamId || localStorage.getItem('currentTeamId');
    }

    // 🔥 Firebase: Verify task code against Firestore data
    async verifyTaskCode(teamId, expectedCode, actualCode) {
        if (!teamId || !actualCode) return false;
        
        try {
            const teamRef = db.collection('teams').doc(teamId);
            const teamDoc = await teamRef.get();
            
            if (!teamDoc.exists) {
                // Auto-create team if it doesn't exist
                await this.setTeamId(teamId);
                return false; // First time, need to complete previous tasks
            }
            
            const teamData = teamDoc.data();
            const currentTask = teamData.currentTask;
            
            // Check if this is the expected sequence
            if (expectedCode !== this.taskCodes[currentTask - 1]) {
                alert('Invalid sequence! Complete tasks in order.');
                return false;
            }
            
            if (actualCode.toUpperCase() !== expectedCode) {
                alert('Incorrect task code! Try again.');
                return false;
            }
            
            return true;
        } catch (error) {
            console.error('Error verifying task code:', error);
            return false;
        }
    }

    // 🔥 Firebase: Complete task (updates Firestore)
    async completeTask(taskNumber, teamId = null) {
        teamId = teamId || this.getCurrentTeamId();
        if (!teamId) {
            alert('No team ID set!');
            return false;
        }

        try {
            const teamRef = db.collection('teams').doc(teamId);
            const teamDoc = await teamRef.get();
            
            if (!teamDoc.exists) {
                // Auto-create team if needed
                await this.setTeamId(teamId);
            }

            const now = firebase.firestore.FieldValue.serverTimestamp();
            const regularTimestamp = new Date(); // Use regular Date for arrays
            
            // Update team progress
            const updates = {
                completedTasks: taskNumber,
                currentTask: taskNumber + 1,
                [`task${taskNumber}CompletedAt`]: now
            };
            
            // If this is the final task, mark as completed
            if (taskNumber === 5) {
                updates.completionTime = now;
                updates.status = 'completed';
                updates.currentTask = 'completed';
            }
            
            // Add to task history (use regular Date instead of serverTimestamp)
            const existingData = teamDoc.exists ? teamDoc.data() : {};
            const taskHistory = existingData.taskHistory || [];
            taskHistory.push({
                taskNumber: taskNumber,
                completedAt: regularTimestamp, // Fixed: Use regular Date instead of serverTimestamp
                taskCode: this.taskCodes[taskNumber]
            });
            updates.taskHistory = taskHistory;
            
            await teamRef.set(updates, { merge: true });
            
            // Also log submission (use regular timestamp here too)
            await db.collection('submissions').add({
                teamId: teamId,
                taskNumber: taskNumber,
                taskCode: this.taskCodes[taskNumber],
                timestamp: regularTimestamp // Fixed: Use regular Date
            });

            console.log(`🔥 Task ${taskNumber} completed for team ${teamId}`);
            
            if (taskNumber === 5) {
                alert('🏆 Congratulations! You have completed the treasure hunt!');
            } else {
                alert(`✅ Task ${taskNumber} completed! Move to the next location.`);
            }
            
            return true;
        } catch (error) {
            console.error('Error completing task:', error);
            alert('Error saving progress. Please try again.');
            return false;
        }
    }

    // 🔥 Firebase: Get team progress (real-time)
    async getTeamProgress(teamId) {
        try {
            const teamRef = db.collection('teams').doc(teamId);
            const teamDoc = await teamRef.get();
            
            if (teamDoc.exists) {
                return teamDoc.data();
            }
            return null;
        } catch (error) {
            console.error('Error getting team progress:', error);
            return null;
        }
    }

    // 🔥 Firebase: Get all teams (real-time)
    async getAllTeams() {
        try {
            const teamsSnapshot = await db.collection('teams').orderBy('completedTasks', 'desc').get();
            const teams = [];
            
            teamsSnapshot.forEach(doc => {
                teams.push(doc.data());
            });
            
            return teams;
        } catch (error) {
            console.error('Error getting all teams:', error);
            return [];
        }
    }

    // 🔥 Firebase: Real-time listener for admin dashboard
    listenToTeamUpdates(callback) {
        return db.collection('teams')
            .orderBy('completedTasks', 'desc')
            .onSnapshot(snapshot => {
                const teams = [];
                snapshot.forEach(doc => {
                    teams.push(doc.data());
                });
                callback(teams);
            });
    }

    // 🔥 Firebase: Get all submissions
    async getSubmissions() {
        try {
            const submissionsSnapshot = await db.collection('submissions')
                .orderBy('timestamp', 'desc')
                .get();
            
            const submissions = [];
            submissionsSnapshot.forEach(doc => {
                submissions.push(doc.data());
            });
            
            return submissions;
        } catch (error) {
            console.error('Error getting submissions:', error);
            return [];
        }
    }

    // 🔥 Firebase: Clear all data (admin function)
    async clearAllData() {
        if (!confirm('Are you sure you want to clear ALL game data? This cannot be undone!')) {
            return false;
        }

        try {
            // Delete all teams
            const teamsSnapshot = await db.collection('teams').get();
            const batch = db.batch();
            
            teamsSnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            // Delete all submissions
            const submissionsSnapshot = await db.collection('submissions').get();
            submissionsSnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            await batch.commit();
            
            // Clear localStorage
            localStorage.clear();
            
            alert('✅ All data cleared successfully!');
            return true;
        } catch (error) {
            console.error('Error clearing data:', error);
            alert('Error clearing data. Please try again.');
            return false;
        }
    }

    // 🔥 Firebase: Export data
    async exportData() {
        try {
            const teams = await this.getAllTeams();
            const submissions = await this.getSubmissions();
            
            const exportData = {
                teams: teams,
                submissions: submissions,
                exportedAt: new Date().toISOString()
            };
            
            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `treasure_hunt_data_${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            
            return true;
        } catch (error) {
            console.error('Error exporting data:', error);
            alert('Error exporting data.');
            return false;
        }
    }
}

// 🔥 Initialize Firebase game instance
const firebaseGame = new FirebaseTreasureHunt();

// 🔥 Real-time admin dashboard functions
function initializeAdminDashboard() {
    if (typeof updateLeaderboard === 'function') {
        // Set up real-time listener
        firebaseGame.listenToTeamUpdates(teams => {
            updateLeaderboard(teams);
            updateStatistics(teams);
        });
    }
}

function updateLeaderboard(teams) {
    const leaderboardBody = document.getElementById('leaderboardBody');
    if (!leaderboardBody) return;
    
    if (teams.length === 0) {
        leaderboardBody.innerHTML = '<tr><td colspan="6" class="no-data">No teams registered yet</td></tr>';
        return;
    }
    
    let html = '';
    teams.forEach((team, index) => {
        const rank = index + 1;
        const progress = `${team.completedTasks}/5`;
        
        let currentTask, status;
        if (team.completedTasks === 5) {
            currentTask = '🏆 WINNER!';
            status = '🏆 CHAMPION!';
        } else if (team.status === 'completed' && team.completedTasks === 4) {
            currentTask = 'Task 5 - Final Challenge';
            status = '🎯 At Final Task';
        } else if (team.currentTask === 'completed') {
            currentTask = 'COMPLETED!';
            status = '🏆 Winner';
        } else {
            currentTask = `Task ${team.currentTask}`;
            status = '🎮 Playing';
        }
        
        const completionTime = team.completionTime ? 
            new Date(team.completionTime.toDate()).toLocaleTimeString() : '-';
        
        // Highlight winners (Task 5 completed)
        const rowClass = team.completedTasks === 5 ? 'winner-team' : 
                        (team.status === 'completed' ? 'completed-team' : '');
        
        html += `
            <tr class="${rowClass}">
                <td>${rank}</td>
                <td><strong>${team.id}</strong></td>
                <td>${progress}</td>
                <td>${currentTask}</td>
                <td>${completionTime}</td>
                <td>${status}</td>
            </tr>
        `;
    });
    
    leaderboardBody.innerHTML = html;
}

function updateStatistics(teams) {
    const totalTeams = teams.length;
    const completedTeams = teams.filter(team => team.completedTasks === 5).length;
    const inProgressTeams = totalTeams - completedTeams;
    
    if (document.getElementById('totalTeams')) {
        document.getElementById('totalTeams').textContent = totalTeams;
        document.getElementById('completedTeams').textContent = completedTeams;
        document.getElementById('inProgressTeams').textContent = inProgressTeams;
    }
}

// 🔥 Updated game functions for Firebase
async function setTeamIdTask1() {
    const teamIdInput = document.getElementById('teamIdInput');
    const teamId = teamIdInput.value.trim().toUpperCase();
    
    if (!teamId) {
        alert('Please enter your Team ID');
        return;
    }
    
    if (await firebaseGame.setTeamId(teamId)) {
        showGameContent(teamId);
    }
}

async function verifyTask2() {
    const teamId = document.getElementById('teamId2').value.trim().toUpperCase();
    const code = document.getElementById('previousCode').value.trim().toUpperCase();
    
    if (!teamId || !code) {
        alert('Please fill in all fields');
        return;
    }
    
    // 🔒 SEQUENCE LOCK: Check if team can access Task 2
    if (!(await canAccessTask(teamId, 2))) {
        showSequenceError(2);
        return;
    }
    
    // Simple code check
    if (code !== 'TC441') {
        alert('❌ Incorrect code! You need the code from Task 1.');
        return;
    }
    
    if (await firebaseGame.setTeamId(teamId)) {
        document.getElementById('clueSection').style.display = 'block';
        document.getElementById('teamDisplayName').textContent = teamId;
        document.querySelector('.verification-section').style.display = 'none';
    }
}

async function verifyTask3() {
    const teamId = document.getElementById('teamId3').value.trim().toUpperCase();
    const code = document.getElementById('previousCode3').value.trim().toUpperCase();
    
    if (!teamId || !code) {
        alert('Please fill in all fields');
        return;
    }
    
    // 🔒 SEQUENCE LOCK: Check if team can access Task 3
    if (!(await canAccessTask(teamId, 3))) {
        showSequenceError(3);
        return;
    }
    
    // Simple code check
    if (code !== 'TC242') {
        alert('❌ Incorrect code! You need the code from Task 2.');
        return;
    }
    
    if (await firebaseGame.setTeamId(teamId)) {
        document.getElementById('clueSection3').style.display = 'block';
        document.getElementById('teamDisplayName').textContent = teamId;
        document.querySelector('.verification-section').style.display = 'none';
    }
}

async function verifyTask4() {
    const teamId = document.getElementById('teamId4').value.trim().toUpperCase();
    const code = document.getElementById('previousCode4').value.trim().toUpperCase();
    
    if (!teamId || !code) {
        alert('Please fill in all fields');
        return;
    }
    
    // 🔒 SEQUENCE LOCK: Check if team can access Task 4
    if (!(await canAccessTask(teamId, 4))) {
        showSequenceError(4);
        return;
    }
    
    // Simple code check
    if (code !== 'TC803') {
        alert('❌ Incorrect code! You need the code from Task 3.');
        return;
    }
    
    if (await firebaseGame.setTeamId(teamId)) {
        document.getElementById('clueSection4').style.display = 'block';
        document.getElementById('teamDisplayName').textContent = teamId;
        document.querySelector('.verification-section').style.display = 'none';
    }
}

async function completeTask1() {
    const teamId = firebaseGame.getCurrentTeamId();
    if (!teamId) {
        alert('Please set your team ID first');
        return;
    }
    
    const success = await firebaseGame.completeTask(1, teamId);
    if (success) {
        document.getElementById('completeBtn').textContent = '✅ Task 1 Completed!';
        document.getElementById('completeBtn').disabled = true;
        document.getElementById('completeBtn').style.opacity = '0.7';
        alert('🎉 Great! You have completed Task 1. Now find the QR code for Task 2!');
    }
}

async function completeTask2() {
    const teamId = firebaseGame.getCurrentTeamId();
    if (!teamId) {
        alert('Please verify your team ID first');
        return;
    }
    
    const success = await firebaseGame.completeTask(2, teamId);
    if (success) {
        document.getElementById('completeBtn2').textContent = '✅ Task 2 Completed!';
        document.getElementById('completeBtn2').disabled = true;
        document.getElementById('completeBtn2').style.opacity = '0.7';
        alert('🎉 Excellent! Task 2 completed. Find the QR code for Task 3!');
    }
}

async function completeTask3() {
    const teamId = firebaseGame.getCurrentTeamId();
    if (!teamId) {
        alert('Please verify your team ID first');
        return;
    }
    
    const success = await firebaseGame.completeTask(3, teamId);
    if (success) {
        document.getElementById('completeBtn3').textContent = '✅ Task 3 Completed!';
        document.getElementById('completeBtn3').disabled = true;
        document.getElementById('completeBtn3').style.opacity = '0.7';
        alert('🎉 Outstanding! Task 3 completed. Find the QR code for Task 4!');
    }
}

async function completeTask4() {
    const teamId = firebaseGame.getCurrentTeamId();
    if (!teamId) {
        alert('Please verify your team ID first');
        return;
    }
    
    const success = await firebaseGame.completeTask(4, teamId);
    if (success) {
        document.getElementById('completeBtn4').textContent = '✅ Task 4 Completed!';
        document.getElementById('completeBtn4').disabled = true;
        document.getElementById('completeBtn4').style.opacity = '0.7';
        alert('🎉 Amazing! Task 4 completed. Find the final QR code for the WINNER challenge!');
    }
}

async function verifyTask5() {
    const teamId = document.getElementById('teamId5').value.trim().toUpperCase();
    const code = document.getElementById('previousCode5').value.trim().toUpperCase();
    
    if (!teamId || !code) {
        alert('Please fill in all fields');
        return;
    }
    
    // 🔒 SEQUENCE LOCK: Check if team can access Task 5
    if (!(await canAccessTask(teamId, 5))) {
        showSequenceError(5);
        return;
    }
    
    // Simple code check
    if (code !== 'TC200') {
        alert('❌ Incorrect code! You need the code from Task 4.');
        return;
    }
    
    if (await firebaseGame.setTeamId(teamId)) {
        document.getElementById('clueSection5').style.display = 'block';
        document.getElementById('teamDisplayName').textContent = teamId;
        document.querySelector('.verification-section').style.display = 'none';
        // Final winner task - start celebration!
        celebrateWinner();
    }
}

async function completeTask5() {
    const teamId = firebaseGame.getCurrentTeamId();
    if (!teamId) {
        alert('Please verify your team ID first');
        return;
    }
    
    const success = await firebaseGame.completeTask(5, teamId);
    if (success) {
        document.getElementById('completeBtn5').textContent = '🎉 VICTORY CLAIMED!';
        document.getElementById('completeBtn5').disabled = true;
        document.getElementById('completeBtn5').style.opacity = '0.7';
        
        // 🏆 WINNER CELEBRATION!
        alert('🏆 CONGRATULATIONS! You are the OFFICIAL WINNER of the treasure hunt!');
        
        // 🎊 Show celebration
        setTimeout(() => {
            if (confirm('🎉 Would you like to see the final results and leaderboard?')) {
                goToAdmin();
            }
        }, 2000);
        
        // 🎯 Final celebration effects
        celebrateWinner();
    }
}

// 🎊 Winner celebration function
function celebrateWinner() {
    // Add confetti effect to body
    document.body.style.background = 'linear-gradient(45deg, #FFD700, #FFA500, #FF6B6B, #4ECDC4)';
    document.body.style.backgroundSize = '400% 400%';
    document.body.style.animation = 'gradient 3s ease infinite';
    
    // Add winner sound effect (optional)
    try {
        // You can add sound here if needed
        console.log('🎉 WINNER CELEBRATION!');
    } catch (e) {
        // Silent fail for sound
    }
}

// Navigation functions
function goHome() {
    window.location.href = 'index.html';
}

function goToAdmin() {
    window.location.href = 'admin.html';
}

// 🔒 SIMPLE SEQUENCE LOCK: Check if team can access this task
async function canAccessTask(teamId, taskNumber) {
    // Task 1 is always accessible
    if (taskNumber === 1) return true;
    
    // For other tasks, check if previous task is completed
    try {
        const progress = await firebaseGame.getTeamProgress(teamId);
        if (!progress) {
            return false; // Team doesn't exist yet
        }
        
        const requiredCompletedTasks = taskNumber - 1;
        const hasCompleted = progress.completedTasks >= requiredCompletedTasks;
        
        console.log(`🔒 Team ${teamId} - Task ${taskNumber}: Completed=${progress.completedTasks}, Required=${requiredCompletedTasks}, Access=${hasCompleted}`);
        
        return hasCompleted;
    } catch (error) {
        console.error('Error checking task access:', error);
        return false;
    }
}

// 🔒 SEQUENCE LOCK: Show sequence error
function showSequenceError(taskNumber) {
    const previousTask = taskNumber - 1;
    alert(`🚫 SEQUENCE ERROR!\n\nYou must complete Task ${previousTask} first before accessing Task ${taskNumber}.\n\nPlease follow the proper order!`);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Initialize admin dashboard if on admin page
    if (window.location.pathname.includes('admin.html')) {
        initializeAdminDashboard();
    }
});

console.log('🔥 Firebase Treasure Hunt Game Initialized');

// Export for global access
window.firebaseGame = firebaseGame; 