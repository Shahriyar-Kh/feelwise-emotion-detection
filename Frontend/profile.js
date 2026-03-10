// profile-mongo.js
const API_ORIGIN = ["localhost", "127.0.0.1"].includes(window.location.hostname)
  ? "http://localhost:5000"
  : "https://feelwise-emotion-detection.onrender.com";
const API_BASE = `${API_ORIGIN}/api/auth`;

const token = localStorage.getItem("token");
if (!token) window.location.href = "login.html";

// DOM refs
const welcomeText = document.getElementById("welcome-text");
const userAvatar = document.getElementById("user-avatar");

const usernameH2 = document.querySelector(".user-details .username h2");
const emailH2 = document.querySelector(".user-details .email h2");
const currentMoodH2 = document.querySelector(".user-details .current-mood h2");

// New: container for showing translated ayah
const ayahContainer = document.getElementById("ayah-container");

const moodOptions = document.querySelectorAll(".mood-option");
const submitMoodBtn = document.getElementById("submit-mood-btn");
let selectedMood = null;

// moods mapped to translated ayahs
const moodAyahs = {
  happy: "“Verily, in the remembrance of Allah do hearts find rest.” (Surah Ar-Ra’d 13:28)",
  sad: "“Do not grieve; indeed Allah is with us.” (Surah At-Tawbah 9:40)",
  angry: "“Those who restrain anger and pardon people – and Allah loves those who do good.” (Surah Al-Imran 3:134)",
  neutral: "“And He found you lost and guided you.” (Surah Ad-Duha 93:7)",
};

// load profile
async function loadMe() {
  const res = await fetch(`${API_BASE}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) return (window.location.href = "login.html");

  const me = await res.json();

  // Fill UI
  welcomeText.textContent = `Welcome , ${me.username || "User"}! 🌟`;
  if (me.image) userAvatar.src = `${API_ORIGIN}${me.image}`;
  if (usernameH2) usernameH2.textContent = me.username || "UserName";
  if (emailH2) emailH2.textContent = me.email || "Email";
  if (currentMoodH2)
    currentMoodH2.textContent = me.mood
      ? `Current Mood: ${me.mood}`
      : "Current Mood";

  // show ayah if already set
  if (me.mood && ayahContainer) {
    ayahContainer.textContent = moodAyahs[me.mood.toLowerCase()] || "";
  }
}
loadMe();

// mood option selection
moodOptions.forEach((option) => {
  option.addEventListener("click", function () {
    moodOptions.forEach((opt) => opt.classList.remove("selected"));
    this.classList.add("selected");
    selectedMood = this.getAttribute("data-mood");
  });
});

// submit mood
if (submitMoodBtn) {
  submitMoodBtn.addEventListener("click", async () => {
    if (!selectedMood) return alert("Please select a mood first.");
    const res = await fetch(`${API_BASE}/mood`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ mood: selectedMood }),
    });
    const data = await res.json();
    if (res.ok) {
      if (currentMoodH2)
        currentMoodH2.textContent = `Current Mood: ${data.mood}`;

      // Show translated ayah inline instead of popup
      if (ayahContainer) {
        ayahContainer.textContent =
          moodAyahs[data.mood.toLowerCase()] || "Stay strong with faith.";
      }
    } else {
      alert(data.error || "Failed to update mood");
    }
  });
}

// avatar upload (form: #avatar-form, input: #avatar-input)
const avatarForm = document.getElementById("avatar-form");
if (avatarForm) {
  avatarForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById("avatar-input");
    if (!fileInput.files.length) return alert("Please select an image first.");

    const fd = new FormData();
    fd.append("image", fileInput.files[0]);

    const res = await fetch(`${API_BASE}/upload-avatar`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });

    const data = await res.json();
    if (res.ok) {
      userAvatar.src = `${API_ORIGIN}${data.image}`;
      alert("Profile picture updated!");
      fileInput.value = "";
    } else {
      alert(data.error || "Failed to upload image");
    }
  });
}
