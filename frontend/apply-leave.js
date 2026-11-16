const token = localStorage.getItem("token");
const role = localStorage.getItem("role");
const username = localStorage.getItem("username");

if (!token || role !== "employee") {
    window.location.href = "index.html";
}

// ===== Profile Dropdown =====
const profileMenuButton = document.getElementById("profileMenuButton");
const profileMenu = document.getElementById("profileMenu");
const headerEmployeeName = document.getElementById("headerEmployeeName");

if (headerEmployeeName) {
    headerEmployeeName.textContent = username || "Employee";
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
        window.location.href = "index.html";
    });
}

// ===== Form Elements =====
const form = document.getElementById("applyLeaveForm");
const leaveTypeInput = document.getElementById("leaveType");
const startDateInput = document.getElementById("startDate");
const endDateInput = document.getElementById("endDate");
const reasonInput = document.getElementById("reason");
const charCount = document.getElementById("charCount");
const leaveFormMessage = document.getElementById("leaveFormMessage");
const submitLeaveButton = document.getElementById("submitLeaveButton");

function capitalizeFirst(value) {
    if (!value) return "";
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

// ===== Approved Leave Calendar =====
let calendarDate = new Date();
calendarDate.setDate(1);
let calendarLeaves = [];
const previousMonthBtn = document.getElementById("previousMonth");
const nextMonthBtn = document.getElementById("nextMonth");
const calendarModal = document.getElementById("calendarModal");
const calendarModalTitle = document.getElementById("calendarModalTitle");
const calendarModalBody = document.getElementById("calendarModalBody");

function formatCalendarDate(value) {
    return new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function getApprovedLeavesForDate(year, month, day) {
    const date = [year, String(month + 1).padStart(2, "0"), String(day).padStart(2, "0")].join("-");
    return calendarLeaves.filter(leave => leave.status === "approved" && date >= leave.start_date && date <= leave.end_date);
}

function renderCalendar() {
    const grid = document.getElementById("calendarGrid");
    const monthHeading = document.getElementById("calendarMonth");
    if (!grid || !monthHeading) return;

    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    monthHeading.textContent = calendarDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    grid.replaceChildren();

    ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach(day => {
        const heading = document.createElement("div");
        heading.className = "weekday";
        heading.textContent = day;
        grid.appendChild(heading);
    });

    for (let index = 0; index < new Date(year, month, 1).getDay(); index += 1) {
        const empty = document.createElement("div");
        empty.className = "empty-day";
        grid.appendChild(empty);
    }

    for (let day = 1; day <= new Date(year, month + 1, 0).getDate(); day += 1) {
        const dayButton = document.createElement("button");
        dayButton.type = "button";
        dayButton.className = "calendar-day";
        const leaves = getApprovedLeavesForDate(year, month, day);
        const number = document.createElement("span");
        number.className = "day-number";
        number.textContent = day;
        dayButton.appendChild(number);
        if (leaves.length) {
            dayButton.classList.add("has-leave", "status-approved");
            dayButton.title = "Approved leave";
        }
        dayButton.addEventListener("click", () => showCalendarDetails(year, month, day, leaves));
        grid.appendChild(dayButton);
    }
}

function showCalendarDetails(year, month, day, leaves) {
    if (!calendarModal || !calendarModalTitle || !calendarModalBody) return;
    calendarModalTitle.textContent = new Date(year, month, day).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    calendarModalBody.innerHTML = leaves.length
        ? leaves.map(leave => `<article class="calendar-modal-leave"><div class="calendar-modal-leave-info"><h4>${capitalizeFirst(leave.leave_type)} Leave</h4><p>${formatCalendarDate(leave.start_date)} to ${formatCalendarDate(leave.end_date)}</p><p>${leave.reason || "No reason provided"}</p></div><span class="status-badge approved">Approved</span></article>`).join("")
        : '<div class="calendar-modal-empty"><span class="calendar-empty-icon">✓</span><p>No approved leave on this date.</p></div>';
    calendarModal.classList.remove("hidden");
    calendarModal.classList.add("active");
}

function closeCalendarModal() {
    calendarModal?.classList.add("hidden");
    calendarModal?.classList.remove("active");
}

previousMonthBtn?.addEventListener("click", () => { calendarDate.setMonth(calendarDate.getMonth() - 1); renderCalendar(); });
nextMonthBtn?.addEventListener("click", () => { calendarDate.setMonth(calendarDate.getMonth() + 1); renderCalendar(); });
document.getElementById("closeCalendarModal")?.addEventListener("click", closeCalendarModal);
calendarModal?.querySelector(".calendar-modal-backdrop")?.addEventListener("click", closeCalendarModal);

// ===== Character Count =====
if (reasonInput && charCount) {
    reasonInput.addEventListener("input", function () {
        charCount.textContent = this.value.length;
    });
}

// ===== Leave Balance State =====
let leaveBalance = null;

// ===== Load Leave Balance =====
async function loadLeaveBalance() {
    try {
        const response = await fetch("http://localhost:3000/api/balance", {
            method: "GET",
            headers: {
                "Authorization": "Bearer " + token
            }
        });

        if (response.ok) {
            const data = await response.json();
            leaveBalance = data.balance;

            if (leaveBalance) {
                // Update balance cards with available/total format
                document.getElementById("balanceAnnual").textContent = `${Math.max(0, leaveBalance.annual.available)}/${leaveBalance.annual.total}`;
                document.getElementById("balanceCasual").textContent = `${Math.max(0, leaveBalance.casual.available)}/${leaveBalance.casual.total}`;
                document.getElementById("balanceSick").textContent = `${Math.max(0, leaveBalance.sick.available)}/${leaveBalance.sick.total}`;
                document.getElementById("balancePersonal").textContent = `${Math.max(0, leaveBalance.personal.available)}/${leaveBalance.personal.total}`;
            }
        } else {
            // Show error message when API fails
            document.getElementById("balanceAnnual").textContent = "Leaves fetch failed";
            document.getElementById("balanceCasual").textContent = "Leaves fetch failed";
            document.getElementById("balanceSick").textContent = "Leaves fetch failed";
            document.getElementById("balancePersonal").textContent = "Leaves fetch failed";
        }
    } catch (error) {
        console.error("Error loading leave balance:", error);
        // Show error message on connection failure
        document.getElementById("balanceAnnual").textContent = "Leaves fetch failed";
        document.getElementById("balanceCasual").textContent = "Leaves fetch failed";
        document.getElementById("balanceSick").textContent = "Leaves fetch failed";
        document.getElementById("balancePersonal").textContent = "Leaves fetch failed";
    }
}

// ===== Check Leave Availability =====
function checkLeaveAvailability() {
    if (!leaveBalance) return true;

    const leaveType = leaveTypeInput.value.toLowerCase();
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;

    if (!leaveType || !startDate || !endDate) return true;

    // Calculate duration
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    const duration = Math.ceil((endDateObj - startDateObj) / (1000 * 60 * 60 * 24)) + 1;

    // Check availability
    const typeBalance = leaveBalance[leaveType];
    if (!typeBalance) return true;

    const available = Math.max(0, typeBalance.available);
    const hasEnough = available >= duration;

    // Update form message when the requested duration exceeds the available balance.
    const messageElement = document.getElementById("leaveFormMessage");
    if (messageElement) {
        if (hasEnough) {
            messageElement.textContent = "";
            messageElement.className = "form-message";
        } else if (available === 0) {
            messageElement.textContent = `You are out of ${leaveTypeInput.value} leave. Please contact your manager for assistance.`;
            messageElement.className = "form-message warning";
        } else {
            messageElement.textContent = `Insufficient ${leaveTypeInput.value} leave. Available: ${available}, Required: ${duration}. Please contact your manager for assistance.`;
            messageElement.className = "form-message warning";
        }
    }

    if (submitLeaveButton) submitLeaveButton.disabled = !hasEnough;
    return hasEnough;
}

// Add event listeners for real-time validation
if (leaveTypeInput) {
    leaveTypeInput.addEventListener("change", function() {
        setTimeout(checkLeaveAvailability, 100);
    });
}

if (startDateInput) {
    startDateInput.addEventListener("change", function() {
        setTimeout(checkLeaveAvailability, 100);
    });
}

if (endDateInput) {
    endDateInput.addEventListener("change", function() {
        setTimeout(checkLeaveAvailability, 100);
    });
}

// ===== Set Minimum Date =====
function setMinDate() {
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    startDateInput.min = today;
    endDateInput.min = today;
}

setMinDate();

// ===== Date Validation =====
startDateInput.addEventListener("change", function () {
    endDateInput.min = this.value;
    if (endDateInput.value && endDateInput.value < this.value) {
        endDateInput.value = this.value;
    }
});

// ===== Form Submit =====
form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const now = new Date();
    const today = now.toISOString().split("T")[0];

    // Clear previous messages
    leaveFormMessage.textContent = "";
    leaveFormMessage.className = "form-message";

    // Validation
    if (startDateInput.value < today) {
        leaveFormMessage.textContent = "Start date cannot be in the past.";
        leaveFormMessage.className = "form-message error";
        startDateInput.focus();
        return;
    }

    if (endDateInput.value < startDateInput.value) {
        leaveFormMessage.textContent = "End date must be on or after start date.";
        leaveFormMessage.className = "form-message error";
        endDateInput.focus();
        return;
    }

    // Disable button during submission
    submitLeaveButton.disabled = true;
    submitLeaveButton.textContent = "Submitting...";

    const leaveData = {
        leave_type: leaveTypeInput.value,
        start_date: startDateInput.value,
        end_date: endDateInput.value,
        reason: reasonInput.value
    };

    try {
        const response = await fetch("http://localhost:3000/api/leaves", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify(leaveData)
        });

        const responseData = await response.json();

        if (!response.ok) {
            leaveFormMessage.textContent = responseData.message || "Failed to submit leave request.";
            leaveFormMessage.className = "form-message error";
            submitLeaveButton.disabled = false;
            submitLeaveButton.textContent = "Submit Leave Request";
            return;
        }

        leaveFormMessage.textContent = "Leave request submitted successfully! Redirecting...";
        leaveFormMessage.className = "form-message success";

        // Redirect after short delay
        setTimeout(function () {
            window.location.href = "employee.html";
        }, 1500);

    } catch (error) {
        console.error("Error:", error);
        leaveFormMessage.textContent = "Unable to connect to the server. Please try again.";
        leaveFormMessage.className = "form-message error";
        submitLeaveButton.disabled = false;
        submitLeaveButton.textContent = "Submit Leave Request";
    }
});

// Initialize
loadLeaveBalance();

async function loadApprovedLeaveCalendar() {
    try {
        const response = await fetch("http://localhost:3000/api/leaves/calendar", { headers: { "Authorization": "Bearer " + token } });
        if (!response.ok) return;
        const data = await response.json();
        calendarLeaves = (data.leaves || []).filter(leave => leave.status === "approved");
        renderCalendar();
    } catch (error) {
        console.error("Error loading approved leave calendar:", error);
    }
}

loadApprovedLeaveCalendar();