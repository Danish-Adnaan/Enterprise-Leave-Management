
const form = document.getElementById("LoginForm")

form.addEventListener("submit", async function(e){
    e.preventDefault();

    const username = document.getElementById("username").value.trim()
    const password = document.getElementById("password").value;
    const selectedRole = form.querySelector('input[name="role"]:checked')?.value;
    
    if(!username || !password || !selectedRole){
        alert("Please enter your username, password and role.")
        return;
    }

    const loginData = {
        username,
        password,
        role: selectedRole
    };

    try{
        const response = await fetch("http://localhost:3000/api/login",{
            method: "POST",
            headers: {
                "Content-Type" : "application/json"
            },
            body: JSON.stringify(loginData)
        });

        let responseData;

        try{
            responseData = await response.json()
        } catch {
            responseData = {};
        }

        if (!response.ok){
            alert(responseData.message || "Login failed. Please try again.");
            return;
        }

        if (!responseData.token || !responseData.role){
            alert("The server returned an incomplete login response");
            return;
        }

        localStorage.removeItem("token");
        localStorage.removeItem("role");
        localStorage.removeItem("username");


        localStorage.setItem("token", responseData.token)

        localStorage.setItem("role", responseData.role);

        localStorage.setItem("username", responseData.username);

        if (responseData.role === "employee"){
            window.location.href = "employee.html";
        } else if (responseData.role === "manager"){
            window.location.href = "manager.html"
        } else {
            localStorage.clear();
            alert("The server returned an unsupported role.")
        }
        
    } catch (error){
        console.error("Login request failed: ", error)
        alert("Unable to conect to the server")
    }
});

