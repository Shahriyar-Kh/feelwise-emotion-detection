const API_ORIGIN = ["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? "http://localhost:5000"
    : "https://feelwise-emotion-detection.onrender.com";
const API_BASE = `${API_ORIGIN}/api/auth`;
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const successMessage = document.getElementById("success-message");
const forgotPasswordLink = document.getElementById("forgot-password");

// Login functionality
loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.style.display = "none";
    successMessage.style.display = "none";

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    try {
        const res = await fetch(`${API_BASE}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });

        const data = await res.json();

        if (!res.ok) {
            loginError.style.display = "block";
            loginError.textContent = data.error || "Login failed";
            return;
        }

        // Store token & user (Note: Consider using more secure storage in production)
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));

        successMessage.style.display = "block";
        successMessage.textContent = "Login successful! Redirecting...";

        setTimeout(() => window.location.assign("profile.html"), 1000);
    } catch (err) {
        console.error("Login error:", err);
        loginError.style.display = "block";
        loginError.textContent = "An error occurred. Check console.";
    }
});

// Forgot Password functionality
forgotPasswordLink.addEventListener("click", (e) => {
    e.preventDefault();
    showForgotPasswordForm();
});

function showForgotPasswordForm() {
    // Hide login form elements
    const loginContainer = document.querySelector('.login-container');
    const originalContent = loginContainer.innerHTML;
    
    // Create forgot password form
    loginContainer.innerHTML = `
        <div class="logo">
            <div class="logo-circle">
                <i class="fas fa-brain"></i>
            </div>
            <div class="logo-text">
                <h1>FeelWise</h1>
                <p>Emotional Intelligence Platform</p>
            </div>
        </div>
        
        <h2>Forgot Password?</h2>
        <p style="color: rgba(255, 255, 255, 0.8); margin-bottom: 25px; font-size: 0.95rem;">
            Enter your email address and we'll send you a link to reset your password.
        </p>
        
        <form id="forgot-password-form">
            <div class="input-group">
                <i class="fas fa-envelope input-icon"></i>
                <input type="email" id="reset-email" placeholder="Email Address" required />
            </div>
            
            <p class="error-message" id="forgot-error"></p>
            <p class="success-message" id="forgot-success"></p>
            
            <button type="submit" id="send-reset-btn">
                Send Reset Link <i class="fas fa-paper-plane" style="margin-left: 8px;"></i>
            </button>
        </form>
        
        <p style="margin-top: 20px;">
            <a href="#" id="back-to-login">← Back to Login</a>
        </p>
        
        <div class="footer">
            <p>© 2023 FeelWise. All rights reserved.</p>
        </div>
    `;

    // Add event listeners for forgot password form
    const forgotForm = document.getElementById('forgot-password-form');
    const backToLogin = document.getElementById('back-to-login');
    const forgotError = document.getElementById('forgot-error');
    const forgotSuccess = document.getElementById('forgot-success');
    const sendResetBtn = document.getElementById('send-reset-btn');

    forgotForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        forgotError.style.display = "none";
        forgotSuccess.style.display = "none";

        const email = document.getElementById('reset-email').value.trim();

        // Validate email format
        const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailPattern.test(email)) {
            forgotError.style.display = "block";
            forgotError.textContent = "Please enter a valid email address";
            return;
        }

        // Disable button and show loading state
        sendResetBtn.disabled = true;
        sendResetBtn.innerHTML = 'Sending... <i class="fas fa-spinner fa-spin" style="margin-left: 8px;"></i>';

        try {
            const res = await fetch(`${API_BASE}/forgot-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });

            const data = await res.json();

            if (!res.ok) {
                forgotError.style.display = "block";
                
                if (res.status === 404) {
                    forgotError.textContent = "No account found with this email address. Please check your email and try again.";
                } else {
                    forgotError.textContent = data.error || "Failed to send reset instructions";
                }
                
                sendResetBtn.disabled = false;
                sendResetBtn.innerHTML = 'Send Reset Link <i class="fas fa-paper-plane" style="margin-left: 8px;"></i>';
                return;
            }

            forgotSuccess.style.display = "block";
            forgotSuccess.textContent = "Password reset link sent! Please check your email inbox (and spam folder).";
            
            // Disable input and button after success
            document.getElementById('reset-email').disabled = true;
            sendResetBtn.innerHTML = 'Email Sent! <i class="fas fa-check" style="margin-left: 8px;"></i>';
            
        } catch (err) {
            console.error("Forgot password error:", err);
            forgotError.style.display = "block";
            forgotError.textContent = "An error occurred. Please check your internet connection and try again.";
            
            sendResetBtn.disabled = false;
            sendResetBtn.innerHTML = 'Send Reset Link <i class="fas fa-paper-plane" style="margin-left: 8px;"></i>';
        }
    });

    backToLogin.addEventListener('click', (e) => {
        e.preventDefault();
        location.reload(); // Reload the page to show login form
    });
}

function initializeLoginForm() {
    const loginForm = document.getElementById("login-form");
    const loginError = document.getElementById("login-error");
    const successMessage = document.getElementById("success-message");
    const forgotPasswordLink = document.getElementById("forgot-password");

    // Re-add login form event listener
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        loginError.style.display = "none";
        successMessage.style.display = "none";

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        try {
            const res = await fetch(`${API_BASE}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                loginError.style.display = "block";
                loginError.textContent = data.error || "Login failed";
                return;
            }

            localStorage.setItem("token", data.token);
            localStorage.setItem("user", JSON.stringify(data.user));

            successMessage.style.display = "block";
            successMessage.textContent = "Login successful! Redirecting...";

            setTimeout(() => window.location.assign("profile.html"), 1000);
        } catch (err) {
            console.error("Login error:", err);
            loginError.style.display = "block";
            loginError.textContent = "An error occurred. Check console.";
        }
    });

    // Re-add forgot password event listener
    forgotPasswordLink.addEventListener("click", (e) => {
        e.preventDefault();
        showForgotPasswordForm();
    });
}