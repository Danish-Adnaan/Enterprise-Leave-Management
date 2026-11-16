const token = localStorage.getItem("token");
const role = localStorage.getItem("role");
const username = localStorage.getItem("username");

if (!token || role !== "employee") {
    window.location.href = "index.html";
}

// ===== Local Storage for Data Persistence =====
const STORAGE_KEYS = {
    MY_LEAVES: "myLeaves",
    CALENDAR_LEAVES: "calendarLeaves"
};

function saveToStorage(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

function getFromStorage(key) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
}

// ===== Profile Dropdown =====
const profileMenuButton = document.getElementById("profileMenuButton");
const profileMenu = document.getElementById("profileMenu");
const employeeNameElement = document.getElementById("employeeName");

if (employeeNameElement) {
    employeeNameElement.textContent = username || "Employee";
}

if (profileMenuButton) {
    profileMenuButton.addEventListener("click", function (e) {
        e.stopPropagation();
        profileMenu.classList.toggle("hidden");
    });

    document.addEventListener("click", function () {
        profileMenu.classList.add("hidden");
    });

    profileMenu.addEventListener("click", function (e) {
        e.stopPropagation();
    });
}

const dropdownLogoutButton = document.getElementById("dropdownLogoutButton");
if (dropdownLogoutButton) {
    dropdownLogoutButton.addEventListener("click", function () {
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        localStorage.removeItem("username");
        localStorage.removeItem(STORAGE_KEYS.MY_LEAVES);
        localStorage.removeItem(STORAGE_KEYS.CALENDAR_LEAVES);
        window.location.href = "index.html";
    });
}

// ===== Leave Balance State =====
let leaveBalance = null;

async function fetchLeaveBalance() {
    try {
        const response = await fetch("http://localhost:3000/api/balance", {
            method: "GET",
            headers: { "Authorization": "Bearer " + token }
        });

        if (response.ok) {
            const data = await response.json();
            leaveBalance = data.balance;
            updateLeaveBalanceDisplay();
        }
    } catch (error) {
        console.error("Error fetching leave balance:", error);
    }
}

function updateLeaveBalanceDisplay() {
    if (!leaveBalance) return;

    const annualElement = document.getElementById("annualLeaveCount");
    const sickElement = document.getElementById("sickLeaveCount");
    const casualElement = document.getElementById("casualLeaveCount");
    const personalElement = document.getElementById("personalLeaveCount");

    // Display available/total (e.g., "7/10")
    // If available is 0, show as "0" but don't show negative values
    if (annualElement) annualElement.textContent = `${Math.max(0, leaveBalance.annual.available)}/${leaveBalance.annual.total}`;
    if (sickElement) sickElement.textContent = `${Math.max(0, leaveBalance.sick.available)}/${leaveBalance.sick.total}`;
    if (casualElement) casualElement.textContent = `${Math.max(0, leaveBalance.casual.available)}/${leaveBalance.casual.total}`;
    if (personalElement) personalElement.textContent = `${Math.max(0, leaveBalance.personal.available)}/${leaveBalance.personal.total}`;
}

// ===== Calendar =====
let calendarDate = new Date();
calendarDate.setDate(1);

let calendarLeaves = getFromStorage(STORAGE_KEYS.CALENDAR_LEAVES) || [];

const previousMonthBtn = document.getElementById("previousMonth");
const nextMonthBtn = document.getElementById("nextMonth");

if (previousMonthBtn) {
    previousMonthBtn.addEventListener("click", function () {
        calendarDate.setMonth(calendarDate.getMonth() - 1);
        renderCalendar();
    });
}

if (nextMonthBtn) {
    nextMonthBtn.addEventListener("click", function () {
        calendarDate.setMonth(calendarDate.getMonth() + 1);
        renderCalendar();
    });
}

function renderCalendar() {
    const calendarGrid = document.getElementById("calendarGrid");
    const calendarMonth = document.getElementById("calendarMonth");

    if (!calendarGrid || !calendarMonth) {
        console.error("Calendar elements not found");
        return;
    }

    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();

    const monthName = calendarDate.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric"
    });

    calendarMonth.textContent = monthName;
    calendarGrid.innerHTML = "";

    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    weekdays.forEach(function (day) {
        const weekdayElement = document.createElement("div");
        weekdayElement.textContent = day;
        weekdayElement.classList.add("weekday");
        calendarGrid.appendChild(weekdayElement);
    });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
        const emptyCell = document.createElement("div");
        emptyCell.className = "empty-day";
        calendarGrid.appendChild(emptyCell);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dayCell = document.createElement("button");
        dayCell.type = "button";
        dayCell.className = "calendar-day";
        dayCell.setAttribute("aria-label", monthName + " " + day);
        const dayNumber = document.createElement("span");
        dayNumber.className = "day-number";
        dayNumber.textContent = day;
        dayCell.appendChild(dayNumber);

        const dayLeaves = getLeavesForDate(year, month, day);

        function showDateDetails() {
            displaySelectedDateDetails(year, month, day);
        }

        dayCell.addEventListener("click", showDateDetails);

        dayCell.addEventListener("keydown", function (event) {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                showDateDetails();
            }
        });

        // Apply styling based on leave status
        const today = new Date();
        if (year === today.getFullYear() && month === today.getMonth() && day === today.getDate()) {
            dayCell.classList.add("today");
        }

        const approvedLeaves = dayLeaves.filter(l => l.status === "approved");
        if (approvedLeaves.length > 0) {
            dayCell.classList.add("has-leave", "status-approved");
            const approvedIndicator = document.createElement("span");
            approvedIndicator.className = "approved-indicator";
            approvedIndicator.textContent = "✓";
            dayCell.appendChild(approvedIndicator);
            dayCell.title = approvedLeaves.map(function (leave) {
                return leave.leave_type + " - Approved";
            }).join(", ");
        }

        calendarGrid.appendChild(dayCell);
    }
}

function getLeavesForDate(year, month, day) {
    const selectedDate = [
        year,
        String(month + 1).padStart(2, "0"),
        String(day).padStart(2, "0")
    ].join("-");

    return calendarLeaves.filter(function (leave) {
        return leave.status === "approved" &&
            selectedDate >= leave.start_date &&
            selectedDate <= leave.end_date;
    });
}

const calendarModal = document.getElementById("calendarModal");
const calendarModalTitle = document.getElementById("calendarModalTitle");
const calendarModalBody = document.getElementById("calendarModalBody");

function closeCalendarModal() {
    if (!calendarModal) return;
    calendarModal.classList.add("hidden");
    calendarModal.classList.remove("active");
}

function displaySelectedDateDetails(year, month, day) {
    if (!calendarModal || !calendarModalTitle || !calendarModalBody) return;

    const dayLeaves = getLeavesForDate(year, month, day);
    const selectedDate = [year, String(month + 1).padStart(2, "0"), String(day).padStart(2, "0")].join("-");
    const readableDate = new Date(year, month, day).toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric", year: "numeric"
    });

    calendarModalTitle.textContent = readableDate;
    calendarModalBody.replaceChildren();

    const dateLabel = document.createElement("p");
    dateLabel.className = "calendar-modal-date";
    dateLabel.textContent = selectedDate;
    calendarModalBody.appendChild(dateLabel);

    if (dayLeaves.length === 0) {
        const emptyState = document.createElement("div");
        emptyState.className = "calendar-modal-empty";
        emptyState.innerHTML = "<span class=\"calendar-empty-icon\">☼</span><p>No leave records for this date.</p>";
        calendarModalBody.appendChild(emptyState);
    } else {
        const leaveList = document.createElement("div");
        leaveList.className = "calendar-modal-leaves";

        dayLeaves.forEach(function (leave) {
            const leaveItem = document.createElement("article");
            leaveItem.className = "calendar-modal-leave";
            leaveItem.innerHTML =
                '<div class="calendar-modal-leave-type ' + leave.leave_type.toLowerCase() + '">' + capitalizeFirst(leave.leave_type).charAt(0) + '</div>' +
                '<div class="calendar-modal-leave-info"><h4>' + capitalizeFirst(leave.leave_type) + ' Leave</h4>' +
                '<p>' + formatDate(leave.start_date) + ' to ' + formatDate(leave.end_date) + '</p>' +
                '<p class="calendar-modal-reason">' + (leave.reason || "No reason provided") + '</p></div>' +
                '<span class="status-badge ' + leave.status.toLowerCase() + '">' + capitalizeFirst(leave.status) + '</span>';
            leaveList.appendChild(leaveItem);
        });

        calendarModalBody.appendChild(leaveList);
    }

    calendarModal.classList.remove("hidden");
    calendarModal.classList.add("active");
}

if (calendarModal) {
    document.getElementById("closeCalendarModal")?.addEventListener("click", closeCalendarModal);
    calendarModal.querySelector(".calendar-modal-backdrop")?.addEventListener("click", closeCalendarModal);
    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") closeCalendarModal();
    });
}

// ===== My Leave Requests =====
const myLeavesMessage = document.getElementById("myLeavesMessage");
const myLeavesTableBody = document.getElementById("myLeavesTableBody");
const refreshLeavesButton = document.getElementById("refreshLeavesButton");
const withdrawSelectedButton = document.getElementById("withdrawSelectedButton");
const selectAllLeaves = document.getElementById("selectAllLeaves");
const statusFilter = document.getElementById("statusFilter");
const sortOrder = document.getElementById("sortOrder");

let myLeaves = getFromStorage(STORAGE_KEYS.MY_LEAVES) || [];

// Initialize event listeners if elements exist
if (refreshLeavesButton && selectAllLeaves && withdrawSelectedButton) {
    refreshLeavesButton.addEventListener("click", loadMyLeaves);
    selectAllLeaves.addEventListener("change", handleSelectAll);
    withdrawSelectedButton.addEventListener("click", bulkWithdrawLeaves);

    if (statusFilter) statusFilter.addEventListener("change", renderMyLeavesTable);
    if (sortOrder) sortOrder.addEventListener("change", renderMyLeavesTable);
}

function updateSelectAllVisibility() {
    if (!selectAllLeaves) return;

    const selectAllHeader = selectAllLeaves.closest("th");
    const pendingOnly = statusFilter && statusFilter.value === "pending";
    const pendingCheckboxes = myLeavesTableBody
        ? myLeavesTableBody.querySelectorAll('input[type="checkbox"]:not(:disabled)')
        : [];

    if (selectAllHeader) selectAllHeader.hidden = !pendingOnly;
    selectAllLeaves.hidden = !pendingOnly;
    selectAllLeaves.disabled = !pendingOnly || pendingCheckboxes.length === 0;

    if (withdrawSelectedButton) {
        withdrawSelectedButton.hidden = !pendingOnly;
        withdrawSelectedButton.disabled = !pendingOnly || pendingCheckboxes.length === 0;
    }

    if (!pendingOnly) {
        selectAllLeaves.checked = false;
    }
}

async function loadMyLeaves() {
    if (myLeavesMessage) myLeavesMessage.textContent = "Loading leave requests...";
    if (refreshLeavesButton) refreshLeavesButton.disabled = true;
    if (withdrawSelectedButton) withdrawSelectedButton.disabled = true;

    try {
        const response = await fetch("http://localhost:3000/api/leaves/my", {
            method: "GET",
            headers: {
                "Authorization": "Bearer " + token
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                handleUnauthorized();
                return;
            }
            const errorData = await response.json();
            if (myLeavesMessage) myLeavesMessage.textContent = errorData.message || "Failed to load leave requests.";
            return;
        }

        const data = await response.json();
        myLeaves = data.leaves || [];
        saveToStorage(STORAGE_KEYS.MY_LEAVES, myLeaves);
        renderMyLeavesTable();
        if (myLeavesMessage) myLeavesMessage.textContent = myLeaves.length > 0 ? "Loaded " + myLeaves.length + " leave request(s)." : "No leave requests yet.";
    } catch (error) {
        console.error("Error loading leaves:", error);
        if (myLeavesMessage) myLeavesMessage.textContent = "Unable to connect to the server.";
    } finally {
        if (refreshLeavesButton) refreshLeavesButton.disabled = false;
        updateSelectedCount();
    }
}

function getFilteredAndSortedLeaves() {
    const statusValue = statusFilter ? statusFilter.value : "all";
    let filtered = myLeaves;
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const quarterStartMonth = Math.floor(currentMonth / 3) * 3;

    const dateInRange = function (leave, startDate, endDate) {
        const leaveDate = new Date(leave.start_date + "T00:00:00");
        return leaveDate >= startDate && leaveDate <= endDate;
    };

    if (statusValue !== "all") {
        filtered = myLeaves.filter(function (leave) {
            return leave.status.toLowerCase() === statusValue;
        });
    }

    const sortValue = sortOrder ? sortOrder.value : "thisMonth";
    if (sortValue === "thisMonth") {
        filtered = filtered.filter(leave => dateInRange(leave, new Date(currentYear, currentMonth, 1), new Date(currentYear, currentMonth + 1, 0, 23, 59, 59)));
    } else if (sortValue === "thisQuarter") {
        filtered = filtered.filter(leave => dateInRange(leave, new Date(currentYear, quarterStartMonth, 1), new Date(currentYear, quarterStartMonth + 3, 0, 23, 59, 59)));
    } else if (sortValue === "thisYear") {
        filtered = filtered.filter(leave => dateInRange(leave, new Date(currentYear, 0, 1), new Date(currentYear, 11, 31, 23, 59, 59)));
    }

    const sorted = [...filtered];

    sorted.sort(function (a, b) {
        if (sortValue === "thisMonth" || sortValue === "thisQuarter" || sortValue === "thisYear" || sortValue === "newest") {
            return new Date(b.created_at) - new Date(a.created_at);
        } else if (sortValue === "oldest") {
            return new Date(a.created_at) - new Date(b.created_at);
        } else if (sortValue === "startDate") {
            return new Date(a.start_date) - new Date(b.start_date);
        }
        return 0;
    });

    return sorted;
}

function renderMyLeavesTable() {
    if (!myLeavesTableBody) return;

    myLeavesTableBody.replaceChildren();

    const filteredLeaves = getFilteredAndSortedLeaves();

    if (filteredLeaves.length === 0) {
        updateSelectAllVisibility();
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = statusFilter && statusFilter.value === "pending" ? 7 : 6;
        cell.className = "empty-cell";
        cell.innerHTML = '<div class="empty-state"><svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"/></svg><p>No leave requests found</p></div>';
        row.appendChild(cell);
        myLeavesTableBody.appendChild(row);
        return;
    }

    filteredLeaves.forEach(function (leave) {
        const row = document.createElement("tr");
        row.dataset.leaveId = leave.id;

        // Checkbox
        const checkboxCell = document.createElement("td");
        checkboxCell.className = "checkbox-col";
        checkboxCell.hidden = !statusFilter || statusFilter.value !== "pending";

        if (!checkboxCell.hidden) {
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.value = leave.id;
            checkbox.addEventListener("change", updateSelectedCount);
            checkboxCell.appendChild(checkbox);
        }

        row.appendChild(checkboxCell);

        // Leave Type
        row.appendChild(createTableCell(capitalizeFirst(leave.leave_type), "type-col"));

        // Start Date
        row.appendChild(createTableCell(formatDate(leave.start_date), "date-col"));

        // End Date
        row.appendChild(createTableCell(formatDate(leave.end_date), "date-col"));

        // Reason - clickable
        const reasonCell = document.createElement("td");
        reasonCell.className = "reason-col";
        const reasonSpan = document.createElement("span");
        reasonSpan.textContent = leave.reason || "—";
        reasonSpan.title = leave.reason || "";
        reasonSpan.style.cssText = "cursor: pointer; color: #4f46e5;";
        reasonSpan.addEventListener("click", function () {
            showLeaveDetail(leave);
        });
        reasonCell.appendChild(reasonSpan);
        row.appendChild(reasonCell);

        // Status
        const statusCell = document.createElement("td");
        statusCell.className = "status-col";
        const statusBadge = document.createElement("span");
        statusBadge.className = "status-badge " + leave.status.toLowerCase();
        statusBadge.textContent = capitalizeFirst(leave.status);
        statusBadge.style.cursor = "pointer";
        statusBadge.addEventListener("click", function () {
            showLeaveDetail(leave);
        });
        statusCell.appendChild(statusBadge);
        row.appendChild(statusCell);

        // Actions
        const actionCell = document.createElement("td");
        actionCell.className = "actions-col";
        const buttonGroup = document.createElement("div");
        buttonGroup.className = "action-buttons";

        if (leave.status === "pending") {
            const withdrawBtn = document.createElement("button");
            withdrawBtn.type = "button";
            withdrawBtn.textContent = "Withdraw";
            withdrawBtn.addEventListener("click", function () {
                withdrawSingleLeave(leave.id);
            });
            buttonGroup.appendChild(withdrawBtn);
        } else if (leave.status === "approved") {
            const cancelBtn = document.createElement("button");
            cancelBtn.type = "button";
            if (leave.has_pending_cancellation) {
                cancelBtn.textContent = "Cancellation In Review";
                cancelBtn.className = "btn-frozen";
                cancelBtn.disabled = true;
                cancelBtn.title = "A cancellation request is already pending for this leave. Please wait for it to be processed.";
            } else {
                cancelBtn.textContent = "Request Cancel";
                cancelBtn.addEventListener("click", function () {
                    requestLeaveCancellation(leave.id);
                });
            }
            buttonGroup.appendChild(cancelBtn);
        }

        actionCell.appendChild(buttonGroup);
        row.appendChild(actionCell);

        // Add click event to row for detail view
        row.style.cursor = "pointer";
        row.addEventListener("click", function (e) {
            if (e.target.tagName !== "INPUT" && e.target.tagName !== "BUTTON") {
                showLeaveDetail(leave);
            }
        });

        myLeavesTableBody.appendChild(row);
    });

    updateSelectAllVisibility();
}

function createTableCell(text, className) {
    const cell = document.createElement("td");
    if (className) cell.className = className;
    cell.textContent = text;
    return cell;
}

function formatDate(dateString) {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric"
    });
}

function capitalizeFirst(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function handleSelectAll() {
    if (!myLeavesTableBody || !statusFilter || statusFilter.value !== "pending") return;
    const checkboxes = myLeavesTableBody.querySelectorAll('input[type="checkbox"]:not(:disabled)');
    checkboxes.forEach(function (checkbox) {
        checkbox.checked = selectAllLeaves.checked;
    });
    updateSelectedCount();
}

function updateSelectedCount() {
    const selectedIds = getSelectedLeaveIds();
    const pendingOnly = statusFilter && statusFilter.value === "pending";
    if (withdrawSelectedButton) {
        withdrawSelectedButton.hidden = !pendingOnly;
        withdrawSelectedButton.disabled = !pendingOnly || selectedIds.length === 0;
        if (selectedIds.length > 0) {
            withdrawSelectedButton.innerHTML = '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"/></svg> Withdraw Selected (' + selectedIds.length + ')';
        } else {
            withdrawSelectedButton.innerHTML = '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"/></svg> Withdraw Selected';
        }
    }
}

function getSelectedLeaveIds() {
    if (!myLeavesTableBody || !statusFilter || statusFilter.value !== "pending") return [];
    const checkboxes = myLeavesTableBody.querySelectorAll('input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(function (checkbox) {
        return parseInt(checkbox.value);
    });
}

async function withdrawSingleLeave(leaveId) {
    if (!confirm("Are you sure you want to withdraw this leave request?")) return;

    if (myLeavesMessage) myLeavesMessage.textContent = "Withdrawing leave request...";

    try {
        const response = await fetch("http://localhost:3000/api/leaves/" + leaveId + "/withdraw", {
            method: "PATCH",
            headers: {
                "Authorization": "Bearer " + token
            }
        });

        const data = await response.json();

        if (!response.ok) {
            if (myLeavesMessage) myLeavesMessage.textContent = data.message || "Failed to withdraw leave request.";
            return;
        }

        if (myLeavesMessage) myLeavesMessage.textContent = "Leave request withdrawn successfully.";
        await loadMyLeaves();
        await getCalendarLeaves();
    } catch (error) {
        console.error("Error withdrawing leave:", error);
        if (myLeavesMessage) myLeavesMessage.textContent = "Unable to connect to the server.";
    }
}

async function bulkWithdrawLeaves() {
    const selectedIds = getSelectedLeaveIds();
    if (selectedIds.length === 0) return;

    const confirmText = selectedIds.length === 1
        ? "Are you sure you want to withdraw the selected leave request?"
        : "Are you sure you want to withdraw " + selectedIds.length + " selected leave requests?";

    if (!confirm(confirmText)) return;

    if (myLeavesMessage) myLeavesMessage.textContent = "Withdrawing selected leave requests...";
    if (withdrawSelectedButton) withdrawSelectedButton.disabled = true;

    try {
        const response = await fetch("http://localhost:3000/api/leaves/bulk-withdraw", {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify({ leaveIds: selectedIds })
        });

        const data = await response.json();

        if (!response.ok) {
            if (myLeavesMessage) myLeavesMessage.textContent = data.message || "Failed to withdraw leave requests.";
            return;
        }

        if (myLeavesMessage) myLeavesMessage.textContent = selectedIds.length + " leave request(s) withdrawn successfully.";
        await loadMyLeaves();
        await getCalendarLeaves();
        if (selectAllLeaves) selectAllLeaves.checked = false;
    } catch (error) {
        console.error("Error bulk withdrawing leaves:", error);
        if (myLeavesMessage) myLeavesMessage.textContent = "Unable to connect to the server.";
    } finally {
        if (withdrawSelectedButton) withdrawSelectedButton.disabled = true;
    }
}

async function requestLeaveCancellation(leaveId) {
    const reason = prompt("Please enter a reason for cancelling this leave:");
    if (!reason || reason.trim() === "") {
        alert("A reason is required for cancellation.");
        return;
    }

    if (myLeavesMessage) myLeavesMessage.textContent = "Submitting cancellation request...";

    try {
        const response = await fetch("http://localhost:3000/api/leaves/" + leaveId + "/cancellation", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify({ reason: reason.trim() })
        });

        const data = await response.json();

        if (!response.ok) {
            if (myLeavesMessage) myLeavesMessage.textContent = data.message || "Failed to submit cancellation request.";
            return;
        }

        if (myLeavesMessage) myLeavesMessage.textContent = "Cancellation request submitted successfully. It will be reviewed by a manager.";
        await loadMyLeaves();
    } catch (error) {
        console.error("Error requesting cancellation:", error);
        if (myLeavesMessage) myLeavesMessage.textContent = "Unable to connect to the server.";
    }
}

// ===== Leave Detail Overlay =====
const leaveDetailOverlay = document.getElementById("leaveDetailOverlay");
const closeOverlay = document.getElementById("closeOverlay");
const leaveDetailContent = document.getElementById("leaveDetailContent");

if (closeOverlay && leaveDetailOverlay) {
    closeOverlay.addEventListener("click", function () {
        leaveDetailOverlay.classList.add("hidden");
    });

    const backdrop = leaveDetailOverlay.querySelector(".overlay-backdrop");
    if (backdrop) {
        backdrop.addEventListener("click", function () {
            leaveDetailOverlay.classList.add("hidden");
        });
    }

    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && leaveDetailOverlay && !leaveDetailOverlay.classList.contains("hidden")) {
            leaveDetailOverlay.classList.add("hidden");
        }
    });
}

function showLeaveDetail(leave) {
    if (!leaveDetailOverlay || !leaveDetailContent) return;

    const startDate = new Date(`${leave.start_date}T00:00:00`);
    const endDate = new Date(`${leave.end_date}T00:00:00`);
    const daysDiff = Math.max(1, Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1);

    const createdDate = leave.created_at ? new Date(leave.created_at) : null;
    const reviewedDate = leave.reviewed_at ? new Date(leave.reviewed_at) : null;

    let reviewerInfo = '';
    if (leave.reviewer_name && leave.reviewed_at) {
        reviewerInfo =
            '<div class="detail-divider"></div>' +
            '<div class="detail-row">' +
            '<span class="detail-label">Reviewed By</span>' +
            '<span class="detail-value">' + leave.reviewer_name + '</span>' +
            '</div>' +
            '<div class="detail-row">' +
            '<span class="detail-label">Reviewed On</span>' +
            '<span class="detail-value">' + formatDate(leave.reviewed_at) + '</span>' +
            '</div>' +
            (leave.reviewer_reason ? '<div class="detail-row"><span class="detail-label">Manager Note</span></div><div style="background-color: #f9fafb; padding: 12px; border-radius: 8px; font-size: 14px; color: #374151; margin-bottom: 16px;">' + leave.reviewer_reason + '</div>' : '');
    }

    leaveDetailContent.innerHTML =
        '<div class="detail-row">' +
        '<span class="detail-label">Leave ID</span>' +
        '<span class="detail-value">#' + leave.id + '</span>' +
        '</div>' +
        '<div class="detail-row">' +
        '<span class="detail-label">Leave Type</span>' +
        '<span class="detail-value">' + capitalizeFirst(leave.leave_type) + '</span>' +
        '</div>' +
        '<div class="detail-row">' +
        '<span class="detail-label">Start Date</span>' +
        '<span class="detail-value">' + formatDate(leave.start_date) + '</span>' +
        '</div>' +
        '<div class="detail-row">' +
        '<span class="detail-label">End Date</span>' +
        '<span class="detail-value">' + formatDate(leave.end_date) + '</span>' +
        '</div>' +
        '<div class="detail-row">' +
        '<span class="detail-label">Duration</span>' +
        '<span class="detail-value">' + daysDiff + ' day(s)</span>' +
        '</div>' +
        '<div class="detail-row">' +
        '<span class="detail-label">Status</span>' +
        '<span class="detail-value"><span class="status-badge ' + leave.status.toLowerCase() + '">' + capitalizeFirst(leave.status) + '</span></span>' +
        '</div>' +
        '<div class="detail-divider"></div>' +
        '<div class="detail-row">' +
        '<span class="detail-label">Reason</span>' +
        '</div>' +
        '<div style="background-color: #f9fafb; padding: 12px; border-radius: 8px; font-size: 14px; color: #374151; line-height: 1.6; margin-bottom: 16px;">' + (leave.reason || "No reason provided") + '</div>' +
        (leave.status !== "pending" && (leave.reviewer_name || leave.reviewed_at || leave.reviewer_reason) ?
            '<div class="review-status-panel"><strong>Status updated by manager</strong>' +
            (leave.reviewer_name ? '<span>Updated by: ' + leave.reviewer_name + '</span>' : '') +
            (leave.reviewed_at ? '<span>Updated on: ' + formatDate(leave.reviewed_at) + '</span>' : '') +
            (leave.reviewer_reason ? '<span>Manager note: ' + leave.reviewer_reason + '</span>' : '') +
            '</div>' : '') +
        reviewerInfo +
        (createdDate ?
            '<div class="detail-row">' +
            '<span class="detail-label">Applied On</span>' +
            '<span class="detail-value">' + formatDate(createdDate.toISOString()) + '</span>' +
            '</div>' : '') +
        (leave.status === "pending" ?
            '<div class="detail-actions"><button type="button" id="modalWithdrawLeaveButton" class="secondary-button">Withdraw Leave</button></div>' :
         leave.status === "approved" && leave.has_pending_cancellation ?
            '<div class="detail-actions"><span class="status-badge pending" style="display:inline-block; padding: 8px 14px;">Cancellation request already pending — please wait for review</span></div>' :
         leave.status === "approved" ?
            '<div class="detail-actions"><button type="button" id="modalCancelLeaveButton" class="secondary-button" style="color: #b91c1c; border-color: #fecaca; background: #fff7f7;">Request Cancellation</button></div>' : '');

    const modalWithdrawButton = document.getElementById("modalWithdrawLeaveButton");
    if (modalWithdrawButton) {
        modalWithdrawButton.addEventListener("click", async function () {
            leaveDetailOverlay.classList.add("hidden");
            await withdrawSingleLeave(leave.id);
        });
    }

    const modalCancelButton = document.getElementById("modalCancelLeaveButton");
    if (modalCancelButton) {
        modalCancelButton.addEventListener("click", async function () {
            leaveDetailOverlay.classList.add("hidden");
            await requestLeaveCancellation(leave.id);
        });
    }

    leaveDetailOverlay.classList.remove("hidden");
}

// ===== Calendar =====
async function getCalendarLeaves() {
    try {
        const response = await fetch("http://localhost:3000/api/leaves/calendar", {
            method: "GET",
            headers: { "Authorization": "Bearer " + token }
        });

        const data = await response.json();

        if (!response.ok) {
            if (response.status === 401) {
                handleUnauthorized();
                return;
            }
            return;
        }

        calendarLeaves = data.leaves || [];
        saveToStorage(STORAGE_KEYS.CALENDAR_LEAVES, calendarLeaves);
        renderCalendar();
    } catch (error) {
        console.error("Calendar request error", error);
    }
}

function handleUnauthorized() {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("username");
    window.location.href = "index.html";
}

// ===== Initialize on page load =====
console.log("Employee dashboard initializing...");
console.log("Token:", token ? "Present" : "Missing");
console.log("Role:", role);

// Render stored data first (for faster UX)
if (myLeaves.length > 0) {
    renderMyLeavesTable();
}
if (calendarLeaves.length > 0) {
    renderCalendar();
}

// Then fetch fresh data
getCalendarLeaves();
fetchLeaveBalance();
if (!myLeaves.length) {
    loadMyLeaves();
}
