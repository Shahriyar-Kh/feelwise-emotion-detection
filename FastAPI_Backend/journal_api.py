# backend/journal_api.py
from fastapi import FastAPI, APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
from datetime import datetime, timedelta
from bson import ObjectId
from pymongo import MongoClient
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from collections import Counter
import re
import random
import os
from dotenv import load_dotenv
import sys
from pymongo.errors import ConnectionFailure, ConfigurationError

# -----------------------------
# Shared Import: Text Emotion
# -----------------------------
from analysis_utils import analyze_text   # <-- reuse shared analyzer

# -----------------------------
# FastAPI Setup
# -----------------------------
app = FastAPI(title="Journal API", version="1.0.0")
router = APIRouter(prefix="/journal", tags=["Journal"])

# -----------------------------
# MongoDB Setup - UPDATED TO USE MONGODB_URI
# -----------------------------
# Load environment variables
load_dotenv()

# Use the same environment variable name as main server
PRIMARY_MONGO_URI = os.getenv("MONGODB_URI")
FALLBACK_MONGO_URI = os.getenv("MONGODB_LOCAL_URI") or os.getenv("LOCAL_MONGODB_URI")
MONGO_URI = PRIMARY_MONGO_URI or FALLBACK_MONGO_URI
MONGO_URI_SOURCE = "MONGODB_URI" if PRIMARY_MONGO_URI else "MONGODB_LOCAL_URI" if FALLBACK_MONGO_URI else None


def format_mongo_error(error: Exception) -> str:
    if hasattr(error, "code") and getattr(error, "code") == "ENOTFOUND":
        hostname = getattr(error, "hostname", "unknown host")
        return (
            f"DNS lookup failed for MongoDB host: {hostname}. "
            "Replace MONGODB_URI with a valid Atlas URI or set "
            "MONGODB_LOCAL_URI=mongodb://127.0.0.1:27017/feelwise_db."
        )

    return str(error)

if not MONGO_URI:
    print("ERROR: MongoDB is not configured. Set MONGODB_URI or MONGODB_LOCAL_URI.")
    sys.exit(1)

# Initialize client and database variables
client = None
db = None
journal_collection = None

def connect_to_mongodb():
    """Initialize MongoDB connection with error handling"""
    global client, db, journal_collection
    
    try:
        print(f"Attempting to connect to MongoDB using {MONGO_URI_SOURCE}...")
        
        # Create client with timeout settings
        client = MongoClient(
            MONGO_URI,
            serverSelectionTimeoutMS=10000,  # 10 second timeout
            connectTimeoutMS=10000,
            socketTimeoutMS=10000,
            retryWrites=True,
            w='majority'
        )
        
        # Test the connection
        client.admin.command('ping')
        
        # Initialize database and collection
        db = client["feelwise_db"]
        journal_collection = db["journals"]
        
        # Create indexes for better performance
        journal_collection.create_index([("user_id", 1), ("datetime", -1)])
        journal_collection.create_index([("datetime", -1)])
        
        print("✅ MongoDB connected successfully")
        return True
        
    except (ConnectionFailure, ConfigurationError) as e:
        print(f"❌ MongoDB connection failed: {format_mongo_error(e)}")
        print("⚠️  Server will run without database functionality")
        client = None
        db = None
        journal_collection = None
        return False
    except Exception as e:
        print(f"❌ Unexpected MongoDB error: {format_mongo_error(e)}")
        client = None
        db = None
        journal_collection = None
        return False

# Try to connect at startup
mongodb_connected = connect_to_mongodb()

# Add a dependency to check if MongoDB is available
def check_mongodb_connection():
    """Check if MongoDB is connected before processing requests"""
    if not mongodb_connected or journal_collection is None:
        raise HTTPException(
            status_code=503, 
            detail="Database service temporarily unavailable. Please try again later."
        )

# # Create indexes for better performance
# journal_collection.create_index([("user_id", 1), ("datetime", -1)])
# journal_collection.create_index([("datetime", -1)])



# -----------------------------
# Constants
# -----------------------------
MOOD_MAPPING = {
    "joy": "happy",
    "sadness": "sad", 
    "anger": "angry",
    "fear": "sad",
    "surprise": "neutral",
    "love": "happy"
}

MOOD_EMOJIS = {
    "happy": "😊",
    "calm": "😌", 
    "neutral": "😐",
    "sad": "😢",
    "angry": "😠"
}

PROMPTS = [
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
    "How did you connect with others today?"
]

# -----------------------------
# Pydantic Models
# -----------------------------
class AnalyzeRequest(BaseModel):
    text: str

class JournalEntryRequest(BaseModel):
    text: str
    mood: Optional[str] = "neutral"
    prompt: Optional[str] = ""
    datetime: Optional[str] = None

class JournalEntryResponse(BaseModel):
    success: bool
    saved_entry: Dict[str, Any]
    streak_count: int
    entries_count: int

class EntriesResponse(BaseModel):
    entries: List[Dict[str, Any]]
    entries_count: int
    streak_count: int

class InsightsResponse(BaseModel):
    dates: List[str]
    scores: List[float]
    keywords: List[Dict[str, Any]]

# -----------------------------
# Utility Functions
# -----------------------------
sentiment_analyzer = SentimentIntensityAnalyzer()

def convert_objectid_to_str(doc):
    """Convert MongoDB ObjectId to string for JSON serialization"""
    if isinstance(doc, dict):
        if '_id' in doc:
            doc['_id'] = str(doc['_id'])
        for key, value in doc.items():
            if isinstance(value, ObjectId):
                doc[key] = str(value)
            elif isinstance(value, dict):
                doc[key] = convert_objectid_to_str(value)
            elif isinstance(value, list):
                doc[key] = [convert_objectid_to_str(item) if isinstance(item, dict) else item for item in value]
    return doc

def summarize_text(text: str, max_words: int = 15) -> str:
    """Create a concise summary of the text"""
    sentences = re.split(r'[.!?]+', text.strip())
    if not sentences:
        return "No summary available"
    
    # Take first sentence and limit words
    first_sentence = sentences[0].strip()
    words = first_sentence.split()
    
    if len(words) <= max_words:
        return first_sentence + "."
    else:
        return " ".join(words[:max_words]) + "..."

def extract_keywords(text: str, top_n: int = 8) -> List[str]:
    """Extract meaningful keywords from text"""
    # Remove common stop words and short words
    stop_words = {'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'was', 'were', 'is', 'are', 'am', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'a', 'an', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'her', 'its', 'our', 'their'}
    
    # Clean and tokenize
    clean_text = re.sub(r'[^\w\s]', '', text.lower())
    words = [w for w in clean_text.split() if len(w) > 3 and w not in stop_words]
    
    # Get most common words
    most_common = Counter(words).most_common(top_n)
    return [w for w, _ in most_common]

def generate_suggestions(emotion: str, mood: str, sentiment_score: float) -> str:
    """Generate personalized suggestions based on analysis"""
    suggestions = []
    
    if emotion == "sadness" or mood == "sad" or sentiment_score < -0.3:
        suggestions = [
            "Consider writing three things you're grateful for today.",
            "Try a short walk or breathing exercise to lift your spirits.",
            "Remember that difficult days help us appreciate the good ones.",
            "Consider reaching out to a friend or loved one."
        ]
    elif emotion == "anger" or mood == "angry":
        suggestions = [
            "Take five deep breaths before responding to any challenges.",
            "Write down what's bothering you, then reflect on solutions.",
            "Consider some physical activity to release tension.",
            "Practice the 4-7-8 breathing technique."
        ]
    elif emotion == "joy" or mood == "happy" or sentiment_score > 0.3:
        suggestions = [
            "Great energy today! Consider sharing your positivity with others.",
            "Capture this good feeling - what specifically made you happy?",
            "Use this positive momentum to tackle a challenging task.",
            "Express gratitude for the good things in your life."
        ]
    elif emotion == "fear" or sentiment_score < -0.1:
        suggestions = [
            "Focus on what you can control in your current situation.",
            "Try journaling about your strengths and past successes.",
            "Consider breaking down big worries into smaller, manageable steps.",
            "Practice grounding techniques - name 5 things you can see."
        ]
    else:
        suggestions = [
            "Keep journaling regularly to track your emotional patterns.",
            "Reflect on one thing you learned about yourself today.",
            "Consider setting a small, achievable goal for tomorrow.",
            "Practice mindful awareness of your thoughts and feelings."
        ]
    
    return random.choice(suggestions)

def calculate_mood_score(emotion: str, sentiment_score: float) -> float:
    """Convert emotion and sentiment to a 0-1 mood score"""
    base_scores = {
        "joy": 0.8,
        "love": 0.9,
        "surprise": 0.6,
        "sadness": 0.2,
        "anger": 0.1,
        "fear": 0.3
    }
    
    emotion_score = base_scores.get(emotion, 0.5)
    # Combine with sentiment (normalize from -1,1 to 0,1)
    sentiment_normalized = (sentiment_score + 1) / 2
    
    # Weight them 60% emotion, 40% sentiment
    final_score = (emotion_score * 0.6) + (sentiment_normalized * 0.4)
    return round(max(0, min(1, final_score)), 2)

def get_user_streak(user_id: str = "default_user") -> int:
    """Calculate current streak of consecutive journaling days"""
    entries = list(journal_collection.find(
        {"user_id": user_id}
    ).sort("datetime", -1).limit(30))
    
    if not entries:
        return 0
    
    # Convert datetime strings to dates
    entry_dates = []
    for entry in entries:
        dt_str = entry.get('datetime', '')
        try:
            dt = datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
            entry_dates.append(dt.date())
        except:
            continue
    
    if not entry_dates:
        return 0
    
    # Remove duplicates and sort
    unique_dates = sorted(set(entry_dates), reverse=True)
    
    # Count consecutive days from today
    today = datetime.now().date()
    streak = 0
    
    for i, date in enumerate(unique_dates):
        expected_date = today - timedelta(days=i)
        if date == expected_date:
            streak += 1
        else:
            break
    
    return streak

def analyze_text_complete(text: str) -> Dict[str, Any]:
    """Complete text analysis combining multiple approaches"""
    # Sentiment analysis
    sentiment = sentiment_analyzer.polarity_scores(text)
    sentiment_score = sentiment["compound"]
    
    # Emotion analysis (reuse shared analyzer)
    emotion_result = analyze_text(text)
    dominant_emotion = emotion_result["emotion"]
    
    # Map emotion to mood
    mapped_mood = MOOD_MAPPING.get(dominant_emotion, "neutral")
    
    # Calculate mood score
    mood_score = calculate_mood_score(dominant_emotion, sentiment_score)
    
    # Extract keywords
    keywords = extract_keywords(text)
    
    # Generate summary
    summary = summarize_text(text)
    
    # Generate suggestion
    suggestion = generate_suggestions(dominant_emotion, mapped_mood, sentiment_score)
    
    return {
        "ai_summary": summary,
        "dominant_mood": mapped_mood,
        "mood_scores": {
            mapped_mood: mood_score,
            "positive": max(0, sentiment_score),
            "negative": max(0, -sentiment_score),
            "neutral": 1 - abs(sentiment_score)
        },
        "keywords": keywords,
        "suggestion": suggestion,
        "sentiment_score": sentiment_score,
        "emotion_distribution": emotion_result["emotion_distribution"]
    }

# -----------------------------
# API Endpoints
# -----------------------------

@router.get("/prompts")
async def get_random_prompt():
    """Return a random journaling prompt"""
    try:
        prompt = random.choice(PROMPTS)
        return {"prompt": prompt}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get prompt: {str(e)}")

@router.post("/analyze")
async def analyze_text_endpoint(req: AnalyzeRequest):
    """Perform text analysis for a given text (summary, mood, keywords, suggestion)"""
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="Text is required for analysis")
    try:
        analysis = analyze_text_complete(req.text)
        return analysis
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.post("/entry")
async def save_entry(entry: JournalEntryRequest, user_id: str = Query(default="default_user")):
    """Save a new journal entry"""
    check_mongodb_connection()  # Add this line
    
    if not entry.text.strip():
        raise HTTPException(status_code=400, detail="Entry text cannot be empty")
    
    try:
        # Analyze the text
        analysis = analyze_text_complete(entry.text)
        
        # Parse datetime
        entry_datetime = datetime.now()
        if entry.datetime:
            try:
                entry_datetime = datetime.fromisoformat(entry.datetime.replace('Z', '+00:00'))
            except:
                pass  # Use current time if parsing fails
        
        # Create document
        doc = {
            "user_id": user_id,
            "text": entry.text,
            "mood": entry.mood or analysis["dominant_mood"],
            "prompt": entry.prompt or "",
            "datetime": entry_datetime.isoformat(),
            "ai_summary": analysis["ai_summary"],
            "dominant_mood": analysis["dominant_mood"],
            "mood_scores": analysis["mood_scores"],
            "keywords": analysis["keywords"],
            "suggestion": analysis["suggestion"],
            "sentiment_score": analysis["sentiment_score"],
            "emotion_distribution": analysis["emotion_distribution"],
            "created_at": datetime.utcnow()
        }
        
        # Save to database
        result = journal_collection.insert_one(doc)
        doc["_id"] = str(result.inserted_id)
        
        # Calculate streak and count
        streak_count = get_user_streak(user_id)
        entries_count = journal_collection.count_documents({"user_id": user_id})
        
        return JournalEntryResponse(
            success=True,
            saved_entry=convert_objectid_to_str(doc),
            streak_count=streak_count,
            entries_count=entries_count
        )
        
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save entry: {str(e)}")

@router.get("/entries")
async def get_entries(
    range: str = Query(default="30d"),
    user_id: str = Query(default="default_user")
):
    """Get journal entries for a user within a date range"""
    check_mongodb_connection()  # Add this line
    
    try:
        # Calculate date filter
        now = datetime.now()
        if range == "7d":
            start_date = now - timedelta(days=7)
        elif range == "30d":
            start_date = now - timedelta(days=30)
        elif range == "90d":
            start_date = now - timedelta(days=90)
        elif range.startswith("search:"):
            # Simple search functionality
            search_term = range.replace("search:", "").strip()
            if search_term:
                entries = list(journal_collection.find({
                    "user_id": user_id,
                    "$text": {"$search": search_term}
                }).sort("datetime", -1).limit(50))
            else:
                entries = []
        else:  # "all"
            start_date = datetime.min
        
        if not range.startswith("search:"):
            # Date range query
            entries = list(journal_collection.find({
                "user_id": user_id,
                "datetime": {"$gte": start_date.isoformat()}
            }).sort("datetime", -1).limit(100))
        
        # Convert ObjectIds to strings
        for entry in entries:
            convert_objectid_to_str(entry)
        
        # Calculate stats
        entries_count = journal_collection.count_documents({"user_id": user_id})
        streak_count = get_user_streak(user_id)
        
        return EntriesResponse(
            entries=entries,
            entries_count=entries_count,
            streak_count=streak_count
        )
        
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get entries: {str(e)}")

@router.get("/insights")
async def get_insights(
    range: str = Query(default="30d"),
    user_id: str = Query(default="default_user")
):
    """Get mood trends and keyword insights"""
    check_mongodb_connection()  # Add this line
    
    try:
        # Calculate date filter
        now = datetime.now()
        if range == "7d":
            start_date = now - timedelta(days=7)
        elif range == "30d":
            start_date = now - timedelta(days=30)
        elif range == "90d":
            start_date = now - timedelta(days=90)
        else:  # "all"
            start_date = datetime.min
        
        # Get entries in date range
        entries = list(journal_collection.find({
            "user_id": user_id,
            "datetime": {"$gte": start_date.isoformat()}
        }).sort("datetime", 1))
        
        # Prepare mood trend data
        dates = []
        scores = []
        all_keywords = []
        
        for entry in entries:
            try:
                dt = datetime.fromisoformat(entry["datetime"].replace('Z', '+00:00'))
                dates.append(dt.strftime("%m/%d"))
                
                # Get mood score (fallback to sentiment-based calculation)
                mood_scores = entry.get("mood_scores", {})
                if mood_scores:
                    # Average of positive emotions
                    score = mood_scores.get(entry.get("dominant_mood", "neutral"), 0.5)
                else:
                    # Fallback to sentiment
                    sentiment = entry.get("sentiment_score", 0)
                    score = (sentiment + 1) / 2  # Convert -1,1 to 0,1
                
                scores.append(score)
                
                # Collect keywords
                entry_keywords = entry.get("keywords", [])
                all_keywords.extend(entry_keywords)
                
            except:
                continue
        
        # Generate keyword frequency data
        keyword_counter = Counter(all_keywords)
        keyword_data = [
            {"word": word, "count": count}
            for word, count in keyword_counter.most_common(20)
        ]
        
        return InsightsResponse(
            dates=dates,
            scores=scores,
            keywords=keyword_data
        )
        
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get insights: {str(e)}")

@router.delete("/entry/{entry_id}")
async def delete_entry(entry_id: str):
    """Delete a journal entry"""
    check_mongodb_connection()  # Add this line
    
    try:
        result = journal_collection.delete_one({"_id": ObjectId(entry_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Entry not found")
        return {"message": "Entry deleted successfully"}
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        if "not found" in str(e):
            raise HTTPException(status_code=404, detail="Entry not found")
        raise HTTPException(status_code=500, detail=f"Failed to delete entry: {str(e)}")

# -----------------------------
# Mount Router & Run
# -----------------------------
app.include_router(router)

# Health check
@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "journal_api"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("journal_api:app", host="0.0.0.0", port=8004, reload=True)