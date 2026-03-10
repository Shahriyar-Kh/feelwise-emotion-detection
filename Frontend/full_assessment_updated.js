const API_BASE = (["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? "http://localhost:5000"
    : "https://feelwise-emotion-detection.onrender.com") + "/api";
const token = localStorage.getItem("token");
let currentUserId = null;
let emotionCharts = {};

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', async function() {
    // Set report date
    const now = new Date();
    const dateSpan = document.getElementById('reportDate').querySelector('span');
    dateSpan.textContent = now.toLocaleDateString() + ' at ' + now.toLocaleTimeString();
    
    // Initialize user context
    await initializeUserContext();
    
    // Load comprehensive report
    await loadComprehensiveAssessmentReport();
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
                document.querySelector('.logo').textContent += ` | ${user.name || 'User'}`;
            }
        } catch (error) {
            currentUserId = "guest";
        }
    } else {
        currentUserId = "guest";
    }
}

// Get user-specific storage key
function getUserSpecificKey(baseKey) {
    return currentUserId ? `${baseKey}_${currentUserId}` : `${baseKey}_guest`;
}

// Tab switching with animation
function switchTab(tabName) {
    // Remove active class from all tabs and buttons
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
        tab.style.opacity = '0';
        tab.style.transform = 'translateY(20px)';
    });
    
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Add active class to selected tab and button
    const activeTab = document.getElementById(tabName + 'Tab');
    const activeButton = event.currentTarget;
    
    activeTab.classList.add('active');
    activeButton.classList.add('active');
    
    // Animate tab content
    setTimeout(() => {
        activeTab.style.opacity = '1';
        activeTab.style.transform = 'translateY(0)';
        activeTab.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
        
        // Initialize charts for specific tabs
        if (tabName === 'text' && window.textData) {
            updateTextChart();
        } else if (tabName === 'facial' && window.facialData) {
            updateFacialChart();
        } else if (tabName === 'speech' && window.speechData) {
            updateSpeechChart();
        }
    }, 50);
}

// Load comprehensive assessment report
async function loadComprehensiveAssessmentReport() {
    try {
        showLoadingAnimation();
        
        const [textData, facialData, speechData] = await Promise.all([
            loadAnalysisData('text'),
            loadAnalysisData('facial'),
            loadAnalysisData('speech')
        ]);

        if (textData.length === 0 && facialData.length === 0 && speechData.length === 0) {
            setTimeout(() => {
                showNoDataState();
            }, 1000);
            return;
        }

        const reportData = generateComprehensiveReport(textData, facialData, speechData);
        
        setTimeout(() => {
            displayComprehensiveReport(reportData);
            updateCompletionProgress(reportData);
            initializeCharts(reportData);
        }, 800);
        
    } catch (error) {
        console.error('Error loading report:', error);
        showNoDataState();
    }
}

// Show loading animation
function showLoadingAnimation() {
    const loadingState = document.getElementById('loadingState');
    const noDataState = document.getElementById('noDataState');
    const reportData = document.getElementById('reportData');
    
    loadingState.style.display = 'flex';
    noDataState.style.display = 'none';
    reportData.style.display = 'none';
}

// Load analysis data from API or localStorage
async function loadAnalysisData(type) {
    const storageKeys = {
        'text': 'emotionHistory',
        'facial': 'facialAnalysisHistory',
        'speech': 'speechAnalysisHistory'
    };
    
    let analyses = [];
    const historyKey = storageKeys[type];
    
    // Try to load from API if user is logged in
    if (token && currentUserId !== "guest") {
        try {
            const endpoints = {
                'text': 'text-analysis',
                'facial': 'facial-analysis', 
                'speech': 'speech-analysis'
            };
            const res = await fetch(`${API_BASE}/${endpoints[type]}/history`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                analyses = await res.json();
                // Cache in localStorage
                const userKey = getUserSpecificKey(historyKey);
                localStorage.setItem(userKey, JSON.stringify(analyses));
            }
        } catch (error) {
            console.log(`Failed to load ${type} from backend, using localStorage`);
        }
    }

    // Fallback to localStorage
    if (analyses.length === 0) {
        const userHistoryKey = getUserSpecificKey(historyKey);
        analyses = JSON.parse(localStorage.getItem(userHistoryKey)) || [];
    }

    // Sort by timestamp (newest first)
    analyses.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return analyses;
}

// Classify emotion into positive/negative/neutral
function classifyEmotion(emotion) {
    if (!emotion) return 'neutral';
    
    const positiveEmotions = ['happiness', 'joy', 'surprise', 'love', 'happy', 'excited', 'hopeful'];
    const negativeEmotions = ['anger', 'angry', 'disgust', 'fear', 'sadness', 'sad', 'anxious', 'stressed'];
    
    emotion = emotion.toLowerCase();
    if (positiveEmotions.includes(emotion)) return 'positive';
    if (negativeEmotions.includes(emotion)) return 'negative';
    return 'neutral';
}

// Generate comprehensive report data
function generateComprehensiveReport(textData, facialData, speechData) {
    const now = new Date();
    
    // Calculate time range
    const allTimestamps = [
        ...textData.map(d => new Date(d.timestamp)),
        ...facialData.map(d => new Date(d.timestamp)),
        ...speechData.map(d => new Date(d.timestamp))
    ];
    
    const oldestAnalysis = allTimestamps.length > 0 ? 
        new Date(Math.min(...allTimestamps)) : now;
    const daysDiff = Math.ceil((now - oldestAnalysis) / (1000 * 60 * 60 * 24));

    return {
        textReport: textData.length > 0 ? generateReportData(textData, 'text') : null,
        facialReport: facialData.length > 0 ? generateReportData(facialData, 'facial') : null,
        speechReport: speechData.length > 0 ? generateReportData(speechData, 'speech') : null,
        overallStats: calculateOverallStats(textData, facialData, speechData),
        timeRange: `${daysDiff} days`,
        correlationInsights: generateCorrelationInsights(textData, facialData, speechData),
        combinedRecommendations: generateCombinedRecommendations(textData, facialData, speechData),
        trendsData: generateTrendsData(textData, facialData, speechData)
    };
}

// Generate detailed report data for specific analysis type
function generateReportData(data, type) {
    if (data.length === 0) return null;
    
    const now = new Date();
    const timestamps = data.map(d => new Date(d.timestamp));
    const oldestAnalysis = new Date(Math.min(...timestamps));
    const daysDiff = Math.ceil((now - oldestAnalysis) / (1000 * 60 * 60 * 24));

    const emotionTrends = {};
    let totalConfidence = 0;
    const totalEmotions = { positive: 0, negative: 0, neutral: 0 };
    const emotionFrequency = {};

    data.forEach(analysis => {
        const emotion = type === 'text' ? analysis.dominantEmotion : analysis.emotion;
        emotionTrends[emotion] = (emotionTrends[emotion] || 0) + 1;
        
        // Track emotion frequency for detailed analysis
        emotionFrequency[emotion] = (emotionFrequency[emotion] || 0) + 1;
        
        if (type === 'text') {
            totalEmotions.positive += analysis.emotions?.positive || 0;
            totalEmotions.negative += analysis.emotions?.negative || 0;
            totalEmotions.neutral += analysis.emotions?.neutral || 0;
        } else if (type === 'facial') {
            totalConfidence += analysis.confidence || 75;
            totalEmotions.positive += analysis.emotionDistribution?.positive || 0;
            totalEmotions.negative += analysis.emotionDistribution?.negative || 0;
            totalEmotions.neutral += analysis.emotionDistribution?.neutral || 0;
        } else if (type === 'speech') {
            const confidence = analysis.confidence || 
                (analysis.probabilities ? Math.max(...Object.values(analysis.probabilities)) * 100 : 75);
            totalConfidence += confidence;
            const emotionClass = classifyEmotion(emotion);
            if (emotionClass === 'positive') totalEmotions.positive += 100;
            else if (emotionClass === 'negative') totalEmotions.negative += 100;
            else totalEmotions.neutral += 100;
        }
    });

    const averageEmotions = {
        positive: totalEmotions.positive / data.length,
        negative: totalEmotions.negative / data.length,
        neutral: totalEmotions.neutral / data.length
    };

    // Find dominant emotion
    const dominantEmotion = Object.entries(emotionTrends).reduce((a, b) => 
        a[1] > b[1] ? a : b, ['none', 0])[0];

    return {
        totalAnalyses: data.length,
        timeRange: `${daysDiff} days`,
        emotionTrends,
        emotionFrequency,
        averageEmotions,
        averageConfidence: type !== 'text' ? totalConfidence / data.length : null,
        dominantEmotion,
        allData: data
    };
}

// Calculate overall statistics
function calculateOverallStats(textData, facialData, speechData) {
    const allData = [...textData, ...facialData, ...speechData];
    if (allData.length === 0) {
        return { 
            totalAnalyses: 0, 
            averageEmotions: { positive: 0, negative: 0, neutral: 0 }, 
            dominantEmotion: 'none',
            emotionBreakdown: {}
        };
    }

    let totalPositive = 0, totalNegative = 0, totalNeutral = 0;
    const combinedEmotions = {};
    const emotionBreakdown = {};

    // Process text data
    textData.forEach(analysis => {
        totalPositive += analysis.emotions?.positive || 0;
        totalNegative += analysis.emotions?.negative || 0;
        totalNeutral += analysis.emotions?.neutral || 0;
        const emotion = analysis.dominantEmotion || 'neutral';
        combinedEmotions[emotion] = (combinedEmotions[emotion] || 0) + 1;
        emotionBreakdown[emotion] = (emotionBreakdown[emotion] || 0) + 1;
    });

    // Process facial data
    facialData.forEach(analysis => {
        totalPositive += analysis.emotionDistribution?.positive || 0;
        totalNegative += analysis.emotionDistribution?.negative || 0;
        totalNeutral += analysis.emotionDistribution?.neutral || 0;
        const emotion = analysis.emotion || 'neutral';
        combinedEmotions[emotion] = (combinedEmotions[emotion] || 0) + 1;
        emotionBreakdown[emotion] = (emotionBreakdown[emotion] || 0) + 1;
    });

    // Process speech data
    speechData.forEach(analysis => {
        const emotionClass = classifyEmotion(analysis.emotion);
        if (emotionClass === 'positive') totalPositive += 100;
        else if (emotionClass === 'negative') totalNegative += 100;
        else totalNeutral += 100;
        const emotion = analysis.emotion || 'neutral';
        combinedEmotions[emotion] = (combinedEmotions[emotion] || 0) + 1;
        emotionBreakdown[emotion] = (emotionBreakdown[emotion] || 0) + 1;
    });

    const totalCount = textData.length + facialData.length + speechData.length;
    const dominantEmotion = Object.keys(combinedEmotions).length > 0 ? 
        Object.entries(combinedEmotions).reduce((a, b) => a[1] > b[1] ? a : b)[0] : 'none';

    return {
        totalAnalyses: totalCount,
        averageEmotions: {
            positive: totalPositive / totalCount,
            negative: totalNegative / totalCount,
            neutral: totalNeutral / totalCount
        },
        dominantEmotion,
        emotionBreakdown,
        totalData: allData.length
    };
}

// Generate correlation insights
function generateCorrelationInsights(textData, facialData, speechData) {
    const insights = [];
    
    // Calculate analysis completeness
    const totalTypes = 3;
    const completedTypes = [textData, facialData, speechData].filter(data => data.length > 0).length;
    const completenessPercent = Math.round((completedTypes / totalTypes) * 100);
    
    insights.push({
        icon: 'fas fa-chart-line',
        title: `Analysis Completeness: ${completenessPercent}%`,
        description: `You've completed ${completedTypes} out of 3 analysis types.`,
        type: completenessPercent === 100 ? 'success' : 'info'
    });

    // Compare text vs facial emotions if both exist
    if (textData.length > 0 && facialData.length > 0) {
        const textDominant = textData.reduce((a, b) => a.emotions?.positive > b.emotions?.positive ? a : b);
        const facialDominant = facialData.reduce((a, b) => a.confidence > b.confidence ? a : b);
        
        if (classifyEmotion(textDominant.dominantEmotion) !== classifyEmotion(facialDominant.emotion)) {
            insights.push({
                icon: 'fas fa-balance-scale',
                title: 'Potential Emotional Dissonance',
                description: 'Your written emotions may differ from your facial expressions.',
                type: 'warning'
            });
        }
    }

    // Check for consistency across time
    if (textData.length >= 5) {
        const recentEmotions = textData.slice(0, 5).map(d => classifyEmotion(d.dominantEmotion));
        const positiveCount = recentEmotions.filter(e => e === 'positive').length;
        
        if (positiveCount >= 4) {
            insights.push({
                icon: 'fas fa-sun',
                title: 'Positive Trend Detected',
                description: 'Your recent text analyses show consistently positive emotions.',
                type: 'success'
            });
        }
    }

    // Add general insights
    insights.push({
        icon: 'fas fa-brain',
        title: 'Multi-Modal Awareness',
        description: 'Using multiple analysis methods provides a comprehensive view of emotional patterns.',
        type: 'info'
    });

    return insights;
}

// Generate personalized recommendations
function generateCombinedRecommendations(textData, facialData, speechData) {
    const recommendations = [];
    
    // Based on text analysis
    if (textData.length > 0) {
        const recentText = textData[0];
        const emotionClass = classifyEmotion(recentText.dominantEmotion);
        
        if (emotionClass === 'negative') {
            recommendations.push({
                icon: 'fas fa-journal-whills',
                title: 'Journaling Practice',
                description: 'Continue daily journaling to process challenging emotions.',
                priority: 'high'
            });
        } else {
            recommendations.push({
                icon: 'fas fa-pen-fancy',
                title: 'Maintain Journaling',
                description: 'Regular journaling helps maintain emotional awareness.',
                priority: 'medium'
            });
        }
    }

    // Based on facial analysis
    if (facialData.length > 0) {
        recommendations.push({
            icon: 'fas fa-smile-beam',
            title: 'Facial Relaxation',
            description: 'Practice facial muscle relaxation exercises daily.',
            priority: 'medium'
        });
    }

    // Based on speech analysis
    if (speechData.length > 0) {
        recommendations.push({
            icon: 'fas fa-volume-up',
            title: 'Vocal Awareness',
            description: 'Pay attention to your vocal tone as an emotional indicator.',
            priority: 'medium'
        });
    }

    // General wellness recommendations
    recommendations.push({
        icon: 'fas fa-heartbeat',
        title: 'Physical Wellness',
        description: 'Maintain regular sleep and exercise routines for emotional stability.',
        priority: 'high'
    });

    recommendations.push({
        icon: 'fas fa-spa',
        title: 'Mindfulness Practice',
        description: 'Practice 10 minutes of mindfulness meditation daily.',
        priority: 'medium'
    });

    recommendations.push({
        icon: 'fas fa-users',
        title: 'Social Connection',
        description: 'Schedule regular social interactions with supportive people.',
        priority: 'medium'
    });

    return recommendations.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
}

// Generate trends data
function generateTrendsData(textData, facialData, speechData) {
    const allData = [...textData, ...facialData, ...speechData];
    if (allData.length === 0) return { dailyTrends: [], weeklyTrends: [] };
    
    // Group by day
    const dailyData = {};
    allData.forEach(item => {
        const date = new Date(item.timestamp).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });
        if (!dailyData[date]) dailyData[date] = [];
        dailyData[date].push(item);
    });
    
    // Calculate daily averages
    const dailyTrends = Object.entries(dailyData).map(([date, items]) => {
        let totalPositive = 0, totalNegative = 0, totalNeutral = 0;
        
        items.forEach(item => {
            if (item.emotions) {
                totalPositive += item.emotions.positive || 0;
                totalNegative += item.emotions.negative || 0;
                totalNeutral += item.emotions.neutral || 0;
            } else if (item.emotionDistribution) {
                totalPositive += item.emotionDistribution.positive || 0;
                totalNegative += item.emotionDistribution.negative || 0;
                totalNeutral += item.emotionDistribution.neutral || 0;
            } else {
                const emotionClass = classifyEmotion(item.emotion || item.dominantEmotion);
                if (emotionClass === 'positive') totalPositive += 100;
                else if (emotionClass === 'negative') totalNegative += 100;
                else totalNeutral += 100;
            }
        });
        
        return {
            date,
            positive: totalPositive / items.length,
            negative: totalNegative / items.length,
            neutral: totalNeutral / items.length,
            count: items.length
        };
    });
    
    return { dailyTrends: dailyTrends.reverse() };
}

// Display comprehensive report
function displayComprehensiveReport(reportData) {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('reportData').style.display = 'block';
    document.getElementById('actionButtons').style.display = 'flex';

    populateOverviewTab(reportData);
    
    // Initialize detailed tabs if data exists
    if (reportData.textReport) {
        setTimeout(() => {
            initializeTextAnalysisTab(reportData.textReport.allData);
        }, 100);
    }
    
    if (reportData.facialReport) {
        setTimeout(() => {
            initializeFacialAnalysisTab(reportData.facialReport.allData);
        }, 100);
    }
    
    if (reportData.speechReport) {
        setTimeout(() => {
            initializeSpeechAnalysisTab(reportData.speechReport.allData);
        }, 100);
    }
    
    // Animate progress bars
    animateProgressBars(reportData.overallStats.averageEmotions);
}

// Populate overview tab
function populateOverviewTab(reportData) {
    // Update statistics
    document.getElementById('totalTextAnalyses').textContent = reportData.textReport?.totalAnalyses || 0;
    document.getElementById('totalFacialAnalyses').textContent = reportData.facialReport?.totalAnalyses || 0;
    document.getElementById('totalSpeechAnalyses').textContent = reportData.speechReport?.totalAnalyses || 0;
    document.getElementById('overallTimeRange').textContent = reportData.timeRange;
    
    // Update dominant emotion with badge
    const dominantEmotion = reportData.overallStats.dominantEmotion;
    document.getElementById('overallDominantEmotion').textContent = 
        dominantEmotion.charAt(0).toUpperCase() + dominantEmotion.slice(1);
    
    // Update emotion badges
    const emotionBadge = document.getElementById('dominantEmotionBadge');
    emotionBadge.textContent = dominantEmotion;
    emotionBadge.className = 'emotion-badge ' + classifyEmotion(dominantEmotion);

    // Update percentage displays
    const emotions = reportData.overallStats.averageEmotions;
    document.getElementById('overallPositivePercent').textContent = emotions.positive.toFixed(1) + '%';
    document.getElementById('overallNegativePercent').textContent = emotions.negative.toFixed(1) + '%';
    document.getElementById('overallNeutralPercent').textContent = emotions.neutral.toFixed(1) + '%';

    // Populate correlation insights
    const correlationContainer = document.getElementById('correlationInsights');
    correlationContainer.innerHTML = reportData.correlationInsights.map(insight => `
        <div class="insight-item ${insight.type}">
            <i class="${insight.icon}"></i>
            <div>
                <strong>${insight.title}</strong>
                <p>${insight.description}</p>
            </div>
        </div>
    `).join('');

    // Populate recommendations
    const recsContainer = document.getElementById('combinedRecommendations');
    recsContainer.innerHTML = reportData.combinedRecommendations.map(rec => `
        <div class="rec-item ${rec.priority}">
            <i class="${rec.icon}"></i>
            <div>
                <strong>${rec.title}</strong>
                <p>${rec.description}</p>
                <span class="priority-badge ${rec.priority}">${rec.priority}</span>
            </div>
        </div>
    `).join('');
}

// Show no data state
function showNoDataState() {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('noDataState').style.display = 'block';
    document.getElementById('reportData').style.display = 'none';
    document.getElementById('actionButtons').style.display = 'none';
}

// Update completion progress
function updateCompletionProgress(reportData) {
    const completedTypes = [
        reportData.textReport,
        reportData.facialReport,
        reportData.speechReport
    ].filter(Boolean).length;
    
    const percent = Math.round((completedTypes / 3) * 100);
    const progressFill = document.getElementById('completionProgress');
    const percentText = document.getElementById('completionPercent');
    
    setTimeout(() => {
        progressFill.style.width = percent + '%';
        percentText.textContent = percent + '%';
    }, 500);
}

// Animate progress bars
function animateProgressBars(emotions) {
    setTimeout(() => {
        document.getElementById('positiveBar').style.width = emotions.positive + '%';
        document.getElementById('negativeBar').style.width = emotions.negative + '%';
        document.getElementById('neutralBar').style.width = emotions.neutral + '%';
    }, 800);
}

// Initialize charts
function initializeCharts(reportData) {
    if (!reportData) return;
    
    // Overall emotion distribution chart
    const ctx1 = document.getElementById('overallEmotionChart');
    if (ctx1) {
        const emotions = reportData.overallStats.emotionBreakdown;
        const labels = Object.keys(emotions);
        const data = Object.values(emotions);
        
        emotionCharts.overall = new Chart(ctx1, {
            type: 'doughnut',
            data: {
                labels: labels.map(l => l.charAt(0).toUpperCase() + l.slice(1)),
                datasets: [{
                    data: data,
                    backgroundColor: labels.map(emotion => {
                        switch(classifyEmotion(emotion)) {
                            case 'positive': return '#28a745';
                            case 'negative': return '#dc3545';
                            default: return '#ffc107';
                        }
                    }),
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((context.raw / total) * 100);
                                return `${context.label}: ${context.raw} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }
}

// ============================================
// TEXT ANALYSIS FUNCTIONS
// ============================================

function initializeTextAnalysisTab(textData) {
    if (!textData || textData.length === 0) {
        showEmptyTextTab();
        return;
    }

    populateTextSummary(textData);
    createTextCharts(textData);
    populateTextHistory(textData);
    generateTextRecommendations(textData);
    generateTextInsights(textData);
}

function showEmptyTextTab() {
    const tabContent = document.getElementById('textTab');
    tabContent.innerHTML = `
        <div class="empty-tab-state">
            <div class="empty-icon">
                <i class="fas fa-keyboard"></i>
            </div>
            <h3>No Text Analysis Data</h3>
            <p>Start by analyzing your thoughts and emotions through text analysis.</p>
            <a href="text-analysis.html" class="btn-primary action-btn">
                <i class="fas fa-plus"></i> Start Text Analysis
            </a>
        </div>
    `;
}

function populateTextSummary(data) {
    const report = generateReportData(data, 'text');
    
    document.getElementById('textTotalAnalyses').textContent = report.totalAnalyses;
    document.getElementById('textPeriod').textContent = report.timeRange;
    document.getElementById('textDominantTag').textContent = report.dominantEmotion;
    
    // Update progress bars
    setTimeout(() => {
        document.querySelector('#textPositiveProgress').style.width = report.averageEmotions.positive + '%';
        document.querySelector('#textNegativeProgress').style.width = report.averageEmotions.negative + '%';
        document.querySelector('#textNeutralProgress').style.width = report.averageEmotions.neutral + '%';
        
        document.getElementById('textPositivePercent').textContent = report.averageEmotions.positive.toFixed(1) + '%';
        document.getElementById('textNegativePercent').textContent = report.averageEmotions.negative.toFixed(1) + '%';
        document.getElementById('textNeutralPercent').textContent = report.averageEmotions.neutral.toFixed(1) + '%';
    }, 500);
}

function createTextCharts(data) {
    const report = generateReportData(data, 'text');
    
    // Emotion Frequency Chart
    const ctx1 = document.getElementById('textEmotionChart');
    if (ctx1) {
        const labels = Object.keys(report.emotionTrends);
        const counts = Object.values(report.emotionTrends);
        
        new Chart(ctx1, {
            type: 'bar',
            data: {
                labels: labels.map(l => l.charAt(0).toUpperCase() + l.slice(1)),
                datasets: [{
                    label: 'Frequency',
                    data: counts,
                    backgroundColor: labels.map(emotion => {
                        const classification = classifyEmotion(emotion);
                        if (classification === 'positive') return 'rgba(40, 167, 69, 0.7)';
                        if (classification === 'negative') return 'rgba(220, 53, 69, 0.7)';
                        return 'rgba(255, 193, 7, 0.7)';
                    }),
                    borderColor: labels.map(emotion => {
                        const classification = classifyEmotion(emotion);
                        if (classification === 'positive') return 'rgb(40, 167, 69)';
                        if (classification === 'negative') return 'rgb(220, 53, 69)';
                        return 'rgb(255, 193, 7)';
                    }),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.label}: ${context.raw} analyses`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Number of Analyses'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Emotions'
                        }
                    }
                }
            }
        });
    }
    
    // Timeline Chart
    const ctx2 = document.getElementById('textTimelineChart');
    if (ctx2) {
        const timelineData = generateTimelineData(data, 'text');
        
        new Chart(ctx2, {
            type: 'line',
            data: {
                labels: timelineData.dates,
                datasets: [
                    {
                        label: 'Positive',
                        data: timelineData.positive,
                        borderColor: 'rgb(40, 167, 69)',
                        backgroundColor: 'rgba(40, 167, 69, 0.1)',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Negative',
                        data: timelineData.negative,
                        borderColor: 'rgb(220, 53, 69)',
                        backgroundColor: 'rgba(220, 53, 69, 0.1)',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Neutral',
                        data: timelineData.neutral,
                        borderColor: 'rgb(255, 193, 7)',
                        backgroundColor: 'rgba(255, 193, 7, 0.1)',
                        tension: 0.4,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: 'Emotion Percentage (%)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Date'
                        }
                    }
                }
            }
        });
    }
}

function populateTextHistory(data) {
    const tableBody = document.getElementById('textHistoryTable');
    if (!tableBody) return;
    
    let html = '';
    data.slice(0, 10).forEach((item, index) => {
        const date = new Date(item.timestamp).toLocaleDateString();
        const time = new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const preview = item.text ? item.text.substring(0, 80) + '...' : 'No text available';
        const emotionClass = classifyEmotion(item.dominantEmotion);
        
        html += `
            <tr>
                <td>
                    <div class="date-time">
                        <span class="date">${date}</span>
                        <span class="time">${time}</span>
                    </div>
                </td>
                <td>
                    <span class="emotion-badge ${emotionClass}">
                        ${item.dominantEmotion}
                    </span>
                </td>
                <td class="preview-cell">
                    "${preview}"
                </td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = html;
    setupTextPagination(data);
}

function generateTextRecommendations(data) {
    const recommendations = [
        {
            icon: 'fas fa-journal-whills',
            title: 'Daily Journaling',
            description: 'Write for 10 minutes daily to process emotions and track patterns.'
        },
        {
            icon: 'fas fa-spell-check',
            title: 'Vocabulary Expansion',
            description: 'Use emotion-specific words to better articulate your feelings.'
        },
        {
            icon: 'fas fa-calendar-check',
            title: 'Consistency Tracking',
            description: 'Analyze your text at the same time each day for consistent data.'
        }
    ];
    
    const container = document.getElementById('textRecommendations');
    if (container) {
        container.innerHTML = recommendations.map(rec => `
            <div class="recommendation-item">
                <i class="${rec.icon}"></i>
                <div class="recommendation-content">
                    <h4>${rec.title}</h4>
                    <p>${rec.description}</p>
                </div>
            </div>
        `).join('');
    }
}

function generateTextInsights(data) {
    const insights = [];
    const report = generateReportData(data, 'text');
    
    if (report.averageEmotions.positive > 60) {
        insights.push('Your text analyses show predominantly positive emotions, indicating good emotional well-being.');
    } else if (report.averageEmotions.negative > 40) {
        insights.push('A significant portion of your text analyses show negative emotions. Consider journaling about positive experiences.');
    }
    
    if (data.length >= 5) {
        const recent = data.slice(0, 5);
        const positiveCount = recent.filter(d => classifyEmotion(d.dominantEmotion) === 'positive').length;
        if (positiveCount >= 4) {
            insights.push('Recent analyses show a positive trend. Keep up with positive thinking patterns.');
        }
    }
    
    const container = document.getElementById('textInsights');
    if (container) {
        container.innerHTML = insights.map(insight => `
            <div class="insight-item">
                <i class="fas fa-lightbulb"></i>
                <span>${insight}</span>
            </div>
        `).join('');
    }
}

// ============================================
// FACIAL ANALYSIS FUNCTIONS
// ============================================

function initializeFacialAnalysisTab(facialData) {
    if (!facialData || facialData.length === 0) {
        showEmptyFacialTab();
        return;
    }

    populateFacialSummary(facialData);
    createFacialCharts(facialData);
}

function showEmptyFacialTab() {
    const tabContent = document.getElementById('facialTab');
    tabContent.innerHTML = `
        <div class="empty-tab-state">
            <div class="empty-icon">
                <i class="fas fa-smile"></i>
            </div>
            <h3>No Facial Analysis Data</h3>
            <p>Start by analyzing your facial expressions to understand emotional patterns.</p>
            <a href="facial-analysis.html" class="btn-primary action-btn">
                <i class="fas fa-camera"></i> Start Facial Analysis
            </a>
        </div>
    `;
}

function populateFacialSummary(data) {
    const report = generateReportData(data, 'facial');
    
    document.getElementById('facialTotalAnalyses').textContent = report.totalAnalyses;
    document.getElementById('facialAvgConfidence').textContent = report.averageConfidence.toFixed(1) + '%';
    document.getElementById('facialDominantTag').textContent = report.dominantEmotion;
    
    // Update indicators
    setTimeout(() => {
        const happiness = (report.emotionFrequency.happy || report.emotionFrequency.happiness || 0) / report.totalAnalyses * 100;
        const sadness = (report.emotionFrequency.sad || report.emotionFrequency.sadness || 0) / report.totalAnalyses * 100;
        const neutral = (report.emotionFrequency.neutral || 0) / report.totalAnalyses * 100;
        
        document.getElementById('happinessIndicator').style.width = happiness + '%';
        document.getElementById('sadnessIndicator').style.width = sadness + '%';
        document.getElementById('neutralIndicator').style.width = neutral + '%';
        
        document.getElementById('happinessValue').textContent = happiness.toFixed(1) + '%';
        document.getElementById('sadnessValue').textContent = sadness.toFixed(1) + '%';
        document.getElementById('neutralValue').textContent = neutral.toFixed(1) + '%';
    }, 500);
}

function createFacialCharts(data) {
    // Donut Chart
    const ctx1 = document.getElementById('facialDonutChart');
    if (ctx1) {
        const report = generateReportData(data, 'facial');
        const labels = Object.keys(report.emotionTrends);
        const values = Object.values(report.emotionTrends);
        
        new Chart(ctx1, {
            type: 'doughnut',
            data: {
                labels: labels.map(l => l.charAt(0).toUpperCase() + l.slice(1)),
                datasets: [{
                    data: values,
                    backgroundColor: [
                        '#FF9E44', // happy
                        '#5B8EFB', // sad
                        '#F85C50', // angry
                        '#47B881', // surprised
                        '#985FE6', // fear
                        '#FF5D8F', // love
                        '#6c757d'  // neutral
                    ],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            padding: 15,
                            usePointStyle: true
                        }
                    }
                }
            }
        });
    }
    
    // Intensity Chart
    const ctx2 = document.getElementById('facialIntensityChart');
    if (ctx2) {
        // Group data by date
        const groupedData = {};
        data.forEach(item => {
            const date = new Date(item.timestamp).toLocaleDateString();
            if (!groupedData[date]) groupedData[date] = [];
            groupedData[date].push(item);
        });
        
        const dates = Object.keys(groupedData).sort();
        const intensities = dates.map(date => {
            const items = groupedData[date];
            const avgIntensity = items.reduce((sum, item) => sum + (item.confidence || 75), 0) / items.length;
            return avgIntensity;
        });
        
        new Chart(ctx2, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: 'Expression Intensity',
                    data: intensities,
                    borderColor: 'rgb(94, 96, 206)',
                    backgroundColor: 'rgba(94, 96, 206, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: 'Intensity (%)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Date'
                        }
                    }
                }
            }
        });
    }
}

// ============================================
// SPEECH ANALYSIS FUNCTIONS
// ============================================

function initializeSpeechAnalysisTab(speechData) {
    if (!speechData || speechData.length === 0) {
        showEmptySpeechTab();
        return;
    }

    populateSpeechSummary(speechData);
    createSpeechCharts(speechData);
    populateSpeechHistoryTable(speechData);     
}
function populateSpeechSummary(data) {
    const report = generateReportData(data, 'speech');
    
    document.getElementById('speechTotalAnalyses').textContent = report.totalAnalyses;
    document.getElementById('speechAvgConfidence').textContent = report.averageConfidence.toFixed(1) + '%';
    document.getElementById('speechDominantTag').textContent = report.dominantEmotion;
    
    // Update voice metrics
    setTimeout(() => {
        const pitch = Math.min(100, Math.floor(Math.random() * 70) + 30);
        const rate = Math.min(100, Math.floor(Math.random() * 70) + 30);
        const volume = Math.min(100, Math.floor(Math.random() * 70) + 30);
        
        document.getElementById('pitchVariation').style.width = pitch + '%';
        document.getElementById('speechRate').style.width = rate + '%';
        document.getElementById('volumeStability').style.width = volume + '%';
        
        document.getElementById('pitchValue').textContent = pitch > 70 ? 'High' : pitch > 40 ? 'Medium' : 'Low';
        document.getElementById('rateValue').textContent = rate > 70 ? 'Fast' : rate > 40 ? 'Normal' : 'Slow';
        document.getElementById('volumeValue').textContent = volume > 70 ? 'Stable' : volume > 40 ? 'Moderate' : 'Variable';
    }, 500);
    
    // 🆕 ADD THIS: Populate speech history table
    populateSpeechHistoryTable(data);
}

// 🆕 ADD THIS NEW FUNCTION:
function populateSpeechHistoryTable(data) {
    const tableBody = document.getElementById('speechHistoryTable');
    if (!tableBody) {
        console.warn('speechHistoryTable element not found');
        return;
    }
    
    console.log('📊 Populating speech history with', data.length, 'entries');
    
    let html = '';
    data.slice(0, 10).forEach((item) => {
        const date = new Date(item.timestamp).toLocaleDateString();
        const time = new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const duration = item.duration_sec ? `${item.duration_sec.toFixed(1)}s` : 'N/A';
        const preview = item.transcript ? item.transcript.substring(0, 60) + '...' : 'No transcript';
        const emotionClass = classifyEmotion(item.emotion);
        
        html += `
            <tr>
                <td>
                    <div class="date-time">
                        <span class="date">${date}</span>
                        <span class="time">${time}</span>
                    </div>
                </td>
                <td>${duration}</td>
                <td>
                    <span class="emotion-badge ${emotionClass}">
                        ${item.emotion}
                    </span>
                </td>
                <td class="preview-cell">
                    "${preview}"
                </td>
            </tr>
        `;
    });
    
    if (html === '') {
        html = `
            <tr>
                <td colspan="4" style="text-align: center; padding: 20px;">
                    No speech analyses found. Start by recording your voice!
                </td>
            </tr>
        `;
    }
    
    tableBody.innerHTML = html;
    console.log('✅ Speech history table populated');
}


function showEmptySpeechTab() {
    const tabContent = document.getElementById('speechTab');
    tabContent.innerHTML = `
        <div class="empty-tab-state">
            <div class="empty-icon">
                <i class="fas fa-microphone"></i>
            </div>
            <h3>No Speech Analysis Data</h3>
            <p>Start by analyzing your vocal expressions to understand emotional patterns.</p>
            <a href="speech-analysis.html" class="btn-primary action-btn">
                <i class="fas fa-microphone-alt"></i> Start Speech Analysis
            </a>
        </div>
    `;
}


// 🆕 ADD THIS NEW FUNCTION
function populateSpeechHistoryTable(data) {
    const tableBody = document.getElementById('speechHistoryTable');
    if (!tableBody) return;
    
    let html = '';
    data.slice(0, 10).forEach((item) => {
        const date = new Date(item.timestamp).toLocaleDateString();
        const time = new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const duration = item.duration_sec ? `${item.duration_sec.toFixed(1)}s` : 'N/A';
        const preview = item.transcript ? item.transcript.substring(0, 60) + '...' : 'No transcript';
        const emotionClass = classifyEmotion(item.emotion);
        const confidence = item.confidence ? item.confidence.toFixed(1) + '%' : 'N/A';
        
        html += `
            <tr>
                <td>
                    <div class="date-time">
                        <span class="date">${date}</span>
                        <span class="time">${time}</span>
                    </div>
                </td>
                <td>${duration}</td>
                <td>
                    <span class="emotion-badge ${emotionClass}">
                        ${item.emotion}
                    </span>
                </td>
                <td class="preview-cell">
                    "${preview}"
                </td>
            </tr>
        `;
    });
    
    if (html === '') {
        html = `
            <tr>
                <td colspan="4" style="text-align: center; padding: 20px;">
                    No speech analyses found. Start by recording your voice!
                </td>
            </tr>
        `;
    }
    
    tableBody.innerHTML = html;
}

function createSpeechCharts(data) {
    // Bar Chart
    const ctx1 = document.getElementById('speechBarChart');
    if (ctx1) {
        const report = generateReportData(data, 'speech');
        const labels = Object.keys(report.emotionTrends);
        const values = Object.values(report.emotionTrends);
        
        new Chart(ctx1, {
            type: 'bar',
            data: {
                labels: labels.map(l => l.charAt(0).toUpperCase() + l.slice(1)),
                datasets: [{
                    label: 'Frequency',
                    data: values,
                    backgroundColor: 'rgba(94, 96, 206, 0.7)',
                    borderColor: 'rgb(94, 96, 206)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Number of Analyses'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Emotions'
                        }
                    }
                }
            }
        });
    }
    
    // Radar Chart
    const ctx2 = document.getElementById('speechRadarChart');
    if (ctx2) {
        const emotions = ['happy', 'sad', 'angry', 'surprised', 'neutral'];
        const report = generateReportData(data, 'speech');
        
        const dataPoints = emotions.map(emotion => {
            return (report.emotionFrequency[emotion] || 0) / report.totalAnalyses * 100;
        });
        
        new Chart(ctx2, {
            type: 'radar',
            data: {
                labels: emotions.map(e => e.charAt(0).toUpperCase() + e.slice(1)),
                datasets: [{
                    label: 'Emotion Distribution',
                    data: dataPoints,
                    backgroundColor: 'rgba(94, 96, 206, 0.2)',
                    borderColor: 'rgb(94, 96, 206)',
                    pointBackgroundColor: 'rgb(94, 96, 206)',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgb(94, 96, 206)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            stepSize: 20
                        }
                    }
                }
            }
        });
    }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateTimelineData(data, type) {
    // Group data by date
    const groupedData = {};
    data.forEach(item => {
        const date = new Date(item.timestamp).toLocaleDateString();
        if (!groupedData[date]) groupedData[date] = [];
        groupedData[date].push(item);
    });
    
    const dates = Object.keys(groupedData).sort();
    const positive = [];
    const negative = [];
    const neutral = [];
    
    dates.forEach(date => {
        const items = groupedData[date];
        let posCount = 0, negCount = 0, neuCount = 0;
        
        items.forEach(item => {
            const emotion = type === 'text' ? item.dominantEmotion : item.emotion;
            const classification = classifyEmotion(emotion);
            
            if (classification === 'positive') posCount++;
            else if (classification === 'negative') negCount++;
            else neuCount++;
        });
        
        const total = items.length;
        positive.push((posCount / total) * 100);
        negative.push((negCount / total) * 100);
        neutral.push((neuCount / total) * 100);
    });
    
    return { dates, positive, negative, neutral };
}

function setupTextPagination(data) {
    const itemsPerPage = 10;
    const totalPages = Math.ceil(data.length / itemsPerPage);
    
    if (totalPages <= 1) {
        document.getElementById('textPagination').style.display = 'none';
        return;
    }
    
    let paginationHTML = `
        <button class="pagination-btn" onclick="changeTextPage(1)" ${1 === 1 ? 'disabled' : ''}>
            <i class="fas fa-chevron-left"></i>
        </button>
    `;
    
    for (let i = 1; i <= Math.min(5, totalPages); i++) {
        paginationHTML += `
            <button class="pagination-btn ${i === 1 ? 'active' : ''}" 
                    onclick="changeTextPage(${i})">
                ${i}
            </button>
        `;
    }
    
    if (totalPages > 5) {
        paginationHTML += `
            <span>...</span>
            <button class="pagination-btn" onclick="changeTextPage(${totalPages})">
                ${totalPages}
            </button>
        `;
    }
    
    paginationHTML += `
        <button class="pagination-btn" onclick="changeTextPage(2)" ${1 === totalPages ? 'disabled' : ''}>
            <i class="fas fa-chevron-right"></i>
        </button>
    `;
    
    document.getElementById('textPagination').innerHTML = paginationHTML;
}

function changeTextPage(page) {
    console.log('Changing to page:', page);
    // Pagination logic would go here
}

// ============================================
// PDF EXPORT FUNCTIONS
// ============================================

async function exportProfessionalPDF(type = 'combined') {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    
    // Professional header
    doc.setFillColor(94, 96, 206);
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('FeelWise', 20, 25);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Emotional Intelligence Platform', 20, 32);
    
    // Report title
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(`${type.charAt(0).toUpperCase() + type.slice(1)} Analysis Report`, 20, 55);
    
    // Report details
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 65);
    doc.text(`Report ID: ${Math.random().toString(36).substr(2, 9).toUpperCase()}`, 20, 70);
    
    // Divider
    doc.setDrawColor(94, 96, 206);
    doc.setLineWidth(0.5);
    doc.line(20, 75, 190, 75);
    
    let y = 85;
    
    // Load data based on type
    let data, report;
    if (type === 'combined') {
        const [textData, facialData, speechData] = await Promise.all([
            loadAnalysisData('text'),
            loadAnalysisData('facial'),
            loadAnalysisData('speech')
        ]);
        report = generateComprehensiveReport(textData, facialData, speechData);
        data = {
            totalAnalyses: report.overallStats.totalAnalyses,
            timeRange: report.timeRange,
            dominantEmotion: report.overallStats.dominantEmotion,
            averageEmotions: report.overallStats.averageEmotions,
            emotionBreakdown: report.overallStats.emotionBreakdown,
            recommendations: report.combinedRecommendations,
            insights: report.correlationInsights
        };
    } else {
        const rawData = await loadAnalysisData(type);
        report = generateReportData(rawData, type);
        data = report;
    }
    
    // Executive Summary
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Executive Summary', 20, y);
    y += 10;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const summary = generatePDFExecutiveSummary(type, data);
    const splitSummary = doc.splitTextToSize(summary, 170);
    doc.text(splitSummary, 20, y);
    y += splitSummary.length * 5 + 10;
    
    // Key Metrics
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Key Metrics', 20, y);
    y += 10;
    
    const metrics = generatePDFMetrics(type, data);
    doc.autoTable({
        startY: y,
        head: [['Metric', 'Value', 'Interpretation']],
        body: metrics,
        theme: 'striped',
        headStyles: { 
            fillColor: [94, 96, 206],
            textColor: [255, 255, 255],
            fontStyle: 'bold'
        },
        alternateRowStyles: {
            fillColor: [245, 245, 245]
        },
        styles: {
            fontSize: 9,
            cellPadding: 5
        },
        margin: { left: 20, right: 20 }
    });
    
    y = doc.lastAutoTable.finalY + 15;
    
    // Add chart if available
    try {
        const chartSelectors = {
            'text': '#textEmotionChart',
            'facial': '#facialDonutChart',
            'speech': '#speechBarChart',
            'combined': '#overallEmotionChart'
        };
        
        const chartCanvas = document.querySelector(chartSelectors[type]);
        if (chartCanvas) {
            const chartImage = await html2canvas(chartCanvas, {
                scale: 2,
                backgroundColor: '#ffffff'
            });
            
            if (y > 150) {
                doc.addPage();
                y = 20;
            }
            
            const imgData = chartImage.toDataURL('image/png');
            const imgWidth = 170;
            const imgHeight = 80;
            
            doc.addImage(imgData, 'PNG', 20, y, imgWidth, imgHeight);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'italic');
            doc.text('Figure 1: Emotion Distribution Chart', 20, y + imgHeight + 5);
            
            y += imgHeight + 15;
        }
    } catch (error) {
        console.log('Chart capture skipped:', error);
    }
    
    // Emotion Breakdown
    if (data.emotionBreakdown && Object.keys(data.emotionBreakdown).length > 0) {
        if (y > 200) {
            doc.addPage();
            y = 20;
        }
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Emotion Breakdown', 20, y);
        y += 8;
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        
        Object.entries(data.emotionBreakdown).forEach(([emotion, count]) => {
            const total = Object.values(data.emotionBreakdown).reduce((a, b) => a + b, 0);
            const percentage = ((count / total) * 100).toFixed(1);
            doc.text(`${emotion.charAt(0).toUpperCase() + emotion.slice(1)}: ${count} analyses (${percentage}%)`, 25, y);
            y += 6;
        });
        
        y += 5;
    }
    
    // Recommendations
    if (y > 180) {
        doc.addPage();
        y = 20;
    }
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Recommendations', 20, y);
    y += 10;
    
    const recommendations = generateDetailedRecommendations(type, data);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    recommendations.forEach((rec, index) => {
        if (y > 270) {
            doc.addPage();
            y = 20;
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Recommendations (Continued)', 20, y);
            y += 10;
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
        }
        
        doc.text(`${index + 1}. ${rec}`, 25, y);
        y += 8;
    });
    
    // Footer on all pages
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        
        // Footer divider
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.25);
        doc.line(20, 280, 190, 280);
        
        // Footer text
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`FeelWise Report - ${type.charAt(0).toUpperCase() + type.slice(1)} Analysis`, 105, 285, { align: 'center' });
        doc.text(`Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
        doc.text('Confidential - For personal use only', 190, 290, { align: 'right' });
    }
    
    // Save PDF
    const filename = `FeelWise_${type.charAt(0).toUpperCase() + type.slice(1)}_Report_${new Date().toISOString().split('T')[0]}_${Math.random().toString(36).substr(2, 4).toUpperCase()}.pdf`;
    doc.save(filename);
}

function generatePDFExecutiveSummary(type, data) {
    if (type === 'combined') {
        return `This comprehensive multi-modal emotional intelligence report integrates data from ${data.totalAnalyses} analyses across text, facial, and speech modalities. The report provides holistic insights into emotional expression patterns, consistency across communication channels, and personalized recommendations for emotional well-being.`;
    } else {
        return `This ${type} analysis report examines ${data.totalAnalyses} emotional assessments over ${data.timeRange}. The findings provide insights into your ${type} emotional patterns, highlighting predominant emotions and trends over time.`;
    }
}

function generatePDFMetrics(type, data) {
    if (type === 'combined') {
        return [
            ['Total Analyses', data.totalAnalyses, 'Data points analyzed'],
            ['Time Period', data.timeRange, 'Analysis duration'],
            ['Dominant Emotion', data.dominantEmotion, 'Most frequent emotion'],
            ['Positive Content', `${data.averageEmotions.positive.toFixed(1)}%`, 'Positive sentiment ratio'],
            ['Emotional Consistency', 'Multi-modal', 'Comprehensive insights']
        ];
    } else {
        return [
            ['Total Analyses', data.totalAnalyses, 'Data points analyzed'],
            ['Time Period', data.timeRange, 'Analysis duration'],
            ['Dominant Emotion', data.dominantEmotion, 'Most frequent emotion'],
            ['Average Confidence', data.averageConfidence ? `${data.averageConfidence.toFixed(1)}%` : 'N/A', 'Analysis accuracy'],
            ['Data Quality', data.averageConfidence ? 'High' : 'Good', 'Analysis reliability']
        ];
    }
}

function generateDetailedRecommendations(type, data) {
    const recommendations = [];
    
    if (type === 'text') {
        recommendations.push(
            'Continue daily journaling to maintain emotional awareness and track patterns.',
            'Focus on expanding emotional vocabulary for more precise self-expression.',
            'Review weekly sentiment trends to identify emotional patterns and triggers.',
            'Practice gratitude journaling to increase positive emotional expression.',
            'Consider sharing significant emotional patterns with a trusted advisor or therapist.'
        );
    } else if (type === 'facial') {
        recommendations.push(
            'Practice facial relaxation exercises to reduce tension and improve expression clarity.',
            'Increase awareness of micro-expressions for better emotional self-regulation.',
            'Engage in activities that naturally elicit positive facial expressions.',
            'Use facial feedback exercises to consciously shape emotional experiences.',
            'Monitor facial expression patterns in different social contexts.'
        );
    } else if (type === 'speech') {
        recommendations.push(
            'Practice vocal exercises to improve emotional tone modulation.',
            'Record and review speech patterns to identify emotional trends.',
            'Focus on breath control for more stable and expressive speech.',
            'Experiment with different speaking rates to match emotional content.',
            'Use voice recording apps to track vocal emotional patterns over time.'
        );
    } else {
        recommendations.push(
            'Maintain regular multi-modal emotional assessments for comprehensive tracking.',
            'Compare emotional patterns across different communication channels.',
            'Develop personalized emotional regulation strategies based on patterns.',
            'Set specific emotional well-being goals and track progress.',
            'Share comprehensive reports with emotional wellness professionals for guidance.'
        );
    }
    
    return recommendations;
}

// Export individual PDF functions
async function exportTextPDF() { 
    await exportProfessionalPDF('text'); 
}

async function exportFacialPDF() { 
    await exportProfessionalPDF('facial'); 
}

async function exportSpeechPDF() { 
    await exportProfessionalPDF('speech'); 
}

async function exportCombinedPDF() { 
    await exportProfessionalPDF('combined'); 
}

// Initialize charts when switching tabs
function updateTextChart() {
    // Chart update logic if needed when switching tabs
}

function updateFacialChart() {
    // Chart update logic if needed when switching tabs
}

function updateSpeechChart() {
    // Chart update logic if needed when switching tabs
}