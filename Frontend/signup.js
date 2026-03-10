const API_ORIGIN = ["localhost", "127.0.0.1"].includes(window.location.hostname)
  ? "http://localhost:5000"
  : "https://feelwise-emotion-detection.onrender.com";
const API_BASE = `${API_ORIGIN}/api/auth`;

const signupForm = document.getElementById("signup-form");
const signupError = document.getElementById("signup-error");
const signupSuccess = document.getElementById("signup-success");

signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  console.log("Signup form submitted");

  // Hide previous messages
  signupError.style.display = "none";
  signupSuccess.style.display = "none";

  const fullName = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const dob = document.getElementById("dob").value;

  // Validate inputs
  if (!fullName || !email || !password) {
    signupError.style.display = "block";
    signupError.textContent = "Please fill in all fields";
    return;
  }

  // Email validation
  const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailPattern.test(email)) {
    signupError.style.display = "block";
    signupError.textContent = "Invalid email format";
    return;
  }

  // Password validation
  if (password.length < 6) {
    signupError.style.display = "block";
    signupError.textContent = "Password must be at least 6 characters long";
    return;
  }

  try {
    // Check if email already exists
    console.log("Checking if email exists...");
    const checkRes = await fetch(`${API_BASE}/check-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (!checkRes.ok) {
      throw new Error(`HTTP error! status: ${checkRes.status}`);
    }

    const checkData = await checkRes.json();
    console.log("Email check response:", checkData);

    if (checkData.exists) {
      signupError.style.display = "block";
      signupError.textContent = "This email is already registered. Please login or use a different email.";
      return;
    }

    // Create FormData for signup
    console.log("Registering new user...");
    const formData = new FormData();
    formData.append("username", fullName);
    formData.append("email", email);
    formData.append("password", password);
    
    // Optional: Add DOB if you want to store it
    // formData.append("dob", dob);

    const registerRes = await fetch(`${API_BASE}/register`, {
      method: "POST",
      body: formData,
    });

    console.log("Register response status:", registerRes.status);

    // Get response text first
    const responseText = await registerRes.text();
    console.log("Register response text:", responseText);

    let registerData;
    try {
      registerData = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Failed to parse response:", parseError);
      signupError.style.display = "block";
      signupError.textContent = "Server error. Please try again later.";
      return;
    }

    if (!registerRes.ok) {
      signupError.style.display = "block";
      signupError.textContent = registerData.error || "Registration failed. Please try again.";
      return;
    }

    // Success!
    signupSuccess.style.display = "block";
    signupSuccess.textContent = "Account created successfully! Redirecting to login...";

    // Disable form
    signupForm.querySelectorAll('input').forEach(input => input.disabled = true);
    signupForm.querySelector('button').disabled = true;

    // Redirect to login after 2 seconds
    setTimeout(() => {
      window.location.href = "login.html";
    }, 2000);

  } catch (err) {
    console.error("Signup error:", err);
    signupError.style.display = "block";
    signupError.textContent = "An error occurred. Please check your internet connection and try again.";
  }
});