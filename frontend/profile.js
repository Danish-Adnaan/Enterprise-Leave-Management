const API_BASE_URL = "http://localhost:3000/api";

const token = localStorage.getItem("token");
const role = localStorage.getItem("role");
const username = localStorage.getItem("username");

if (!token || (role !== "employee" && role !== "manager")) {
    window.location.href = "index.html";
}

// ===== Profile Dropdown =====
const profileMenuButton = document.getElementById("profileMenuButton");
const profileMenu = document.getElementById("profileMenu");

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

// ===== Load User Profile Data =====
async function loadUserProfile() {
    const profileUsername = document.getElementById("profileUsername");
    const profileRoleBadge = document.getElementById("profileRoleBadge");
    const profileId = document.getElementById("profileId");
    const profileMessage = document.getElementById("profileMessage");
    const headerEmployeeName = document.getElementById("headerEmployeeName");

    try {
        const response = await fetch(`${API_BASE_URL}/users/me`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                handleUnauthorized();
                return;
            }
            throw new Error("Failed to fetch user profile");
        }

        const data = await response.json();

        // Update all profile fields
        if (profileUsername) profileUsername.textContent = data.user?.username || username || "User";
        if (profileRoleBadge) profileRoleBadge.textContent = data.user?.role ? capitalizeFirst(data.user.role) : (role ? capitalizeFirst(role) : "User");
        if (profileId) profileId.textContent = "ID: " + (data.user?.id || "N/A");
        if (headerEmployeeName) headerEmployeeName.textContent = data.user?.username || username || "Employee";
        if (profileMessage) profileMessage.textContent = "Profile loaded successfully.";

    } catch (error) {
        console.error("Error loading profile:", error);
        // Fallback to localStorage values
        if (profileUsername) profileUsername.textContent = username || "User";
        if (profileRoleBadge) profileRoleBadge.textContent = role ? capitalizeFirst(role) : "User";
        if (profileId) profileId.textContent = "ID: N/A";
        if (headerEmployeeName) headerEmployeeName.textContent = username || "Employee";
        if (profileMessage) profileMessage.textContent = "Profile loaded with limited data.";
    }
}

// ===== Password Change =====
const changePasswordForm = document.getElementById("changePasswordForm");
const currentPasswordInput = document.getElementById("currentPassword");
const newPasswordInput = document.getElementById("newPassword");
const confirmPasswordInput = document.getElementById("confirmPassword");
const passwordMessage = document.getElementById("passwordMessage");
const changePasswordButton = document.getElementById("changePasswordButton");

if (changePasswordForm) {
    changePasswordForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const currentPassword = currentPasswordInput.value;
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        // Reset messages
        passwordMessage.textContent = "";
        passwordMessage.className = "";

        // Validation
        if (newPassword !== confirmPassword) {
            passwordMessage.textContent = "New passwords do not match.";
            passwordMessage.className = "password-message error";
            confirmPasswordInput.focus();
            return;
        }

        if (currentPassword === newPassword) {
            passwordMessage.textContent = "New password must be different from current password.";
            passwordMessage.className = "password-message error";
            newPasswordInput.focus();
            return;
        }

        if (newPassword.length < 12 || newPassword.length > 72) {
            passwordMessage.textContent = "Password must be 12-72 characters.";
            passwordMessage.className = "password-message error";
            newPasswordInput.focus();
            return;
        }

        changePasswordButton.disabled = true;
        changePasswordButton.textContent = "Updating...";
        passwordMessage.textContent = "Updating password...";
        passwordMessage.className = "";

        try {
            const response = await fetch(`${API_BASE_URL}/users/change-password`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    currentPassword: currentPassword,
                    newPassword: newPassword
                })
            });

            const data = await response.json();

            if (!response.ok) {
                passwordMessage.textContent = data.message || "Failed to change password.";
                passwordMessage.className = "password-message error";
                return;
            }

            passwordMessage.textContent = "Password changed successfully.";
            passwordMessage.className = "password-message success";
            changePasswordForm.reset();
        } catch (error) {
            console.error("Password change error:", error);
            passwordMessage.textContent = "Unable to connect to the server. Please try again.";
            passwordMessage.className = "password-message error";
        } finally {
            changePasswordButton.disabled = false;
            changePasswordButton.textContent = "Update Password";
        }
    });
}

// ===== Helper Functions =====
function capitalizeFirst(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function handleUnauthorized() {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("username");
    window.location.href = "index.html";
}

// Initialize
loadUserProfile();