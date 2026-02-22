import urllib.request
import json
import urllib.error
import time

url = "http://localhost:8000/api/social/analyze"

# Test Case 1: URL Input
print("--- Testing URL Input ---")
payload_url = {"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"} # Using a known safe URL for structure test, or a mock if yt-dlp fails
# Note: yt-dlp might fail on some networks or if not installed/updated. 
# The backend converts yt-dlp errors to "Could not extract...", which we should check for.

data = json.dumps(payload_url).encode('utf-8')
headers = {"Content-Type": "application/json"}
req = urllib.request.Request(url, data=data, headers=headers, method='POST')

try:
    with urllib.request.urlopen(req) as response:
        result = json.loads(response.read().decode('utf-8'))
        print("Status: Success")
        print(f"Sanitized Content Preview: {result.get('sanitized_content')[:100] if result.get('sanitized_content') else 'None'}")
        
        # Check if segments/heatmap are present
        print(f"Heatmap Items: {len(result.get('heatmap', []))}")
        print(f"Risk Score: {result.get('overall_risk')}")

except urllib.error.HTTPError as e:
    print(f"HTTP Error: {e.code}")
    print(e.read().decode('utf-8'))
except Exception as e:
    print(f"Error: {e}")

print("\n")

# Test Case 2: Text Input (Regression Test)
print("--- Testing Text Input (Regression) ---")
payload_text = {"text": "This is a test post about an idiot who creates fake news."}
data = json.dumps(payload_text).encode('utf-8')
req = urllib.request.Request(url, data=data, headers=headers, method='POST')

try:
    with urllib.request.urlopen(req) as response:
        result = json.loads(response.read().decode('utf-8'))
        print("Status: Success")
        print(f"Sanitized Content Preview: {result.get('sanitized_content')}")
        print(f"Censored Elements: {len(result.get('censored_elements', []))}")
except urllib.error.HTTPError as e:
    print(f"HTTP Error: {e.code}")
    print(e.read().decode('utf-8'))
except Exception as e:
    print(f"Error: {e}")
