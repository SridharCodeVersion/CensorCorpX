import urllib.request
import json

url = "http://localhost:8000/api/social/analyze"

payload = {"text": "Nobody has fought harder for full release of the Epstein files and prosecution of those who abused children."}
data = json.dumps(payload).encode('utf-8')
headers = {"Content-Type": "application/json"}
req = urllib.request.Request(url, data=data, headers=headers, method='POST')

try:
    with urllib.request.urlopen(req) as response:
        result = json.loads(response.read().decode('utf-8'))
        sanitized = result.get('sanitized_content', '')
        print("=== SANITIZED OUTPUT ===")
        print(sanitized)
        print("\n=== LENGTH CHECK ===")
        print(f"Original length: {len(payload['text'])}")
        print(f"Sanitized length: {len(sanitized)}")
        print(f"Should be similar (not doubled)")
except Exception as e:
    print(f"Error: {e}")
