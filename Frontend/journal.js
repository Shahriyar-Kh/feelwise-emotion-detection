
// =============================
// FeelWise Journal - Enhanced JavaScript
// =============================

// Configuration
const API_BASE_URL = ["localhost", "127.0.0.1"].includes(window.location.hostname)
  ? "http://localhost:5000"
  : "https://feelwise-emotion-detection.onrender.com";
const USER_ID = 'default_user';

// State Management
let currentPrompt = "";
let currentMood = null;
let recognition = null;
let moodTrendChart = null;
let analysisData = null;
let currentStreak = 0;
let totalEntries = 0;

// Enhanced Prompts Library
const ENHANCED_PROMPTS = [
  "What was the most meaningful moment of your day?",
  "How did you grow or learn something new today?",
  "What are three things you're genuinely grateful for right now?",
  "What challenged you today and how did you handle it?",
  "What made you smile or laugh today?",
  "How did you take care of yourself today?",
  "What's one thing you want to remember about today?",
  "Who had a positive impact on your day and why?",
  "What emotion dominated your day and what caused it?",
  "What would you tell your past self about today?",
  "What are you most proud of accomplishing today?",
  "How did you connect with others today?",
  "What surprised you about today?",
  "What would make tomorrow even better?",
  "What pattern do you notice in your thoughts today?",
  "What boundary did you honor or need to set today?",
  "How did your body feel today and what did it need?",
  "What creative energy flowed through you today?",
  "What fear did you face or what courage did you show?",
  "How did you practice self-compassion today?"
];

// Utility Functions
function el(id) { return document.getElementById(id); }
function qs(sel, root = document) { return root.querySelector(sel); }
function qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

// Enhanced Toast with different types
function showToast(message, type = 'info', duration = 3000) {
  const toast = el('toast');
  if (!toast) return;

  // Add type-based styling
  const typeEmojis = {
    success: '✅',
    error: '❌', 
    warning: '⚠️',
    info: 'ℹ️'
  };

  toast.textContent = `${typeEmojis[type] || '💬'} ${message}`;
  toast.classList.add('show');
  
  setTimeout(() => toast.classList.remove('show'), duration);
  console.log(`Toast [${type}]:`, message);
}

// Enhanced API calls with better error handling
async function apiCall(endpoint, options = {}) {
  const requestId = Math.random().toString(36).substring(2, 10);
  
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Id': requestId,
        ...options.headers
      },
      ...options
    };
    
    console.log(`🔄 [${requestId}] API Call: ${config.method || 'GET'} ${url}`);
    
    const response = await fetch(url, config);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    console.log(`✅ [${requestId}] Success:`, data);
    return data;
    
  } catch (error) {
    console.error(`❌ [${requestId}] Failed:`, error);
    
    // Show user-friendly error messages
    if (error.message.includes('Failed to fetch')) {
      showToast('Connection failed. Check if the server is running.', 'error');
    } else {
      showToast(`Error: ${error.message}`, 'error');
    }
    
    throw error;
  }
}

// Enhanced Prompt Management
async function setRandomPrompt() {
  try {
    // Try to get prompt from API first
    const data = await apiCall('/journal/prompts');
    currentPrompt = data.prompt || getRandomFallbackPrompt();
  } catch (error) {
    console.warn('Failed to fetch prompt from API, using fallback');
    currentPrompt = getRandomFallbackPrompt();
  }
  
  const promptEl = el('promptText');
  if (promptEl) {
    promptEl.textContent = currentPrompt;
    // Add a subtle animation
    promptEl.style.opacity = '0';
    setTimeout(() => {
      promptEl.style.opacity = '1';
    }, 100);
  }
}

function getRandomFallbackPrompt() {
  return ENHANCED_PROMPTS[Math.floor(Math.random() * ENHANCED_PROMPTS.length)];
}

// Enhanced Mood Management
function initMoodTags() {
  qsa('.mood-tags .tag').forEach(btn => {
    btn.addEventListener('click', (e) => {
      // Remove selection from all tags
      qsa('.mood-tags .tag').forEach(b => b.classList.remove('selected'));
      
      // Select current tag
      btn.classList.add('selected');
      currentMood = btn.dataset.mood;
      
      // Update body class for dynamic background
      document.body.className = document.body.className.replace(/mood-\w+/, '');
      document.body.classList.add(`mood-${currentMood}`);
      
      showToast(`Mood selected: ${capitalizeFirst(currentMood)}`, 'success');
      updateSaveButton();
    });
  });
}

// Enhanced Speech Recognition
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    const recordBtn = el('recordBtn');
    if (recordBtn) {
      recordBtn.style.display = 'none';
      console.warn('Speech recognition not supported in this browser');
    }
    return;
  }
  
  recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.continuous = false;

  recognition.onstart = () => {
    const btn = el('recordBtn');
    if (btn) {
      btn.setAttribute('aria-pressed', 'true');
      btn.innerHTML = '🛑 Stop Recording';
    }
    showToast('🎙️ Recording... speak clearly!', 'info');
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    const textarea = el('journalText');
    
    if (textarea) {
      const currentText = textarea.value.trim();
      const newText = currentText ? `${currentText}\n\n${transcript}` : transcript;
      textarea.value = newText;
      updateSaveButton();
    }
    
    showToast('✅ Voice successfully converted to text!', 'success');
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    showToast(`Voice recognition error: ${event.error}`, 'error');
    resetRecordButton();
  };

  recognition.onend = () => {
    resetRecordButton();
  };
}

function resetRecordButton() {
  const btn = el('recordBtn');
  if (btn) {
    btn.setAttribute('aria-pressed', 'false');
    btn.innerHTML = '🎙️ Record';
  }
}

// Enhanced Text Analysis
async function analyzeEntry(text) {
  if (!text.trim() || text.length < 10) {
    showToast('Please write at least 10 characters for analysis', 'warning');
    return null;
  }

  const analyzeBtn = el('analyzeBtn');
  const statusEl = el('summaryStatus');
  
  try {
    // Update UI to show loading
    if (analyzeBtn) {
      analyzeBtn.disabled = true;
      analyzeBtn.textContent = '🔄 Analyzing...';
    }
    if (statusEl) statusEl.classList.add('loading');

    const result = await apiCall('/journal/analyze', {
      method: 'POST',
      body: JSON.stringify({ text })
    });

    // Store analysis data
    analysisData = result;

    // Update UI with results
    updateAnalysisUI(result);
    updateSaveButton();

    showToast('✅ Analysis complete! Check the insights below.', 'success');
    return result;

  } catch (error) {
    console.error('Analysis failed:', error);
    showToast('Analysis failed. Please try again.', 'error');
    return null;
    
  } finally {
    // Reset UI
    if (analyzeBtn) {
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = '🔍 Analyze';
    }
    if (statusEl) statusEl.classList.remove('loading');
  }
}

function updateAnalysisUI(analysis) {
  // Update AI Summary
  const summaryEl = el('summaryText');
  if (summaryEl) {
    summaryEl.textContent = analysis.ai_summary || 'Summary not available';
    summaryEl.classList.remove('muted');
  }

  // Update Mood Analysis
  const moodEmoji = el('dominantMoodEmoji');
  const moodText = el('dominantMoodText');
  const sentimentScore = el('sentimentScoreText');
  
  if (moodEmoji) moodEmoji.textContent = getMoodEmoji(analysis.dominant_mood);
  if (moodText) moodText.textContent = capitalizeFirst(analysis.dominant_mood || 'neutral');
  if (sentimentScore) {
    const score = analysis.sentiment_score;
    const percentage = score ? Math.round(((score + 1) / 2) * 100) : 50;
    sentimentScore.textContent = `Positivity: ${percentage}%`;
  }

  // Update Keywords
  const keywordsEl = el('keywordsList');
  if (keywordsEl) {
    keywordsEl.innerHTML = '';
    const keywords = analysis.keywords || [];
    
    if (keywords.length === 0) {
      keywordsEl.innerHTML = '<span class="muted">No keywords found</span>';
    } else {
      keywords.slice(0, 15).forEach(keyword => {
        const span = document.createElement('span');
        span.textContent = keyword;
        span.title = `Keyword: ${keyword}`;
        keywordsEl.appendChild(span);
      });
    }
  }

  // Update Suggestion
  const suggestionEl = el('suggestionText');
  if (suggestionEl) {
    suggestionEl.textContent = analysis.suggestion || 'Keep writing to get personalized suggestions!';
    suggestionEl.classList.remove('muted');
  }

  // Render mood bars
  if (analysis.mood_scores) {
    renderMoodBars(analysis.mood_scores);
  }
}

function renderMoodBars(moodScores) {
  const container = el('moodBars');
  if (!container) return;
  
  container.innerHTML = '';
  
  const moods = Object.entries(moodScores).sort(([,a], [,b]) => b - a);
  
  moods.slice(0, 5).forEach(([mood, score]) => {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
      display: flex; 
      align-items: center; 
      gap: 0.75rem; 
      margin-bottom: 0.5rem;
    `;
    
    const label = document.createElement('div');
    label.textContent = capitalizeFirst(mood);
    label.style.cssText = `
      width: 80px; 
      font-size: 0.85rem; 
      font-weight: 500;
    `;
    
    const barContainer = document.createElement('div');
    barContainer.style.cssText = `
      flex: 1; 
      background: rgba(255,255,255,0.3); 
      border-radius: 10px; 
      height: 8px; 
      overflow: hidden;
    `;
    
    const bar = document.createElement('div');
    const percentage = Math.round((score || 0) * 100);
    bar.style.cssText = `
      height: 100%; 
      width: ${percentage}%; 
      background: linear-gradient(90deg, #667eea, #764ba2); 
      border-radius: 10px;
      transition: width 0.8s ease;
    `;
    
    const scoreText = document.createElement('div');
    scoreText.textContent = `${percentage}%`;
    scoreText.style.cssText = `
      font-size: 0.8rem; 
      color: #6b7280; 
      width: 40px; 
      text-align: right;
    `;
    
    barContainer.appendChild(bar);
    wrapper.appendChild(label);
    wrapper.appendChild(barContainer);
    wrapper.appendChild(scoreText);
    container.appendChild(wrapper);
  });
}

// Enhanced Save Entry
async function saveEntry() {
  const text = el('journalText')?.value?.trim();
  
  if (!text || text.length < 10) {
    showToast('Please write at least 10 characters before saving', 'warning');
    return;
  }

  const saveBtn = el('saveBtn');
  
  try {
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = '💾 Saving...';
    }

    const entryData = {
      text,
      mood: currentMood || (analysisData?.dominant_mood) || 'neutral',
      prompt: currentPrompt || '',
      datetime: new Date().toISOString()
    };

    const result = await apiCall(`/journal/entry?user_id=${USER_ID}`, {
      method: 'POST',
      body: JSON.stringify(entryData)
    });

    // Update stats
    if (result.streak_count !== undefined) {
      currentStreak = result.streak_count;
      updateStreakDisplay();
    }
    
    if (result.entries_count !== undefined) {
      totalEntries = result.entries_count;
      updateEntriesCountDisplay();
    }

    // Reset editor
    resetEditor();

    // Refresh displays
    await Promise.all([
      loadTimeline(),
      loadMoodTrend(),
      loadWordCloud(),
      updateBadges()
    ]);

    showToast('✅ Entry saved successfully! Great job!', 'success');

  } catch (error) {
    console.error('Save failed:', error);
    showToast('Failed to save entry. Please try again.', 'error');
    
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 Save Entry';
    }
  }
}

function resetEditor() {
  const textArea = el('journalText');
  if (textArea) textArea.value = '';
  
  // Reset mood selection
  qsa('.mood-tags .tag').forEach(b => b.classList.remove('selected'));
  currentMood = null;
  
  // Reset body class
  document.body.className = document.body.className.replace(/mood-\w+/, '');
  
  // Reset analysis UI
  resetAnalysisUI();
  
  // Reset state
  analysisData = null;
  updateSaveButton();
  
  // Get new prompt
  setRandomPrompt();
}

function resetAnalysisUI() {
  const elements = {
    summaryText: 'Your AI-generated summary will appear here after analysis.',
    dominantMoodEmoji: '🙂',
    dominantMoodText: 'Neutral',
    sentimentScoreText: 'Sentiment: —',
    suggestionText: 'Personalized suggestions will appear here based on your mood and entry.'
  };
  
  Object.entries(elements).forEach(([id, text]) => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = text;
      if (id !== 'dominantMoodEmoji') el.classList.add('muted');
    }
  });
  
  const keywordsEl = el('keywordsList');
  if (keywordsEl) {
    keywordsEl.innerHTML = '<span class="muted">Add some text to see key themes</span>';
  }
  
  const moodBarsEl = el('moodBars');
  if (moodBarsEl) moodBarsEl.innerHTML = '';
}

// Enhanced Timeline Loading
async function loadTimeline(range = '30d') {
  const container = el('timelineContainer');
  if (!container) return;
  
  try {
    // Show loading state
    container.innerHTML = '<div class="loading" style="text-align: center; padding: 2rem;">Loading entries...</div>';
    
    const data = await apiCall(`/journal/entries?range=${encodeURIComponent(range)}&user_id=${USER_ID}`);
    
    container.innerHTML = '';
    
    const entries = data.entries || [];
    if (entries.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 2rem;">
          <p class="muted">📝 No entries yet.</p>
          <p class="muted">Start your journaling journey today!</p>
        </div>
      `;
      return;
    }

    // Sort entries by date (newest first)
    entries.sort((a, b) => new Date(b.datetime) - new Date(a.datetime));

    const template = el('timelineItemTemplate');
    if (!template) {
      console.error('Timeline template not found');
      return;
    }

    entries.forEach((entry, index) => {
      const node = template.content.cloneNode(true);
      const btn = node.querySelector('.timeline-item');
      
      if (btn) {
        btn.dataset.id = entry._id || entry.id;
        btn.style.animationDelay = `${index * 0.1}s`;
        
        const emojiEl = btn.querySelector('.emoji');
        const dateEl = btn.querySelector('.date');
        
        if (emojiEl) {
          emojiEl.textContent = getMoodEmoji(entry.mood || entry.dominant_mood || 'neutral');
        }
        
        if (dateEl) {
          try {
            const date = new Date(entry.datetime);
            const today = new Date();
            const diffTime = today - date;
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays === 0) {
              dateEl.textContent = 'Today';
            } else if (diffDays === 1) {
              dateEl.textContent = 'Yesterday';
            } else if (diffDays < 7) {
              dateEl.textContent = `${diffDays} days ago`;
            } else {
              dateEl.textContent = date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric' 
              });
            }
          } catch {
            dateEl.textContent = 'Invalid date';
          }
        }
        
        btn.addEventListener('click', () => openEntryModal(entry));
      }
      
      container.appendChild(node);
    });

    // Update header stats
    if (data.entries_count !== undefined) {
      totalEntries = data.entries_count;
      updateEntriesCountDisplay();
    }
    
    if (data.streak_count !== undefined) {
      currentStreak = data.streak_count;
      updateStreakDisplay();
    }

  } catch (error) {
    console.error('Timeline load failed:', error);
    container.innerHTML = `
      <div style="text-align: center; padding: 2rem;">
        <p class="muted">❌ Failed to load entries</p>
        <button class="btn chip" onclick="loadTimeline('${range}')">🔄 Retry</button>
      </div>
    `;
  }
}

// Enhanced Modal Management
function openEntryModal(entry) {
  const modal = el('entryModal');
  if (!modal) return;

  // Populate modal content
  populateModalContent(entry);

  // Set delete button behavior
  const deleteBtn = el('deleteEntryBtn');
  if (deleteBtn) {
    deleteBtn.onclick = () => deleteEntry(entry._id || entry.id);
  }

  // Show modal
  if (typeof modal.showModal === 'function') {
    modal.showModal();
  } else {
    modal.style.display = 'block';
  }
}

function populateModalContent(entry) {
  const elements = {
    modalDate: formatEntryDate(entry.datetime),
    modalMood: `${getMoodEmoji(entry.mood || entry.dominant_mood)} ${capitalizeFirst(entry.mood || entry.dominant_mood || 'Neutral')}`,
    modalText: entry.text || 'No content available',
    modalSummary: entry.ai_summary || 'No summary available'
  };

  Object.entries(elements).forEach(([id, content]) => {
    const element = el(id);
    if (element) element.textContent = content;
  });

  // Handle keywords
  const keywordsEl = el('modalKeywords');
  if (keywordsEl) {
    keywordsEl.innerHTML = '';
    const keywords = entry.keywords || [];
    
    if (keywords.length === 0) {
      keywordsEl.innerHTML = '<span class="muted">No keywords available</span>';
    } else {
      keywords.forEach(keyword => {
        const span = document.createElement('span');
        span.textContent = keyword;
        keywordsEl.appendChild(span);
      });
    }
  }
}

function formatEntryDate(dateString) {
  try {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return 'Invalid date';
  }
}

function closeEntryModal() {
  const modal = el('entryModal');
  if (!modal) return;
  
  if (typeof modal.close === 'function') {
    modal.close();
  } else {
    modal.style.display = 'none';
  }
}

// Enhanced Delete Entry
async function deleteEntry(entryId) {
  if (!entryId) return;
  
  const confirmed = confirm(
    '⚠️ Are you sure you want to delete this entry?\n\nThis action cannot be undone.'
  );
  
  if (!confirmed) return;
  
  try {
    await apiCall(`/journal/entry/${encodeURIComponent(entryId)}`, {
      method: 'DELETE'
    });
    
    showToast('✅ Entry deleted successfully', 'success');
    closeEntryModal();
    
    // Refresh all data
    await Promise.all([
      loadTimeline(),
      loadMoodTrend(),
      loadWordCloud(),
      updateBadges()
    ]);
    
  } catch (error) {
    console.error('Delete failed:', error);
    showToast('Failed to delete entry. Please try again.', 'error');
  }
}

// Enhanced Mood Trend Chart
async function loadMoodTrend(range = '30d') {
  const canvas = el('moodTrendChart');
  if (!canvas) return;
  
  try {
    // Destroy existing chart if it exists
    if (moodTrendChart) {
      moodTrendChart.destroy();
      moodTrendChart = null;
    }

    const data = await apiCall(`/journal/entries?range=${encodeURIComponent(range)}&user_id=${USER_ID}`);
    const entries = data.entries || [];
    
    if (entries.length === 0) {
      // Show empty state
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#6b7280';
      ctx.font = '16px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No mood data available', canvas.width / 2, canvas.height / 2);
      return;
    }

    // Sort entries by date
    entries.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
    
    // Process data for chart
    const chartData = entries.map(entry => {
      const mood = entry.mood || entry.dominant_mood || 'neutral';
      // Convert mood to numeric value for trending
      const moodValue = getMoodValue(mood);
      
      return {
        x: new Date(entry.datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        y: moodValue,
        mood: mood
      };
    });

    // Create the chart
    const ctx = canvas.getContext('2d');
    moodTrendChart = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [{
          label: 'Mood Trend',
          data: chartData,
          borderColor: '#667eea',
          backgroundColor: 'rgba(102, 126, 234, 0.1)',
          tension: 0.4,
          fill: true,
          pointBackgroundColor: chartData.map(point => getMoodColor(point.mood)),
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 8
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
              title: (context) => context[0].parsed.x,
              label: (context) => {
                const point = chartData[context.dataIndex];
                return `Mood: ${capitalizeFirst(point.mood)}`;
              }
            }
          }
        },
        scales: {
          x: {
            type: 'category',
            title: {
              display: true,
              text: 'Date'
            },
            grid: {
              display: false
            }
          },
          y: {
            min: 1,
            max: 5,
            ticks: {
              stepSize: 1,
              callback: function(value) {
                const moodLabels = {1: 'Angry', 2: 'Sad', 3: 'Neutral', 4: 'Calm', 5: 'Happy'};
                return moodLabels[value] || '';
              }
            },
            title: {
              display: true,
              text: 'Mood Level'
            }
          }
        },
        elements: {
          point: {
            hoverRadius: 10
          }
        }
      }
    });

  } catch (error) {
    console.error('Mood trend chart failed:', error);
    
    // Show error state
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#dc2626';
    ctx.font = '14px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Failed to load mood trend', canvas.width / 2, canvas.height / 2);
  }
}

// Helper function to convert mood to numeric value
function getMoodValue(mood) {
  const moodValues = {
    'angry': 1,
    'anger': 1,
    'sad': 2,
    'sadness': 2,
    'neutral': 3,
    'calm': 4,
    'happy': 5,
    'joy': 5
  };
  return moodValues[mood?.toLowerCase()] || 3;
}

// Helper function to get mood colors
function getMoodColor(mood) {
  const moodColors = {
    'angry': '#ef4444',
    'anger': '#ef4444',
    'sad': '#3b82f6',
    'sadness': '#3b82f6',
    'neutral': '#6b7280',
    'calm': '#10b981',
    'happy': '#f59e0b',
    'joy': '#f59e0b'
  };
  return moodColors[mood?.toLowerCase()] || '#6b7280';
}
// Enhanced Word Cloud
async function loadWordCloud(range = '30d') {
  try {
    const data = await apiCall(`/journal/insights?range=${encodeURIComponent(range)}&user_id=${USER_ID}`);
    
    const container = el('wordCloud');
    if (!container) return;
    
    container.innerHTML = '';
    
    const keywords = data.keywords || [];
    if (keywords.length === 0) {
      container.innerHTML = '<p class="muted" style="text-align: center;">Write more entries to see your themes</p>';
      return;
    }

    // Create enhanced word cloud
    keywords.slice(0, 25).forEach((item, index) => {
      const word = typeof item === 'string' ? item : item.word;
      const count = typeof item === 'string' ? keywords.length - index : item.count;
      
      const span = document.createElement('span');
      span.textContent = word;
      span.title = `Used ${count} times`;
      
      // Dynamic sizing and coloring
      const fontSize = Math.max(12, Math.min(24, 12 + (count * 2)));
      const hue = (index * 30) % 360;
      
      span.style.cssText = `
        font-size: ${fontSize}px;
        font-weight: ${count > 3 ? 'bold' : 'normal'};
        color: hsl(${hue}, 70%, 50%);
        margin: 4px 8px;
        display: inline-block;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 6px;
        background: hsla(${hue}, 70%, 95%, 0.7);
        transition: all 0.3s ease;
        animation: fadeIn 0.5s ease ${index * 0.1}s both;
      `;
      
      span.addEventListener('click', () => {
        showToast(`"${word}" appears ${count} times in your entries`);
        searchEntries(word);
      });
      
      span.addEventListener('mouseenter', () => {
        span.style.transform = 'scale(1.1) translateY(-2px)';
        span.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
      });
      
      span.addEventListener('mouseleave', () => {
        span.style.transform = 'scale(1) translateY(0)';
        span.style.boxShadow = 'none';
      });
      
      container.appendChild(span);
    });
    
  } catch (error) {
    console.warn('Word cloud failed to load:', error);
    const container = el('wordCloud');
    if (container) {
      container.innerHTML = '<p class="muted" style="text-align: center;">Unable to load themes</p>';
    }
  }
}

// Enhanced Badge System
async function updateBadges() {
  try {
    const data = await apiCall(`/journal/entries?range=all&user_id=${USER_ID}`);
    const entries = data.entries || [];
    const streak = data.streak_count || 0;
    const totalCount = data.entries_count || entries.length;
    
    const container = el('badgesGrid');
    if (!container) return;
    
    container.innerHTML = '';
    
    const badges = generateBadges(entries, streak, totalCount);
    
    if (badges.length === 0) {
      container.innerHTML = `
        <div class="badge" style="opacity: 0.6;">
          <span class="emoji">🌟</span>
          <div class="label">Start journaling to earn badges!</div>
        </div>
      `;
      return;
    }
    
    badges.forEach((badge, index) => {
      const div = document.createElement('div');
      div.className = 'badge';
      div.title = badge.description;
      div.style.animationDelay = `${index * 0.1}s`;
      div.innerHTML = `
        <span class="emoji">${badge.emoji}</span>
        <div class="label">${badge.title}</div>
      `;
      container.appendChild(div);
    });
    
  } catch (error) {
    console.warn('Failed to update badges:', error);
  }
}

function generateBadges(entries, streak, totalCount) {
  const badges = [];
  const now = new Date();
  
  // Streak badges
  if (streak >= 3) badges.push({ emoji: '🔥', title: 'On Fire!', description: `${streak} day streak` });
  if (streak >= 7) badges.push({ emoji: '⭐', title: 'Consistent', description: '7+ day streak' });
  if (streak >= 14) badges.push({ emoji: '💪', title: 'Dedicated', description: '14+ day streak' });
  if (streak >= 30) badges.push({ emoji: '💎', title: 'Diamond', description: '30+ day streak' });
  
  // Entry count badges
  if (totalCount >= 5) badges.push({ emoji: '📝', title: 'Writer', description: '5+ entries' });
  if (totalCount >= 10) badges.push({ emoji: '📚', title: 'Storyteller', description: '10+ entries' });
  if (totalCount >= 25) badges.push({ emoji: '🏆', title: 'Chronicler', description: '25+ entries' });
  if (totalCount >= 50) badges.push({ emoji: '👑', title: 'Master', description: '50+ entries' });
  
  // Mood diversity
  const moods = new Set(entries.map(e => e.mood || e.dominant_mood));
  if (moods.size >= 4) badges.push({ emoji: '🌈', title: 'Emotional Range', description: 'Diverse moods tracked' });
  
  // Time-based badges
  const recentEntries = entries.filter(e => {
    const entryDate = new Date(e.datetime);
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    return entryDate > weekAgo;
  });
  
  if (recentEntries.length >= 3) badges.push({ emoji: '⚡', title: 'Active', description: '3+ entries this week' });
  
  // Word count badges
  const totalWords = entries.reduce((sum, entry) => {
    return sum + (entry.text ? entry.text.split(' ').length : 0);
  }, 0);
  
  if (totalWords >= 1000) badges.push({ emoji: '✍️', title: 'Wordsmith', description: '1000+ words written' });
  if (totalWords >= 5000) badges.push({ emoji: '📖', title: 'Author', description: '5000+ words written' });
  
  // Special achievements
  const morningEntries = entries.filter(e => {
    const hour = new Date(e.datetime).getHours();
    return hour >= 6 && hour <= 11;
  });
  
  if (morningEntries.length >= 5) badges.push({ emoji: '🌅', title: 'Early Bird', description: 'Morning journaling' });
  
  return badges;
}

// Utility Functions
function getMoodEmoji(mood) {
  const emojiMap = {
    happy: '😊',
    joy: '😊',
    calm: '😌',
    neutral: '😐',
    sad: '😢',
    sadness: '😢',
    angry: '😠',
    anger: '😠',
    fear: '😰',
    surprise: '😮'
  };
  return emojiMap[mood?.toLowerCase()] || '🙂';
}

function capitalizeFirst(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function updateSaveButton() {
  const saveBtn = el('saveBtn');
  const text = el('journalText')?.value?.trim();
  
  if (saveBtn) {
    const isValid = text && text.length >= 10;
    saveBtn.disabled = !isValid;
    
    if (isValid) {
      saveBtn.classList.remove('muted');
    } else {
      saveBtn.classList.add('muted');
    }
  }
}

function updateStreakDisplay() {
  const streakEl = el('streakChip');
  if (streakEl && currentStreak !== undefined) {
    streakEl.textContent = `🔥 ${currentStreak}-day streak`;
  }
}

function updateEntriesCountDisplay() {
  const countEl = el('entriesCountChip');
  if (countEl && totalEntries !== undefined) {
    countEl.textContent = `📝 ${totalEntries} entries`;
  }
}

function searchEntries(query) {
  const searchInput = el('searchInput');
  if (searchInput) {
    searchInput.value = query;
    loadTimeline(`search:${query}`);
  }
}

// Enhanced Event Handlers
function bindEventHandlers() {
  // Prompt button
  const newPromptBtn = el('newPromptBtn');
  if (newPromptBtn) {
    newPromptBtn.addEventListener('click', setRandomPrompt);
  }

  // Text area
  const journalText = el('journalText');
  if (journalText) {
    journalText.addEventListener('input', updateSaveButton);
    
    // Auto-resize textarea
    journalText.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = (this.scrollHeight) + 'px';
    });
  }

  // Action buttons
  const clearBtn = el('clearBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (confirm('Clear all text? This cannot be undone.')) {
        const textarea = el('journalText');
        if (textarea) {
          textarea.value = '';
          textarea.style.height = 'auto';
        }
        resetAnalysisUI();
        updateSaveButton();
      }
    });
  }

  const analyzeBtn = el('analyzeBtn');
  if (analyzeBtn) {
    analyzeBtn.addEventListener('click', async () => {
      const text = el('journalText')?.value?.trim();
      if (text) {
        await analyzeEntry(text);
      }
    });
  }

  const saveBtn = el('saveBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveEntry);
  }

  // Recording
  const recordBtn = el('recordBtn');
  if (recordBtn) {
    recordBtn.addEventListener('click', () => {
      if (!recognition) {
        showToast('Voice recording not supported in this browser', 'warning');
        return;
      }
      
      const isRecording = recordBtn.getAttribute('aria-pressed') === 'true';
      
      if (isRecording) {
        recognition.stop();
      } else {
        try {
          recognition.start();
        } catch (error) {
          console.warn('Recording error:', error);
          showToast('Unable to start recording', 'error');
        }
      }
    });
  }

  // Audio file upload
  const audioFile = el('audioFile');
  if (audioFile) {
    audioFile.addEventListener('change', handleAudioUpload);
  }

  // Modal handlers
  const entryModal = el('entryModal');
  if (entryModal) {
    entryModal.addEventListener('click', (event) => {
      if (event.target === entryModal) {
        closeEntryModal();
      }
    });
    
    const closeButtons = entryModal.querySelectorAll('[value="close"]');
    closeButtons.forEach(btn => {
      btn.addEventListener('click', closeEntryModal);
    });
  }

  // Filter controls
  const rangeSelect = el('rangeSelect');
  if (rangeSelect) {
    rangeSelect.addEventListener('change', (event) => {
      const range = event.target.value;
      loadTimeline(range);
      loadMoodTrend(range);
      loadWordCloud(range);
    });
  }

  const searchInput = el('searchInput');
  if (searchInput) {
    let searchTimeout;
    
    searchInput.addEventListener('input', (event) => {
      clearTimeout(searchTimeout);
      const query = event.target.value.trim();
      
      searchTimeout = setTimeout(() => {
        if (query) {
          loadTimeline(`search:${query}`);
        } else {
          loadTimeline('30d');
        }
      }, 500);
    });
    
    searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        const query = event.target.value.trim();
        if (query) {
          loadTimeline(`search:${query}`);
        } else {
          loadTimeline('30d');
        }
      }
    });
  }

  // Export functionality
  const exportBtn = el('exportBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportJournalData);
  }

  // Insights button
  const insightsBtn = el('insightsBtn');
  if (insightsBtn) {
    insightsBtn.addEventListener('click', () => {
      const chartEl = el('moodTrendChart');
      if (chartEl) {
        chartEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        showToast('Check out your mood trends and insights below!');
      }
    });
  }

  // Additional UI buttons
  const detailsBtn = el('detailsBtn');
  if (detailsBtn) {
    detailsBtn.addEventListener('click', showAnalysisDetails);
  }

  const refreshKeywordsBtn = el('refreshKeywordsBtn');
  if (refreshKeywordsBtn) {
    refreshKeywordsBtn.addEventListener('click', refreshKeywords);
  }
}

// Additional Features
async function handleAudioUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  if (!file.type.startsWith('audio/')) {
    showToast('Please select an audio file', 'warning');
    return;
  }
  
  showToast('Audio upload feature coming soon!', 'info');
  // TODO: Implement audio processing
}

async function exportJournalData() {
  try {
    showToast('Preparing your journal export...', 'info');
    
    const data = await apiCall(`/journal/entries?range=all&user_id=${USER_ID}`);
    const entries = data.entries || [];
    
    if (entries.length === 0) {
      showToast('No entries to export', 'warning');
      return;
    }
    
    // Create comprehensive export data
    const exportData = {
      exported_at: new Date().toISOString(),
      user_stats: {
        total_entries: entries.length,
        current_streak: data.streak_count || 0,
        date_range: {
          first_entry: entries[entries.length - 1]?.datetime,
          last_entry: entries[0]?.datetime
        }
      },
      entries: entries.map(entry => ({
        date: entry.datetime,
        mood: entry.mood || entry.dominant_mood,
        text: entry.text,
        ai_summary: entry.ai_summary,
        keywords: entry.keywords,
        sentiment_score: entry.sentiment_score
      }))
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `feelwise_journal_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast(`Successfully exported ${entries.length} entries!`, 'success');
    
  } catch (error) {
    console.error('Export failed:', error);
    showToast('Export failed. Please try again.', 'error');
  }
}

function showAnalysisDetails() {
  if (!analysisData) {
    showToast('Analyze your text first to see detailed insights', 'warning');
    return;
  }
  
  const details = [
    `Sentiment Score: ${analysisData.sentiment_score?.toFixed(2) || 'N/A'}`,
    `Keywords Found: ${analysisData.keywords?.length || 0}`,
    `Dominant Mood: ${capitalizeFirst(analysisData.dominant_mood || 'Unknown')}`
  ];
  
  showToast(details.join(' • '), 'info', 5000);
}

async function refreshKeywords() {
  const text = el('journalText')?.value?.trim();
  if (!text) {
    showToast('Write some text first', 'warning');
    return;
  }
  
  try {
    const result = await analyzeEntry(text);
    if (result) {
      showToast('Keywords refreshed!', 'success');
    }
  } catch (error) {
    showToast('Failed to refresh keywords', 'error');
  }
}

// Initialize Application
async function initializeApp() {
  console.log('🚀 FeelWise Journal initializing...');
  
  try {
    // Set current date
    const todayEl = el('todayDate');
    if (todayEl) {
      const today = new Date();
      todayEl.textContent = `📅 ${today.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      })}`;
    }

    // Initialize components
    await setRandomPrompt();
    initMoodTags();
    initSpeechRecognition();
    bindEventHandlers();

    // Load initial data
    const loadPromises = [
      loadTimeline(),
      loadMoodTrend(), 
      loadWordCloud(),
      updateBadges()
    ];
    
    await Promise.allSettled(loadPromises);
    
    // Update UI state
    updateSaveButton();
    
    console.log('✅ Journal initialized successfully');
    showToast('Welcome back! Ready to journal?', 'success');
    
  } catch (error) {
    console.error('❌ Initialization failed:', error);
    showToast('Some features may not work properly. Check your connection.', 'warning');
  }
}

// Global Error Handling
window.addEventListener('error', (event) => {
  console.error('Global JavaScript error:', event.error);
  showToast('An unexpected error occurred', 'error');
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  showToast('A network error occurred. Check your connection.', 'error');
});

// Visibility Change Handler
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    // Refresh data when user returns to the page
    loadTimeline().catch(console.warn);
    updateBadges().catch(console.warn);
  }
});

// CSS Animations (injected via JavaScript)
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  @keyframes slideInFromRight {
    from { opacity: 0; transform: translateX(20px); }
    to { opacity: 1; transform: translateX(0); }
  }
  
  .timeline-item {
    animation: slideInFromRight 0.5s ease;
  }
`;
document.head.appendChild(style);

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

// Export for debugging
window.FeelWiseJournal = {
  loadTimeline,
  loadMoodTrend,
  loadWordCloud,
  updateBadges,
  analyzeEntry,
  saveEntry,
  apiCall,
  showToast
};
