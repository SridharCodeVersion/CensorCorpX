import urllib.request
import json
import urllib.error

url = "http://localhost:8000/api/social/analyze"
payload = {"text": "This politician is an idiot and should be attacked."}
data = json.dumps(payload).encode('utf-8')
headers = {"Content-Type": "application/json"}

req = urllib.request.Request(url, data=data, headers=headers, method='POST')

try:
    with urllib.request.urlopen(req) as response:
        result = json.loads(response.read().decode('utf-8'))
        with open("reproduce_output.json", "w") as f:
            json.dump(result, f, indent=2)
        print("Output written to reproduce_output.json")
except urllib.error.HTTPError as e:
    print(f"HTTP Error: {e.code}")
    print(e.read().decode('utf-8'))
except Exception as e:
    print(f"Error: {e}")
