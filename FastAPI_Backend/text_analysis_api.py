# text-analysis-api.py (updated version)
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Optional
import uvicorn
from analysis_utils import analyze_text_with_context  # Use the improved function!

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TextRequest(BaseModel):
    text: str

class AnalysisResponse(BaseModel):
    text: str
    emotion: str
    emotion_distribution: dict
    sentiment: Optional[Dict] = None
    negation_detected: Optional[bool] = False
    sarcasm_detected: Optional[bool] = False

@app.post("/analyze", response_model=AnalysisResponse)
def analyze(request: TextRequest):
    return analyze_text_with_context(request.text)

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "text-emotion-analysis"}

if __name__ == "__main__":
    uvicorn.run("text-analysis-api:app", host="0.0.0.0", port=8001, reload=True)
    