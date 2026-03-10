

      // API Configuration
      const API_ORIGIN = ["localhost", "127.0.0.1"].includes(window.location.hostname)
        ? "http://localhost:5000"
        : "https://feelwise-emotion-detection.onrender.com";
      const API_BASE = `${API_ORIGIN}/api/auth`;
      const token = localStorage.getItem("token");

      if (!token) {
        window.location.href = "login.html";
      }

      // DOM Elements
      const welcomeText = document.getElementById("welcome-text");
      const userAvatar = document.getElementById("user-avatar");
      const headerAvatar = document.getElementById("header-avatar");
      const usernameDisplay = document.getElementById("username-display");
      const emailDisplay = document.getElementById("email-display");
      const moodDisplay = document.getElementById("mood-display");
      const headerUsername = document.getElementById("header-username");

      // Settings modal elements
      const settingsBtn = document.getElementById("settings-btn");
      const settingsModal = document.getElementById("settings-modal");
      const closeModal = document.getElementById("close-modal");
      const saveChangesBtn = document.getElementById("save-changes");
      const logoutBtn = document.getElementById("logout-btn");
      const settingsNotification = document.getElementById(
        "settings-notification"
      );

      // Form inputs
      const usernameInput = document.getElementById("username");
      const currentPasswordInput = document.getElementById("current-password");
      const newPasswordInput = document.getElementById("new-password");
      const confirmPasswordInput = document.getElementById("confirm-password");

      // Image upload elements
      const changeAvatarBtn = document.getElementById("change-avatar-btn");
      const uploadAvatarBtn = document.getElementById("upload-avatar-btn");
      const removeAvatarBtn = document.getElementById("remove-avatar-btn");
      const imageModal = document.getElementById("image-modal");
      const avatarInput = document.getElementById("avatar-input");
      const imagePreview = document.getElementById("image-preview");
      const confirmUpload = document.getElementById("confirm-upload");
      const cancelUpload = document.getElementById("cancel-upload");
      const cancelUploadBtn = document.getElementById("cancel-upload-btn");

      // Mood tracking
      const ayahContainer = document.getElementById("ayah-container");
      const moodOptions = document.querySelectorAll(".mood-option");
      const submitMoodBtn = document.getElementById("submit-mood-btn");
      let selectedMood = null;

      // Mood Ayahs
      const moodAyahs = {
        Happy:
          "Verily, in the remembrance of Allah do hearts find rest. (Surah Ar-Ra'd 13:28)",
        Sad: "Do not grieve; indeed Allah is with us. (Surah At-Tawbah 9:40)",
        Angry:
          "Those who restrain anger and pardon people – and Allah loves those who do good. (Surah Al-Imran 3:134)",
        Neutral: "And He found you lost and guided you. (Surah Ad-Duha 93:7)",
      };
      function cap(str) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}


      // Load user profile
      async function loadProfile() {
        try {
          const response = await fetch(`${API_BASE}/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (response.status === 401) {
            window.location.href = "login.html";
            return;
          }

          const user = await response.json();

          // Update UI elements
          if (user.username) {
            usernameDisplay.textContent = user.username;
            headerUsername.textContent = `Hello ${user.username}`;
            welcomeText.textContent = `Welcome, ${user.username}!`;
            usernameInput.value = user.username;
          }

          if (user.email) {
            emailDisplay.textContent = user.email;
          }

          if (user.image) {
            userAvatar.src = `${API_ORIGIN}${user.image}`;
            headerAvatar.src = `${API_ORIGIN}${user.image}`;
          }

          if (user.mood) {
            moodDisplay.textContent = `Mood: ${user.mood}`;
            ayahContainer.textContent = moodAyahs[cap(user.mood)] || "";

            ayahContainer.style.display = "block";
          }
        } catch (error) {
          console.error("Error loading profile:", error);
        }
      }

      // Initialize
      loadProfile();

      // Settings Modal
      settingsBtn.addEventListener("click", () => {
        settingsModal.classList.add("active");
      });

      closeModal.addEventListener("click", () => {
        settingsModal.classList.remove("active");
        clearForm();
      });

      settingsModal.addEventListener("click", (e) => {
        if (e.target === settingsModal) {
          settingsModal.classList.remove("active");
          clearForm();
        }
      });

      function clearForm() {
        currentPasswordInput.value = "";
        newPasswordInput.value = "";
        confirmPasswordInput.value = "";
        settingsNotification.style.display = "none";
      }

      // Save changes
      saveChangesBtn.addEventListener("click", async () => {
        const newUsername = usernameInput.value.trim();
        const currentPassword = currentPasswordInput.value;
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        if (!currentPassword) {
          showNotification("Current password is required", "error");
          return;
        }

        if (newPassword && newPassword !== confirmPassword) {
          showNotification("New passwords do not match", "error");
          return;
        }

        try {
          const updateData = {
            currentPassword,
            username: newUsername,
          };

          if (newPassword) {
            updateData.newPassword = newPassword;
          }

          const response = await fetch(`${API_BASE}/update-profile`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(updateData),
          });

          const data = await response.json();

          if (response.ok) {
            showNotification("Profile updated successfully!", "success");
            usernameDisplay.textContent = newUsername;
            headerUsername.textContent = `Hello ${newUsername}`;
            welcomeText.textContent = `Welcome, ${newUsername}!`;
            clearForm();
          } else {
            showNotification(data.error || "Failed to update profile", "error");
          }
        } catch (error) {
          showNotification("An error occurred. Please try again.", "error");
        }
      });

      function showNotification(message, type) {
        settingsNotification.textContent = message;
        settingsNotification.className = `notification ${type}`;
        settingsNotification.style.display = "block";

        setTimeout(() => {
          settingsNotification.style.display = "none";
        }, 3000);
      }

      // Logout
      logoutBtn.addEventListener("click", async () => {
        if (confirm("Are you sure you want to logout?")) {
          try {
            await fetch(`${API_BASE}/logout`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
            });
          } catch (error) {
            console.error("Logout error:", error);
          } finally {
            localStorage.removeItem("token");
            window.location.href = "login.html";
          }
        }
      });

      // Image Upload
      changeAvatarBtn.addEventListener("click", () => {
        imageModal.classList.add("active");
      });

      uploadAvatarBtn.addEventListener("click", () => {
        imageModal.classList.add("active");
      });

      [cancelUpload, cancelUploadBtn].forEach((btn) => {
        btn.addEventListener("click", () => {
          imageModal.classList.remove("active");
          avatarInput.value = "";
          imagePreview.style.display = "none";
        });
      });

      avatarInput.addEventListener("change", function () {
        if (this.files && this.files[0]) {
          const reader = new FileReader();
          reader.onload = function (e) {
            imagePreview.src = e.target.result;
            imagePreview.style.display = "block";
          };
          reader.readAsDataURL(this.files[0]);
        }
      });

      confirmUpload.addEventListener("click", async () => {
        if (!avatarInput.files.length) {
          alert("Please select an image first.");
          return;
        }

        const formData = new FormData();
        formData.append("image", avatarInput.files[0]);

        try {
          const response = await fetch(`${API_BASE}/upload-avatar`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          });

          const data = await response.json();

          if (response.ok) {
            userAvatar.src = `${API_ORIGIN}${data.image}`;
            headerAvatar.src = `${API_ORIGIN}${data.image}`;
            imageModal.classList.remove("active");
            avatarInput.value = "";
            imagePreview.style.display = "none";
            alert("Profile picture updated successfully!");
          } else {
            alert(data.error || "Failed to upload image");
          }
        } catch (error) {
          alert("An error occurred while uploading the image.");
        }
      });

      removeAvatarBtn.addEventListener("click", async () => {
        if (!confirm("Are you sure you want to remove your profile picture?"))
          return;

        try {
          const response = await fetch(`${API_BASE}/remove-avatar`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });

          if (response.ok) {
            const defaultImage =
              "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png";
            userAvatar.src = defaultImage;
            headerAvatar.src = defaultImage;
            alert("Profile picture removed successfully!");
          } else {
            const data = await response.json();
            alert(data.error || "Failed to remove profile picture");
          }
        } catch (error) {
          alert("An error occurred while removing the profile picture.");
        }
      });

      // Mood Tracking
      moodOptions.forEach((option) => {
        option.addEventListener("click", function () {
          moodOptions.forEach((opt) => opt.classList.remove("selected"));
          this.classList.add("selected");
          selectedMood = this.getAttribute("data-mood");
        });
      });

      submitMoodBtn.addEventListener("click", async () => {
        if (!selectedMood) {
          alert("Please select a mood first.");
          return;
        }

        try {
          const response = await fetch(`${API_BASE}/mood`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ mood: selectedMood }),
          });

          const data = await response.json();

          if (response.ok) {
            moodDisplay.textContent = `Mood: ${data.mood}`;
            ayahContainer.textContent = moodAyahs[cap(data.mood)] || "";
            ayahContainer.style.display = "block";
          } else {
            alert(data.error || "Failed to update mood");
          }
        } catch (error) {
          alert("An error occurred while updating mood.");
        }
      });
