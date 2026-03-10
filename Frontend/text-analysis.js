document.addEventListener("DOMContentLoaded", function () {
  const API_ORIGIN = ["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? "http://localhost:5000"
    : "https://feelwise-emotion-detection.onrender.com";
  const analyzeBtn = document.getElementById("analyzeBtn");
  const userInput = document.getElementById("userInput");
  const wordCountEl = document.getElementById("wordCount");
  const emotionResult = document.getElementById("emotionResult");
  const recommendationsContent = document.getElementById(
    "recommendationsContent"
  );
  const dailyChallengeContent = document.getElementById(
    "dailyChallengeContent"
  );
  const dailyTipContent = document.getElementById("dailyTipContent");
  const timeFilters = document.querySelectorAll(".time-filter");
  let progressChart;

  // Backend API configuration
  const API_BASE = `${API_ORIGIN}/api`;
  const token = localStorage.getItem("token");
  let currentUserId = null;

  initProgressChart();
  loadDailyTip();
  initializeUserContext();

  analyzeBtn.addEventListener("click", function () {
    const text = userInput.value.trim();
    if (text === "") {
      alert("Please enter some text to analyze");
      return;
    }
    analyzeText(text);
  });

  timeFilters.forEach((filter) => {
    filter.addEventListener("click", function () {
      timeFilters.forEach((f) => f.classList.remove("active"));
      this.classList.add("active");
      updateProgressChart(this.dataset.period);
    });
  });

  // Initialize user context for backend integration
  async function initializeUserContext() {
    if (token) {
      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const user = await res.json();
          currentUserId = user.id || user._id;
          console.log("Current user ID:", currentUserId);
          loadUserAnalysisHistory();
        }
      } catch (error) {
        console.error("Error getting user context:", error);
        currentUserId = "guest";
      }
    } else {
      currentUserId = "guest";
    }
  }

  // Get user-specific localStorage key
  function getUserSpecificKey(baseKey) {
    return currentUserId ? `${baseKey}_${currentUserId}` : `${baseKey}_guest`;
  }

async function analyzeText(text) {
  emotionResult.innerHTML =
    '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Analyzing your text...</div>';

  try {
    const response = await fetch(`${API_ORIGIN}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text }),
    });

    if (!response.ok) {
      throw new Error(`Analysis failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.sarcasm_detected) {
      showSarcasmAlert();
    }

    if (data && data.emotion_distribution) {
      const formattedResults = formatAnalysisResults(data);
      displayAnalysisResults(formattedResults);

      updateRecommendations(data.emotion_distribution, data.sarcasm_detected);
      updateDailyChallenge(data.emotion_distribution, data.sarcasm_detected);

      // ⬅️ NEW: update daily tip based on emotion
      const dominantEmotion = Object.entries(data.emotion_distribution)
        .reduce((a, b) => (a[1] > b[1] ? a : b))[0];
      updateDailyTipWithEmotion(dominantEmotion);

      await saveAnalysisToHistory(formattedResults);
      await saveAnalysisToBackend(formattedResults);

      updateProgressChart("daily");
      showAssessmentReportOption();
    } else {
      throw new Error("Invalid data structure from server");
    }
  } catch (error) {
    console.error("Error:", error);
    emotionResult.innerHTML =
      '<p class="error"><i class="fas fa-exclamation-circle"></i> Failed to analyze text. Please try again.</p>';
  }
}
function updateRecommendations(emotionDistribution, sarcasmDetected = false) {
  let recommendations = [];
  const entries = Object.entries(emotionDistribution);

  if (entries.length === 0) {
    recommendationsContent.innerHTML =
      '<p>No specific recommendations available for this analysis.</p>';
    return;
  }

  const dominantEmotion = entries.reduce((a, b) => (a[1] > b[1] ? a : b))[0];
  const moodDisplayName = getMoodDisplayName(dominantEmotion);
  const quizPageUrl = getQuizPageUrl(dominantEmotion);

  const recMap = {
    joy: [
      "Your joy is contagious! Consider sharing your happiness with others today.",
      "Capture this positive moment by journaling about what's making you happy.",
      "Use this positive energy to try something new or creative.",
      `Perform the daily ${moodDisplayName.toLowerCase()} quiz to boost your mood further.`,
    ],
    love: [
      "Nurture your loving feelings - reach out to someone you care about.",
      "Practice self-love with a small act of kindness for yourself.",
      "Consider volunteering or helping others to spread your loving energy.",
      `Take the ${moodDisplayName.toLowerCase()} quiz to explore your positive emotions.`,
    ],
    surprise: [
      "Embrace the unexpected! Try going with the flow today.",
      "Channel your surprise into curiosity - learn something new.",
      "Reflect on what surprised you and how it made you feel.",
      `Explore the ${moodDisplayName.toLowerCase()} quiz for more positive insights.`,
    ],
    sadness: [
      "Be gentle with yourself. It's okay to feel sad sometimes.",
      "Consider talking to a trusted friend about how you're feeling.",
      "Engage in comforting activities like listening to soothing music or taking a warm bath.",
      `Take the ${moodDisplayName.toLowerCase()} quiz to help process your emotions.`,
    ],
    anger: [
      "Try physical activity to release angry energy in a healthy way.",
      "Practice deep breathing (4-7-8 technique) to calm your nervous system.",
      "Identify the source of your anger and consider constructive ways to address it.",
      `Complete the ${moodDisplayName.toLowerCase()} quiz to help manage your emotions better.`,
    ],
    fear: [
      "Ground yourself with the 5-4-3-2-1 technique.",
      "Write down your fears to process them more objectively.",
      "Practice progressive muscle relaxation to reduce physical tension.",
      `Take the ${moodDisplayName.toLowerCase()} quiz to build confidence and reduce fear.`,
    ],
    neutral: [
      "Take a moment to reflect on your current emotional state.",
      "Practice mindfulness to become more aware of subtle emotions.",
      "Consider keeping a mood journal to track emotional patterns.",
      `Take a general mood quiz to explore different emotional states.`,
    ],
  };

  recommendations.push(...(recMap[dominantEmotion] || recMap.neutral));

  // Sarcasm modifier
  if (sarcasmDetected) {
    recommendations.unshift(
      "Your text suggests sarcasm. It might be helpful to explore what's behind these feelings."
    );
  }

  let html = "<ul>";
  recommendations.forEach((rec) => (html += `<li>${rec}</li>`));
  html += "</ul>";

  html += `
    <div style="margin-top: 15px; text-align: center;">
      <button onclick="navigateToQuizPage('${dominantEmotion}')" class="quiz-btn">
        <i class="fas fa-brain"></i> Take ${moodDisplayName} Quiz
      </button>
    </div>
  `;

  recommendationsContent.innerHTML = html;

  // ⬅️ NEW: Update Daily Tip with emotion-specific content
  updateDailyTipWithEmotion(dominantEmotion);
}
function updateDailyTipWithEmotion(emotion) {
  const normalizedEmotion = emotion.toLowerCase();

  const emotionTips = {
    joy: {
      tip: "Your joy is contagious! Sharing positive moments amplifies happiness for you and others.",
      page: "happyTips.html",
      emoji: "😊"
    },
    happiness: {
      tip: "Happiness is a journey, not a destination. Savor this wonderful feeling!",
      page: "happyTips.html",
      emoji: "😊"
    },
    happy: {
      tip: "Your positive energy can brighten someone's day. Keep spreading joy!",
      page: "happyTips.html",
      emoji: "😊"
    },
    sadness: {
      tip: "It's okay to feel sad. Allow yourself to process these emotions with self-compassion.",
      page: "sadTips.html",
      emoji: "☹️"
    },
    sad: {
      tip: "Be gentle with yourself during difficult times. Healing takes time.",
      page: "sadTips.html",
      emoji: "☹️"
    },
    anger: {
      tip: "Take a moment to breathe before reacting. Your emotions are valid, but how you express them matters.",
      page: "angryTips.html",
      emoji: "😠"
    },
    angry: {
      tip: "Channel your anger into positive action. Physical activity can help release tension.",
      page: "angryTips.html",
      emoji: "😠"
    },
    fear: {
      tip: "Face your fears one small step at a time. Courage is not the absence of fear, but action despite it.",
      page: "fearTips.html",
      emoji: "😰"
    },
    surprise: {
      tip: "Embrace the unexpected! Life's surprises can lead to growth and new opportunities.",
      page: "surpriseTips.html",
      emoji: "😲"
    },
    surprised: {
      tip: "Stay curious and open-minded when faced with the unexpected.",
      page: "surpriseTips.html",
      emoji: "😲"
    },
    love: {
      tip: "Love is a powerful emotion. Express it freely and nurture the connections that matter.",
      page: "loveTips.html",
      emoji: "💖"
    },
    disgust: {
      tip: "Identify what's causing discomfort and take steps to address it constructively.",
      page: "angryTips.html",
      emoji: "😠"
    },
    neutral: {
      tip: "Being in a calm state is an opportunity for reflection and self-awareness.",
      page: "wellnessTips.html",
      emoji: "😊"
    }
  };

  const tipData = emotionTips[normalizedEmotion] || emotionTips["neutral"];

  const html = `
    <div class="tip-icon">
      <span style="font-size: 2rem;">${tipData.emoji}</span>
    </div>
    <p style="margin-bottom: 1.5rem;">${tipData.tip}</p>
    <a href="${tipData.page}"
       style="
         display: inline-block;
         padding: 12px 24px;
         background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%);
         color: white;
         text-decoration: none;
         border-radius: 25px;
         font-weight: 600;
         transition: all 0.3s ease;
         box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3);
       "
    >
      View ${normalizedEmotion.charAt(0).toUpperCase() + normalizedEmotion.slice(1)} Wellness Tips
    </a>
  `;

  dailyTipContent.innerHTML = html;
}


  function showSarcasmAlert() {
    // Create a subtle notification for sarcasm
    const existingAlert = document.querySelector('.sarcasm-alert');
    if (existingAlert) existingAlert.remove();
    
    const alertDiv = document.createElement('div');
    alertDiv.className = 'sarcasm-alert';
    alertDiv.innerHTML = `
      <i class="fas fa-theater-masks"></i>
      <span>Sarcasm detected in your text. Analysis adjusted accordingly.</span>
      <button class="close-alert">&times;</button>
    `;
    
    document.querySelector('.input-section').appendChild(alertDiv);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (alertDiv.parentNode) {
        alertDiv.style.opacity = '0';
        setTimeout(() => alertDiv.parentNode.removeChild(alertDiv), 300);
      }
    }, 5000);
    
    // Close button
    alertDiv.querySelector('.close-alert').addEventListener('click', () => {
      alertDiv.parentNode.removeChild(alertDiv);
    });
  }

  function formatAnalysisResults(data) {
    const emotions = data.emotion_distribution || {};
    const sentiment = data.sentiment || { positive: 0, negative: 0, neutral: 0 };
    const dominantEmotion = data.emotion;
    const negationDetected = data.negation_detected || false;
    const sarcasmDetected = data.sarcasm_detected || false;
    
    // Create interpretation note
    let interpretationNote = "";
    if (sarcasmDetected) {
        interpretationNote = "Sarcasm detected - sentiment results inverted";
    }
    if (negationDetected) {
        interpretationNote += (interpretationNote ? "; " : "") + "Negation detected";
    }
    
    return {
        text: userInput.value.trim(),
        emotions: {
            positive: sentiment.positive || 0,
            negative: sentiment.negative || 0,
            neutral: sentiment.neutral || 0
        },
        dominantEmotion: dominantEmotion,
        emotionDetails: emotions,
        interpretationNote: interpretationNote,
        sarcasmDetected: sarcasmDetected,
        negationDetected: negationDetected,
        timestamp: new Date().toISOString(),
        userId: currentUserId,
    };
  }

  function displayAnalysisResults(results) {
    let html = `<h3>Dominant Emotion: <span class="emotion-tag ${getEmotionClass(results.dominantEmotion)}">${results.dominantEmotion}</span></h3>`;
    
    if (results.interpretationNote) {
        html += `<div class="interpretation-note ${results.sarcasmDetected ? 'sarcasm' : ''}">
                    <i class="fas fa-${results.sarcasmDetected ? 'theater-masks' : 'exclamation-triangle'}"></i> 
                    ${results.interpretationNote}
                 </div>`;
    }
    
    html += '<div class="emotion-breakdown">';
    html += `<div class="meter">
                <div class="meter-label">
                    <span>Positive</span>
                    <span>${results.emotions.positive.toFixed(1)}%</span>
                </div>
                <div class="meter-bar">
                    <div class="meter-fill positive" style="width: ${results.emotions.positive}%"></div>
                </div>
            </div>`;
    
    html += `<div class="meter">
                <div class="meter-label">
                    <span>Negative</span>
                    <span>${results.emotions.negative.toFixed(1)}%</span>
                </div>
                <div class="meter-bar">
                    <div class="meter-fill negative" style="width: ${results.emotions.negative}%"></div>
                </div>
            </div>`;
    
    html += `<div class="meter">
                <div class="meter-label">
                    <span>Neutral</span>
                    <span>${results.emotions.neutral.toFixed(1)}%</span>
                </div>
                <div class="meter-bar">
                    <div class="meter-fill neutral" style="width: ${results.emotions.neutral}%"></div>
                </div>
            </div>`;
    html += '</div>';
    
    // Show emotion details only if there are significant emotions
    const significantEmotions = Object.entries(results.emotionDetails).filter(([_, percent]) => percent > 5);
    if (significantEmotions.length > 0) {
        html += '<h4>Detailed Emotion Distribution:</h4><div class="emotion-tags">';
        significantEmotions.sort((a, b) => b[1] - a[1]).forEach(([emotion, percent]) => {
            html += `<span class="emotion-tag ${getEmotionClass(emotion)}" title="${emotion}: ${percent.toFixed(1)}%">
                        ${emotion} (${percent.toFixed(1)}%)
                    </span>`;
        });
        html += '</div>';
    }
    
    emotionResult.innerHTML = html;
  }

  function getEmotionClass(emotion) {
    const positiveEmotions = ["joy", "love", "surprise"];
    const negativeEmotions = ["sadness", "anger", "fear"];
    if (positiveEmotions.includes(emotion)) return "positive";
    if (negativeEmotions.includes(emotion)) return "negative";
    return "neutral";
  }

  // Helper function to get quiz page URL for recommendations
  function getQuizPageUrl(emotion) {
    const quizPages = {
      joy: "happyQuiz.html",
      love: "happyQuiz.html",
      surprise: "happyQuiz.html",
      sadness: "sadQuiz.html",
      anger: "angryQuiz.html",
      fear: "anxiousQuiz.html",
      neutral: "happyQuiz.html"
    };
    return quizPages[emotion] || "happyQuiz.html";
  }

  // Helper function to get challenge page URL for daily challenges
  function getChallengePageUrl(emotion) {
    const challengePages = {
      joy: "happy.html",
      love: "happy.html",
      surprise: "happy.html",
      sadness: "sad.html",
      anger: "angry.html",
      fear: "anxious.html",
      neutral: "happy.html"
    };
    return challengePages[emotion] || "happy.html";
  }

  // Helper function to get mood display name
  function getMoodDisplayName(emotion) {
    const moodNames = {
      joy: "Happy",
      love: "Loving",
      surprise: "Surprised",
      sadness: "Sad",
      anger: "Angry",
      fear: "Anxious",
      neutral: "Neutral"
    };
    return moodNames[emotion] || "Happy";
  }


  function updateDailyChallenge(emotionDistribution, sarcasmDetected = false) {
    const entries = Object.entries(emotionDistribution);
    if (entries.length === 0) {
      dailyChallengeContent.innerHTML = '<h3>Daily Challenge</h3><p>Practice mindfulness for 5 minutes today.</p>';
      return;
    }
    
    const dominantEmotion = entries.reduce((a, b) => a[1] > b[1] ? a : b)[0];
    const moodDisplayName = getMoodDisplayName(dominantEmotion);
    const challengePageUrl = getChallengePageUrl(dominantEmotion);

    const challenges = {
      joy: [
        "Spread Joy",
        "Your challenge today is to intentionally share your joy with at least three people.",
        "Take the Happy Challenge to explore more ways to amplify your joy!"
      ],
      love: [
        "Express Love",
        "Express love in three different ways today - to yourself, someone close, and a stranger.",
        "Take the Happy Challenge to discover more loving activities!"
      ],
      surprise: [
        "Embrace Uncertainty",
        "Do something spontaneous or try something new today.",
        "Take the Happy Challenge for more delightful surprises!"
      ],
      sadness: [
        "Self-Compassion",
        "Treat yourself kindly—write a compassionate letter or rest.",
        "Take the Sad Challenge to work through your emotions constructively!"
      ],
      anger: [
        "Channel Energy",
        "Channel your anger into something constructive like cleaning or art.",
        "Take the Angry Challenge to learn healthy anger management techniques!"
      ],
      fear: [
        "Small Brave Step",
        "Take one small step toward something that scares you.",
        "Take the Anxious Challenge to build confidence and overcome fears!"
      ],
      neutral: [
        "Mindful Awareness",
        "Practice being present and aware of your surroundings for 10 minutes.",
        "Take a mindfulness challenge to improve emotional awareness!"
      ]
    };

    const [title, explanation, challengePrompt] = challenges[dominantEmotion] || challenges.neutral;

    let html = `<h3>${title}</h3><p>${explanation}</p>`;
    html += `<p style="margin-top: 15px; font-style: italic; color: #666;">${challengePrompt}</p>`;
    
    // Adjust for sarcasm
    if (sarcasmDetected) {
      html += `<p style="margin-top: 10px; color: #ff9800; font-weight: bold;">
                <i class="fas fa-lightbulb"></i> Since sarcasm was detected, consider exploring underlying feelings.
               </p>`;
    }
    
    // Add challenge button for daily challenges
    html += `
      <div style="margin-top: 15px; text-align: center;">
        <button 
          onclick="navigateToChallengePage('${dominantEmotion}')" 
          class="challenge-btn"
        >
          <i class="fas fa-tasks"></i> Take the ${moodDisplayName} Challenge
        </button>
      </div>
    `;

    dailyChallengeContent.innerHTML = html;
  }

  // Navigation function for mood-specific quiz pages
  function navigateToQuizPage(emotion) {
    const quizPageUrl = getQuizPageUrl(emotion);
    
    // Store the current emotion in sessionStorage for the quiz page to use
    sessionStorage.setItem('currentMoodFromAnalysis', emotion);
    sessionStorage.setItem('analysisTimestamp', new Date().toISOString());
    
    // Navigate to the appropriate quiz page
    window.location.href = quizPageUrl;
  }

  // Navigation function for mood-specific challenge pages
  function navigateToChallengePage(emotion) {
    const challengePageUrl = getChallengePageUrl(emotion);
    
    // Store the current emotion in sessionStorage for the challenge page to use
    sessionStorage.setItem('currentMoodFromAnalysis', emotion);
    sessionStorage.setItem('analysisTimestamp', new Date().toISOString());
    
    // Navigate to the appropriate challenge page
    window.location.href = challengePageUrl;
  }

  // Make the navigation functions globally available
  window.navigateToQuizPage = navigateToQuizPage;
  window.navigateToChallengePage = navigateToChallengePage;

  function loadDailyTip() {
    const tips = [
      "Practice the 4-7-8 breathing technique.",
      "Gratitude journaling for just 5 minutes a day can significantly improve your mood.",
      "Emotions are temporary - remind yourself 'This too shall pass'.",
      "Physical activity, even a short walk, can reduce stress.",
      "Prioritize 7-9 hours of quality sleep.",
      "Limit social media if it affects your mood.",
      "Naming emotions reduces their intensity.",
      "Time in nature reduces negative emotions.",
      "Helping others boosts your positive emotions.",
      "Mindful eating helps connect with emotional needs.",
    ];
    const randomTip = tips[Math.floor(Math.random() * tips.length)];
    dailyTipContent.innerHTML = `<p><i class="fas fa-lightbulb"></i> ${randomTip}</p>`;
  }

  function initProgressChart() {
    const ctx = document.getElementById("progressChart").getContext("2d");
    progressChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["Positive", "Negative", "Neutral"],
        datasets: [
          {
            label: "Emotion Distribution",
            data: [30, 20, 50],
            backgroundColor: [
              "rgba(102, 187, 106, 0.7)",
              "rgba(239, 83, 80, 0.7)",
              "rgba(255, 202, 40, 0.7)",
            ],
            borderColor: [
              "rgba(102, 187, 106, 1)",
              "rgba(239, 83, 80, 1)",
              "rgba(255, 202, 40, 1)",
            ],
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              callback: function(value) {
                return value + '%';
              }
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return context.dataset.label + ': ' + context.parsed.y + '%';
              }
            }
          }
        }
      },
    });
  }

  async function updateProgressChart(period) {
    try {
      let analyses = [];

      // Get user-specific analysis history
      if (token && currentUserId !== "guest") {
        try {
          const res = await fetch(
            `${API_BASE}/text-analysis/history/${period}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          if (res.ok) {
            analyses = await res.json();
          }
        } catch (error) {
          console.log("Failed to load from database, using localStorage");
        }
      }

      // Fallback to localStorage if database fails or user is guest
      if (analyses.length === 0) {
        const userHistoryKey = getUserSpecificKey("emotionHistory");
        const allAnalyses =
          JSON.parse(localStorage.getItem(userHistoryKey)) || [];

        // Filter by period
        const now = new Date();
        const filterDate = new Date();

        if (period === "daily") {
          filterDate.setDate(now.getDate() - 1);
        } else if (period === "weekly") {
          filterDate.setDate(now.getDate() - 7);
        } else {
          filterDate.setMonth(now.getMonth() - 1);
        }

        analyses = allAnalyses.filter(
          (analysis) => new Date(analysis.timestamp) >= filterDate
        );
      }

      // Calculate averages
      let totalPositive = 0,
        totalNegative = 0,
        totalNeutral = 0;

      if (analyses.length > 0) {
        analyses.forEach((analysis) => {
          totalPositive += analysis.emotions.positive || 0;
          totalNegative += analysis.emotions.negative || 0;
          totalNeutral += analysis.emotions.neutral || 0;
        });

        totalPositive = totalPositive / analyses.length;
        totalNegative = totalNegative / analyses.length;
        totalNeutral = totalNeutral / analyses.length;
      } else {
        // Default values if no data
        totalPositive = Math.floor(Math.random() * 30) + 30;
        totalNegative = Math.floor(Math.random() * 20) + 10;
        totalNeutral = 100 - totalPositive - totalNegative;
      }

      progressChart.data.datasets[0].data = [
        totalPositive,
        totalNegative,
        totalNeutral,
      ];
      progressChart.update();
    } catch (error) {
      console.error("Error updating progress chart:", error);
    }
  }

  // Save analysis to localStorage (user-specific)
  function saveAnalysisToHistory(result) {
    const userHistoryKey = getUserSpecificKey("emotionHistory");
    let history = JSON.parse(localStorage.getItem(userHistoryKey)) || [];
    history.push(result);
    // Keep only last 50 entries
    if (history.length > 50) {
      history = history.slice(-50);
    }
    localStorage.setItem(userHistoryKey, JSON.stringify(history));
  }

  // Save analysis to backend
  async function saveAnalysisToBackend(result) {
    if (!token || currentUserId === "guest") {
      console.log("Guest user - analysis saved locally only");
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/text-analysis/save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          text: result.text,
          emotions: result.emotions,
          dominantEmotion: result.dominantEmotion,
          emotionDetails: result.emotionDetails,
          sarcasmDetected: result.sarcasmDetected,
          negationDetected: result.negationDetected,
          timestamp: result.timestamp,
        }),
      });

      if (response.ok) {
        console.log("Analysis saved to backend successfully");
      } else {
        console.error("Failed to save analysis to backend");
      }
    } catch (error) {
      console.error("Error saving to backend:", error);
    }
  }

  // Load user analysis history from backend
  async function loadUserAnalysisHistory() {
    if (!token || currentUserId === "guest") return;

    try {
      const response = await fetch(`${API_BASE}/text-analysis/history`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const history = await response.json();
        console.log(`Loaded ${history.length} analyses from backend`);
        localStorage.setItem(
          getUserSpecificKey("emotionHistory"),
          JSON.stringify(history)
        );
      }
    } catch (error) {
      console.error("Error loading analysis history:", error);
    }
  }

  // Show assessment report option after analysis
  function showAssessmentReportOption() {
    // Instead of adding a button, save the latest analysis for report page access
    sessionStorage.setItem("latestAnalysisCompleted", "true");
    sessionStorage.setItem("latestAnalysisTime", new Date().toISOString());

    // Show a subtle notification that report is available
    const notification = document.createElement("div");
    notification.className = "analysis-complete-notification";
    notification.innerHTML = `
      <i class="fas fa-chart-line"></i>
      <span>Analysis complete! View detailed report in History section.</span>
    `;

    // Remove existing notification if present
    const existingNotification = document.querySelector(
      ".analysis-complete-notification"
    );
    if (existingNotification) {
      existingNotification.remove();
    }

    emotionResult.appendChild(notification);
  }

  // Get user progress summary
  async function getUserProgressSummary() {
    try {
      let analyses = [];

      if (token && currentUserId !== "guest") {
        try {
          const res = await fetch(`${API_BASE}/text-analysis/history`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            analyses = await res.json();
          }
        } catch (error) {
          console.log("Using localStorage data for progress summary");
        }
      }

      if (analyses.length === 0) {
        const userHistoryKey = getUserSpecificKey("emotionHistory");
        analyses = JSON.parse(localStorage.getItem(userHistoryKey)) || [];
      }

      return {
        totalAnalyses: analyses.length,
        recentAnalyses: analyses.slice(-10).reverse(),
        emotionalTrends: analyses.reduce((trends, analysis) => {
          const emotion = analysis.dominantEmotion;
          trends[emotion] = (trends[emotion] || 0) + 1;
          return trends;
        }, {}),
        averageEmotions:
          analyses.length > 0
            ? {
                positive:
                  analyses.reduce(
                    (sum, a) => sum + (a.emotions.positive || 0),
                    0
                  ) / analyses.length,
                negative:
                  analyses.reduce(
                    (sum, a) => sum + (a.emotions.negative || 0),
                    0
                  ) / analyses.length,
                neutral:
                  analyses.reduce(
                    (sum, a) => sum + (a.emotions.neutral || 0),
                    0
                  ) / analyses.length,
              }
            : { positive: 0, negative: 0, neutral: 0 },
      };
    } catch (error) {
      console.error("Error getting user progress summary:", error);
      return {
        totalAnalyses: 0,
        recentAnalyses: [],
        emotionalTrends: {},
        averageEmotions: { positive: 0, negative: 0, neutral: 0 },
      };
    }
  }

  // Initialize authentication check
  function checkAuthenticationStatus() {
    if (token) {
      console.log("User is authenticated - syncing enabled");
    } else {
      console.log("Guest user - local storage only");
    }
  }

  function classifyEmotion(emotion) {
    if (!emotion) return "neutral";

    const normalizedEmotion = emotion.toLowerCase();
    const positiveEmotions = ["joy", "love", "surprise", "happy", "happiness"];
    const negativeEmotions = ["sadness", "sad", "anger", "angry", "fear", "anxious", "disgust"];

    if (positiveEmotions.includes(normalizedEmotion)) return "positive";
    if (negativeEmotions.includes(normalizedEmotion)) return "negative";
    return "neutral";
  }

  function generateReportData(data, type = "text") {
    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }

    const timestamps = data
      .map((entry) => new Date(entry.timestamp || entry.createdAt || Date.now()))
      .filter((date) => !Number.isNaN(date.getTime()));
    const oldestAnalysis = timestamps.length
      ? new Date(Math.min(...timestamps))
      : new Date();
    const daysDiff = Math.max(
      1,
      Math.ceil((Date.now() - oldestAnalysis.getTime()) / (1000 * 60 * 60 * 24))
    );

    const emotionTrends = {};
    const emotionFrequency = {};
    const totalEmotions = { positive: 0, negative: 0, neutral: 0 };

    data.forEach((analysis) => {
      const dominantEmotion =
        analysis.dominantEmotion || analysis.emotion || "neutral";
      emotionTrends[dominantEmotion] =
        (emotionTrends[dominantEmotion] || 0) + 1;
      emotionFrequency[dominantEmotion] =
        (emotionFrequency[dominantEmotion] || 0) + 1;

      if (type === "text") {
        totalEmotions.positive += analysis.emotions?.positive || 0;
        totalEmotions.negative += analysis.emotions?.negative || 0;
        totalEmotions.neutral += analysis.emotions?.neutral || 0;
      } else {
        const emotionClass = classifyEmotion(dominantEmotion);
        totalEmotions[emotionClass] += 100;
      }
    });

    const dominantEmotion = Object.keys(emotionTrends).length
      ? Object.entries(emotionTrends).reduce((best, current) =>
          current[1] > best[1] ? current : best
        )[0]
      : "neutral";

    return {
      totalAnalyses: data.length,
      timeRange: `${daysDiff} days`,
      emotionTrends,
      emotionFrequency,
      averageEmotions: {
        positive: totalEmotions.positive / data.length,
        negative: totalEmotions.negative / data.length,
        neutral: totalEmotions.neutral / data.length,
      },
      dominantEmotion,
      allData: data,
    };
  }

  async function generateAssessmentReport() {
    const summary = await getUserProgressSummary();
    return generateReportData(summary.recentAnalyses || [], "text");
  }

  async function prepareReportForPage() {
    const report = await generateAssessmentReport();
    if (report) {
      sessionStorage.setItem("textAssessmentReport", JSON.stringify(report));
    }
    return report;
  }

  async function exportUserAnalysisData() {
    const summary = await getUserProgressSummary();
    const blob = new Blob([JSON.stringify(summary, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `feelwise-text-analysis-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function syncAnalysisData() {
    if (!token || currentUserId === "guest") {
      return {
        synced: false,
        reason: "guest",
      };
    }

    await loadUserAnalysisHistory();
    return {
      synced: true,
      history: JSON.parse(
        localStorage.getItem(getUserSpecificKey("emotionHistory")) || "[]"
      ),
    };
  }

  async function deleteAnalysis(analysisId) {
    if (!analysisId) {
      throw new Error("Analysis ID is required");
    }

    if (token && currentUserId !== "guest") {
      const response = await fetch(`${API_BASE}/text-analysis/${analysisId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Delete failed: ${response.status}`);
      }
    }

    const userHistoryKey = getUserSpecificKey("emotionHistory");
    const history = JSON.parse(localStorage.getItem(userHistoryKey) || "[]");
    const nextHistory = history.filter((entry) => {
      const entryId = entry._id || entry.id;
      return entryId !== analysisId;
    });
    localStorage.setItem(userHistoryKey, JSON.stringify(nextHistory));

    return true;
  }

  async function recordTextAnalysisChallenge(mood, challenge = "text-analysis") {
    if (!token || currentUserId === "guest") {
      return { saved: false, reason: "guest" };
    }

    const response = await fetch(`${API_BASE}/progress/complete-challenge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ mood, challenge }),
    });

    if (!response.ok) {
      throw new Error(`Challenge save failed: ${response.status}`);
    }

    return response.json();
  }

  // Make functions available globally
  window.generateAssessmentReport = generateAssessmentReport;
  window.prepareReportForPage = prepareReportForPage;
  window.exportUserAnalysisData = exportUserAnalysisData;
  window.syncAnalysisData = syncAnalysisData;
  window.deleteAnalysis = deleteAnalysis;
  window.getUserProgressSummary = getUserProgressSummary;
  window.recordTextAnalysisChallenge = recordTextAnalysisChallenge;
  window.getCurrentUserId = () => currentUserId;
  window.getUserSpecificKey = getUserSpecificKey;
  window.generateReportData = generateReportData;

  // Auto-sync when user logs in/out
  window.addEventListener("storage", function (e) {
    if (e.key === "token") {
      location.reload(); // Reload to re-initialize with new auth status
    }
  });

  // Check auth status on load
  checkAuthenticationStatus();

  // Word count functionality
  if (wordCountEl) {
    userInput.addEventListener('input', function() {
      const text = this.value.trim();
      const words = text.split(/\s+/).filter(word => word.length > 0);
      const wordCount = words.length;
      
      if (text.length > 0) {
        wordCountEl.style.display = 'block';
        wordCountEl.textContent = `${wordCount} word${wordCount !== 1 ? 's' : ''}`;
      } else {
        wordCountEl.style.display = 'none';
      }
    });
  }

  // Add CSS for new elements
  const style = document.createElement('style');
  style.textContent = `
    .sarcasm-alert {
      background: linear-gradient(135deg, #ff9800 0%, #ff5722 100%);
      color: white;
      padding: 10px 15px;
      border-radius: 8px;
      margin: 10px 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      animation: slideIn 0.3s ease;
      box-shadow: 0 3px 10px rgba(255, 152, 0, 0.3);
    }
    
    .sarcasm-alert i {
      margin-right: 10px;
      font-size: 1.2em;
    }
    
    .close-alert {
      background: none;
      border: none;
      color: white;
      font-size: 1.5em;
      cursor: pointer;
      padding: 0 5px;
    }
    
    .interpretation-note.sarcasm {
      background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
      border-left: 4px solid #ff9800;
      color: #856404;
    }
    
    .quiz-btn, .challenge-btn {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 25px;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
    }
    
    .challenge-btn {
      background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%);
      color: #333;
    }
    
    .quiz-btn:hover, .challenge-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
    }
    
    .challenge-btn:hover {
      box-shadow: 0 6px 20px rgba(255, 154, 158, 0.4);
    }
    
    .loading {
      text-align: center;
      padding: 20px;
      color: #666;
    }
    
    .loading i {
      margin-right: 10px;
      color: #6366F1;
    }
    
    @keyframes slideIn {
      from { transform: translateY(-10px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
});
  
