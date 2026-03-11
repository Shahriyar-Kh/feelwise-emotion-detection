require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const path = require("path");
const mongoose = require("mongoose");
const { MongoClient, ObjectId } = require("mongodb");

// Import auth and progress routes
const auth = require("./middleware/auth");
const authRoutes = require("./routes/auth");
const progressRoutes = require("./routes/progress");

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === "production";
const primaryMongoUri = process.env.MONGODB_URI;
const fallbackMongoUri = process.env.MONGODB_LOCAL_URI || process.env.LOCAL_MONGODB_URI;
const resolvedMongoUri = primaryMongoUri || fallbackMongoUri;
const mongoUriSource = primaryMongoUri ? "MONGODB_URI" : fallbackMongoUri ? "MONGODB_LOCAL_URI" : null;

let mongooseConnected = false;

const TEXT_EMOTION_KEYWORDS = {
  joy: ["happy", "joy", "joyful", "excited", "great", "wonderful", "good", "amazing", "awesome", "glad", "pleased", "content"],
  sadness: ["sad", "unhappy", "depressed", "down", "gloomy", "lonely", "miserable", "heartbroken", "bad"],
  anger: ["angry", "mad", "furious", "rage", "annoyed", "frustrated", "irritated", "hate", "upset"],
  fear: ["afraid", "fear", "scared", "anxious", "worried", "nervous", "terrified", "stressed"],
  surprise: ["surprised", "surprise", "shocked", "amazed", "astonished", "unexpected", "wow"],
  love: ["love", "adore", "affection", "caring", "kindness", "warmth", "cherish"],
};

const TEXT_POSITIVE_EMOTIONS = new Set(["joy", "love", "surprise"]);
const TEXT_NEGATIVE_EMOTIONS = new Set(["sadness", "anger", "fear"]);
const TEXT_NEGATION_WORDS = new Set(["not", "no", "never", "don't", "doesn't", "didn't", "can't", "cannot", "won't", "isn't", "aren't", "wasn't", "weren't", "without"]);
const TEXT_INTENSIFIERS = new Set(["very", "really", "extremely", "so", "too", "highly", "deeply", "absolutely", "totally"]);
const TEXT_SARCASM_PATTERNS = [
  /\boh\s+(great|wonderful|perfect)\b/i,
  /\bjust\s+what\s+i\s+needed\b/i,
  /\bthanks\s+a\s+lot\b/i,
  /\bhow\s+lovely\b/i,
  /\boh\s+joy\b/i,
];

const JOURNAL_MOOD_MAPPING = {
  joy: "happy",
  sadness: "sad",
  anger: "angry",
  fear: "sad",
  surprise: "neutral",
  love: "happy",
};

const JOURNAL_PROMPTS = [
  "What was the best part of your day?",
  "What challenged you today and how did you respond?",
  "What are three things you're grateful for today?",
  "What's one word that describes your day?",
  "What gave you energy today?",
  "What made you smile today?",
  "What would you like to improve tomorrow?",
  "Who are you most thankful for today?",
  "What was today's biggest lesson?",
  "What helped you relax today?",
  "How did you take care of yourself today?",
  "What surprised you today?",
  "What are you looking forward to tomorrow?",
  "What made you feel proud today?",
  "How did you connect with others today?",
];

const JOURNAL_STOP_WORDS = new Set([
  "the", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by", "was", "were", "is", "are", "am", "be", "been",
  "being", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "may", "might", "must", "can", "a", "an",
  "this", "that", "these", "those", "i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them", "my", "your",
  "his", "its", "our", "their", "from", "into", "about", "after", "before", "because", "while", "than", "then", "there", "here",
]);

const JOURNAL_POSITIVE_WORDS = new Set([
  "happy", "joy", "joyful", "excited", "great", "wonderful", "good", "amazing", "awesome", "glad", "pleased", "content", "love", "calm",
  "grateful", "proud", "relaxed", "hopeful", "better", "smile", "smiled", "thankful", "peaceful",
]);

const JOURNAL_NEGATIVE_WORDS = new Set([
  "sad", "unhappy", "depressed", "down", "gloomy", "lonely", "miserable", "heartbroken", "bad", "angry", "mad", "furious", "rage", "annoyed",
  "frustrated", "irritated", "hate", "upset", "afraid", "fear", "scared", "anxious", "worried", "nervous", "terrified", "stressed", "tired",
  "overwhelmed", "hurt", "pain", "cry", "cried", "problem", "failed",
]);

let journalIndexesReady = false;

let TextAnalysis;

try {
  TextAnalysis = mongoose.model("TextAnalysis");
} catch {
  const TextAnalysisSchema = new mongoose.Schema(
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true, index: true },
      text: { type: String, required: true, trim: true },
      emotions: {
        positive: { type: Number, default: 0 },
        negative: { type: Number, default: 0 },
        neutral: { type: Number, default: 0 },
      },
      dominantEmotion: { type: String, default: "neutral", index: true },
      emotionDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
      sarcasmDetected: { type: Boolean, default: false },
      negationDetected: { type: Boolean, default: false },
      timestamp: { type: Date, default: Date.now, index: true },
    },
    { timestamps: true }
  );

  TextAnalysis = mongoose.model("TextAnalysis", TextAnalysisSchema);
}

function roundToTwo(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function createNeutralAnalysis(text) {
  return {
    text,
    emotion: "neutral",
    emotion_distribution: {
      joy: 0,
      sadness: 0,
      anger: 0,
      fear: 0,
      surprise: 0,
      love: 0,
    },
    sentiment: {
      positive: 0,
      negative: 0,
      neutral: 100,
    },
    negation_detected: false,
    sarcasm_detected: false,
  };
}

function createHttpError(statusCode, message, details) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (details) {
    error.details = details;
  }
  return error;
}

function buildTextSentiment(distribution) {
  const positive = Object.entries(distribution)
    .filter(([emotion]) => TEXT_POSITIVE_EMOTIONS.has(emotion))
    .reduce((sum, [, value]) => sum + value, 0);
  const negative = Object.entries(distribution)
    .filter(([emotion]) => TEXT_NEGATIVE_EMOTIONS.has(emotion))
    .reduce((sum, [, value]) => sum + value, 0);

  const normalizedPositive = roundToTwo(Math.min(100, positive));
  const normalizedNegative = roundToTwo(Math.min(100, negative));
  const neutral = roundToTwo(Math.max(0, 100 - normalizedPositive - normalizedNegative));

  return {
    positive: normalizedPositive,
    negative: normalizedNegative,
    neutral,
  };
}

function analyzeTextLocally(text) {
  const normalizedText = typeof text === "string" ? text.trim() : "";

  if (!normalizedText) {
    return createNeutralAnalysis("");
  }

  const tokens = normalizedText.toLowerCase().match(/[a-z']+/g) || [];
  const scores = {
    joy: 0,
    sadness: 0,
    anger: 0,
    fear: 0,
    surprise: 0,
    love: 0,
  };

  let negationDetected = false;
  let sarcasmDetected = TEXT_SARCASM_PATTERNS.some((pattern) => pattern.test(normalizedText));

  tokens.forEach((token, index) => {
    const intensity = TEXT_INTENSIFIERS.has(tokens[index - 1]) ? 1.5 : 1;
    const windowTokens = tokens.slice(Math.max(0, index - 3), index);
    const isNegated = windowTokens.some((windowToken) => TEXT_NEGATION_WORDS.has(windowToken));

    if (isNegated) {
      negationDetected = true;
    }

    for (const [emotion, keywords] of Object.entries(TEXT_EMOTION_KEYWORDS)) {
      if (!keywords.includes(token)) {
        continue;
      }

      if (isNegated) {
        if (emotion === "joy" || emotion === "love") {
          scores.sadness += intensity;
        } else if (emotion === "fear") {
          scores.joy += intensity * 0.75;
        } else {
          scores[emotion] += intensity * 0.25;
        }
      } else {
        scores[emotion] += intensity;
      }
    }
  });

  const hasNegativeContext = /(broken|broke|failed|problem|issue|tired|again|late|stuck|hate)/i.test(normalizedText);
  const hasPositiveCue = /(great|wonderful|perfect|amazing|nice|love)/i.test(normalizedText);
  if (!sarcasmDetected && hasNegativeContext && hasPositiveCue) {
    sarcasmDetected = true;
  }

  if (sarcasmDetected && (scores.joy > 0 || scores.love > 0 || scores.surprise > 0)) {
    scores.anger += Math.max(scores.joy, scores.love, scores.surprise, 1);
  }

  const totalScore = Object.values(scores).reduce((sum, value) => sum + value, 0);
  if (totalScore <= 0) {
    return {
      ...createNeutralAnalysis(normalizedText),
      negation_detected: negationDetected,
      sarcasm_detected: sarcasmDetected,
    };
  }

  const emotion_distribution = Object.fromEntries(
    Object.entries(scores).map(([emotion, value]) => [emotion, roundToTwo((value / totalScore) * 100)])
  );

  const dominantEmotion = Object.entries(scores).reduce((best, current) =>
    current[1] > best[1] ? current : best
  )[0];

  return {
    text: normalizedText,
    emotion: dominantEmotion,
    emotion_distribution,
    sentiment: buildTextSentiment(emotion_distribution),
    negation_detected: negationDetected,
    sarcasm_detected: sarcasmDetected,
  };
}

function normalizeJournalDatetime(value) {
  const parsed = value ? new Date(value) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function summarizeJournalText(text, maxWords = 15) {
  const normalizedText = typeof text === "string" ? text.trim() : "";
  if (!normalizedText) {
    return "No summary available";
  }

  const [firstSentence] = normalizedText.split(/[.!?]+/).map((sentence) => sentence.trim()).filter(Boolean);
  if (!firstSentence) {
    return "No summary available";
  }

  const words = firstSentence.split(/\s+/);
  if (words.length <= maxWords) {
    return `${firstSentence}.`;
  }

  return `${words.slice(0, maxWords).join(" ")}...`;
}

function extractJournalKeywords(text, topN = 8) {
  const tokens = String(text || "")
    .toLowerCase()
    .match(/[a-z']+/g) || [];

  const counts = new Map();
  for (const token of tokens) {
    if (token.length <= 3 || JOURNAL_STOP_WORDS.has(token)) {
      continue;
    }
    counts.set(token, (counts.get(token) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, topN)
    .map(([word]) => word);
}

function calculateJournalSentimentScore(text, analysis) {
  const tokens = String(text || "").toLowerCase().match(/[a-z']+/g) || [];
  let positiveMatches = 0;
  let negativeMatches = 0;

  for (const token of tokens) {
    if (JOURNAL_POSITIVE_WORDS.has(token)) {
      positiveMatches += 1;
    }
    if (JOURNAL_NEGATIVE_WORDS.has(token)) {
      negativeMatches += 1;
    }
  }

  if (positiveMatches === 0 && negativeMatches === 0) {
    const positive = Number(analysis?.sentiment?.positive) || 0;
    const negative = Number(analysis?.sentiment?.negative) || 0;
    return roundToTwo((positive - negative) / 100);
  }

  const total = positiveMatches + negativeMatches;
  return roundToTwo((positiveMatches - negativeMatches) / total);
}

function calculateMoodScore(emotion, sentimentScore) {
  const baseScores = {
    joy: 0.8,
    love: 0.9,
    surprise: 0.6,
    sadness: 0.2,
    anger: 0.1,
    fear: 0.3,
    neutral: 0.5,
  };

  const emotionScore = baseScores[emotion] ?? 0.5;
  const sentimentNormalized = (sentimentScore + 1) / 2;
  return roundToTwo(Math.max(0, Math.min(1, (emotionScore * 0.6) + (sentimentNormalized * 0.4))));
}

function generateJournalSuggestion(emotion, mood, sentimentScore) {
  let suggestions;

  if (emotion === "sadness" || mood === "sad" || sentimentScore < -0.3) {
    suggestions = [
      "Consider writing three things you're grateful for today.",
      "Try a short walk or breathing exercise to lift your spirits.",
      "Remember that difficult days help us appreciate the good ones.",
      "Consider reaching out to a friend or loved one.",
    ];
  } else if (emotion === "anger" || mood === "angry") {
    suggestions = [
      "Take five deep breaths before responding to any challenges.",
      "Write down what's bothering you, then reflect on solutions.",
      "Consider some physical activity to release tension.",
      "Practice the 4-7-8 breathing technique.",
    ];
  } else if (emotion === "joy" || mood === "happy" || sentimentScore > 0.3) {
    suggestions = [
      "Great energy today! Consider sharing your positivity with others.",
      "Capture this good feeling - what specifically made you happy?",
      "Use this positive momentum to tackle a challenging task.",
      "Express gratitude for the good things in your life.",
    ];
  } else if (emotion === "fear" || sentimentScore < -0.1) {
    suggestions = [
      "Focus on what you can control in your current situation.",
      "Try journaling about your strengths and past successes.",
      "Consider breaking down big worries into smaller, manageable steps.",
      "Practice grounding techniques - name 5 things you can see.",
    ];
  } else {
    suggestions = [
      "Keep journaling regularly to track your emotional patterns.",
      "Reflect on one thing you learned about yourself today.",
      "Consider setting a small, achievable goal for tomorrow.",
      "Practice mindful awareness of your thoughts and feelings.",
    ];
  }

  return suggestions[Math.floor(Math.random() * suggestions.length)];
}

function analyzeJournalLocally(text) {
  const normalizedText = typeof text === "string" ? text.trim() : "";
  if (!normalizedText) {
    throw createHttpError(400, "Text is required for analysis");
  }

  const analysis = analyzeTextLocally(normalizedText);
  const dominantEmotion = analysis.emotion || "neutral";
  const dominantMood = JOURNAL_MOOD_MAPPING[dominantEmotion] || "neutral";
  const sentimentScore = calculateJournalSentimentScore(normalizedText, analysis);
  const moodScore = calculateMoodScore(dominantEmotion, sentimentScore);

  return {
    ai_summary: summarizeJournalText(normalizedText),
    dominant_mood: dominantMood,
    mood_scores: {
      [dominantMood]: moodScore,
      positive: Math.max(0, sentimentScore),
      negative: Math.max(0, -sentimentScore),
      neutral: roundToTwo(Math.max(0, 1 - Math.abs(sentimentScore))),
    },
    keywords: extractJournalKeywords(normalizedText),
    suggestion: generateJournalSuggestion(dominantEmotion, dominantMood, sentimentScore),
    sentiment_score: sentimentScore,
    emotion_distribution: analysis.emotion_distribution,
  };
}

async function getJournalCollection() {
  if (!MONGO_URI) {
    throw createHttpError(
      503,
      "Database service temporarily unavailable. Please try again later.",
      "Set MONGODB_URI or MONGODB_LOCAL_URI to enable journal storage."
    );
  }

  if (!mongoClient) {
    mongoClient = new MongoClient(MONGO_URI, {
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 10000,
    });
    await mongoClient.connect();
  }

  const collection = mongoClient.db("feelwise_db").collection("journals");
  if (!journalIndexesReady) {
    await collection.createIndex({ user_id: 1, datetime: -1 });
    await collection.createIndex({ datetime: -1 });
    journalIndexesReady = true;
  }

  return collection;
}

function normalizeJournalEntry(document) {
  if (!document) {
    return document;
  }

  return {
    ...document,
    _id: document._id ? String(document._id) : document._id,
    created_at: document.created_at instanceof Date ? document.created_at.toISOString() : document.created_at,
  };
}

function getDateKey(dateValue) {
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function getJournalStreak(userId = "default_user") {
  const collection = await getJournalCollection();
  const entries = await collection.find({ user_id: userId }).sort({ datetime: -1 }).limit(60).toArray();
  if (entries.length === 0) {
    return 0;
  }

  const uniqueDates = [...new Set(entries.map((entry) => getDateKey(entry.datetime)).filter(Boolean))].sort().reverse();
  if (uniqueDates.length === 0) {
    return 0;
  }

  let streak = 0;
  const today = new Date();

  for (let index = 0; index < uniqueDates.length; index += 1) {
    const expected = new Date(today);
    expected.setHours(0, 0, 0, 0);
    expected.setDate(expected.getDate() - index);
    if (uniqueDates[index] === getDateKey(expected.toISOString())) {
      streak += 1;
      continue;
    }
    break;
  }

  return streak;
}

function filterJournalEntriesByRange(entries, rangeValue) {
  const range = String(rangeValue || "30d").toLowerCase();

  if (range.startsWith("search:")) {
    const rawTerm = rangeValue.slice("search:".length).trim();
    if (!rawTerm) {
      return [];
    }

    const escaped = rawTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matcher = new RegExp(escaped, "i");

    return entries.filter((entry) => {
      const keywords = Array.isArray(entry.keywords) ? entry.keywords.join(" ") : "";
      return matcher.test(String(entry.text || "")) || matcher.test(String(entry.ai_summary || "")) || matcher.test(keywords);
    });
  }

  if (range === "all") {
    return entries;
  }

  const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - days);

  return entries.filter((entry) => {
    const parsed = new Date(entry.datetime);
    return !Number.isNaN(parsed.getTime()) && parsed >= start;
  });
}

async function getLocalJournalEntries(userId, rangeValue = "30d") {
  const collection = await getJournalCollection();
  const entries = await collection.find({ user_id: userId }).sort({ datetime: -1 }).limit(200).toArray();
  const filteredEntries = filterJournalEntriesByRange(entries, rangeValue)
    .slice(0, String(rangeValue || "").toLowerCase().startsWith("search:") ? 50 : 100)
    .map(normalizeJournalEntry);

  return {
    entries: filteredEntries,
    entries_count: await collection.countDocuments({ user_id: userId }),
    streak_count: await getJournalStreak(userId),
  };
}

async function getLocalJournalInsights(userId, rangeValue = "30d") {
  const collection = await getJournalCollection();
  const entries = await collection.find({ user_id: userId }).sort({ datetime: 1 }).limit(500).toArray();
  const filteredEntries = filterJournalEntriesByRange(entries, rangeValue);
  const keywordCounts = new Map();
  const dates = [];
  const scores = [];

  for (const entry of filteredEntries) {
    const parsed = new Date(entry.datetime);
    if (Number.isNaN(parsed.getTime())) {
      continue;
    }

    dates.push(`${String(parsed.getMonth() + 1).padStart(2, "0")}/${String(parsed.getDate()).padStart(2, "0")}`);

    const moodScores = entry.mood_scores || {};
    const dominantMood = entry.dominant_mood || "neutral";
    const fallbackScore = typeof entry.sentiment_score === "number" ? roundToTwo((entry.sentiment_score + 1) / 2) : 0.5;
    scores.push(typeof moodScores[dominantMood] === "number" ? moodScores[dominantMood] : fallbackScore);

    for (const keyword of Array.isArray(entry.keywords) ? entry.keywords : []) {
      keywordCounts.set(keyword, (keywordCounts.get(keyword) || 0) + 1);
    }
  }

  const keywords = [...keywordCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 20)
    .map(([word, count]) => ({ word, count }));

  return { dates, scores, keywords };
}

async function saveLocalJournalEntry(userId, entryInput) {
  const text = typeof entryInput?.text === "string" ? entryInput.text.trim() : "";
  if (!text) {
    throw createHttpError(400, "Entry text cannot be empty");
  }

  const collection = await getJournalCollection();
  const analysis = analyzeJournalLocally(text);
  const datetime = normalizeJournalDatetime(entryInput?.datetime);

  const document = {
    user_id: userId,
    text,
    mood: entryInput?.mood || analysis.dominant_mood,
    prompt: typeof entryInput?.prompt === "string" ? entryInput.prompt : "",
    datetime,
    ai_summary: analysis.ai_summary,
    dominant_mood: analysis.dominant_mood,
    mood_scores: analysis.mood_scores,
    keywords: analysis.keywords,
    suggestion: analysis.suggestion,
    sentiment_score: analysis.sentiment_score,
    emotion_distribution: analysis.emotion_distribution,
    created_at: new Date(),
  };

  const result = await collection.insertOne(document);
  document._id = result.insertedId;

  return {
    success: true,
    saved_entry: normalizeJournalEntry(document),
    streak_count: await getJournalStreak(userId),
    entries_count: await collection.countDocuments({ user_id: userId }),
  };
}

async function deleteLocalJournalEntry(entryId) {
  if (!ObjectId.isValid(entryId)) {
    throw createHttpError(404, "Entry not found");
  }

  const collection = await getJournalCollection();
  const result = await collection.deleteOne({ _id: new ObjectId(entryId) });
  if (result.deletedCount === 0) {
    throw createHttpError(404, "Entry not found");
  }

  return { message: "Entry deleted successfully" };
}

async function proxyJournalOrFallback(req, res, servicePath, localHandler) {
  const rid = req._rid;

  if (SERVICES.journal) {
    try {
      const serviceUrl = `${SERVICES.journal}${servicePath}`;
      console.log(`➡️  [${rid}] Proxying: ${req.method} ${serviceUrl}`);

      const fetchOptions = {
        method: req.method,
        headers: {
          "Content-Type": "application/json",
          "X-Request-Id": rid,
        },
      };

      if (req.method !== "GET" && req.method !== "DELETE" && req.body) {
        fetchOptions.body = JSON.stringify(req.body);
      }

      const response = await fetch(serviceUrl, fetchOptions);
      const rawBody = await response.text();
      console.log(`⬅️  [${rid}] Response: ${response.status}`);

      if (response.ok) {
        return res.status(200).type("application/json").send(rawBody);
      }

      if (response.status < 500 && response.status !== 502) {
        return res.status(response.status).type("application/json").send(rawBody);
      }

      console.warn(`🟨 [${rid}] Journal service unavailable (${response.status}); using local fallback.`);
    } catch (error) {
      console.warn(`🟨 [${rid}] Journal service request failed; using local fallback: ${error.message}`);
    }
  } else {
    console.warn(`🟨 [${rid}] JOURNAL_SERVICE_URL not configured; using local fallback.`);
  }

  try {
    const result = await localHandler();
    return res.json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    const payload = { error: error.message || "Journal fallback failed" };
    if (error.details) {
      payload.details = error.details;
    }
    console.error(`🟥 [${rid}] Journal fallback error: ${error.message}`);
    return res.status(statusCode).json(payload);
  }
}

function getPeriodStart(period) {
  const now = new Date();
  const normalizedPeriod = String(period || "").toLowerCase();
  const start = new Date(now);

  if (["daily", "day", "24h", "1d"].includes(normalizedPeriod)) {
    start.setDate(now.getDate() - 1);
    return start;
  }

  if (["weekly", "week", "7d"].includes(normalizedPeriod)) {
    start.setDate(now.getDate() - 7);
    return start;
  }

  if (["monthly", "month", "30d"].includes(normalizedPeriod)) {
    start.setDate(now.getDate() - 30);
    return start;
  }

  return null;
}

function ensureTextAnalysisPersistence(res) {
  if (!mongooseConnected || mongoose.connection.readyState !== 1) {
    res.status(503).json({
      error: "Text analysis storage is unavailable",
      details: "MongoDB connection is not ready.",
    });
    return false;
  }

  return true;
}

function getUserObjectId(userId, res) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    res.status(400).json({ error: "Invalid user ID format" });
    return null;
  }

  return new mongoose.Types.ObjectId(userId);
}

async function proxyTextAnalysisOrFallback(req, res) {
  const rid = req._rid;
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";

  if (!text) {
    return res.status(400).json({ error: "Text is required" });
  }

  if (SERVICES.text) {
    try {
      console.log(`➡️  [${rid}] Proxying: POST ${SERVICES.text}/analyze`);
      const response = await fetch(`${SERVICES.text}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Request-Id": rid,
        },
        body: JSON.stringify({ text }),
      });

      const rawBody = await response.text();
      console.log(`⬅️  [${rid}] Response: ${response.status}`);

      if (response.ok) {
        return res.status(200).type("application/json").send(rawBody);
      }

      if (response.status < 500 && response.status !== 502) {
        return res.status(response.status).type("application/json").send(rawBody);
      }

      console.warn(`🟨 [${rid}] Text service unavailable (${response.status}); using local fallback.`);
    } catch (error) {
      console.warn(`🟨 [${rid}] Text service request failed; using local fallback: ${error.message}`);
    }
  } else {
    console.warn(`🟨 [${rid}] TEXT_SERVICE_URL not configured; using local fallback.`);
  }

  return res.json(analyzeTextLocally(text));
}

function formatMongoError(err) {
  if (!err) {
    return "Unknown MongoDB error";
  }

  if (err.code === "ENOTFOUND") {
    return [
      `DNS lookup failed for MongoDB host: ${err.hostname || "unknown host"}.`,
      "Update FastAPI_Backend/.env with a valid Atlas connection string in MONGODB_URI,",
      "or set MONGODB_LOCAL_URI=mongodb://127.0.0.1:27017/feelwise_db after installing a local MongoDB server."
    ].join(" ");
  }

  return err.message || String(err);
}

async function connectMongoose() {
  if (!resolvedMongoUri) {
    console.error(
      "❌ MongoDB is not configured. Set MONGODB_URI for Atlas or MONGODB_LOCAL_URI for a local database."
    );
    return false;
  }

  try {
    await mongoose.connect(resolvedMongoUri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });
    mongooseConnected = true;
    console.log(`✅ MongoDB (Mongoose) connected using ${mongoUriSource}`);
    return true;
  } catch (err) {
    mongooseConnected = false;
    console.error("❌ MongoDB (Mongoose) connection error:", formatMongoError(err));
    return false;
  }
}

// ---------------------------
// MongoDB Connection (Mongoose for auth, MongoClient for journals)
// ---------------------------
connectMongoose();

// MongoDB Atlas Setup for journals (using same URI as Mongoose)
const MONGO_URI = resolvedMongoUri;

let mongoClient;
async function checkMongoConnection() {
  try {
    if (!MONGO_URI) {
      return {
        status: "not_configured",
        details: "Set MONGODB_URI for Atlas or MONGODB_LOCAL_URI for a local database.",
      };
    }

    if (!mongoClient) {
      mongoClient = new MongoClient(MONGO_URI, { 
        connectTimeoutMS: 10000,
        serverSelectionTimeoutMS: 10000
      });
      await mongoClient.connect();
    }
    const db = mongoClient.db("feelwise_db");
    const count = await db.collection("journals").countDocuments();
    return { status: "ok", db: "feelwise_db", journal_count: count };
  } catch (err) {
    return { status: "error", details: formatMongoError(err) };
  }
}

// ---------------------------
// Generate a simple request ID for logging
// ---------------------------
app.use((req, res, next) => {
  req._rid = Math.random().toString(36).substring(2, 10);
  next();
});

// ---------------------------
// Enhanced CORS Middleware
// ---------------------------
const configuredOrigins = [process.env.FRONTEND_URL, process.env.ALLOWED_ORIGINS]
  .filter(Boolean)
  .join(",")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = new Set([
  "http://127.0.0.1:5500",
  "http://127.0.0.1:5501",
  "http://localhost:5500",
  "http://localhost:5501",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://feelwise-emotion-detection.feelwise.workers.dev",
  ...configuredOrigins,
]);

function isAllowedDevOrigin(origin) {
  try {
    const parsed = new URL(origin);
    const isHttp = parsed.protocol === "http:" || parsed.protocol === "https:";
    const isDevPort = ["3000", "5500", "5501"].includes(parsed.port);
    const isPrivateIpv4 = /^(127\.0\.0\.1|localhost|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(
      parsed.hostname
    );

    return isHttp && isDevPort && isPrivateIpv4;
  } catch {
    return false;
  }
}

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (!allowedOrigins.has(origin) && !isAllowedDevOrigin(origin)) {
      const msg = `CORS policy does not allow access from: ${origin}`;
      console.error(msg);
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ["GET", "POST", "DELETE", "OPTIONS", "PUT", "PATCH"],
  allowedHeaders: ["Content-Type", "X-Request-Id", "Authorization"],
  credentials: true
}));

// Handle preflight requests
app.options('*', cors());

// ---------------------------
// Middleware (200MB limit for images/audio)
// ---------------------------
app.use(express.json({ limit: "200mb" }));
app.use(express.urlencoded({ limit: "200mb", extended: true }));

// ---------------------------
// Serve static files (for development and uploads)
// ---------------------------
app.use('/static', express.static(path.join(__dirname, 'static')));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ---------------------------
// Base URLs for FastAPI services
// ---------------------------
function normalizeServiceUrl(url) {
  return url ? url.replace(/\/+$/, "") : "";
}

const defaultServiceUrls = isProduction
  ? {
      text: "https://text-analysis-api-jjd2.onrender.com",
      face: "",
      speech: "",
      journal: "https://journal-api-tz31.onrender.com",
    }
  : {
      text: "http://127.0.0.1:8001",
      face: "http://127.0.0.1:8002",
      speech: "http://127.0.0.1:8000",
      journal: "http://127.0.0.1:8004",
    };

const SERVICES = {
  text: normalizeServiceUrl(process.env.TEXT_SERVICE_URL || defaultServiceUrls.text),
  face: normalizeServiceUrl(process.env.FACE_SERVICE_URL || defaultServiceUrls.face),
  speech: normalizeServiceUrl(process.env.SPEECH_SERVICE_URL || defaultServiceUrls.speech),
  journal: normalizeServiceUrl(process.env.JOURNAL_SERVICE_URL || defaultServiceUrls.journal),
};

function ensureServiceAvailable(serviceName, res) {
  if (SERVICES[serviceName]) {
    return true;
  }

  return res.status(503).json({
    error: `${serviceName} service is not configured`,
    details: `Set ${serviceName.toUpperCase()}_SERVICE_URL to enable this feature in production.`,
  });
}

// ---------------------------
// Utility function for proxy requests
// ---------------------------
async function proxyRequest(serviceUrl, req, res, options = {}) {
  const rid = req._rid;
  try {
    console.log(`➡️  [${rid}] Proxying: ${req.method} ${serviceUrl}`);
    
    const fetchOptions = {
      method: req.method,
      headers: { 
        "Content-Type": "application/json",
        "X-Request-Id": rid 
      },
      ...options
    };
    
    if (req.method !== 'GET' && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }
    
    const response = await fetch(serviceUrl, fetchOptions);
    const text = await response.text();
    
    console.log(`⬅️  [${rid}] Response: ${response.status}`);
    
    return res.status(response.ok ? 200 : response.status)
              .type("application/json")
              .send(text);
  } catch (err) {
    console.error(`🟥 [${rid}] Proxy error: ${err.message}`);
    return res.status(500).json({ 
      error: "Proxy error", 
      details: err.message 
    });
  }
}

// ---------------------------
// Authentication & Progress Routes
// ---------------------------
app.use("/api/auth", authRoutes);
app.use("/api/progress", progressRoutes);

// ---------------------------
// Text Analysis Persistence Routes
// ---------------------------
app.post("/api/text-analysis/save", auth, async (req, res) => {
  if (!ensureTextAnalysisPersistence(res)) {
    return;
  }

  const userObjectId = getUserObjectId(req.userId, res);
  if (!userObjectId) {
    return;
  }

  const {
    text,
    emotions = {},
    dominantEmotion = "neutral",
    emotionDetails = {},
    timestamp,
    sarcasmDetected = false,
    negationDetected = false,
  } = req.body || {};

  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Text is required" });
  }

  try {
    const entry = await TextAnalysis.create({
      userId: userObjectId,
      text: text.trim(),
      emotions: {
        positive: Number(emotions.positive) || 0,
        negative: Number(emotions.negative) || 0,
        neutral: Number(emotions.neutral) || 0,
      },
      dominantEmotion: String(dominantEmotion || "neutral").toLowerCase(),
      emotionDetails,
      sarcasmDetected: Boolean(sarcasmDetected),
      negationDetected: Boolean(negationDetected),
      timestamp: timestamp ? new Date(timestamp) : new Date(),
    });

    res.status(201).json(entry);
  } catch (error) {
    console.error("Failed to save text analysis:", error);
    res.status(500).json({ error: "Failed to save text analysis", details: error.message });
  }
});

app.get("/api/text-analysis/history", auth, async (req, res) => {
  if (!ensureTextAnalysisPersistence(res)) {
    return;
  }

  const userObjectId = getUserObjectId(req.userId, res);
  if (!userObjectId) {
    return;
  }

  try {
    const entries = await TextAnalysis.find({ userId: userObjectId })
      .sort({ timestamp: -1, createdAt: -1 })
      .lean();

    res.json(entries);
  } catch (error) {
    console.error("Failed to load text analysis history:", error);
    res.status(500).json({ error: "Failed to load text analysis history", details: error.message });
  }
});

app.get("/api/text-analysis/history/:period", auth, async (req, res) => {
  if (!ensureTextAnalysisPersistence(res)) {
    return;
  }

  const userObjectId = getUserObjectId(req.userId, res);
  if (!userObjectId) {
    return;
  }

  const startDate = getPeriodStart(req.params.period);
  const filter = { userId: userObjectId };
  if (startDate) {
    filter.timestamp = { $gte: startDate };
  }

  try {
    const entries = await TextAnalysis.find(filter)
      .sort({ timestamp: -1, createdAt: -1 })
      .lean();

    res.json(entries);
  } catch (error) {
    console.error("Failed to load filtered text analysis history:", error);
    res.status(500).json({ error: "Failed to load filtered text analysis history", details: error.message });
  }
});

app.delete("/api/text-analysis/:id", auth, async (req, res) => {
  if (!ensureTextAnalysisPersistence(res)) {
    return;
  }

  const userObjectId = getUserObjectId(req.userId, res);
  if (!userObjectId) {
    return;
  }

  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ error: "Invalid text analysis ID" });
  }

  try {
    const deleted = await TextAnalysis.findOneAndDelete({
      _id: new mongoose.Types.ObjectId(req.params.id),
      userId: userObjectId,
    }).lean();

    if (!deleted) {
      return res.status(404).json({ error: "Text analysis entry not found" });
    }

    res.json({ success: true, deletedId: req.params.id });
  } catch (error) {
    console.error("Failed to delete text analysis entry:", error);
    res.status(500).json({ error: "Failed to delete text analysis entry", details: error.message });
  }
});

// ---------------------------
// Proxy route for Text Analysis
// ---------------------------
app.post("/analyze", async (req, res) => {
  await proxyTextAnalysisOrFallback(req, res);
});

// ---------------------------
// Proxy route for Face Analysis
// ---------------------------
app.post("/analyze-face", async (req, res) => {
  if (ensureServiceAvailable("face", res) !== true) {
    return;
  }
  await proxyRequest(`${SERVICES.face}/analyze_face`, req, res);
});

// ---------------------------
// Proxy route for Speech Analysis
// ---------------------------
app.post("/analyze-speech", async (req, res) => {
  if (ensureServiceAvailable("speech", res) !== true) {
    return;
  }
  const { transcript, audio } = req.body || {};
  if (!audio || typeof audio !== "string" || audio.length < 1000) {
    return res.status(400).json({ error: "Audio is required (base64 > 1KB)" });
  }
  
  await proxyRequest(`${SERVICES.speech}/analyze_speech`, req, res);
});

// ---------------------------
// Journal Module Routes
// ---------------------------

// Get random prompt
app.get("/journal/prompts", async (req, res) => {
  await proxyJournalOrFallback(req, res, "/journal/prompts", async () => ({
    prompt: JOURNAL_PROMPTS[Math.floor(Math.random() * JOURNAL_PROMPTS.length)],
  }));
});

// Analyze journal text
app.post("/journal/analyze", async (req, res) => {
  await proxyJournalOrFallback(req, res, "/journal/analyze", async () => {
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    return analyzeJournalLocally(text);
  });
});

// Create/Save journal entry
app.post("/journal/entry", async (req, res) => {
  const user_id = req.query.user_id || "default_user";
  const servicePath = `/journal/entry?user_id=${encodeURIComponent(user_id)}`;
  await proxyJournalOrFallback(req, res, servicePath, async () => saveLocalJournalEntry(user_id, req.body));
});

// Get journal entries
app.get("/journal/entries", async (req, res) => {
  const rangeValue = req.query.range || "30d";
  const user_id = req.query.user_id || "default_user";
  const queryParams = new URLSearchParams({
    range: rangeValue,
    user_id,
  });

  await proxyJournalOrFallback(req, res, `/journal/entries?${queryParams.toString()}`, async () =>
    getLocalJournalEntries(user_id, rangeValue)
  );
});

// Get journal insights (mood trends, keywords, etc.)
app.get("/journal/insights", async (req, res) => {
  const rangeValue = req.query.range || "30d";
  const user_id = req.query.user_id || "default_user";
  const queryParams = new URLSearchParams({
    range: rangeValue,
    user_id,
  });

  await proxyJournalOrFallback(req, res, `/journal/insights?${queryParams.toString()}`, async () =>
    getLocalJournalInsights(user_id, rangeValue)
  );
});

// Delete journal entry
app.delete("/journal/entry/:id", async (req, res) => {
  await proxyJournalOrFallback(
    req,
    res,
    `/journal/entry/${encodeURIComponent(req.params.id)}`,
    async () => deleteLocalJournalEntry(req.params.id)
  );
});

// ---------------------------
// Legacy journal routes (for backward compatibility)
// ---------------------------
app.post("/journal", async (req, res) => {
  const user_id = req.query.user_id || "default_user";
  await proxyJournalOrFallback(req, res, `/journal/entry?user_id=${encodeURIComponent(user_id)}`, async () =>
    saveLocalJournalEntry(user_id, req.body)
  );
});

app.get("/journal", async (req, res) => {
  const user_id = req.query.user_id || "default_user";
  const rangeValue = req.query.range || "30d";
  const queryParams = new URLSearchParams({
    range: rangeValue,
    user_id,
  });

  await proxyJournalOrFallback(req, res, `/journal/entries?${queryParams.toString()}`, async () =>
    getLocalJournalEntries(user_id, rangeValue)
  );
});

app.get("/journal-insights", async (req, res) => {
  const user_id = req.query.user_id || "default_user";
  const rangeValue = req.query.range || "30d";
  const queryParams = new URLSearchParams({
    range: rangeValue,
    user_id,
  });

  await proxyJournalOrFallback(req, res, `/journal/insights?${queryParams.toString()}`, async () =>
    getLocalJournalInsights(user_id, rangeValue)
  );
});

// ---------------------------
// Health Check
// ---------------------------
app.get("/health", async (req, res) => {
  const mongoStatus = await checkMongoConnection();
  const status =
    mongoStatus.status === "ok" && mongooseConnected ? "ok" : "degraded";

  res.json({
    status,
    server: "Combined Main Server with Auth",
    services: {
      text: SERVICES.text ? `${SERVICES.text}/analyze` : "not_configured",
      face: SERVICES.face ? `${SERVICES.face}/analyze_face` : "not_configured",
      speech: SERVICES.speech ? `${SERVICES.speech}/analyze_speech` : "not_configured",
      journal: SERVICES.journal ? `${SERVICES.journal}/journal` : "not_configured",
      mongoose: {
        status: mongooseConnected ? "ok" : "error",
        uri_source: mongoUriSource || "missing",
      },
      mongodb: mongoStatus,
      auth: "integrated",
      progress: "integrated"
    },
  });
});

// ---------------------------
// Default route for development
// ---------------------------
app.get("/", (req, res) => {
  res.json({
    message: "FeelWise Combined Main Server with Authentication",
    endpoints: [
      // Analysis endpoints
      "POST /analyze - Text analysis",
      "POST /api/text-analysis/save - Save text analysis",
      "GET /api/text-analysis/history - Get text analysis history",
      "GET /api/text-analysis/history/:period - Get filtered text analysis history",
      "DELETE /api/text-analysis/:id - Delete text analysis entry",
      "POST /analyze-face - Face emotion analysis", 
      "POST /analyze-speech - Speech emotion analysis",
      
      // Journal endpoints
      "GET /journal/prompts - Get random prompt",
      "POST /journal/analyze - Analyze journal text",
      "POST /journal/entry - Save journal entry",
      "GET /journal/entries - Get journal entries", 
      "GET /journal/insights - Get mood trends & insights",
      "DELETE /journal/entry/:id - Delete journal entry",
      
      // Authentication endpoints
      "POST /api/auth/register - User registration",
      "POST /api/auth/login - User login",
      "GET /api/auth/profile - Get user profile",
      "PUT /api/auth/profile - Update user profile",
      
      // Progress endpoints
      "GET /api/progress - Get user progress",
      "POST /api/progress - Save progress data",
      
      // System endpoints
      "GET /health - Health check"
    ]
  });
});

// ---------------------------
// Error handling middleware
// ---------------------------
app.use((error, req, res, next) => {
  console.error(`🟥 [${req._rid || 'unknown'}] Server error:`, error);
  res.status(500).json({
    error: "Internal server error",
    message: error.message
  });
});

// ---------------------------
// Start server
// ---------------------------
app.listen(PORT, () => {
  console.log(`\n🚀 [NODE] Combined Main Server with Auth running on ${process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`}`);
  console.log(`🔗 Analysis endpoints:`);
  console.log(`   POST /analyze            → ${SERVICES.text}/analyze`);
  console.log(`   POST /api/text-analysis/save`);
  console.log(`   GET  /api/text-analysis/history`);
  console.log(`   GET  /api/text-analysis/history/:period`);
  console.log(`   DELETE /api/text-analysis/:id`);
  console.log(`   POST /analyze-face       → ${SERVICES.face}/analyze_face`);
  console.log(`   POST /analyze-speech     → ${SERVICES.speech}/analyze_speech`);
  console.log(`🔗 Journal endpoints:`);
  console.log(`   GET  /journal/prompts    → ${SERVICES.journal}/journal/prompts`);
  console.log(`   POST /journal/analyze    → ${SERVICES.journal}/journal/analyze`);
  console.log(`   POST /journal/entry      → ${SERVICES.journal}/journal/entry`);
  console.log(`   GET  /journal/entries    → ${SERVICES.journal}/journal/entries`);
  console.log(`   GET  /journal/insights   → ${SERVICES.journal}/journal/insights`);
  console.log(`   DELETE /journal/entry/:id → ${SERVICES.journal}/journal/entry/:id`);
  console.log(`🔗 Authentication endpoints:`);
  console.log(`   POST /api/auth/register  → Local auth handling`);
  console.log(`   POST /api/auth/login     → Local auth handling`);
  console.log(`   GET  /api/auth/profile   → Local auth handling`);
  console.log(`   PUT  /api/auth/profile   → Local auth handling`);
  console.log(`🔗 Progress endpoints:`);
  console.log(`   GET  /api/progress       → Local progress handling`);
  console.log(`   POST /api/progress       → Local progress handling`);
  console.log(`🔗 System endpoints:`);
  console.log(`   GET  /health`);
  console.log(`\n🌐 Frontend can be served from any HTTP server on allowed origins.`);
});