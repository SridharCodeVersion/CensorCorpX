import urllib.request
import json

url = "http://localhost:8000/api/chat"

# Simulate social media context (from frontend tab state)
social_context = {
    "has_social": True,
    "social": {
        "contentId": "test-123",
        "segments": [
            {"id": "seg1", "start": 0.1, "end": 0.3, "labels": ["abusive_language"], "riskScores": [{"category": "abusive_language", "score": 0.6}]}
        ],
        "certification": {
            "before": "A",
            "after": "U/A"
        },
        "overallRisk": 0.6
    }
}

test_questions = [
    "How does sanitization work?",
    "What elements were flagged?",
    "Explain the risk breakdown",
    "Why did the certification change?",
    "What does the heatmap show?",
    "How does detection work?",
    "Tell me about the AI analysis",
    "What can you help me with?"
]

for question in test_questions:
    print(f"\n--- Q: {question} ---")
    payload = {"question": question, "context": social_context}
    data = json.dumps(payload).encode('utf-8')
    headers = {"Content-Type": "application/json"}
    req = urllib.request.Request(url, data=data, headers=headers, method='POST')
    
    try:
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode('utf-8'))
            print(f"A: {result.get('answer')}")
    except Exception as e:
        print(f"Error: {e}")
