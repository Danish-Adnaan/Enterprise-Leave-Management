const token = localStorage.getItem("token");
const role = localStorage.getItem("role");
const username = localStorage.getItem("username");

if (!token || role !== "employee") {
    window.location.href = "index.html";
}

const profileMenuButton = document.getElementById("profileMenuButton");
const profileMenu = document.getElementById("profileMenu");
const employeeNameElement = document.getElementById("employeeName");
const leaveMessage = document.getElementById("leaveMessage");
const leaveHistory = document.getElementById("leaveHistory");
const refreshHistoryButton = document.getElementById("refreshHistoryButton");
const leaveDetailOverlay = document.getElementById("leaveDetailOverlay");
const leaveDetailContent = document.getElementById("leaveDetailContent");

if (employeeNameElement) {
    employeeNameElement.textContent = username || "Employee";
}

if (profileMenuButton && profileMenu) {
    profileMenuButton.addEventListener("click", function (event) {
        event.stopPropagation();
        profileMenu.classList.toggle("hidden");
    });

    profileMenu.addEventListener("click", function (event) {
        event.stopPropagation();
    });

    document.addEventListener("click", function () {
        profileMenu.classList.add("hidden");
    });
}

document.getElementById("dropdownLogoutButton")?.addEventListener("click", function () {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("username");
    window.location.href = "index.html";
});

function formatDate(dateString) {
    if (!dateString) return "—";

    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric"
    });
}

function capitalizeFirst(value) {
    if (!value) return "";
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function calculateDuration(leave) {
    const startDate = new Date(`${leave.start_date}T00:00:00`);
    const endDate = new Date(`${leave.end_date}T00:00:00`);
    return Math.max(1, Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1);
}

function showLeaveDetail(leave) {
    if (!leaveDetailOverlay || !leaveDetailContent) return;

    leaveDetailContent.innerHTML =
        '<div class="detail-row"><span class="detail-label">Leave ID</span><span class="detail-value">#' + leave.id + '</span></div>' +
        '<div class="detail-row"><span class="detail-label">Leave Type</span><span class="detail-value">' + capitalizeFirst(leave.leave_type) + '</span></div>' +
        '<div class="detail-row"><span class="detail-label">Start Date</span><span class="detail-value">' + formatDate(leave.start_date) + '</span></div>' +
        '<div class="detail-row"><span class="detail-label">End Date</span><span class="detail-value">' + formatDate(leave.end_date) + '</span></div>' +
        '<div class="detail-row"><span class="detail-label">Duration</span><span class="detail-value">' + calculateDuration(leave) + ' day(s)</span></div>' +
        '<div class="detail-row"><span class="detail-label">Status</span><span class="detail-value"><span class="status-badge ' + leave.status.toLowerCase() + '">' + capitalizeFirst(leave.status) + '</span></span></div>' +
        '<div class="detail-divider"></div>' +
        '<div class="detail-row"><span class="detail-label">Reason</span><span class="detail-value">' + (leave.reason || "No reason provided") + '</span></div>' +
        '<div class="detail-row"><span class="detail-label">Applied On</span><span class="detail-value">' + formatDate(leave.created_at) + '</span></div>' +
        (leave.status === "approved" && leave.has_pending_cancellation ?
            '<div class="detail-actions"><span class="status-badge pending" style="display:inline-block; padding: 8px 14px;">Cancellation request already pending — please wait for review</span></div>' :
         leave.status === "approved" ?
            '<div class="detail-actions"><button type="button" id="modalCancelLeaveButton" class="secondary-button" style="color: #b91c1c; border-color: #fecaca; background: #fff7f7;">Request Cancellation</button></div>' : '');

    const modalCancelButton = document.getElementById("modalCancelLeaveButton");
    if (modalCancelButton) {
        modalCancelButton.addEventListener("click", async function () {
            leaveDetailOverlay.classList.add("hidden");
            const reason = prompt("Please enter a reason for cancelling this leave:");
            if (!reason || reason.trim() === "") {
                alert("A reason is required for cancellation.");
                return;
            }
            try {
                const response = await fetch("http://localhost:3000/api/leaves/" + leave.id + "/cancellation", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": "Bearer " + token
                    },
                    body: JSON.stringify({ reason: reason.trim() })
                });
                const data = await response.json();
                if (!response.ok) {
                    alert(data.message || "Failed to submit cancellation request.");
                    return;
                }
                alert("Cancellation request submitted successfully.");
                getLeaveHistory();
            } catch (error) {
                console.error("Error requesting cancellation:", error);
                alert("Unable to connect to the server.");
            }
        });
    }

    leaveDetailOverlay.classList.remove("hidden");
}

function closeLeaveDetail() {
    if (leaveDetailOverlay) leaveDetailOverlay.classList.add("hidden");
}

document.getElementById("closeOverlay")?.addEventListener("click", closeLeaveDetail);
leaveDetailOverlay?.querySelector(".overlay-backdrop")?.addEventListener("click", closeLeaveDetail);
document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeLeaveDetail();
});

function displayLeaveHistory(leaves) {
    if (!leaveHistory) return;

    leaveHistory.replaceChildren();

    if (leaves.length === 0) {
        leaveHistory.innerHTML = '<div class="empty-state"><svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 00-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"/></svg><p>No leave history yet</p></div>';
        return;
    }

    const sortedLeaves = [...leaves].sort(function (a, b) {
        return new Date(b.created_at) - new Date(a.created_at);
    });

    sortedLeaves.forEach(function (leave) {
        const leaveItem = document.createElement("div");
        leaveItem.className = "leave-history-item";
        leaveItem.tabIndex = 0;

        const duration = calculateDuration(leave);
        leaveItem.innerHTML =
            '<div class="leave-history-header">' +
            '<h4>' + capitalizeFirst(leave.leave_type) + '</h4>' +
            '<span class="status-badge ' + leave.status.toLowerCase() + '">' + capitalizeFirst(leave.status) + '</span>' +
            '</div>' +
            '<div class="leave-history-dates">' +
            '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"/></svg>' +
            formatDate(leave.start_date) + ' - ' + formatDate(leave.end_date) + ' (' + duration + ' days)' +
            '</div>' +
            '<div class="leave-history-footer">' +
            '<span class="leave-history-reason" title="' + (leave.reason || "") + '">' + (leave.reason || "No reason") + '</span>' +
            (leave.status === "approved" && leave.has_pending_cancellation ? '<span style="font-size:11px; color:#d97706; font-weight:600;">Cancel in review</span>' : '') +
            '</div>';

        leaveItem.addEventListener("click", function () {
            showLeaveDetail(leave);
        });

        leaveItem.addEventListener("keydown", function (event) {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                showLeaveDetail(leave);
            }
        });

        leaveHistory.appendChild(leaveItem);
    });
}

async function getLeaveHistory() {
    if (leaveMessage) leaveMessage.textContent = "Loading leave history...";
    if (refreshHistoryButton) refreshHistoryButton.disabled = true;

    try {
        const response = await fetch("http://localhost:3000/api/leaves/my", {
            method: "GET",
            headers: { "Authorization": "Bearer " + token }
        });

        const data = await response.json();

        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem("token");
                localStorage.removeItem("role");
                localStorage.removeItem("username");
                window.location.href = "index.html";
                return;
            }
            if (leaveMessage) leaveMessage.textContent = data.message || "Unable to load leave history.";
            return;
        }

        const leaves = data.leaves || [];
        displayLeaveHistory(leaves);
        if (leaveMessage) leaveMessage.textContent = leaves.length + " leave request(s) found.";
    } catch (error) {
        console.error("Leave history request error", error);
        if (leaveMessage) leaveMessage.textContent = "Unable to connect to the server.";
    } finally {
        if (refreshHistoryButton) refreshHistoryButton.disabled = false;
    }
}

refreshHistoryButton?.addEventListener("click", getLeaveHistory);
getLeaveHistory();
