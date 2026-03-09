
<div align="center">

# FeelWise — AI-Powered Emotional Intelligence Platform

**Multi-Modal Emotion Detection & Mental Wellness Companion**

[![Python](https://img.shields.io/badge/Python-3.10%20%7C%203.12-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.116-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![PyTorch](https://img.shields.io/badge/PyTorch-Deep%20Learning-EE4C2C?logo=pytorch&logoColor=white)](https://pytorch.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

*Analyze emotions through text, facial expressions, and speech — then journal your way to better emotional awareness.*

</div>

---

## Overview

**FeelWise** is a full-stack AI platform that detects and analyzes human emotions across three modalities — **text**, **facial expressions**, and **speech** — and combines them with a guided **journaling system** for continuous emotional self-awareness.

Mental health awareness is growing, yet most tools offer only surface-level mood tracking. FeelWise goes further by applying **NLP, computer vision, and audio deep learning** to provide real-time emotional insights, actionable recommendations, personalized challenges, and comprehensive assessment reports — all backed by a secure user authentication system and persistent progress tracking.

---

## Key Features

- **Text Emotion Analysis** — NLP-based emotion detection with negation handling, sarcasm detection, and sentiment distribution across 6 emotion categories (joy, sadness, anger, fear, surprise, love)
- **Facial Emotion Analysis** — Real-time webcam capture or image upload processed by DeepFace with PyTorch backend for 7-emotion classification
- **Speech Emotion Analysis** — Voice recording analyzed using a fine-tuned Wav2Vec2 model (`wav2vec2-lg-xlsr-en-speech-emotion-recognition`) for audio-based emotion recognition
- **AI-Powered Journaling** — Reflective journaling with AI-generated prompts, automatic mood analysis, voice-to-text entry, and mood trend visualization
- **Comprehensive Assessment Reports** — Cross-modal emotion reports aggregating text, face, and speech analysis with exportable PDF generation
- **Daily Emotional Challenges** — Emotion-specific activities and exercises to build emotional intelligence
- **Emotion-Specific Learning Modules** — Curated tips, quizzes, and wellness resources for each emotion category
- **Progress Tracking Dashboard** — Visual charts tracking emotional patterns over daily, weekly, and monthly periods
- **User Authentication & Profiles** — Secure JWT-based auth with registration, login, password reset via email, and profile management
- **EQ Skill Tracking** — Progress metrics across self-awareness, self-regulation, empathy, social skills, and motivation

---

## System Architecture

FeelWise follows a **microservices architecture** with a central API gateway pattern:

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (HTML/CSS/JS)                │
│          Served via Live Server / HTTP Server            │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP Requests
                       ▼
┌──────────────────────────────────────────────────────────┐
│              Node.js API Gateway (Port 5000)             │
│         Express.js — Auth, CORS, Proxy Routing           │
│                                                          │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Auth    │  │ Progress │  │ Profiles │  │ Proxy    │  │
│  │ Routes  │  │ Routes   │  │ Mgmt     │  │ Engine   │  │
│  └─────────┘  └──────────┘  └──────────┘  └────┬─────┘  │
└─────────────────────────────────────────────────┼────────┘
                       │ Proxied Requests         │
          ┌────────────┼────────────┬─────────────┘
          ▼            ▼            ▼            ▼
   ┌────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
   │ Text API   │ │ Face API │ │Speech API│ │Journal   │
   │ FastAPI    │ │ FastAPI  │ │ FastAPI  │ │ API      │
   │ Port 8001  │ │ Port 8002│ │ Port 8000│ │ Port 8004│
   │            │ │          │ │          │ │          │
   │ NLTK       │ │ DeepFace │ │ Wav2Vec2 │ │ VADER    │
   │ VADER      │ │ OpenCV   │ │ PyTorch  │ │ NLTK     │
   │ Keyword NLP│ │ PyTorch  │ │ FFmpeg   │ │ PyMongo  │
   └────────────┘ └──────────┘ └──────────┘ └──────────┘
                                                  │
                       ┌──────────────────────────┘
                       ▼
              ┌─────────────────┐
              │  MongoDB Atlas  │
              │  (feelwise_db)  │
              └─────────────────┘
```

**Gateway Pattern:** The Node.js server acts as a unified API gateway — handling authentication, CORS, and request routing — while proxying analysis requests to specialized FastAPI microservices. Each Python service runs independently with its own dependencies and can be scaled or updated without affecting the others.

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | HTML5, CSS3, Vanilla JavaScript, Chart.js, Bootstrap 5, Font Awesome, Google Fonts |
| **API Gateway** | Node.js, Express.js, node-fetch, Multer |
| **ML Microservices** | Python, FastAPI, Uvicorn |
| **NLP & Text Analysis** | NLTK, VADER Sentiment, Custom keyword-based emotion engine |
| **Computer Vision** | DeepFace, OpenCV, PyTorch |
| **Speech Analysis** | Hugging Face Transformers, Wav2Vec2 (XLSR), Librosa, FFmpeg |
| **Database** | MongoDB Atlas (Mongoose ODM + PyMongo) |
| **Authentication** | JSON Web Tokens (JWT), bcrypt.js |
| **Email Service** | Nodemailer (Gmail SMTP) |
| **PDF Reports** | jsPDF, html2canvas |
| **Auth Provider** | Firebase Authentication (signup flow) |
| **Dev Tools** | dotenv, CORS middleware, Python venv |

---

## Project Structure

```
feelwise-emotion-detection/
│
├── FastAPI_Backend/               # All backend services
│   ├── main-server.js             # Node.js API gateway (port 5000)
│   ├── authserver.js              # Standalone auth server (alternative)
│   ├── text-analysis-api.py       # Text emotion analysis service (port 8001)
│   ├── face-analysis-api.py       # Facial emotion analysis service (port 8002)
│   ├── speech_analysis_fastapi.py # Speech emotion analysis service (port 8000)
│   ├── journal_api.py             # Journal CRUD + analysis service (port 8004)
│   ├── analysis_utils.py          # Shared NLP utilities (tokenization, sarcasm, negation)
│   ├── db.js                      # MongoDB connection helper
│   ├── package.json               # Node.js dependencies
│   ├── requirements-final.txt     # Python dependencies (text, speech, journal)
│   ├── requirement-face-final.txt # Python dependencies (face analysis — Python 3.10)
│   ├── start-services.bat         # Windows batch script to launch all services
│   ├── .env                       # Environment variables (secrets, URIs)
│   │
│   ├── middleware/
│   │   └── auth.js                # JWT authentication middleware
│   ├── models/
│   │   └── users.js               # Mongoose user schema (profile, progress, badges)
│   └── routes/
│       ├── auth.js                # Auth routes (register, login, reset password, profile)
│       └── progress.js            # Progress tracking routes (challenges, assessments)
│
├── Frontend/                      # Client-side application
│   ├── index.html                 # Landing page
│   ├── login.html / signup.html   # Authentication pages
│   ├── module.html                # Main dashboard — emotion analysis hub
│   ├── text-analysis.html         # Text emotion analysis interface
│   ├── facial-analysis.html       # Webcam/upload facial analysis interface
│   ├── speech-analysis.html       # Voice recording & analysis interface
│   ├── journal.html               # AI-powered journaling interface
│   ├── full_assessment.html       # Comprehensive cross-modal report
│   ├── progress.html              # Progress tracking & visualization
│   ├── profile.html               # User profile dashboard
│   ├── dailychallenges.html       # Daily emotional challenges
│   ├── quizzes.html               # Emotion quizzes hub
│   ├── [emotion].html             # Emotion-specific pages (happy, sad, angry, etc.)
│   ├── [emotion]Tips.html         # Wellness tips per emotion
│   ├── [emotion]quiz.html         # Quizzes per emotion
│   ├── firebase.js                # Firebase auth configuration
│   ├── *.css                      # Modular stylesheets per page
│   └── images/                    # Static assets
│
└── Testing_Emotions/              # Emotion classification dataset
    ├── train/                     # Training images (7 emotion classes)
    └── test/                      # Test images (7 emotion classes)
```

---

## Installation Guide

### Prerequisites

- **Python 3.12+** (for Text, Speech, and Journal APIs)
- **Python 3.10** (for Face Analysis API — DeepFace compatibility)
- **Node.js 18+** and npm
- **MongoDB Atlas** account (or local MongoDB instance)
- **FFmpeg** installed and added to system PATH (for speech analysis)
- **Git**

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/feelwise-emotion-detection.git
cd feelwise-emotion-detection/FastAPI_Backend
```

### 2. Set Up Environment Variables

Create a `.env` file in the `FastAPI_Backend/` directory:

```env
# Server
PORT=5000
NODE_ENV=development

# MongoDB Atlas
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/feelwise_db?retryWrites=true&w=majority

# JWT
JWT_SECRET=your_secure_random_secret_key_here
JWT_EXPIRE=7d

# CORS
ALLOWED_ORIGINS=http://localhost:5500,http://127.0.0.1:5500

# Email (Gmail App Password)
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_gmail_app_password

# Frontend URL
FRONTEND_URL=http://localhost:5500
```

### 3. Install Node.js Dependencies

```bash
cd FastAPI_Backend
npm install
```

### 4. Set Up Python Virtual Environments

**For Text, Speech, and Journal APIs (Python 3.12+):**

```bash
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux
pip install -r requirements-final.txt
```

**For Face Analysis API (Python 3.10):**

```bash
py -3.10 -m venv face-venv
face-venv\Scripts\activate     # Windows
# source face-venv/bin/activate # macOS/Linux
pip install -r requirement-face-final.txt
```

### 5. Install FFmpeg (for Speech Analysis)

Download FFmpeg from [ffmpeg.org](https://ffmpeg.org/download.html) and add it to your system PATH.

### 6. Start All Services

**Option A — Use the startup script:**

```bash
start-services.bat
```

**Option B — Start each service manually (each in a separate terminal):**

```bash
# Terminal 1: Text Analysis API
uvicorn text-analysis-api:app --reload --port 8001

# Terminal 2: Face Analysis API (use Python 3.10 venv)
uvicorn face-analysis-api:app --reload --port 8002

# Terminal 3: Speech Analysis API
uvicorn speech_analysis_fastapi:app --reload --port 8000

# Terminal 4: Journal API
uvicorn journal_api:app --reload --port 8004

# Terminal 5: Node.js API Gateway
npm start
```

### 7. Serve the Frontend

Use VS Code Live Server or any static file server:

```bash
cd Frontend
python -m http.server 5500
```

Open your browser at `http://localhost:5500`.

---

## Usage

1. **Sign Up / Log In** — Create an account or log in to access the platform
2. **Dashboard** — Navigate to the main module hub to choose an analysis type
3. **Text Analysis** — Type your thoughts and receive an emotion breakdown with distribution chart, sentiment score, and personalized recommendations
4. **Facial Analysis** — Use your webcam to capture a photo or upload an image. The AI detects your facial expression and maps it to an emotion
5. **Speech Analysis** — Record your voice. The system transcribes your speech and analyzes the audio signal for emotional content using a Wav2Vec2 model
6. **Journal** — Write reflective entries guided by AI prompts. Entries are analyzed for mood and stored with trend visualization
7. **Full Assessment** — View a comprehensive report aggregating insights across all modalities, exportable as PDF
8. **Daily Challenges** — Complete emotion-specific challenges to build emotional intelligence skills
9. **Progress Tracking** — Monitor your emotional patterns and EQ growth over time

---

## API Endpoints

### API Gateway (Port 5000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/analyze` | Analyze text for emotions |
| `POST` | `/analyze-face` | Analyze facial expression from image |
| `POST` | `/analyze-speech` | Analyze speech from audio recording |
| `GET` | `/journal/prompts` | Get a random journal prompt |
| `POST` | `/journal/analyze` | Analyze journal entry text |
| `POST` | `/journal/entry` | Save a journal entry |
| `GET` | `/journal/entries` | Retrieve journal entries |
| `GET` | `/journal/insights` | Get mood trends and keyword insights |
| `DELETE` | `/journal/entry/:id` | Delete a journal entry |
| `POST` | `/api/auth/register` | Register a new user |
| `POST` | `/api/auth/login` | Log in and receive JWT |
| `GET` | `/api/auth/profile` | Get authenticated user profile |
| `PUT` | `/api/auth/profile` | Update user profile |
| `POST` | `/api/auth/forgot-password` | Request password reset email |
| `POST` | `/api/progress/complete-challenge` | Record challenge completion |
| `GET` | `/api/progress/stats` | Get user progress statistics |
| `GET` | `/health` | Service health check |

### Core ML Modules

| Module | Model / Engine | Input | Output |
|--------|---------------|-------|--------|
| **Text Analysis** | NLTK + VADER + Custom Keyword Engine | Raw text | Emotion label, distribution, sentiment, negation/sarcasm flags |
| **Face Analysis** | DeepFace (PyTorch backend) | Base64 image | Dominant emotion, confidence scores, recommendations |
| **Speech Analysis** | Wav2Vec2 XLSR (Transformers) | Base64 audio (WAV) | Emotion label, confidence distribution |
| **Journal Analysis** | VADER + Keyword Engine | Journal text | Mood classification, sentiment score |

---

## Development Workflow

### Running in Development

1. Start all FastAPI services with `--reload` for hot reloading
2. Start the Node.js server with `npm start`
3. Use VS Code Live Server for the frontend with auto-refresh

### Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -m "Add your feature"`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

### Code Style

- **Python**: Follow PEP 8 conventions
- **JavaScript**: Use ES6+ syntax
- **CSS**: BEM-like naming with modular per-page stylesheets

---

## Future Improvements

- [ ] Real-time video emotion tracking (continuous webcam feed analysis)
- [ ] Multi-language emotion detection support
- [ ] Mobile-responsive PWA with offline journaling
- [ ] WebSocket integration for live speech-to-emotion streaming
- [ ] Therapist/counselor dashboard for patient monitoring
- [ ] Integration with wearable APIs (heart rate, sleep data)
- [ ] Fine-tuned transformer model for text emotion (replacing keyword engine)
- [ ] Docker Compose setup for one-command deployment
- [ ] CI/CD pipeline with automated testing
- [ ] Role-based access control (admin, user, therapist)

---

## Why This Project Matters

Emotional intelligence (EQ) is a critical predictor of personal well-being, professional success, and relationship quality — yet it remains one of the hardest skills to develop without external feedback.

**FeelWise bridges that gap** by providing objective, AI-driven emotional feedback through multiple channels. Instead of relying on self-reporting alone, users receive data-backed insights into their emotional state from their words, facial expressions, and voice patterns.

**Real-world applications:**
- **Mental health awareness** — Early detection of persistent negative emotional patterns
- **Personal development** — Structured EQ skill-building through challenges and journaling
- **Education** — Teaching emotional literacy through interactive modules and quizzes
- **Workplace wellness** — Employee emotional well-being tracking and support
- **Research** — Multi-modal emotion dataset collection and analysis

---

## Author

**Shahriyar Khan**

Full-Stack Developer & AI/ML Engineer

Built with expertise in Python, Node.js, Deep Learning, and NLP — focused on building AI-powered solutions for mental health and emotional well-being.

---

<div align="center">

*If this project helped you, consider giving it a ⭐ on GitHub!*

</div>
