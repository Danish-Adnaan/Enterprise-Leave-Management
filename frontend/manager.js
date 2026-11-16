const API_BASE_URL = "http://localhost:3000/api";

const token = localStorage.getItem("token")
const role = localStorage.getItem("role")
const username = localStorage.getItem("username");

const leaveSummaryTableBody = document.getElementById("leaveSummaryTableBody")
const overviewMessage = document.getElementById("overviewMessage");
const leaveSort = document.getElementById("leaveSort");

const pageTitle = document.getElementById("pageTitle")
const pageSubtitle = document.getElementById("pageSubtitle")

let leaveSummaryEmployees = []

const sectionDetails = {
    overviewSection : {
        title: "Overview",
        subtitle: "Monitor employee leave usage and pending requests."
    },
    usersSection : {
        title: "Overview",
        subtitle:"View and manage employees and managers."
    },
    leavesSection:{
        title:"Leave Requests",
        subtitle: "Review and process employee leave applications."
    },
    cancellationsSection:{
        title:"Cancellation Requests",
        subtitle:"Review employee leave-cancellation requests."
    }
};

if (!token || role !== "manager"){
    localStorage.removeItem("token");
    localStorage.removeItem("role")
    localStorage.removeItem("username");

    window.location.replace("index.html");
}

if(username){
    document.getElementById("managerSidebarUsername").textContent = username;
}

document.getElementById("summaryYear").textContent = new Date().getFullYear();

async function apiRequest(path, options = {}){
    const response = await fetch(`${API_BASE_URL}${path}`,{
        ...options,
        headers: {
            ...(options.body ? {"content-Type" : "application/json"} : {}),
            ...options.headers,
            Authorization: `Bearer ${token}`
        }
    });

let data = {};

try {
    data = await response.json();
} catch {
    next(error)
}

if(response.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("role")
    localStorage.removeItem("username")

    window.location.replace("index.html");
    throw new Error(" Your session has expired, Please log in again. ");
}

if(!response.ok){
    throw new Error(data.message || "The request failed.")
}

return data;

}


document.querySelectorAll(".nav-item").forEach(button => {
    button.addEventListener("click", () => {
        const targetSectionId = button.dataset.section;
        const targetSection = document.getElementById(targetSectionId);

        if(!targetSection) return;

        document.querySelectorAll(".manager-section").forEach(section => {
            section.hidden = section.id !== targetSectionId;
        });

        document.querySelectorAll(".nav-item").forEach(navButton => {
            navButton.classList.toggle("active", navButton === button);
        });

        pageTitle.textContent = sectionDetails[targetSectionId].title;
        pageSubtitle.textContent = sectionDetails[targetSectionId].subtitle;

        if(targetSectionId === "overviewSection"){
            loadOverview();
        } else if (targetSectionId === "usersSection") {
            loadUsers();
        } else if (targetSectionId === "leavesSection") {
            loadPendingLeaves();
        } else if (targetSectionId === "cancellationsSection") {
            loadPendingCancellations();
        }
    })
});

function createCell(value){
    const cell = document.createElement("td");
    cell.textContent = value ?? "-";;
    return cell
}


function renderLeaveSummary(){
    const sortBy = leaveSort.value;

    const sortedEmployees = [...leaveSummaryEmployees].sort((a,b) => {
        if (sortBy === "username") {
            return String(a.username).localeCompare(String(b.username))
        }

        // Map frontend sort keys to API field names
        const apiField = sortBy === "total" ? "total_days" : sortBy;
        const difference = Number(b[apiField] || 0) - Number(a[apiField] || 0);

        if(difference !== 0) return difference;

        return String(a.username).localeCompare(String(b.username));
    });

    leaveSummaryTableBody.replaceChildren();

    if(sortedEmployees.length === 0){
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 7;
        cell.className = "empty-cell";
        cell.textContent = "No active employees found"

        row.appendChild(cell);
        leaveSummaryTableBody.appendChild(row);
        return;
    }

    sortedEmployees.forEach(employee => {
        const row = document.createElement("tr");

        row.appendChild(createCell(employee.id));
        row.appendChild(createCell(employee.username));
        row.appendChild(createCell(employee.annual));
        row.appendChild(createCell(employee.casual));
        row.appendChild(createCell(employee.sick));
        row.appendChild(createCell(employee.personal));
        row.appendChild(createCell(employee.total_days));

        leaveSummaryTableBody.appendChild(row);
    });
}

async function loadOverview() {
    overviewMessage.textContent = "Loading leave Summary...";
    document.getElementById("refreshOverviewButton").disabled = true;

    try{
        const [summaryData, usersData, pendingData] = await Promise.all([
            apiRequest("/leaves/summary"),
            apiRequest("/users"),
            apiRequest("/leaves/pending")
        ]);

        leaveSummaryEmployees = summaryData.employees || [];

        renderLeaveSummary();

        document.getElementById("summaryYear").textContent = summaryData.year ?? new Date().getFullYear();

        document.getElementById("activeUsersCount").textContent = (usersData.users || []).length;

        document.getElementById("pendingLeavesCount").textContent = (pendingData.leaves || []).length;

        document.getElementById("employeesWithLeaveCount").textContent = leaveSummaryEmployees.filter(employee => Number(employee.total_days) > 0).length;

        overviewMessage.textContent = "Leave summary loaded successfully.";

    } catch (error) {
        console.error("Overview loading failed: ", error);

        overviewMessage.textContent = error.message || "Unable to load the overview.";
    } finally {

        document.getElementById("refreshOverviewButton").disabled = false;
    }
}

leaveSort.addEventListener("change", renderLeaveSummary);

document.getElementById("refreshOverviewButton").addEventListener("click", loadOverview);

document.getElementById("logoutButton").addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("username");

    window.location.replace("index.html");
});

if (token && role === "manager") {
    loadOverview();
}


const usersTableBody = document.getElementById("usersTableBody");
const usersMessage = document.getElementById("usersMessage");
const createUserForm = document.getElementById("createUserForm");
const createUserMessage = document.getElementById("createUserMessage");
const generatedCredentials = document.getElementById("generatedCredentials");

function calculateDuration(leave) {
    const start = new Date(`${leave.start_date}T00:00:00`);
    const end = new Date(`${leave.end_date}T00:00:00`);
    return Math.max(1, Math.round((end - start) / 86400000) + 1);
}

function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleDateString();
}

async function loadUsers() {
    usersMessage.textContent = "Loading users...";

    try {
        const data = await apiRequest("/users");
        const users = data.users || [];

        usersTableBody.replaceChildren();

        if (users.length === 0) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");

            cell.colSpan = 5;
            cell.className = "empty-cell";
            cell.textContent = "No active users found.";

            row.appendChild(cell);
            usersTableBody.appendChild(row);
        }

        users.forEach(user => {
            const row = document.createElement("tr");

            row.appendChild(createCell(user.id));
            row.appendChild(createCell(user.username));
            row.appendChild(createCell(user.role));
            row.appendChild(createCell(formatDate(user.created_at)));

            const actionCell = document.createElement("td");
            const deactivateButton = document.createElement("button");

            deactivateButton.type = "button";
            deactivateButton.textContent = "Deactivate";
            deactivateButton.className = "secondary-button";

            // Prevent accidental deactivation of the logged-in manager.
            if (String(user.id) === String(getCurrentUserId())) {
                deactivateButton.disabled = true;
                deactivateButton.title = "You cannot deactivate your own account.";
            } else {
                deactivateButton.addEventListener("click", () => {
                    deactivateUser(user);
                });
            }

            actionCell.appendChild(deactivateButton);
            row.appendChild(actionCell);
            usersTableBody.appendChild(row);
        });

        usersMessage.textContent = `${users.length} active user(s) loaded.`;
    } catch (error) {
        console.error("Loading users failed:", error);
        usersMessage.textContent = error.message || "Unable to load users.";
    }
}

function getCurrentUserId() {
    const token = localStorage.getItem("token");
    if (!token) return null;

    try {
        // JWT payload is the second part (index 1)
        const payload = token.split(".")[1];
        if (!payload) return null;

        // Decode base64url format
        const decoded = JSON.parse(
            atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
        );
        return decoded.id;
    } catch (error) {
        console.error("Failed to decode token:", error);
        return null;
    }
}

document.getElementById("showCreateUserButton").addEventListener(
    "click",
    () => {
        createUserForm.hidden = !createUserForm.hidden;
        createUserMessage.textContent = "";

        if (!createUserForm.hidden) {
            document.getElementById("newUsername").focus();
        }
    }
);

document.getElementById("cancelCreateUserButton").addEventListener(
    "click",
    () => {
        createUserForm.reset();
        createUserForm.hidden = true;
        createUserMessage.textContent = "";
    }
);

createUserForm.addEventListener("submit", async event => {
    event.preventDefault();

    const username = document.getElementById("newUsername").value.trim();
    const role = document.getElementById("newUserRole").value;
    const submitButton = createUserForm.querySelector(
        'button[type="submit"]'
    );

    if (!username || !["employee", "manager"].includes(role)) {
        createUserMessage.textContent = "Enter a username and select a valid role.";
        return;
    }

    submitButton.disabled = true;
    createUserMessage.textContent = "Creating user...";

    try {
        const data = await apiRequest("/users", {
            method: "POST",
            body: JSON.stringify({ username, role })
        });

        document.getElementById("createdUsername").textContent =
            data.user.username;

        document.getElementById("createdPassword").textContent =
            data.defaultPassword;

        generatedCredentials.hidden = false;
        createUserForm.reset();
        createUserForm.hidden = true;
        createUserMessage.textContent = "";

        await loadUsers();
        await loadOverview();
    } catch (error) {
        console.error("Creating user failed:", error);
        createUserMessage.textContent =
            error.message || "Unable to create user.";
    } finally {
        submitButton.disabled = false;
    }
});

document.getElementById("copyCredentialsButton").addEventListener(
    "click",
    async () => {
        const credentials =
            `Username: ${document.getElementById("createdUsername").textContent}\n` +
            `Default password: ${document.getElementById("createdPassword").textContent}`;

        try {
            await navigator.clipboard.writeText(credentials);
            createUserMessage.textContent = "Credentials copied.";
        } catch (error) {
            console.error("Copying credentials failed:", error);
            createUserMessage.textContent =
                "Unable to copy automatically. Select and copy the credentials manually.";
        }
    }
);

document.getElementById("dismissCredentialsButton").addEventListener(
    "click",
    () => {
        generatedCredentials.hidden = true;
        document.getElementById("createdUsername").textContent = "";
        document.getElementById("createdPassword").textContent = "";
    }
);

async function deactivateUser(user) {
    const confirmed = window.confirm(
        `Deactivate "${user.username}"? They will no longer be able to log in.`
    );

    if (!confirmed) return;

    usersMessage.textContent = `Deactivating ${user.username}...`;

    try {
        await apiRequest(`/users/${encodeURIComponent(user.id)}/deactivate`, {
            method: "PATCH"
        });

        usersMessage.textContent = `${user.username} has been deactivated.`;

        await loadUsers();
        await loadOverview();
    } catch (error) {
        console.error("Deactivating user failed:", error);
        usersMessage.textContent =
            error.message || "Unable to deactivate user.";
    }
}


// ==================== Leave Requests Section ====================

const leavesTableBody = document.getElementById("leavesTableBody");
const leavesMessage = document.getElementById("leavesMessage");
const leaveReviewModal = document.getElementById("leaveReviewModal");
const leaveReviewTitle = document.getElementById("leaveReviewTitle");
const leaveReviewBody = document.getElementById("leaveReviewBody");

function closeLeaveReview() {
    if (leaveReviewModal) leaveReviewModal.hidden = true;
}

document.getElementById("closeLeaveReviewButton")?.addEventListener("click", closeLeaveReview);
leaveReviewModal?.querySelector(".manager-modal-backdrop")?.addEventListener("click", closeLeaveReview);

document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeLeaveReview();
});

function renderBalanceCard(type, balance) {
    const item = balance[type];
    return `<div class="review-balance-item"><span>${capitalizeFirst(type)}</span><strong>${item.available}/${item.total}</strong><small>${item.used} used</small></div>`;
}

function showCancellationReview(request) {
    leaveReviewTitle.textContent = `${capitalizeFirst(request.leave_type)} cancellation · ${request.username}`;
    leaveReviewBody.innerHTML = `
        <div class="review-request-summary">
            <div><span>Employee</span><strong>${request.username}</strong></div>
            <div><span>Leave ID</span><strong>#${request.leave_id}</strong></div>
            <div><span>Period</span><strong>${formatDate(request.start_date)} – ${formatDate(request.end_date)}</strong></div>
            <div><span>Total Days</span><strong>${request.requested_days || calculateDuration(request)} day(s)</strong></div>
            <div><span>Leave Reason</span><strong>${request.leave_reason || "No reason provided"}</strong></div>
            <div><span>Cancellation Reason</span><strong>${request.cancellation_reason || "No reason provided"}</strong></div>
        </div>
        <div class="review-actions">
            <button type="button" class="primary-button small" id="reviewCancellationApproveButton">Approve Cancellation</button>
            <button type="button" class="secondary-button small" id="reviewCancellationRejectButton">Reject Cancellation</button>
        </div>`;
    leaveReviewModal.hidden = false;
    document.getElementById("reviewCancellationApproveButton").addEventListener("click", () => updateCancellationStatus(request.id, "approved"));
    document.getElementById("reviewCancellationRejectButton").addEventListener("click", () => updateCancellationStatus(request.id, "rejected"));
}

async function showLeaveReview(leave) {
    leaveReviewTitle.textContent = `${capitalizeFirst(leave.leave_type)} leave · ${leave.username}`;
    leaveReviewBody.innerHTML = "<p class=\"status-message\">Loading employee balance and approved leave...</p>";
    leaveReviewModal.hidden = false;

    try {
        const data = await apiRequest(`/leaves/${leave.id}/review`);
        const requestedDays = data.requested_days || calculateDuration(data.leave);
        const requestedBalance = data.balance[data.leave.leave_type.toLowerCase()];
        const warning = requestedBalance.available < requestedDays
            ? `<div class="review-alert error">Insufficient ${capitalizeFirst(data.leave.leave_type)} balance: ${requestedBalance.available} available, ${requestedDays} requested.</div>`
            : "";

        leaveReviewBody.innerHTML = `
            ${warning}
            <div class="review-request-summary">
                <div><span>Employee</span><strong>${data.leave.username}</strong></div>
                <div><span>Period</span><strong>${formatDate(data.leave.start_date)} – ${formatDate(data.leave.end_date)}</strong></div>
                <div><span>Requested</span><strong>${requestedDays} day(s)</strong></div>
                <div><span>Reason</span><strong>${data.leave.reason || "No reason provided"}</strong></div>
            </div>
            <h3>Current leave balance</h3>
            <div class="review-balance-grid">
                ${renderBalanceCard("annual", data.balance)}
                ${renderBalanceCard("casual", data.balance)}
                ${renderBalanceCard("sick", data.balance)}
                ${renderBalanceCard("personal", data.balance)}
            </div>
            <h3>Approved leave</h3>
            <div class="approved-leaves-list">
                ${data.approvedLeaves.length ? data.approvedLeaves.map(item => `<div><span>${capitalizeFirst(item.leave_type)} · ${formatDate(item.start_date)} – ${formatDate(item.end_date)}</span><strong>${calculateDuration(item)} day(s)</strong></div>`).join("") : "<p class=\"status-message\">No approved leave records.</p>"}
            </div>
            <div class="review-actions">
                <button type="button" class="primary-button small" id="reviewApproveButton">Approve</button>
                <button type="button" class="secondary-button small" id="reviewRejectButton">Reject</button>
            </div>`;

        document.getElementById("reviewApproveButton").addEventListener("click", () => updateLeaveStatus(data.leave.id, "approved"));
        document.getElementById("reviewRejectButton").addEventListener("click", () => updateLeaveStatus(data.leave.id, "rejected"));
    } catch (error) {
        leaveReviewBody.innerHTML = `<div class="review-alert error">${error.message || "Unable to load leave review details."}</div>`;
    }
}

async function loadPendingLeaves() {
    leavesMessage.classList.remove("status-error");
    leavesMessage.textContent = "Loading pending leave requests...";
    document.getElementById("refreshLeavesButton").disabled = true;

    try {
        const data = await apiRequest("/leaves/pending");
        const leaves = data.leaves || [];

        leavesTableBody.replaceChildren();

        if (leaves.length === 0) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");
            cell.colSpan = 7;
            cell.className = "empty-cell";
            cell.textContent = "No pending leave requests.";
            row.appendChild(cell);
            leavesTableBody.appendChild(row);
            leavesMessage.textContent = "No pending requests.";
            return;
        }

        leaves.forEach(leave => {
            const row = document.createElement("tr");

            row.appendChild(createCell(leave.username));
            row.appendChild(createCell(capitalizeFirst(leave.leave_type)));
            row.appendChild(createCell(formatDate(leave.start_date)));
            row.appendChild(createCell(formatDate(leave.end_date)));
            row.appendChild(createCell(`${leave.requested_days || calculateDuration(leave)} day(s)`));
            row.appendChild(createCell(leave.reason || "—"));

            row.addEventListener("click", event => {
                if (!event.target.closest("button")) showLeaveReview(leave);
            });

            const actionCell = document.createElement("td");
            const buttonGroup = document.createElement("div");
            buttonGroup.className = "button-group";

            const approveBtn = document.createElement("button");
            approveBtn.type = "button";
            approveBtn.className = "primary-button small";
            approveBtn.textContent = "Approve";
            approveBtn.addEventListener("click", () => updateLeaveStatus(leave.id, "approved"));

            const rejectBtn = document.createElement("button");
            rejectBtn.type = "button";
            rejectBtn.className = "secondary-button small";
            rejectBtn.textContent = "Reject";
            rejectBtn.addEventListener("click", () => updateLeaveStatus(leave.id, "rejected"));

            buttonGroup.appendChild(approveBtn);
            buttonGroup.appendChild(rejectBtn);
            actionCell.appendChild(buttonGroup);
            row.appendChild(actionCell);

            leavesTableBody.appendChild(row);
        });

        leavesMessage.textContent = `${leaves.length} pending request(s) loaded.`;
    } catch (error) {
        console.error("Loading pending leaves failed:", error);
        leavesMessage.textContent = error.message || "Unable to load pending leaves.";
    } finally {
        document.getElementById("refreshLeavesButton").disabled = false;
    }
}

async function updateLeaveStatus(leaveId, status) {
    const action = status === "approved" ? "approve" : "reject";
    const confirmed = window.confirm(`Are you sure you want to ${action} this leave request?`);

    if (!confirmed) return;

    leavesMessage.textContent = `${capitalizeFirst(action)}ing leave request...`;

    try {
        await apiRequest(`/leaves/${leaveId}/status`, {
            method: "PATCH",
            body: JSON.stringify({ status })
        });

        leavesMessage.textContent = `Leave request ${status} successfully.`;
        closeLeaveReview();
        await loadPendingLeaves();
        await loadOverview(); // Refresh overview counts
    } catch (error) {
        console.error("Updating leave status failed:", error);
        leavesMessage.textContent = error.message || `Unable to ${action} leave request.`;
        if (error.message && (error.message.toLowerCase().includes("insufficient") || error.message.toLowerCase().includes("overlap"))) {
            leavesMessage.classList.add("status-error");
        }
    }
}

document.getElementById("refreshLeavesButton").addEventListener("click", loadPendingLeaves);


// ==================== Cancellation Requests Section ====================

const cancellationsTableBody = document.getElementById("cancellationsTableBody");
const cancellationsMessage = document.getElementById("cancellationsMessage");

async function loadPendingCancellations() {
    cancellationsMessage.textContent = "Loading pending cancellation requests...";
    document.getElementById("refreshCancellationsButton").disabled = true;

    try {
        const data = await apiRequest("/leave-cancellations/pending");
        const requests = data.cancellationRequests || [];

        cancellationsTableBody.replaceChildren();

        if (requests.length === 0) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");
            cell.colSpan = 9;
            cell.className = "empty-cell";
            cell.textContent = "No pending cancellation requests.";
            row.appendChild(cell);
            cancellationsTableBody.appendChild(row);
            cancellationsMessage.textContent = "No pending requests.";
            return;
        }

        requests.forEach(request => {
            const row = document.createElement("tr");

            row.appendChild(createCell(request.username));
            row.appendChild(createCell(capitalizeFirst(request.leave_type)));
            row.appendChild(createCell(request.leave_id));
            row.appendChild(createCell(formatDate(request.start_date)));
            row.appendChild(createCell(formatDate(request.end_date)));
            row.appendChild(createCell(`${request.requested_days || calculateDuration(request)} day(s)`));
            row.appendChild(createCell(request.leave_reason || "—"));
            row.appendChild(createCell(request.cancellation_reason || "—"));

            row.addEventListener("click", event => {
                if (!event.target.closest("button")) showCancellationReview(request);
            });

            const actionCell = document.createElement("td");
            const buttonGroup = document.createElement("div");
            buttonGroup.className = "button-group";

            const approveBtn = document.createElement("button");
            approveBtn.type = "button";
            approveBtn.className = "primary-button small";
            approveBtn.textContent = "Approve";
            approveBtn.addEventListener("click", () => updateCancellationStatus(request.id, "approved"));

            const rejectBtn = document.createElement("button");
            rejectBtn.type = "button";
            rejectBtn.className = "secondary-button small";
            rejectBtn.textContent = "Reject";
            rejectBtn.addEventListener("click", () => updateCancellationStatus(request.id, "rejected"));

            buttonGroup.appendChild(approveBtn);
            buttonGroup.appendChild(rejectBtn);
            actionCell.appendChild(buttonGroup);
            row.appendChild(actionCell);

            cancellationsTableBody.appendChild(row);
        });

        cancellationsMessage.textContent = `${requests.length} pending request(s) loaded.`;
    } catch (error) {
        console.error("Loading cancellation requests failed:", error);
        cancellationsMessage.textContent = error.message || "Unable to load cancellation requests.";
    } finally {
        document.getElementById("refreshCancellationsButton").disabled = false;
    }
}

async function updateCancellationStatus(cancellationId, status) {
    const action = status === "approved" ? "approve" : "reject";
    const confirmed = window.confirm(`Are you sure you want to ${action} this cancellation request?`);

    if (!confirmed) return;

    cancellationsMessage.textContent = `${capitalizeFirst(action)}ing cancellation request...`;

    try {
        await apiRequest(`/leave-cancellations/${cancellationId}/status`, {
            method: "PATCH",
            body: JSON.stringify({ status })
        });

        cancellationsMessage.textContent = `Cancellation request ${status} successfully.`;
        await loadPendingCancellations();
        await loadOverview(); // Refresh overview counts
    } catch (error) {
        console.error("Updating cancellation status failed:", error);
        cancellationsMessage.textContent = error.message || `Unable to ${action} cancellation request.`;
    }
}

document.getElementById("refreshCancellationsButton").addEventListener("click", loadPendingCancellations);

// Helper function
function capitalizeFirst(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
