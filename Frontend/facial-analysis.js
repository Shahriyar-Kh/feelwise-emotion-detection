// DOM Elements
const video = document.getElementById("video");
const captureBtn = document.getElementById("captureBtn");
const uploadInput = document.getElementById("imageUpload");
const canvas = document.getElementById("canvas");
const imagePreview = document.getElementById("uploadedImage");
const emotionResult = document.getElementById("emotionResult");
const recommendationsContent = document.getElementById("recommendationsContent");
const dailyChallengeContent = document.getElementById("dailyChallengeContent");
const dailyTipContent = document.getElementById("dailyTipContent");
const progressChart = document.getElementById("progressChart");
const analyzeEmotionBtn = document.getElementById("analyzeEmotionBtn");

// Backend configuration
const API_ORIGIN = ["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? "http://localhost:5000"
    : "https://feelwise-emotion-detection.onrender.com";
const API_BASE = `${API_ORIGIN}/api`;
const token = localStorage.getItem("token");
let currentUserId = null;
let imageDataURL = "";
let chart;

// Initialize on page load
document.addEventListener("DOMContentLoaded", async () => {
    await initializeUserContext();
    updateChart();
    loadDailyTip();
    checkAuthenticationStatus();
});

// Initialize user context
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
                loadUserFacialAnalysisHistory();
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

// Initialize webcam
if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ 
        video: { 
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: "user" 
        } 
    })
        .then(stream => {
            video.srcObject = stream;
        })
        .catch(error => {
            console.error("Error accessing webcam:", error);
        });
}

// Capture from webcam
captureBtn.addEventListener("click", () => {
    const context = canvas.getContext("2d");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    imageDataURL = canvas.toDataURL("image/png");
    imagePreview.src = imageDataURL;
    imagePreview.style.display = "block";
    
    // Show image quality tips
    showImageQualityTips();
});

// Upload Image
uploadInput.addEventListener("change", () => {
    const file = uploadInput.files[0];
    if (!file || !file.type.startsWith("image/")) {
        alert("Please upload a valid image.");
        return;
    }

    const reader = new FileReader();
    reader.onload = () => {
        imageDataURL = reader.result;
        imagePreview.src = imageDataURL;
        imagePreview.style.display = "block";
        
        // Show image quality tips
        showImageQualityTips();
    };
    reader.readAsDataURL(file);
});

// Analyze Emotion Button Click
analyzeEmotionBtn.addEventListener("click", () => {
    if (!imageDataURL) {
        alert("Please capture or upload an image first.");
        return;
    }
    sendImageForAnalysis(imageDataURL);
});

// Enhanced image preprocessing
function preprocessImage(base64Image) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Set canvas dimensions
            canvas.width = 640;
            canvas.height = 480;
            
            // Draw and resize
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            // Apply image enhancement
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const enhancedData = enhanceImageData(imageData);
            ctx.putImageData(enhancedData, 0, 0);
            
            // Convert to base64
            const processedImage = canvas.toDataURL('image/jpeg', 0.9);
            resolve(processedImage);
        };
        img.src = base64Image;
    });
}

function enhanceImageData(imageData) {
    const data = imageData.data;
    const contrast = 1.2;
    const brightness = 10;
    
    for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, Math.max(0, (data[i] - 128) * contrast + 128 + brightness));
        data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * contrast + 128 + brightness));
        data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * contrast + 128 + brightness));
    }
    
    return imageData;
}

// Improved Send Image for Analysis
async function sendImageForAnalysis(base64Image) {
    emotionResult.innerHTML = `
        <div class="placeholder-content">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Analyzing facial expression with enhanced accuracy...</p>
        </div>
    `;

    try {
        // Preprocess image first
        const processedImage = await preprocessImage(base64Image);
        
        const response = await fetch(`${API_ORIGIN}/analyze-face`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ 
                image: processedImage,
                enhanced: true,
                timestamp: new Date().toISOString()
            })
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.details || data.error || "Analysis failed");
        }

        // Enhanced results formatting
        const formattedResults = {
            type: 'facial',
            emotion: data.emotion.charAt(0).toUpperCase() + data.emotion.slice(1),
            confidence: data.confidence || 75,
            emotionDistribution: data.emotion_distribution || {
                positive: data.emotion_scores?.happy || 30,
                negative: data.emotion_scores?.sad || data.emotion_scores?.angry || 30,
                neutral: data.emotion_scores?.neutral || 40
            },
            emotionScores: data.emotion_scores || {},
            recommendation: data.recommendation,
            challenge: data.challenge,
            tip: data.tip,
            trend: data.trend,
            timestamp: new Date().toISOString(),
            userId: currentUserId,
            enhanced: true
        };
        
        // Enhanced display with more details
        displayEnhancedFacialAnalysisResults(formattedResults);
        
        // Update UI components with better recommendations
        updateEnhancedRecommendations(formattedResults);
        updateDailyChallenge(data.emotion);
        
        // Save to both local storage and backend
        await saveFacialAnalysisToHistory(formattedResults);
        await saveFacialAnalysisToBackend(formattedResults);
        
        // Update progress chart
        updateChart('daily');
        
        // Show assessment report option
        showAssessmentReportOption();
        
        // Record challenge completion
        await recordFacialAnalysisChallenge(formattedResults.emotion);

    } catch (error) {
        console.error("Facial analysis error:", error);
        
        // Fallback to basic analysis if enhanced fails
        await fallbackBasicAnalysis(base64Image);
    }
}

// Show image quality tips
function showImageQualityTips() {
    const tips = `
        <div class="quality-tips">
            <p><strong>For best accuracy:</strong></p>
            <ul>
                <li>✅ Ensure good lighting on your face</li>
                <li>✅ Look directly at the camera</li>
                <li>✅ Keep a neutral expression initially</li>
                <li>✅ Avoid shadows on your face</li>
            </ul>
        </div>
    `;
    
    // Remove existing tips
    const existingTips = document.querySelector('.quality-tips');
    if (existingTips) existingTips.remove();
    
    // Add tips after the preview section
    const previewSection = document.querySelector('.preview-section');
    const tipsDiv = document.createElement('div');
    tipsDiv.className = 'quality-tips';
    tipsDiv.innerHTML = tips;
    previewSection.appendChild(tipsDiv);
}

// Enhanced results display
function displayEnhancedFacialAnalysisResults(results) {
    let html = `<div class="emotion-report-card">`;
    
    // Main emotion with confidence
    html += `
        <div class="main-emotion">
            <div class="emotion-icon">
                <i class="${getEmotionIcon(results.emotion)}"></i>
            </div>
            <div class="emotion-details">
                <h3>${results.emotion}</h3>
                <div class="confidence-meter">
                    <div class="confidence-fill" style="width: ${results.confidence}%"></div>
                    <span class="confidence-text">${results.confidence}% confidence</span>
                </div>
            </div>
        </div>
    `;
    
    // Detailed emotion breakdown
    if (results.emotionScores && Object.keys(results.emotionScores).length > 0) {
        html += `<div class="detailed-breakdown">`;
        html += `<h4>Detailed Analysis:</h4>`;
        
        const sortedEmotions = Object.entries(results.emotionScores)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
        
        sortedEmotions.forEach(([emotion, score]) => {
            if (score > 5) {
                html += `
                    <div class="emotion-bar">
                        <span class="emotion-name">${emotion}</span>
                        <div class="bar-container">
                            <div class="bar" style="width: ${score}%"></div>
                            <span class="score">${score.toFixed(1)}%</span>
                        </div>
                    </div>
                `;
            }
        });
        
        html += `</div>`;
    }
    
    // Emotion distribution
    html += `
        <div class="distribution-summary">
            <div class="dist-item positive">
                <i class="fas fa-smile"></i>
                <span class="dist-value">${results.emotionDistribution.positive.toFixed(1)}% Positive</span>
            </div>
            <div class="dist-item negative">
                <i class="fas fa-frown"></i>
                <span class="dist-value">${results.emotionDistribution.negative.toFixed(1)}% Negative</span>
            </div>
            <div class="dist-item neutral">
                <i class="fas fa-meh"></i>
                <span class="dist-value">${results.emotionDistribution.neutral.toFixed(1)}% Neutral</span>
            </div>
        </div>
    `;
    
    html += `</div>`;
    emotionResult.innerHTML = html;
    
    // Add CSS for new styles
    addEnhancedStyles();
}

// Helper function to get emotion icons
function getEmotionIcon(emotion) {
    const iconMap = {
        'Happy': 'fas fa-smile-beam',
        'Sad': 'fas fa-sad-tear',
        'Angry': 'fas fa-angry',
        'Surprise': 'fas fa-surprise',
        'Fear': 'fas fa-fearful',
        'Disgust': 'fas fa-grimace',
        'Neutral': 'fas fa-meh'
    };
    return iconMap[emotion] || 'fas fa-smile';
}

// Enhanced recommendations
function updateEnhancedRecommendations(results) {
    const emotion = results.emotion.toLowerCase();
    
    const recMap = {
        happy: `Your ${results.confidence > 80 ? 'strong' : 'moderate'} happiness is wonderful! 
                ${results.confidence > 80 ? 'Consider spreading this positivity through acts of kindness.' : 
                  'Try to identify what specifically is bringing you joy today.'}`,
        sad: `Feeling sadness ${results.confidence > 70 ? 'is completely valid and natural.' : 'can be a signal to slow down.'}
              ${results.confidence > 80 ? 'This might be a good time for self-compassion and reaching out for support.' :
                'Try engaging in a comforting activity or talking to someone you trust.'}`,
        angry: `${results.confidence > 75 ? 'Strong feelings of anger detected. ' : ''}
                Physical movement like walking or stretching can help release this energy.`,
        surprise: `Surprise can lead to new perspectives! 
                   ${results.confidence > 70 ? 'Lean into this unexpected emotion.' : 'Take a moment to process what surprised you.'}`,
        fear: `${results.confidence > 65 ? 'Fear detected at significant levels. ' : ''}
                Grounding techniques (5-4-3-2-1 method) can help manage this feeling.`,
        disgust: `Disgust often protects our boundaries. 
                  ${results.confidence > 60 ? 'Consider if there are healthy boundaries to establish.' :
                    'Reflect on what might be triggering this response.'}`,
        neutral: `A calm, neutral state ${results.confidence > 80 ? 'indicates emotional balance.' : 'is perfectly normal.'}
                  This can be a good time for reflection or mindfulness.`
    };
    
    let baseRecommendation = recMap[emotion] || "Take a moment to check in with yourself and your feelings.";
    
    // Add confidence-based qualifier
    let confidenceNote = '';
    if (results.confidence > 85) {
        confidenceNote = "High confidence analysis suggests this emotion is clearly present.";
    } else if (results.confidence > 60) {
        confidenceNote = "Moderate confidence indicates this emotion is likely present, possibly mixed with others.";
    } else {
        confidenceNote = "Lower confidence suggests your emotional state may be complex or mixed.";
    }
    
    // Add quiz link if available
    const quizFile = getQuizFilename(emotion);
    let fullRecommendation = `
        <div class="enhanced-recommendation">
            <p><strong>Analysis Insight:</strong> ${baseRecommendation}</p>
            <p><small>${confidenceNote}</small></p>
    `;
    
    if (quizFile) {
        const quizLink = createQuizLink(emotion, `Take the ${emotion} exploration quiz`);
        fullRecommendation += `<p class="quiz-link">📋 <strong>Recommended:</strong> ${quizLink} to better understand this emotion.</p>`;
    }
    
    fullRecommendation += `</div>`;
    
    recommendationsContent.innerHTML = fullRecommendation;
}

// Enhanced daily challenge
function updateEnhancedDailyChallenge(results) {
    const emotion = results.emotion.toLowerCase();
    
    const challengeMap = {
        happy: `Share your happiness with someone through a specific compliment or act of kindness. 
                ${results.confidence > 85 ? 'Your strong positive energy can uplift others.' : ''}`,
        sad: `Practice self-compassion by doing one nurturing thing for yourself. 
              ${results.confidence > 75 ? 'Allow space for these feelings without judgment.' : ''}`,
        angry: `Channel this energy into a 10-minute physical activity (walking, stretching, cleaning).`,
        surprise: `Stay open to unexpected opportunities today and journal about any surprises.`,
        fear: `Identify one small fear you can face today, no matter how minor.`,
        disgust: `Focus on finding something beautiful or positive in your immediate environment.`,
        neutral: `Practice 5 minutes of mindfulness, focusing on your breath and bodily sensations.`
    };
    
    let baseChallenge = challengeMap[emotion] || "Take time to reflect on your current emotional state.";
    
    // Add emotional distribution context
    let distributionNote = '';
    if (results.emotionDistribution.positive > 60) {
        distributionNote = "Your predominantly positive emotional state can be leveraged for creative or social activities.";
    } else if (results.emotionDistribution.negative > 60) {
        distributionNote = "With more negative emotions present, gentle self-care is especially important today.";
    }
    
    let fullChallenge = `
        <div class="enhanced-challenge">
            <p><strong>Today's Emotional Challenge:</strong> ${baseChallenge}</p>
    `;
    
    if (distributionNote) {
        fullChallenge += `<p class="distribution-note">${distributionNote}</p>`;
    }
    
    // Add challenge link if available
    const challengeFile = getChallengeFilename(emotion);
    if (challengeFile) {
        const challengeLink = createChallengeLink(emotion, `Access detailed ${emotion} exercises`);
        fullChallenge += `<p class="challenge-link">🎯 <strong>Extended Practice:</strong> ${challengeLink}</p>`;
    }
    
    fullChallenge += `</div>`;
    
    dailyChallengeContent.innerHTML = fullChallenge;
}

// Fallback basic analysis
async function fallbackBasicAnalysis(base64Image) {
    try {
        // Simple fallback using basic DeepFace
        emotionResult.innerHTML = `
            <div class="placeholder-content">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Using basic analysis method...</p>
            </div>
        `;
        
        const response = await fetch(`${API_ORIGIN}/analyze-face`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: base64Image })
        });
        
        if (response.ok) {
            const data = await response.json();
            const formattedResults = formatFacialAnalysisResults(data, base64Image);
            displayFacialAnalysisResults(formattedResults);
            updateRecommendations(data.emotion);
            updateDailyChallenge(data.emotion);
        } else {
            throw new Error("Fallback analysis failed");
        }
    } catch (fallbackError) {
        emotionResult.innerHTML = `
            <div class="placeholder-content" style="color: #dc3545;">
                <i class="fas fa-exclamation-triangle"></i>
                <p><strong>Analysis Unavailable</strong></p>
                <p>Please try:</p>
                <ul style="text-align: left; font-size: 0.9em;">
                    <li>Ensure good lighting on your face</li>
                    <li>Look directly at the camera</li>
                    <li>Use a clear, front-facing photo</li>
                    <li>Try uploading a different image</li>
                </ul>
            </div>
        `;
    }
}

// Add enhanced CSS styles
function addEnhancedStyles() {
    if (document.getElementById('enhanced-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'enhanced-styles';
    style.textContent = `
        .emotion-report-card {
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        
        .main-emotion {
            display: flex;
            align-items: center;
            gap: 15px;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #f0f0f0;
        }
        
        .emotion-icon {
            font-size: 2.5rem;
            color: #4a6fa5;
        }
        
        .emotion-details h3 {
            margin: 0;
            font-size: 1.5rem;
            color: #333;
        }
        
        .confidence-meter {
            width: 200px;
            height: 20px;
            background: #eee;
            border-radius: 10px;
            margin-top: 5px;
            overflow: hidden;
            position: relative;
        }
        
        .confidence-fill {
            height: 100%;
            background: linear-gradient(90deg, #66bb6a, #4caf50);
            border-radius: 10px;
            transition: width 0.5s ease;
        }
        
        .confidence-text {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 0.8rem;
            color: #333;
            font-weight: bold;
        }
        
        .detailed-breakdown {
            margin: 20px 0;
        }
        
        .detailed-breakdown h4 {
            margin-bottom: 10px;
            color: #555;
        }
        
        .emotion-bar {
            margin: 8px 0;
        }
        
        .emotion-name {
            display: inline-block;
            width: 100px;
            text-transform: capitalize;
        }
        
        .bar-container {
            display: inline-block;
            width: calc(100% - 120px);
            position: relative;
        }
        
        .bar {
            height: 20px;
            background: #4a6fa5;
            border-radius: 4px;
        }
        
        .bar .score {
            position: absolute;
            right: 5px;
            top: 50%;
            transform: translateY(-50%);
            font-size: 0.8rem;
            color: #333;
        }
        
        .distribution-summary {
            display: flex;
            justify-content: space-between;
            margin-top: 20px;
            padding-top: 15px;
            border-top: 1px solid #eee;
        }
        
        .dist-item {
            text-align: center;
            padding: 10px;
            border-radius: 8px;
            flex: 1;
            margin: 0 5px;
        }
        
        .dist-item.positive {
            background: rgba(102, 187, 106, 0.1);
        }
        
        .dist-item.negative {
            background: rgba(239, 83, 80, 0.1);
        }
        
        .dist-item.neutral {
            background: rgba(255, 202, 40, 0.1);
        }
        
        .dist-item i {
            font-size: 1.2rem;
            margin-bottom: 5px;
            display: block;
        }
        
        .dist-value {
            font-size: 0.9rem;
            font-weight: 500;
        }
        
        .enhanced-recommendation, .enhanced-challenge {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin: 10px 0;
        }
        
        .quiz-link, .challenge-link {
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px dashed #ddd;
        }
        
        .distribution-note {
            font-style: italic;
            color: #666;
            font-size: 0.9rem;
        }
        
        .quality-tips {
            background: #e3f2fd;
            border-radius: 8px;
            padding: 15px;
            margin-top: 15px;
            font-size: 0.9rem;
        }
        
        .quality-tips ul {
            margin: 10px 0;
            padding-left: 20px;
        }
        
        .quality-tips li {
            margin: 5px 0;
        }
    `;
    
    document.head.appendChild(style);
}

// Display facial analysis results with beautiful UI
function displayFacialAnalysisResults(results) {
    // Get emotion color based on type
    const emotionColors = {
        happy: 'var(--color-happy)',
        sad: 'var(--color-sad)',
        angry: 'var(--color-angry)',
        surprised: 'var(--color-surprised)',
        fearful: 'var(--color-fearful)',
        disgusted: 'var(--color-disgusted)',
        neutral: 'var(--color-neutral)'
    };
    
    const emotionColor = emotionColors[results.emotion.toLowerCase()] || 'var(--color-primary)';
    
    // Format emotion name
    const formattedEmotion = results.emotion.charAt(0).toUpperCase() + results.emotion.slice(1);
    
    let html = `
        <div class="emotion-card">
            <div class="emotion-header" style="border-left-color: ${emotionColor}">
                <div class="emotion-icon" style="background-color: ${emotionColor}">
                    <i class="fas fa-smile"></i>
                </div>
                <div class="emotion-title">
                    <h3>${formattedEmotion}</h3>
                    <p class="confidence-badge">
                        <i class="fas fa-chart-line"></i>
                        ${results.confidence}% confidence
                    </p>
                </div>
            </div>
            
            <div class="emotion-breakdown-section">
                <h4><i class="fas fa-chart-pie"></i> Emotion Distribution</h4>
                <div class="emotion-breakdown">
                    ${createEmotionBar('positive', results.emotionDistribution.positive, '#4CAF50')}
                    ${createEmotionBar('negative', results.emotionDistribution.negative, '#F44336')}
                    ${createEmotionBar('neutral', results.emotionDistribution.neutral, '#9E9E9E')}
                </div>
                
                <div class="emotion-stats">
                    <div class="stat-item positive">
                        <span class="stat-label">Positive</span>
                        <span class="stat-value">${results.emotionDistribution.positive.toFixed(1)}%</span>
                    </div>
                    <div class="stat-item negative">
                        <span class="stat-label">Negative</span>
                        <span class="stat-value">${results.emotionDistribution.negative.toFixed(1)}%</span>
                    </div>
                    <div class="stat-item neutral">
                        <span class="stat-label">Neutral</span>
                        <span class="stat-value">${results.emotionDistribution.neutral.toFixed(1)}%</span>
                    </div>
                </div>
            </div>
            
            <div class="emotion-insights">
                <h4><i class="fas fa-lightbulb"></i> Insights</h4>
                <p class="insight-text">${generateInsight(results.emotion, results.confidence)}</p>
            </div>
            
            <div class="last-updated">
                <i class="fas fa-clock"></i> Analyzed just now
            </div>
        </div>
    `;
    
    emotionResult.innerHTML = html;
    emotionResult.classList.add('visible');
}

// Helper function to create emotion progress bars
function createEmotionBar(type, value, color) {
    return `
        <div class="emotion-bar">
            <div class="bar-label">
                <span class="bar-name">${type.charAt(0).toUpperCase() + type.slice(1)}</span>
                <span class="bar-value">${value.toFixed(1)}%</span>
            </div>
            <div class="bar-container">
                <div class="bar-fill ${type}" style="width: ${value}%; background-color: ${color};"></div>
            </div>
        </div>
    `;
}

// Helper function to generate insights based on emotion
function generateInsight(emotion, confidence) {
    const insights = {
        happy: confidence > 80 
            ? "The subject appears very happy! This is great to see."
            : "The subject shows signs of happiness. Consider this a positive interaction.",
        sad: confidence > 80 
            ? "The subject appears quite sad. Consider offering support."
            : "There are subtle signs of sadness. Check if everything is okay.",
        angry: confidence > 80 
            ? "The subject appears angry. Approach with caution and empathy."
            : "Some signs of frustration detected. This might be a tense moment.",
        neutral: confidence > 80 
            ? "The subject appears neutral and composed."
            : "Emotions appear balanced and neutral at the moment.",
        surprised: "The subject shows surprise! Something unexpected might have happened.",
        fearful: "The subject appears fearful. Ensure a safe and comfortable environment.",
        disgusted: "The subject shows signs of disgust. Consider what might be causing this reaction."
    };
    
    return insights[emotion.toLowerCase()] || "Emotion analysis complete. Consider the context of this expression.";
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
        'happy': 'joyQuiz.html',
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
        'joy': 'happy.html',
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
        return `<a href="${challengeFile}" style="color: #007bff; text-decoration: underline; cursor: pointer;">${linkText}</a>`;
    }
    return linkText;
}

// Update recommendations based on detected emotion
function updateRecommendations(emotion) {
    const normalizedEmotion = emotion.toLowerCase();
    
    const recMap = {
        joy: "Your joy is contagious! Consider sharing your happiness with others today.",
        happiness: "Your happiness is wonderful! Try to savor this moment and think about what brought you this joy.",
        sadness: "Be gentle with yourself. It's okay to feel sad sometimes. Consider talking to someone you trust.",
        sad: "Be gentle with yourself. It's okay to feel sad sometimes. Consider talking to someone you trust.",
        anger: "Try taking deep breaths to calm yourself. Physical activity can also help release angry energy.",
        angry: "Try taking deep breaths to calm yourself. Physical activity can also help release angry energy.",
        fear: "Ground yourself by focusing on your surroundings. Try the 5-4-3-2-1 technique.",
        surprise: "Embrace the unexpected! This could be an opportunity for growth or new experiences.",
        surprised: "Embrace the unexpected! This could be an opportunity for growth or new experiences.",
        disgust: "Try to identify what's causing this feeling and see if there are constructive ways to address it.",
        love: "Your loving emotions are beautiful! Share this positive energy with those around you.",
        neutral: "You appear calm and composed. This is a good time for reflection or planning."
    };
    
    const baseRecommendation = recMap[normalizedEmotion] || "Take a moment to check in with yourself and your feelings.";
    
    const quizFile = getQuizFilename(emotion);
    let fullRecommendation = `<p>${baseRecommendation}</p>`;
    
    if (quizFile) {
        const quizLink = createQuizLink(emotion, `Take the ${normalizedEmotion} quiz`);
        fullRecommendation += `<p>📋 <strong>Recommendation:</strong> ${quizLink} to better understand and manage your emotions.</p>`;
    }
    
    recommendationsContent.innerHTML = fullRecommendation;
}

// Update daily challenge based on emotion
function updateDailyChallenge(emotion) {
    const normalizedEmotion = emotion.toLowerCase();
    
    const challengeMap = {
        joy: "Share your joy with at least three people today through a smile, compliment, or kind gesture.",
        happiness: "Write down three things that made you happy today and reflect on them.",
        sadness: "Practice self-compassion by doing something nurturing for yourself today.",
        sad: "Practice self-compassion by doing something nurturing for yourself today.",
        anger: "Channel your energy into something productive like exercise or cleaning.",
        angry: "Channel your energy into something productive like exercise or cleaning.",
        fear: "Take one small brave step toward something that challenges you today.",
        surprise: "Stay open to new experiences and opportunities that come your way today.",
        surprised: "Stay open to new experiences and opportunities that come your way today.",
        disgust: "Focus on finding something beautiful or positive in your environment today.",
        love: "Express your love and appreciation to someone important in your life today.",
        neutral: "Practice mindfulness by paying attention to your senses for 10 minutes today."
    };
    
    const baseChallenge = challengeMap[normalizedEmotion] || "Take time to reflect on your current emotional state and practice self-awareness.";
    
    const challengeFile = getChallengeFilename(emotion);
    let fullChallenge = `<p>${baseChallenge}</p>`;
    
    if (challengeFile) {
        const challengeLink = createChallengeLink(emotion, `Go to ${normalizedEmotion} challenge`);
        fullChallenge += `<p>🎯 <strong>Challenge:</strong> ${challengeLink} to explore specific activities and exercises for your current mood.</p>`;
    }
    
    dailyChallengeContent.innerHTML = fullChallenge;
}

// Load daily tip
function loadDailyTip() {
    const tips = [
        "Facial expressions can influence how you feel - try smiling to boost your mood.",
        "Practice facial relaxation exercises to reduce tension and stress.",
        "Pay attention to your facial expressions throughout the day - they reflect your inner state.",
        "Use mirror work to practice positive facial expressions and self-compassion.",
        "Facial analysis can help you become more aware of your emotional patterns.",
        "Remember that all emotions are temporary - even difficult ones will pass.",
        "Your face is a window to your emotions - use this awareness for self-care.",
        "Connecting with others through facial expressions can improve relationships.",
        "Practice expressing emotions in healthy ways rather than suppressing them.",
        "Facial expressions are universal - they connect us all as humans."
    ];
    const randomTip = tips[Math.floor(Math.random() * tips.length)];
    dailyTipContent.innerHTML = `<p>${randomTip}</p>`;
}

// Emotional Progress Chart
function updateChart(period = 'daily') {
    loadFacialAnalysisHistory(period).then(analyses => {
        let avgPositive = 0, avgNegative = 0, avgNeutral = 0;
        
        if (analyses.length > 0) {
            analyses.forEach(analysis => {
                avgPositive += analysis.emotionDistribution.positive;
                avgNegative += analysis.emotionDistribution.negative;
                avgNeutral += analysis.emotionDistribution.neutral;
            });
            
            avgPositive /= analyses.length;
            avgNegative /= analyses.length;
            avgNeutral /= analyses.length;
        } else {
            avgPositive = Math.floor(Math.random() * 30) + 40;
            avgNegative = Math.floor(Math.random() * 20) + 15;
            avgNeutral = 100 - avgPositive - avgNegative;
        }

        const ctx = progressChart.getContext("2d");
        const chartData = {
            labels: ["Positive", "Negative", "Neutral"],
            datasets: [{
                label: "Facial Emotion Distribution",
                data: [avgPositive, avgNegative, avgNeutral],
                backgroundColor: [
                    "rgba(102, 187, 106, 0.7)",
                    "rgba(239, 83, 80, 0.7)",
                    "rgba(255, 202, 40, 0.7)"
                ],
                borderColor: [
                    "rgba(102, 187, 106, 1)",
                    "rgba(239, 83, 80, 1)",
                    "rgba(255, 202, 40, 1)"
                ],
                borderWidth: 2
            }]
        };

        if (chart) chart.destroy();
        chart = new Chart(ctx, {
            type: "doughnut",
            data: chartData,
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    });
}

function formatFacialAnalysisResults(data, imageData) {
    const emotion = data.emotion.toLowerCase();
    
    let emotionDistribution = data.emotion_distribution || {
        positive: 0,
        negative: 0,
        neutral: 0
    };
    
    if (!data.emotion_distribution) {
        const positiveEmotions = ['happy', 'joy', 'surprise'];
        const negativeEmotions = ['sad', 'angry', 'fear', 'disgust'];
        
        if (positiveEmotions.includes(emotion)) {
            emotionDistribution.positive = data.confidence || 75;
            emotionDistribution.neutral = (100 - emotionDistribution.positive) * 0.6;
            emotionDistribution.negative = 100 - emotionDistribution.positive - emotionDistribution.neutral;
        } else if (negativeEmotions.includes(emotion)) {
            emotionDistribution.negative = data.confidence || 75;
            emotionDistribution.neutral = (100 - emotionDistribution.negative) * 0.4;
            emotionDistribution.positive = 100 - emotionDistribution.negative - emotionDistribution.neutral;
        } else {
            emotionDistribution.neutral = data.confidence || 70;
            emotionDistribution.positive = (100 - emotionDistribution.neutral) * 0.6;
            emotionDistribution.negative = 100 - emotionDistribution.neutral - emotionDistribution.positive;
        }
    }

    return {
        type: 'facial',
        emotion: data.emotion.charAt(0).toUpperCase() + data.emotion.slice(1),
        confidence: data.confidence || 75,
        emotionDistribution: emotionDistribution,
        emotionScores: data.emotion_scores || {},
        recommendation: data.recommendation,
        challenge: data.challenge,
        tip: data.tip,
        trend: data.trend,
        timestamp: new Date().toISOString(),
        userId: currentUserId,
        enhanced: !!data.enhanced
    };
}

function saveFacialAnalysisToHistory(result) {
    try {
        const userHistoryKey = getUserSpecificKey('facialAnalysisHistory');
        let history = JSON.parse(localStorage.getItem(userHistoryKey)) || [];
        
        const resultToSave = { ...result };
        delete resultToSave.imageData;
        
        history.push(resultToSave);
        
        if (history.length > 50) {
            history = history.slice(-50);
        }
        
        localStorage.setItem(userHistoryKey, JSON.stringify(history));
        console.log('Facial analysis saved to localStorage successfully');
    } catch (error) {
        if (error.name === 'QuotaExceededError') {
            console.error('localStorage quota exceeded. Clearing old data...');
            
            try {
                const userHistoryKey = getUserSpecificKey('facialAnalysisHistory');
                let history = JSON.parse(localStorage.getItem(userHistoryKey)) || [];
                
                history = history.slice(-20);
                
                const resultToSave = { ...result };
                delete resultToSave.imageData;
                history.push(resultToSave);
                
                localStorage.setItem(userHistoryKey, JSON.stringify(history));
                console.log('Saved after clearing old data');
            } catch (retryError) {
                console.error('Still cannot save to localStorage:', retryError);
                alert('Warning: Cannot save analysis history. Your localStorage is full. Some older data may be lost.');
            }
        } else {
            console.error('Error saving to localStorage:', error);
        }
    }
}

function clearOldFacialAnalysisData() {
    try {
        const userHistoryKey = getUserSpecificKey('facialAnalysisHistory');
        let history = JSON.parse(localStorage.getItem(userHistoryKey)) || [];
        
        history = history.map(item => {
            const cleaned = { ...item };
            delete cleaned.imageData;
            return cleaned;
        });
        
        history = history.slice(-30);
        
        localStorage.setItem(userHistoryKey, JSON.stringify(history));
        console.log(`Cleaned localStorage. Kept ${history.length} entries.`);
        
        return history.length;
    } catch (error) {
        console.error('Error cleaning localStorage:', error);
        return 0;
    }
}

// Save facial analysis to backend
async function saveFacialAnalysisToBackend(result) {
    if (!token || currentUserId === "guest") {
        console.log("Guest user - facial analysis saved locally only");
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/facial-analysis/save`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                emotion: result.emotion,
                confidence: result.confidence,
                emotionDistribution: result.emotionDistribution,
                emotionScores: result.emotionScores,
                recommendation: result.recommendation,
                challenge: result.challenge,
                tip: result.tip,
                timestamp: result.timestamp,
                enhanced: result.enhanced || false
            })
        });

        if (response.ok) {
            console.log("Facial analysis saved to backend successfully");
        } else {
            console.error("Failed to save facial analysis to backend");
        }
    } catch (error) {
        console.error("Error saving facial analysis to backend:", error);
    }
}

// Load facial analysis history
async function loadFacialAnalysisHistory(period = 'all') {
    let analyses = [];
    
    if (token && currentUserId !== "guest") {
        try {
            const res = await fetch(`${API_BASE}/facial-analysis/history/${period}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                analyses = await res.json();
            }
        } catch (error) {
            console.log("Failed to load facial analysis from database, using localStorage");
        }
    }

    if (analyses.length === 0) {
        const userHistoryKey = getUserSpecificKey('facialAnalysisHistory');
        const allAnalyses = JSON.parse(localStorage.getItem(userHistoryKey)) || [];
        
        if (period !== 'all') {
            const now = new Date();
            const filterDate = new Date();
            
            if (period === 'daily') {
                filterDate.setDate(now.getDate() - 1);
            } else if (period === 'weekly') {
                filterDate.setDate(now.getDate() - 7);
            } else {
                filterDate.setMonth(now.getMonth() - 1);
            }
            
            analyses = allAnalyses.filter(analysis => 
                new Date(analysis.timestamp) >= filterDate
            );
        } else {
            analyses = allAnalyses;
        }
    }
    
    return analyses;
}

// Load user facial analysis history from backend
async function loadUserFacialAnalysisHistory() {
    if (!token || currentUserId === "guest") return;

    try {
        const response = await fetch(`${API_BASE}/facial-analysis/history`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const history = await response.json();
            console.log(`Loaded ${history.length} facial analyses from backend`);
        }
    } catch (error) {
        console.error("Error loading facial analysis history:", error);
    }
}

// Record facial analysis challenge completion
async function recordFacialAnalysisChallenge(emotion) {
    try {
        if (!currentUserId) {
            await initializeUserContext();
        }

        let newCompletion = {
            mood: emotion.toLowerCase(),
            challenge: 'facial-analysis',
            time: new Date().toISOString(),
            userId: currentUserId,
            type: 'facial-analysis-challenge'
        };

        if (token && currentUserId !== "guest") {
            await fetch(`${API_BASE}/progress/complete-challenge`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    mood: emotion.toLowerCase(),
                    challenge: 'facial-analysis',
                    type: 'facial-analysis-challenge'
                }),
            });
        }

        const userChallengesKey = getUserSpecificKey('completedChallenges');
        let completions = JSON.parse(localStorage.getItem(userChallengesKey)) || [];
        completions.push(newCompletion);
        localStorage.setItem(userChallengesKey, JSON.stringify(completions));

        console.log(`Facial analysis challenge recorded for user ${currentUserId}: ${emotion}`);
    } catch (error) {
        console.error('Error recording facial analysis challenge:', error);
    }
}

// Show assessment report option
function showAssessmentReportOption() {
    sessionStorage.setItem('latestFacialAnalysisCompleted', 'true');
    sessionStorage.setItem('latestFacialAnalysisTime', new Date().toISOString());
    
    const notification = document.createElement('div');
    notification.className = 'analysis-complete-notification';
    notification.style.cssText = `
        background: #e8f5e8;
        border: 1px solid #4caf50;
        color: #2e7d32;
        padding: 10px 15px;
        border-radius: 5px;
        margin-top: 15px;
        text-align: center;
        font-size: 14px;
    `;
    notification.innerHTML = `
        ✅ Facial analysis complete! 
    `;

    const existingNotification = document.querySelector('.analysis-complete-notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    emotionResult.appendChild(notification);
}

// Export facial analysis data
async function exportFacialAnalysisData() {
    try {
        const userHistoryKey = getUserSpecificKey('facialAnalysisHistory');
        const localData = JSON.parse(localStorage.getItem(userHistoryKey)) || [];
        
        let allData = localData;
        
        if (token && currentUserId !== "guest") {
            try {
                const res = await fetch(`${API_BASE}/facial-analysis/export`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) {
                    const backendData = await res.json();
                    const combined = [...backendData, ...localData];
                    allData = combined.filter((item, index, self) => 
                        index === self.findIndex(t => t.timestamp === item.timestamp)
                    );
                }
            } catch (error) {
                console.log("Using local data only for export");
            }
        }

        if (allData.length === 0) {
            alert('No facial analysis data to export');
            return;
        }

        const csvContent = convertFacialAnalysisToCSV(allData);
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `facial_analysis_${currentUserId}_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
    } catch (error) {
        console.error('Error exporting facial analysis data:', error);
        alert('Error exporting data. Please try again.');
    }
}

// Convert facial analysis data to CSV
function convertFacialAnalysisToCSV(data) {
    const headers = ['Date', 'Time', 'Detected Emotion', 'Confidence %', 'Positive %', 'Negative %', 'Neutral %'];
    
    const rows = data.map(item => {
        const date = new Date(item.timestamp);
        return [
            date.toLocaleDateString(),
            date.toLocaleTimeString(),
            item.emotion,
            item.confidence.toFixed(2),
            item.emotionDistribution.positive.toFixed(2),
            item.emotionDistribution.negative.toFixed(2),
            item.emotionDistribution.neutral.toFixed(2)
        ].join(',');
    });
    
    return [headers.join(','), ...rows].join('\n');
}

// Sync facial analysis data with backend
async function syncFacialAnalysisData() {
    if (!token || currentUserId === "guest") {
        console.log("Cannot sync - user not logged in");
        return;
    }

    try {
        const userHistoryKey = getUserSpecificKey('facialAnalysisHistory');
        const localData = JSON.parse(localStorage.getItem(userHistoryKey)) || [];
        
        if (localData.length === 0) {
            console.log("No local facial analysis data to sync");
            return;
        }

        const response = await fetch(`${API_BASE}/facial-analysis/sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ analyses: localData })
        });

        if (response.ok) {
            const result = await response.json();
            console.log(`Synced ${result.syncedCount} facial analyses to backend`);
        } else {
            console.error("Failed to sync facial analysis data with backend");
        }
    } catch (error) {
        console.error("Error syncing facial analysis data:", error);
    }
}

// Check authentication status
function checkAuthenticationStatus() {
    if (token) {
        console.log("User is authenticated - facial analysis syncing enabled");
        syncFacialAnalysisData();
    } else {
        console.log("Guest user - facial analysis local storage only");
    }
}

// Make functions available globally
window.exportFacialAnalysisData = exportFacialAnalysisData;
window.syncFacialAnalysisData = syncFacialAnalysisData;
window.loadFacialAnalysisHistory = loadFacialAnalysisHistory;
window.getUserSpecificKey = getUserSpecificKey;

// Auto-sync when user logs in/out
window.addEventListener('storage', function(e) {
    if (e.key === 'token') {
        location.reload();
    }
});

// Add this enhanced function to facial-analysis.js

// Enhanced Tip of the Day with emotion-specific tips and links
function updateDailyTipWithEmotion(emotion) {
    const normalizedEmotion = emotion.toLowerCase();
    
    const emotionTips = {
        joy: {
            tip: "Your joyful expression reflects inner happiness. Facial expressions of joy can actually boost your mood even more!",
            detailedTip: "Research shows that smiling triggers the release of dopamine and serotonin, creating a positive feedback loop. Keep expressing that joy!",
            page: "happyTips.html",
            emoji: "😊",
            color: "#4caf50"
        },
        happiness: {
            tip: "Smiling activates neural pathways that support emotional well-being. Keep smiling!",
            detailedTip: "Even forced smiles can improve your mood. The facial feedback hypothesis suggests your brain interprets your facial expressions as genuine emotions.",
            page: "happyTips.html",
            emoji: "😊",
            color: "#4caf50"
        },
        happy: {
            tip: "Your happy expression is contagious! Research shows happiness spreads through facial expressions.",
            detailedTip: "Mirror neurons in others' brains activate when they see your smile, making them more likely to smile too. Share your happiness!",
            page: "happyTips.html",
            emoji: "😊",
            color: "#4caf50"
        },
        sadness: {
            tip: "Your facial expression shows you're processing difficult emotions. Be gentle with yourself.",
            detailedTip: "Facial expressions of sadness are valid and important. They signal to others that you need support and help you process grief.",
            page: "sadTips.html",
            emoji: "☹️",
            color: "#2196f3"
        },
        sad: {
            tip: "It's okay to show sadness. Expressing emotions through facial expressions is healthy.",
            detailedTip: "Suppressing sad expressions can intensify negative emotions. Allow yourself to express what you're feeling naturally.",
            page: "sadTips.html",
            emoji: "☹️",
            color: "#2196f3"
        },
        anger: {
            tip: "Notice the tension in your facial muscles. Relaxing your face can help calm your emotions.",
            detailedTip: "Anger creates tension in your jaw, forehead, and eyebrows. Progressive facial relaxation can reduce the intensity of angry feelings.",
            page: "angryTips.html",
            emoji: "😠",
            color: "#f44336"
        },
        angry: {
            tip: "Try facial relaxation exercises - consciously relax your jaw, forehead, and eyes to reduce anger.",
            detailedTip: "Clenched jaws and furrowed brows intensify anger. Softening these muscles sends calming signals to your brain.",
            page: "angryTips.html",
            emoji: "😠",
            color: "#f44336"
        },
        fear: {
            tip: "Your facial expression reveals anxiety. Practice gentle facial massage to release tension.",
            detailedTip: "Fear causes widened eyes and raised eyebrows. Gently massaging your temples and jaw can activate your relaxation response.",
            page: "fearTips.html",
            emoji: "😰",
            color: "#9c27b0"
        },
        fearful: {
            tip: "Notice how fear affects your facial muscles. Deep breathing while relaxing your face can help.",
            detailedTip: "Fear creates tension around the eyes and forehead. Combining facial relaxation with slow breathing activates your parasympathetic nervous system.",
            page: "fearTips.html",
            emoji: "😰",
            color: "#9c27b0"
        },
        surprise: {
            tip: "Your surprised expression shows you're engaged with life! Stay open to new experiences.",
            detailedTip: "Surprise expressions with raised eyebrows and wide eyes indicate active attention and curiosity - embrace this natural response!",
            page: "surpriseTips.html",
            emoji: "😲",
            color: "#ff9800"
        },
        surprised: {
            tip: "Surprise activates your attention systems. Use this heightened awareness positively!",
            detailedTip: "The brief surprise response prepares you to quickly process new information. Channel this alertness into positive action.",
            page: "surpriseTips.html",
            emoji: "😲",
            color: "#ff9800"
        },
        love: {
            tip: "Your loving expression radiates warmth. Facial expressions of love strengthen relationships.",
            detailedTip: "Soft eyes and gentle smiles signal affection and trust. These expressions trigger oxytocin release, deepening emotional bonds.",
            page: "loveTips.html",
            emoji: "💖",
            color: "#e91e63"
        },
        disgust: {
            tip: "Your facial expression indicates discomfort. Identify the source and address it constructively.",
            detailedTip: "Disgust expressions (wrinkled nose, raised upper lip) are protective responses. Honor what your body is telling you needs to change.",
            page: "angryTips.html",
            emoji: "😖",
            color: "#795548"
        },
        neutral: {
            tip: "A neutral expression can indicate calmness and composure. Use this balance for reflection.",
            detailedTip: "A relaxed, neutral face often accompanies mindfulness and emotional equilibrium. This is an excellent state for decision-making.",
            page: "wellnessTips.html",
            emoji: "😐",
            color: "#607d8b"
        }
    };

    const tipData = emotionTips[normalizedEmotion] || emotionTips['neutral'];
    
    const html = `
        <div style="text-align: center; padding: 1rem;">
            <div style="
                width: 90px;
                height: 90px;
                margin: 0 auto 1.5rem;
                background: linear-gradient(135deg, ${tipData.color}25 0%, ${tipData.color}10 100%);
                border: 3px solid ${tipData.color};
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 3rem;
                box-shadow: 0 8px 25px ${tipData.color}30;
                animation: emotionPulse 2.5s ease-in-out infinite;
                position: relative;
            ">
                <div style="
                    position: absolute;
                    width: 100%;
                    height: 100%;
                    border-radius: 50%;
                    border: 2px solid ${tipData.color}40;
                    animation: ripple 2s ease-out infinite;
                "></div>
                ${tipData.emoji}
            </div>
            <h4 style="
                color: ${tipData.color};
                margin-bottom: 0.75rem;
                font-weight: 700;
                font-size: 1.15rem;
                text-transform: uppercase;
                letter-spacing: 1px;
            ">Facial Expression Insight</h4>
            <p style="
                margin-bottom: 1rem;
                line-height: 1.8;
                color: #4a5568;
                font-size: 1.05rem;
                font-weight: 500;
            ">${tipData.tip}</p>
            <p style="
                margin-bottom: 2rem;
                line-height: 1.7;
                color: #718096;
                font-size: 0.95rem;
                padding: 1rem;
                background: ${tipData.color}08;
                border-radius: 12px;
                border-left: 4px solid ${tipData.color};
            ">
                <i class="fas fa-lightbulb" style="color: ${tipData.color}; margin-right: 8px;"></i>
                ${tipData.detailedTip}
            </p>
            <a href="${tipData.page}" 
               style="
                 display: inline-flex;
                 align-items: center;
                 justify-content: center;
                 gap: 12px;
                 padding: 16px 36px;
                 background: linear-gradient(135deg, ${tipData.color} 0%, ${tipData.color}cc 100%);
                 color: white;
                 text-decoration: none;
                 border-radius: 50px;
                 font-weight: 700;
                 font-size: 1.05rem;
                 transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                 box-shadow: 0 6px 20px ${tipData.color}50;
                 text-transform: uppercase;
                 letter-spacing: 0.5px;
                 border: 2px solid transparent;
               "
               onmouseover="
                 this.style.transform='translateY(-4px) scale(1.05)'; 
                 this.style.boxShadow='0 12px 35px ${tipData.color}60';
                 this.style.borderColor='${tipData.color}';
               "
               onmouseout="
                 this.style.transform='translateY(0) scale(1)'; 
                 this.style.boxShadow='0 6px 20px ${tipData.color}50';
                 this.style.borderColor='transparent';
               "
            >
                <i class="fas fa-spa" style="font-size: 1.3rem;"></i>
                <span>Explore ${normalizedEmotion.charAt(0).toUpperCase() + normalizedEmotion.slice(1)} Wellness Tips</span>
                <i class="fas fa-arrow-right" style="font-size: 1rem;"></i>
            </a>
        </div>
        <style>
            @keyframes emotionPulse {
                0%, 100% {
                    transform: scale(1);
                    box-shadow: 0 8px 25px ${tipData.color}30;
                }
                50% {
                    transform: scale(1.08);
                    box-shadow: 0 12px 35px ${tipData.color}45;
                }
            }
            @keyframes ripple {
                0% {
                    transform: scale(1);
                    opacity: 1;
                }
                100% {
                    transform: scale(1.5);
                    opacity: 0;
                }
            }
        </style>
    `;
    
    dailyTipContent.innerHTML = html;
}

// Update the sendImageForAnalysis function to update tips
async function sendImageForAnalysis(base64Image) {
    emotionResult.innerHTML = "Analyzing facial expression...";

    try {
        const response = await fetch(`${API_ORIGIN}/analyze-face`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: base64Image })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.details || "Analysis failed");
        }

        const formattedResults = formatFacialAnalysisResults(data, base64Image);
        displayFacialAnalysisResults(formattedResults);
        updateRecommendations(data.emotion);
        updateDailyChallenge(data.emotion);
        
        // Update Tip of the Day with emotion-specific tip
        updateDailyTipWithEmotion(data.emotion);

        await saveFacialAnalysisToHistory(formattedResults);
        await saveFacialAnalysisToBackend(formattedResults);
        updateChart('daily');
        showAssessmentReportOption();
        await recordFacialAnalysisChallenge(data.emotion);

    } catch (error) {
        console.error("Facial analysis error:", error);
        emotionResult.innerHTML = "Error analyzing facial expression. Please try again.";
    }
}

// Replace the existing loadDailyTip function with this improved version
function loadDailyTip() {
    const generalTips = [
        {
            tip: "Facial expressions can influence how you feel - try smiling to boost your mood.",
            detail: "The facial feedback hypothesis shows that your facial muscles send signals to your brain that can actually change your emotional state.",
            emoji: "😊",
            page: "wellnessTips.html",
            color: "#6366F1"
        },
        {
            tip: "Practice facial relaxation exercises to reduce tension and stress.",
            detail: "Progressive facial muscle relaxation involves consciously tensing and releasing facial muscles to reduce overall stress levels.",
            emoji: "😌",
            page: "wellnessTips.html",
            color: "#10B981"
        },
        {
            tip: "Your face is a window to your emotions - use this awareness for self-care.",
            detail: "Being mindful of your facial expressions throughout the day can help you identify and manage your emotional states more effectively.",
            emoji: "🪞",
            page: "wellnessTips.html",
            color: "#8B5CF6"
        },
        {
            tip: "Mirror work can help you practice positive facial expressions and self-compassion.",
            detail: "Spending a few minutes daily looking at your reflection while expressing positive emotions can boost self-esteem and emotional well-being.",
            emoji: "✨",
            page: "wellnessTips.html",
            color: "#EC4899"
        }
    ];
    
    const randomTip = generalTips[Math.floor(Math.random() * generalTips.length)];
    
    const html = `
        <div style="text-align: center; padding: 1rem;">
            <div style="
                width: 80px;
                height: 80px;
                margin: 0 auto 1.25rem;
                background: linear-gradient(135deg, ${randomTip.color}20 0%, ${randomTip.color}10 100%);
                border: 2px solid ${randomTip.color}40;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 2.2rem;
                box-shadow: 0 4px 15px ${randomTip.color}25;
            ">
                ${randomTip.emoji}
            </div>
            <h4 style="
                color: ${randomTip.color};
                margin-bottom: 0.75rem;
                font-weight: 700;
                font-size: 1.1rem;
            ">Daily Facial Wellness Tip</h4>
            <p style="
                margin-bottom: 0.75rem; 
                line-height: 1.7; 
                color: #4a5568;
                font-weight: 500;
            ">${randomTip.tip}</p>
            <p style="
                margin-bottom: 1.5rem;
                line-height: 1.6;
                color: #718096;
                font-size: 0.9rem;
                padding: 0.75rem;
                background: ${randomTip.color}08;
                border-radius: 8px;
            ">${randomTip.detail}</p>
            <a href="${randomTip.page}" 
               style="
                 display: inline-flex;
                 align-items: center;
                 gap: 8px;
                 color: ${randomTip.color};
                 text-decoration: none;
                 font-weight: 700;
                 font-size: 1rem;
                 transition: all 0.3s ease;
                 padding: 10px 20px;
                 border: 2px solid ${randomTip.color}30;
                 border-radius: 25px;
                 background: ${randomTip.color}05;
               "
               onmouseover="
                 this.style.color='white';
                 this.style.background='${randomTip.color}';
                 this.style.borderColor='${randomTip.color}';
                 this.style.transform='translateY(-2px)';
                 this.style.boxShadow='0 6px 20px ${randomTip.color}40';
               "
               onmouseout="
                 this.style.color='${randomTip.color}';
                 this.style.background='${randomTip.color}05';
                 this.style.borderColor='${randomTip.color}30';
                 this.style.transform='translateY(0)';
                 this.style.boxShadow='none';
               "
            >
                <span>View All Wellness Tips</span>
                <i class="fas fa-arrow-right"></i>
            </a>
        </div>
    `;
    
    dailyTipContent.innerHTML = html;
}