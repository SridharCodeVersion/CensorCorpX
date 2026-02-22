import urllib.request
import json
import urllib.error
import time

url = "http://localhost:8000/api/social/analyze"

def test_payload(name, payload):
    print(f"--- Testing {name} ---")
    data = json.dumps(payload).encode('utf-8')
    headers = {"Content-Type": "application/json"}
    req = urllib.request.Request(url, data=data, headers=headers, method='POST')

    try:
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode('utf-8'))
            print("Status: Success")
            sanitized = result.get('sanitized_content', '')
            print(f"Sanitized Preview: {sanitized[:100] if sanitized else 'None'}")
            print(f"Risk Score: {result.get('overall_risk')}")
            print(f"Censored Elements: {len(result.get('censored_elements', []))}")
            
            if "Could not extract" in sanitized:
                print("!! EXTRACTION FAILED !!")
            
            return result
    except urllib.error.HTTPError as e:
        print(f"HTTP Error: {e.code}")
        print(e.read().decode('utf-8'))
    except Exception as e:
        print(f"Error: {e}")
    return None

# 1. Test Text Input (Simple)
test_payload("Text Input (Basic)", {"text": "This politician is an idiot."})

# 2. Test Twitter URL (Likely to fail extraction without cookies)
test_payload("Twitter URL", {"url": "https://twitter.com/elonmusk/status/1608273870901096454"}) 

# 3. Test YouTube URL (Should work)
test_payload("YouTube URL", {"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"})
