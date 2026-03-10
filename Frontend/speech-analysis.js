document.addEventListener('DOMContentLoaded', function() {
const API_ORIGIN = ["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? "http://localhost:5000"
    : "https://feelwise-emotion-detection.onrender.com";
    // Elements
    const startBtn = document.getElementById('startRecordingBtn');
    const stopBtn = document.getElementById('stopRecordingBtn');
    const transcriptDisplay = document.getElementById('transcriptDisplay');
    const emotionResult = document.getElementById('emotionResult');
    const recommendationsContent = document.getElementById('recommendationsContent');
    const dailyChallengeContent = document.getElementById('dailyChallengeContent');
    const dailyTipContent = document.getElementById('dailyTipContent');
    const timeFilters = document.querySelectorAll('.time-filter');
    let progressChart;
        // 🆕 ADD THIS: Initialize user context
    initializeUserContext();    
    
    // Audio recording variables
    let recognition;
    let mediaRecorder;
    let audioChunks = [];
    let finalTranscript = "";
    let isAnalyzing = false;
    let audioStream = null;
    
    // Initialize on page load
    initProgressChart();
    loadDailyTip();
    initSpeechRecognition();


// Backend API configuration
const API_BASE = `${API_ORIGIN}/api`;
const token = localStorage.getItem("token");

// Initialize user context for backend integration
async function initializeUserContext() {
    if (token) {
        try {
            const res = await fetch(`${API_BASE}/auth/me`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const user = await res.json();
                window.currentUserId = user.id || user._id;
                console.log("✅ Current user ID:", window.currentUserId);
            }
        } catch (error) {
            console.error("Error getting user context:", error);
            window.currentUserId = "guest";
        }
    } else {
        window.currentUserId = "guest";
    }
}

// Get user-specific localStorage key
function getUserSpecificKey(baseKey) {
    return window.currentUserId ? `${baseKey}_${window.currentUserId}` : `${baseKey}_guest`;
}
    
    // Event listeners
    startBtn.addEventListener('click', function(event) {
        event.preventDefault();
        startRecording();
    });
    
    stopBtn.addEventListener('click', function(event) {
        event.preventDefault();
        stopRecording();
    });
    
    timeFilters.forEach(filter => {
        filter.addEventListener('click', function() {
            timeFilters.forEach(f => f.classList.remove('active'));
            this.classList.add('active');
            updateProgressChart(this.dataset.period);
        });
    });

    // Add event listener for view detailed report button
    const viewReportBtn = document.getElementById('viewDetailedReport');
    if (viewReportBtn) {
        viewReportBtn.addEventListener('click', function() {
            alert('Detailed assessment report would open here. This feature can be connected to your backend reporting system.');
        });
    }
    
    // 🆕 ADD THIS: Initialize user context
    // 🆕 ADD THIS FUNCTION
async function initializeUserContext() {
    const token = localStorage.getItem("token");
    const API_BASE = `${API_ORIGIN}/api`;
    
    if (token) {
        try {
            const res = await fetch(`${API_BASE}/auth/me`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const user = await res.json();
                window.currentUserId = user.id || user._id;
                console.log("Current user ID:", window.currentUserId);
            }
        } catch (error) {
            console.error("Error getting user context:", error);
            window.currentUserId = "guest";
        }
    } else {
        window.currentUserId = "guest";
    }
}

// 🆕 ADD THIS HELPER FUNCTION
function getUserSpecificKey(baseKey) {
    return window.currentUserId ? `${baseKey}_${window.currentUserId}` : `${baseKey}_guest`;
}

// Initialize speech recognition
function initSpeechRecognition() {
    // Check for browser support
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        console.error("Speech recognition not supported in this browser");
            startBtn.disabled = true;
            startBtn.textContent = "Speech API Not Supported";
            return;
        }
        
        // Use standard API if available, otherwise webkit prefix
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        
        recognition.onresult = (event) => {
            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript + ' ';
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            transcriptDisplay.innerHTML = finalTranscript + '<span style="color:#777">' + interimTranscript + '</span>';
        };
    
        recognition.onerror = (event) => {
            console.error("Speech recognition error:", event.error);
            transcriptDisplay.innerHTML += `<br><span style="color:red">Speech recognition error: ${event.error}</span>`;
            if (!isAnalyzing) {
                resetUI();
            }
        };
        
        recognition.onend = () => {
            console.log("[JS] Speech recognition ended");
        };
        
        console.log("[JS] Speech recognition initialized");
    }
    
    // Start recording function
    async function startRecording() {
        console.log("[JS] Start recording initiated");
        try {
            finalTranscript = "";
            transcriptDisplay.innerHTML = "Listening...";
            startBtn.disabled = true;
            stopBtn.disabled = false;
            emotionResult.innerHTML = "";
            
            // Hide progress report card when starting new recording
            const progressReportCard = document.getElementById('progressReportCard');
            if (progressReportCard) {
                progressReportCard.style.display = 'none';
            }
            
            // Start media recording
            audioStream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    channelCount: 1,
                    sampleRate: 16000,
                    sampleSize: 16
                } 
            });
            
            // Set up media recorder with WebM format (backend expects this)
            const options = { 
                mimeType: 'audio/webm; codecs=opus',
                audioBitsPerSecond: 128000
            };
            
            mediaRecorder = new MediaRecorder(audioStream, options);
            audioChunks = [];
    
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunks.push(event.data);
                }
            };
    
            mediaRecorder.onstop = async () => {
                console.log("[JS] Media recorder stopped, preparing to send data");
            };
    
            mediaRecorder.start(100); // Collect data every 100ms
            console.log("[JS] Media recorder started");
    
            // Start speech recognition
            if (recognition) {
                recognition.start();
                console.log("[JS] Speech recognition started");
            }
        } catch (error) {
            console.error("Error starting recording:", error);
            transcriptDisplay.innerHTML = "Error accessing microphone: " + error.message;
            resetUI();
        }
    }
    
    // Stop recording function
    async function stopRecording() {
        console.log("[JS] Stop recording initiated");
        
        if (!mediaRecorder || mediaRecorder.state === 'inactive') {
            console.log("[JS] Media recorder is inactive, returning");
            resetUI();
            return;
        }
        
        isAnalyzing = true;
        stopBtn.disabled = true;
        transcriptDisplay.innerHTML += "<br>Processing...";
    
        try {
            // Stop media recorder
            mediaRecorder.stop();
            console.log("[JS] Media recorder stopped");
            
            // Stop speech recognition
            if (recognition) {
                recognition.stop();
                console.log("[JS] Speech recognition stopped");
            }
            
            // Stop audio stream
            if (audioStream) {
                audioStream.getTracks().forEach(track => track.stop());
                audioStream = null;
            }
            
            // Wait for data to be available
            await new Promise(resolve => {
                if (mediaRecorder.state === 'inactive') {
                    resolve();
                } else {
                    mediaRecorder.onstop = resolve;
                }
            });
            
            // Check if we have audio data
            if (audioChunks.length === 0) {
                throw new Error("No audio data recorded");
            }
            
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            console.log("[JS] Audio blob created, size:", audioBlob.size);
            
            if (audioBlob.size < 1000) { // Minimum 1KB of audio data
                throw new Error("Audio recording is too short");
            }
            
            const audioBase64 = await blobToBase64(audioBlob);
            console.log("[JS] Audio blob converted to base64, length:", audioBase64.length);
            
            if (audioBase64) {
                console.log("[JS] Calling analyzeSpeech function");
                await analyzeSpeech(finalTranscript, audioBase64);
            }
        } catch (error) {
            console.error("Error stopping recording:", error);
            transcriptDisplay.innerHTML += `<br><span style="color:red">Error: ${error.message}</span>`;
            resetUI();
        }
    }


// Add this new function after saveSpeechAnalysisToHistory
// Enhanced save function with backend support
async function saveSpeechAnalysisToHistory(result) {
    try {
        // Save to localStorage
        const baseKey = 'speechAnalysisHistory';
        const userKey = getUserSpecificKey(baseKey);

        let history = JSON.parse(localStorage.getItem(userKey)) || [];

        // Build entry
        const entry = {
            type: 'speech',
            emotion: (result.emotion || result.raw_label || 'neutral'),
            confidence: typeof result.confidence === 'number' ? result.confidence : 
                       (result.probabilities ? Math.max(...Object.values(result.probabilities)) * 100 : 75),
            transcript: result.transcript || '',
            top3: result.top3 || result.top_emotions || [],
            probabilities: result.probabilities || {},
            duration_sec: result.duration_sec || null,
            timestamp: result.timestamp || new Date().toISOString(),
            userId: (window.currentUserId || 'guest'),
        };

        history.push(entry);
        if (history.length > 100) history = history.slice(-100);

        localStorage.setItem(userKey, JSON.stringify(history));
        console.log('✅ Speech analysis saved to localStorage (key):', userKey);
        console.log('✅ Total speech analyses:', history.length);

        // Also save to backend if user is logged in
        await saveSpeechAnalysisToBackend(entry);
        
    } catch (err) {
        console.warn('⚠️ Failed to save speech analysis:', err);
        // Retry with trimming
        try {
            const userKey = getUserSpecificKey('speechAnalysisHistory');
            let history = JSON.parse(localStorage.getItem(userKey)) || [];
            history = history.slice(-20); // keep last 20
            history.push(entry);
            localStorage.setItem(userKey, JSON.stringify(history));
            console.log('✅ Saved after trimming old entries');
        } catch (e) {
            console.error('❌ Still could not save speech history:', e);
        }
    }
}

// Save speech analysis to backend
async function saveSpeechAnalysisToBackend(entry) {
    if (!token || window.currentUserId === "guest") {
        console.log("Guest user - speech analysis saved locally only");
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/speech-analysis/save`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                emotion: entry.emotion,
                confidence: entry.confidence,
                transcript: entry.transcript,
                probabilities: entry.probabilities,
                top3: entry.top3,
                duration_sec: entry.duration_sec,
                timestamp: entry.timestamp
            })
        });

        if (response.ok) {
            console.log("✅ Speech analysis saved to backend successfully");
        } else {
            console.error("❌ Failed to save speech analysis to backend:", response.status);
        }
    } catch (error) {
        console.error("❌ Error saving speech analysis to backend:", error);
    }
}
// --- end: add to speech-analysis.js ---

    
 
    // Display analysis results with detailed emotion probabilities
    function displayAnalysisResults(data) {
        console.log("displayAnalysisResults called with:", data);
        if (!data || typeof data !== 'object') {
            throw new Error("displayAnalysisResults: invalid data");
        }
        const rawEmotion = (data.emotion || data.raw_label || "neutral").toString();
        const emotion = rawEmotion.toLowerCase();
        const safeEmotionLabel = emotion.charAt(0).toUpperCase() + emotion.slice(1);
        const recommendation = data.recommendation || "No recommendation provided";

        // Show detailed emotion analysis in the regular emotion result
        if (emotionResult) {
            let emotionHTML = `
                <h3>Detected Emotion: <span class="emotion-tag ${getEmotionClass(emotion)}">${safeEmotionLabel}</span></h3>
                <p><strong>Recommendation:</strong> ${recommendation}</p>
            `;

            // Add emotion probabilities if available
            if (data.probabilities) {
                emotionHTML += `<div class="emotion-probabilities">
                    <h4>Emotion Probabilities:</h4>
                    <div class="probabilities-grid">`;

                // Sort emotions by probability (descending)
                const sortedEmotions = Object.entries(data.probabilities)
                    .sort(([,a], [,b]) => b - a);

                sortedEmotions.forEach(([emotionName, probability]) => {
                    const percentage = (probability * 100).toFixed(1);
                    emotionHTML += `
                        <div class="probability-item">
                            <span class="emotion-name">${emotionName.charAt(0).toUpperCase() + emotionName.slice(1)}</span>
                            <div class="probability-bar-container">
                                <div class="probability-bar" style="width: ${percentage}%"></div>
                            </div>
                            <span class="probability-value">${percentage}%</span>
                        </div>
                    `;
                });

                emotionHTML += `</div></div>`;
            }

            // Add top emotions if available
            if (data.top_emotions && Array.isArray(data.top_emotions)) {
                emotionHTML += `<div class="top-emotions">
                    <h4>Top Emotions:</h4>
                    <div class="top-emotions-list">`;

                data.top_emotions.forEach(([emotionName, probability], index) => {
                    const percentage = (probability * 100).toFixed(1);
                    const rank = index + 1;
                    emotionHTML += `
                        <div class="top-emotion-item">
                            <span class="rank">${rank}.</span>
                            <span class="emotion-name">${emotionName.charAt(0).toUpperCase() + emotionName.slice(1)}</span>
                            <span class="probability-value">${percentage}%</span>
                        </div>
                    `;
                });

                emotionHTML += `</div></div>`;
            }

            emotionResult.innerHTML = emotionHTML;
        }

        // Update the progress report card with emotion distribution
        updateProgressReportCard(data);

        // Show backend daily challenge if provided
        if (data.daily_challenge && dailyChallengeContent) {
            dailyChallengeContent.innerHTML = `<p>${data.daily_challenge}</p>`;
        }

        // Show backend daily tip if provided
        if (data.daily_tip && dailyTipContent) {
            dailyTipContent.innerHTML = `<p>${data.daily_tip}</p>`;
        }

        // Clear "Processing..." message
        transcriptDisplay.innerHTML += "<br><span style='color:green'>Analysis complete ✓</span>";
         // 🆕 ADD THIS: Save the analysis to history
    // 🆕 ADD THIS: Save the analysis to history
    saveSpeechAnalysisToHistory({
        emotion: data.emotion || data.raw_label,
        raw_label: data.raw_label,
        confidence: typeof data.confidence === 'number' ? data.confidence : 
                   (data.probabilities ? Math.max(...Object.values(data.probabilities)) * 100 : 75),
        transcript: finalTranscript || '',
        probabilities: data.probabilities || {},
        top3: data.top3 || data.top_emotions || [],
        duration_sec: data.duration_sec || null,
        timestamp: new Date().toISOString()
    });
    }

    // New function to update the progress report card
    function updateProgressReportCard(data) {
        const progressReportCard = document.getElementById('progressReportCard');
        const dominantEmotion = document.getElementById('dominantEmotion');
        
        if (!progressReportCard || !dominantEmotion) return;
        
        // Show the progress report card
        progressReportCard.style.display = 'block';
        
        // Get emotion data - use backend probabilities if available
        let emotionData = {
            joy: 0,
            sadness: 0,
            anger: 0,
            fear: 0,
            surprise: 0,
            love: 0
        };

        // Map backend emotion names to our frontend names
        if (data.probabilities) {
            // Map backend emotions to our emotion set
            const emotionMapping = {
                'happiness': 'joy',
                'happy': 'joy',
                'joy': 'joy',
                'sadness': 'sadness',
                'sad': 'sadness',
                'anger': 'anger',
                'angry': 'anger',
                'fear': 'fear',
                'surprise': 'surprise',
                'surprised': 'surprise',
                'love': 'love'
            };

            Object.entries(data.probabilities).forEach(([emotionName, probability]) => {
                const mappedEmotion = emotionMapping[emotionName];
                if (mappedEmotion) {
                    // Convert probability to percentage (0-100)
                    emotionData[mappedEmotion] = Math.round(probability * 100);
                }
            });
        } else {
            // Fallback: use dominant emotion
            const dominant = data.emotion?.toLowerCase() || 'joy';
            const emotionMapping = {
                'joy': 'joy',
                'happiness': 'joy',
                'happy': 'joy',
                'sadness': 'sadness',
                'sad': 'sadness',
                'anger': 'anger',
                'angry': 'anger',
                'fear': 'fear',
                'surprise': 'surprise',
                'surprised': 'surprise',
                'love': 'love'
            };
            
            const mappedEmotion = emotionMapping[dominant] || 'joy';
            emotionData[mappedEmotion] = 100;
        }
        
        // Set dominant emotion
        const dominant = data.emotion || Object.entries(emotionData).reduce((a, b) => a[1] > b[1] ? a : b)[0];
        dominantEmotion.textContent = dominant.charAt(0).toUpperCase() + dominant.slice(1);
        
        // Update emotion bars with animation
        setTimeout(() => {
            updateEmotionBar('joy', emotionData.joy || 0);
            updateEmotionBar('sadness', emotionData.sadness || 0);
            updateEmotionBar('anger', emotionData.anger || 0);
            updateEmotionBar('fear', emotionData.fear || 0);
            updateEmotionBar('surprise', emotionData.surprise || 0);
            updateEmotionBar('love', emotionData.love || 0);
        }, 100);
    }

    // Helper function to update individual emotion bars
    function updateEmotionBar(emotion, percentage) {
        const bar = document.getElementById(`${emotion}Bar`);
        const percent = document.getElementById(`${emotion}Percent`);
        
        if (bar && percent) {
            bar.style.width = '0%'; // Reset for animation
            percent.textContent = '0%';
            
            setTimeout(() => {
                bar.style.width = `${percentage}%`;
                percent.textContent = `${percentage}%`;
            }, 300);
        }
    }
    
    // Get emotion class for styling
    function getEmotionClass(emotion) {
        const positiveEmotions = ['happiness', 'joy', 'surprise', 'love'];
        const negativeEmotions = ['anger', 'angry', 'disgust', 'fear', 'sadness', 'sad'];
        return positiveEmotions.includes(emotion) ? 'positive' :
               negativeEmotions.includes(emotion) ? 'negative' : 'neutral';
    }
    
    // Get quiz filename based on emotion
    function getQuizFilename(emotion) {
        const normalizedEmotion = emotion.toLowerCase();
        
        const emotionQuizMap = {
            'sad': 'sadQuiz.html',
            'sadness': 'sadQuiz.html',
            'angry': 'angryQuiz.html',
            'anger': 'angryQuiz.html',
            'joy': 'joyQuiz.html',
            'happiness': 'joyQuiz.html',
            'happy': 'happyQuiz.html',
            'surprise': 'surpriseQuiz.html',
            'surprised': 'surpriseQuiz.html',
            'love': 'loveQuiz.html',
            'fear': 'fearQuiz.html',
            'disgust': 'disgustQuiz.html'
        };
        
        return emotionQuizMap[normalizedEmotion] || null;
    }

    // Get challenge filename based on emotion
    function getChallengeFilename(emotion) {
        const normalizedEmotion = emotion.toLowerCase();
        
        const emotionChallengeMap = {
            'sad': 'sad.html',
            'sadness': 'sad.html',
            'angry': 'angry.html',
            'anger': 'angry.html',
            'joy': 'joy.html',
            'happiness': 'happy.html',
            'happy': 'happy.html',
            'surprise': 'surprise.html',
            'surprised': 'surprise.html',
            'love': 'love.html',
            'fear': 'fear.html',
            'disgust': 'disgust.html'
        };
        
        return emotionChallengeMap[normalizedEmotion] || null;
    }
    
    // Create clickable quiz link
    function createQuizLink(emotion, linkText) {
        const quizFile = getQuizFilename(emotion);
        if (quizFile) {
            return `<a href="${quizFile}" style="color: #007bff; text-decoration: underline; cursor: pointer;">${linkText}</a>`;
        }
        return linkText;
    }

    // Create clickable challenge link
    function createChallengeLink(emotion, linkText) {
        const challengeFile = getChallengeFilename(emotion);
        if (challengeFile) {
            return `<href="${challengeFile}" style="color: #28a745; text-decoration: underline; cursor: pointer;">${linkText}</a>`;
        }
        return linkText;
    }
    
    // Update recommendations with quiz links
    function updateRecommendations(emotion) {
        console.log("[JS] updateRecommendations called with emotion:", emotion);
        const normalizedEmotion = emotion.toLowerCase();
        
        const recommendations = {
            anger: "Try deep breathing exercises to calm down.",
            angry: "Try deep breathing exercises to calm down.",
            disgust: "Reflect on what's bothering you.",
            fear: "Practice grounding techniques.",
            happiness: "Share your positive energy!",
            joy: "Share your positive energy!",
            happy: "Share your positive energy!",
            neutral: "Try expressing more emotions.",
            sadness: "Reach out to a friend for support.",
            sad: "Reach out to a friend for support.",
            surprise: "Embrace the unexpected moments!",
            surprised: "Embrace the unexpected moments!",
            love: "Spread the love and positivity around you!"
        };
        
        const baseRecommendation = recommendations[normalizedEmotion] || "Take time to reflect on your emotions.";
        
        const quizFile = getQuizFilename(emotion);
        let fullRecommendation = `<p>${baseRecommendation}</p>`;
        
        if (quizFile) {
            const quizLink = createQuizLink(emotion, `Take the ${normalizedEmotion} quiz`);
            fullRecommendation += `<p><strong>Recommendation:</strong> ${quizLink} to better understand and manage your emotions.</p>`;
        }
        
        recommendationsContent.innerHTML = fullRecommendation;
    }
    
    // Update daily challenge with challenge links
    function updateDailyChallenge(emotion) {
        console.log("[JS] updateDailyChallenge called with emotion:", emotion);
        const normalizedEmotion = emotion.toLowerCase();
        
        const challenges = {
            anger: "Identify three things you're grateful for today.",
            angry: "Identify three things you're grateful for today.",
            disgust: "Find one positive aspect in a difficult situation.",
            fear: "Face one small fear today with courage.",
            happiness: "Compliment three people and spread joy.",
            joy: "Compliment three people and spread joy.",
            happy: "Compliment three people and spread joy.",
            neutral: "Try a new activity to spark some emotion.",
            sadness: "Do one kind thing for yourself today.",
            sad: "Do one kind thing for yourself today.",
            surprise: "Try something completely new and unexpected.",
            surprised: "Try something completely new and unexpected.",
            love: "Express your love to someone important to you."
        };
        
        const baseChallenge = challenges[normalizedEmotion] || "Reflect deeply on your current emotional state.";
        
        const challengeFile = getChallengeFilename(emotion);
        let fullChallenge = `<p>${baseChallenge}</p>`;
        
        if (challengeFile) {
            const challengeLink = createChallengeLink(emotion, `Take the ${normalizedEmotion} challenge`);
            fullChallenge += `<p><strong>Challenge:</strong> ${challengeLink} to explore your emotions deeper and gain insights.</p>`;
        }
        
        dailyChallengeContent.innerHTML = fullChallenge;
    }
    
 // Add this enhanced function to speech-analysis.js

// Enhanced Tip of the Day with emotion-specific tips and links
function updateDailyTipWithEmotion(emotion) {
    const normalizedEmotion = emotion.toLowerCase();
    
    const emotionTips = {
        anger: {
            tip: "Your voice reveals tension. Try speaking more slowly and take deep breaths between sentences.",
            page: "angryTips.html",
            emoji: "😠",
            color: "#f44336"
        },
        angry: {
            tip: "Notice the intensity in your voice. Lowering your volume and pace can help calm your emotions.",
            page: "angryTips.html",
            emoji: "😠",
            color: "#f44336"
        },
        disgust: {
            tip: "Your tone indicates discomfort. Identify what's bothering you and express it constructively.",
            page: "angryTips.html",
            emoji: "😠",
            color: "#795548"
        },
        fear: {
            tip: "Your voice shows anxiety. Practice grounding techniques and speak from your diaphragm for stability.",
            page: "fearTips.html",
            emoji: "😰",
            color: "#9c27b0"
        },
        fearful: {
            tip: "Vocal tremors can indicate nervousness. Slow, deep breathing before speaking can help steady your voice.",
            page: "fearTips.html",
            emoji: "😰",
            color: "#9c27b0"
        },
        happiness: {
            tip: "Your voice radiates positivity! Sharing your joy through conversation amplifies happiness.",
            page: "happyTips.html",
            emoji: "😊",
            color: "#4caf50"
        },
        joy: {
            tip: "The lightness in your voice reflects inner joy. Express this happiness to spread positive energy!",
            page: "happyTips.html",
            emoji: "😊",
            color: "#4caf50"
        },
        happy: {
            tip: "Your upbeat tone is contagious! Use your positive voice to uplift others around you.",
            page: "happyTips.html",
            emoji: "😊",
            color: "#4caf50"
        },
        neutral: {
            tip: "Your voice is calm and balanced. This composure is great for clear communication and reflection.",
            page: "wellnessTips.html",
            emoji: "😊",
            color: "#607d8b"
        },
        calm: {
            tip: "Your steady voice indicates emotional balance. Maintain this calmness through mindful speaking.",
            page: "wellnessTips.html",
            emoji: "😌",
            color: "#607d8b"
        },
        sadness: {
            tip: "Your voice carries heaviness. It's okay to express sadness - speaking about feelings can be healing.",
            page: "sadTips.html",
            emoji: "☹️",
            color: "#2196f3"
        },
        sad: {
            tip: "The softness in your voice shows vulnerability. Reach out and share your feelings with someone you trust.",
            page: "sadTips.html",
            emoji: "☹️",
            color: "#2196f3"
        },
        surprise: {
            tip: "Your voice shows excitement! Embrace unexpected moments and stay open to new possibilities.",
            page: "surpriseTips.html",
            emoji: "😲",
            color: "#ff9800"
        },
        surprised: {
            tip: "The energy in your voice indicates surprise. Use this heightened awareness to adapt positively!",
            page: "surpriseTips.html",
            emoji: "😲",
            color: "#ff9800"
        },
        love: {
            tip: "Your voice conveys warmth and affection. Express your feelings openly - it strengthens connections.",
            page: "loveTips.html",
            emoji: "💖",
            color: "#e91e63"
        }
    };

    const tipData = emotionTips[normalizedEmotion] || emotionTips['neutral'];
    
    const html = `
        <div style="text-align: center; padding: 1.5rem;">
            <div style="
                width: 85px;
                height: 85px;
                margin: 0 auto 1.5rem;
                background: linear-gradient(135deg, ${tipData.color}20 0%, ${tipData.color}10 100%);
                border: 3px solid ${tipData.color}40;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 2.8rem;
                box-shadow: 0 6px 20px ${tipData.color}25;
                animation: pulse 2s ease-in-out infinite;
            ">
                ${tipData.emoji}
            </div>
            <h4 style="
                color: #2d3748;
                margin-bottom: 1rem;
                font-weight: 700;
                font-size: 1.1rem;
            ">Voice Emotion Insight</h4>
            <p style="
                margin-bottom: 1.75rem;
                line-height: 1.8;
                color: #4a5568;
                font-size: 1.05rem;
                max-width: 400px;
                margin-left: auto;
                margin-right: auto;
            ">${tipData.tip}</p>
            <a href="${tipData.page}" 
               style="
                 display: inline-flex;
                 align-items: center;
                 gap: 10px;
                 padding: 16px 32px;
                 background: linear-gradient(135deg, ${tipData.color} 0%, ${tipData.color}dd 100%);
                 color: white;
                 text-decoration: none;
                 border-radius: 35px;
                 font-weight: 700;
                 font-size: 1.05rem;
                 transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
                 box-shadow: 0 6px 20px ${tipData.color}40;
                 text-transform: uppercase;
                 letter-spacing: 0.5px;
               "
               onmouseover="this.style.transform='translateY(-4px) scale(1.05)'; this.style.boxShadow='0 10px 30px ${tipData.color}60';"
               onmouseout="this.style.transform='translateY(0) scale(1)'; this.style.boxShadow='0 6px 20px ${tipData.color}40';"
            >
                <i class="fas fa-spa" style="font-size: 1.2rem;"></i>
                <span>Explore ${normalizedEmotion.charAt(0).toUpperCase() + normalizedEmotion.slice(1)} Wellness Tips</span>
            </a>
        </div>
        <style>
            @keyframes pulse {
                0%, 100% {
                    transform: scale(1);
                }
                50% {
                    transform: scale(1.05);
                }
            }
        </style>
    `;
    
    dailyTipContent.innerHTML = html;
}

// Update the analyzeSpeech function to update tips
async function analyzeSpeech(transcript, audioBase64) {
    console.log("=> analyzeSpeech() starting", { transcript: transcript || "(none)", audioLength: audioBase64?.length });

    // In speech-analysis.js — update analyzeSpeech()
const url = `${API_ORIGIN}/analyze-speech`;

    const payload = { transcript: transcript || "", audio: audioBase64 };

    try {
        console.log("Sending POST to", url, "payload.audio length:", (audioBase64 || "").length);

        const response = await fetch(url, {
            method: "POST",
            mode: "cors",
            headers: { 
                "Content-Type": "application/json",
                "X-Request-Id": Math.random().toString(36).substring(2, 10)
            },
            body: JSON.stringify(payload),
        });

        console.log("Fetch completed. status:", response.status, response.statusText);

        const raw = await response.text();
        console.log("Raw response text (first 2000 chars):", raw ? raw.slice(0, 2000) : "<empty>");

        if (!response.ok) {
            console.error("Server returned non-OK:", response.status, raw);
            transcriptDisplay.innerHTML += `<br><span style="color:red">Server error: ${response.status}</span>`;
            resetUI();
            return;
        }

        let data;
        try {
            data = raw ? JSON.parse(raw) : null;
        } catch (parseErr) {
            console.error("Failed to parse JSON from backend:", parseErr, "raw:", raw);
            transcriptDisplay.innerHTML += `<br><span style="color:red">Invalid server JSON. Check console.</span>`;
            resetUI();
            return;
        }

        console.log("Parsed JSON result:", data);

        try {
            displayAnalysisResults(data);
        } catch (err) {
            console.error("displayAnalysisResults failed:", err);
            transcriptDisplay.innerHTML += `<br><span style="color:red">UI update failed: ${err.message || err}</span>`;
        }

        try { updateRecommendations(data.emotion); } catch (e) { console.warn("updateRecommendations error:", e); }
        try { updateDailyChallenge(data.emotion); } catch (e) { console.warn("updateDailyChallenge error:", e); }
        
        // Update Tip of the Day with emotion-specific tip
        try { updateDailyTipWithEmotion(data.emotion); } catch (e) { console.warn("updateDailyTipWithEmotion error:", e); }
        
        try { updateProgressChart('daily'); } catch (e) { console.warn("updateProgressChart error:", e); }

    } catch (err) {
        console.error("Analysis failed (fetch/processing):", err);
        const short = (err && err.message) ? err.message : String(err);
        transcriptDisplay.innerHTML += `<br><span style="color:red">Analysis failed: ${short}</span>`;
    } finally {
        resetUI();
        console.log("=> analyzeSpeech() finished");
    }
}

// Replace the existing loadDailyTip function with this improved version
function loadDailyTip() {
    const generalTips = [
        {
            tip: "Your voice carries emotion. Speaking slowly and clearly helps regulate your emotional state.",
            emoji: "🎤",
            page: "wellnessTips.html",
            color: "#5e35b1"
        },
        {
            tip: "Practice vocal warm-ups to express emotions more clearly and confidently.",
            emoji: "🎵",
            page: "wellnessTips.html",
            color: "#5e35b1"
        },
        {
            tip: "Deep breathing before speaking can help modulate your emotional tone and reduce stress.",
            emoji: "🌬️",
            page: "wellnessTips.html",
            color: "#5e35b1"
        }
    ];
    
    const randomTip = generalTips[Math.floor(Math.random() * generalTips.length)];
    
    const html = `
        <div style="text-align: center; padding: 1rem;">
            <div style="
                width: 70px;
                height: 70px;
                margin: 0 auto 1rem;
                background: ${randomTip.color}15;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 2rem;
                box-shadow: 0 4px 15px ${randomTip.color}20;
            ">
                ${randomTip.emoji}
            </div>
            <p style="margin-bottom: 1.25rem; line-height: 1.7; color: #4a5568;">${randomTip.tip}</p>
            <a href="${randomTip.page}" 
               style="
                 color: ${randomTip.color};
                 text-decoration: none;
                 font-weight: 600;
                 transition: all 0.3s ease;
                 display: inline-flex;
                 align-items: center;
                 gap: 8px;
               "
               onmouseover="this.style.color='${randomTip.color}dd'; this.style.gap='12px';"
               onmouseout="this.style.color='${randomTip.color}'; this.style.gap='8px';"
            >
                <span>Explore All Wellness Tips</span>
                <i class="fas fa-arrow-right"></i>
            </a>
        </div>
    `;
    
    dailyTipContent.innerHTML = html;
    console.log("[JS] Daily tip loaded");
}
    // Initialize progress chart
    function initProgressChart() {
        const ctx = document.getElementById('progressChart').getContext('2d');
        progressChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Positive', 'Negative', 'Neutral'],
                datasets: [{
                    label: 'Emotion Distribution',
                    data: [30, 20, 50],
                    backgroundColor: [
                        'rgba(102, 187, 106, 0.7)',
                        'rgba(239, 83, 80, 0.7)',
                        'rgba(255, 202, 40, 0.7)'
                    ],
                    borderColor: [
                        'rgba(102, 187, 106, 1)',
                        'rgba(239, 83, 80, 1)',
                        'rgba(255, 202, 40, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
        console.log("[JS] Progress chart initialized");
    }
    
    // Update progress chart
    function updateProgressChart(period) {
        console.log("[JS] updateProgressChart called with period:", period);
        let positive, negative, neutral;
        if (period === 'daily') {
            positive = Math.floor(Math.random() * 30) + 50;
            negative = Math.floor(Math.random() * 20) + 10;
            neutral = 100 - positive - negative;
        } else if (period === 'weekly') {
            positive = Math.floor(Math.random() * 40) + 30;
            negative = Math.floor(Math.random() * 30) + 15;
            neutral = 100 - positive - negative;
        } else { // monthly
            positive = Math.floor(Math.random() * 50) + 20;
            negative = Math.floor(Math.random() * 40) + 10;
            neutral = 100 - positive - negative;
        }
    
        progressChart.data.datasets[0].data = [positive, negative, neutral];
        progressChart.update();
        console.log("[JS] Progress chart updated for:", period);
    }
    
    // Convert blob to base64
    function blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const dataUrl = reader.result;
                const base64 = dataUrl.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }
    
    // Reset UI
    function resetUI() {
        isAnalyzing = false;
        startBtn.disabled = false;
        stopBtn.disabled = true;
        audioChunks = [];
        console.log("[JS] UI reset");
    }
});

// Enhanced Live Server reload prevention
(function preventLiveServerReload() {
    console.log("Preventing Live Server auto-reload...");
    
    // Override window.location.reload
    const originalReload = window.location.reload;
    window.location.reload = function() {
        console.log("Blocked window.location.reload() to prevent Live Server interference");
        return false;
    };
    
    // Block Live Server WebSocket
    const originalWebSocket = window.WebSocket;
    window.WebSocket = function(url, protocols) {
        // Block Live Server WebSocket connections
        if (url && (url.includes('livereload') || url.includes('ws://127.0.0.1') || url.includes('ws://localhost'))) {
            console.log("Blocked Live Server WebSocket connection:", url);
            return {
                addEventListener: () => {},
                removeEventListener: () => {},
                send: () => {},
                close: () => {},
                readyState: 3 // CLOSED
            };
        }
        
        // Allow other WebSocket connections
        const ws = protocols ? new originalWebSocket(url, protocols) : new originalWebSocket(url);
        
        // Block reload messages on any WebSocket
        ws.addEventListener('message', function(event) {
            if (event.data && (event.data === 'reload' || event.data.includes('reload'))) {
                console.log("Blocked Live Server reload message:", event.data);
                event.stopImmediatePropagation();
                return false;
            }
        });
        
        return ws;
    };
    
    // Block beforeunload events that might be triggered by Live Server
    window.addEventListener('beforeunload', function(event) {
        console.log("Blocked beforeunload event");
        event.preventDefault();
        return false;
    });
    
    // Override any automatic page refresh attempts
    if (window.setTimeout) {
        const originalSetTimeout = window.setTimeout;
        window.setTimeout = function(callback, delay, ...args) {
            // Check if this might be a Live Server refresh attempt
            if (typeof callback === 'function' && 
                (callback.toString().includes('reload') || 
                 callback.toString().includes('location'))) {
                console.log("Blocked suspicious setTimeout that might cause reload");
                return null;
            }
            return originalSetTimeout(callback, delay, ...args);
        };
    }
    
    console.log("Live Server reload prevention measures activated");
})();