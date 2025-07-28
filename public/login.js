document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("auth-form");
    const formTitle = document.getElementById("form-title");
    const toggleForm = document.getElementById("toggle-form");
    let isLogin = true;

    // Toggle between login and signup
    toggleForm.addEventListener("click", (e) => {
        e.preventDefault();
        isLogin = !isLogin;
        formTitle.innerText = isLogin ? "Login" : "Sign Up";
        toggleForm.innerHTML = isLogin 
            ? `Don't have an account? <a href="#">Sign Up</a>`
            : `Already have an account? <a href="#">Login</a>`;
    });

    // Handle form submission
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const username = document.getElementById("username").value;
        const password = document.getElementById("password").value;

        const endpoint = isLogin ? "/login" : "/signup";
        const response = await fetch(`https://www.mnnit-map-backend.onrender.com${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
        });

        const data = await response.json();
        if (response.ok) {
            alert(isLogin ? "Login successful!" : "Signup successful!");
            if (isLogin) {
                localStorage.setItem("token", data.token); // Store JWT token
                window.location.href = "/dashboard.html";  // Redirect after login
            }
        } else {
            alert(data.error);
        }
    });
});
