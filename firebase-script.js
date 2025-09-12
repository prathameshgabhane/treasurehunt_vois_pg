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

// Initialize Firebase
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

    async setTeamId(teamId) {
        if (!teamId || teamId.trim() === '') return false;
        
        teamId = teamId.trim().toUpperCase();
        this.currentTeamId = teamId;
        
        try {
            const teamRef = db.collection('teams').doc(teamId);
            const teamDoc = await teamRef.get();
            
            if (!teamDoc.exists) {
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
            
            localStorage.setItem('currentTeamId', teamId);
            return true;
        } catch (error) {
            console.error('Error setting team ID:', error);
            return false;
        }
    }

    getCurrentTeamId() {
        return this.currentTeamId || localStorage.getItem('currentTeamId');
    }

    async verifyTaskCode(teamId, expectedCode, actualCode) {
        if (!teamId || !actualCode) return false;
        
        try {
            const teamRef = db.collection('teams').doc(teamId);
            const teamDoc = await teamRef.get();
            
            if (!teamDoc.exists) {
                await this.setTeamId(teamId);
                return false;
            }
            
            const teamData = teamDoc.data();
            const currentTask = teamData.currentTask;
            
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
                await this.setTeamId(teamId);
            }

            const now = firebase.firestore.FieldValue.serverTimestamp();
            const regularTimestamp = new Date();
            
            const updates = {
                completedTasks: taskNumber,
                currentTask: taskNumber + 1,
                [`task${taskNumber}CompletedAt`]: now
            };
            
            if (taskNumber === 5) {
                updates.completionTime = now;
                updates.status = 'completed';
                updates.currentTask = 'completed';
            }
            
            const existingData = teamDoc.exists ? teamDoc.data() : {};
            const taskHistory = existingData.taskHistory || [];
            taskHistory.push({
                taskNumber: taskNumber,
                completedAt: regularTimestamp,
                taskCode: this.taskCodes[taskNumber]
            });
            updates.taskHistory = taskHistory;
            
            await teamRef.set(updates, { merge: true });
            
            await db.collection('submissions').add({
                teamId: teamId,
                taskNumber: taskNumber,
                taskCode: this.taskCodes[taskNumber],
                timestamp: regularTimestamp
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

    async getAllTeams() {
        try {
            const teamsSnapshot = await db.collection('teams')
                .orderBy('completionTime', 'asc')
                .get();
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

    // 🔥 Real-time listener for admin dashboard (sorted by completion time ascending)
    listenToTeamUpdates(callback) {
        return db.collection('teams')
            .orderBy('completionTime', 'asc')
            .onSnapshot(snapshot => {
                const teams = [];
                snapshot.forEach(doc => {
                    teams.push(doc.data());
                });
                callback(teams);
            });
    }

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

    async clearAllData() {
        if (!confirm('Are you sure you want to clear ALL game data? This cannot be undone!')) {
            return false;
        }

        try {
            const teamsSnapshot = await db.collection('teams').get();
            const batch = db.batch();
            
            teamsSnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            const submissionsSnapshot = await db.collection('submissions').get();
            submissionsSnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            await batch.commit();
            
            localStorage.clear();
            
            alert('✅ All data cleared successfully!');
            return true;
        } catch (error) {
            console.error('Error clearing data:', error);
            alert('Error clearing data. Please try again.');
            return false;
        }
    }

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

const firebaseGame = new FirebaseTreasureHunt();

function initializeAdminDashboard() {
    if (typeof updateLeaderboard === 'function') {
        firebaseGame.listenToTeamUpdates(teams => {
            updateLeaderboard(teams);
            updateStatistics(teams);
        });
    }
}

// 🔥 Update leaderboard WITHOUT Rank column
function updateLeaderboard(teams) {
    const leaderboardBody = document.getElementById('leaderboardBody');
    if (!leaderboardBody) return;
    
    if (teams.length === 0) {
        leaderboardBody.innerHTML = '<tr><td colspan="5" class="no-data">No teams registered yet</td></tr>';
        return;
    }
    
    let html = '';
    teams.forEach(team => {
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
        
        const rowClass = team.completedTasks === 5 ? 'winner-team' : 
                        (team.status === 'completed' ? 'completed-team' : '');
        
        html += `
            <tr class="${rowClass}">
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

// --- GAME FUNCTIONS (unchanged from your version, kept for completeness) ---
async function setTeamIdTask1() { /* same as before */ }
async function verifyTask2() { /* same as before */ }
async function verifyTask3() { /* same as before */ }
async function verifyTask4() { /* same as before */ }
async function completeTask1() { /* same as before */ }
async function completeTask2() { /* same as before */ }
async function completeTask3() { /* same as before */ }
async function completeTask4() { /* same as before */ }
async function verifyTask5() { /* same as before */ }
async function completeTask5() { /* same as before */ }

function celebrateWinner() { /* same as before */ }
function goHome() { window.location.href = 'index.html'; }
function goToAdmin() { window.location.href = 'admin.html'; }

async function canAccessTask(teamId, taskNumber) { /* same as before */ }
function showSequenceError(taskNumber) { /* same as before */ }

document.addEventListener('DOMContentLoaded', function() {
    if (window.location.pathname.includes('admin.html')) {
        initializeAdminDashboard();
    }
});

console.log('🔥 Firebase Treasure Hunt Game Initialized');
window.firebaseGame = firebaseGame;
