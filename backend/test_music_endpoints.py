import urllib.request
import urllib.parse
import json
import time

BASE_URL = "http://localhost:8000/api"

def test_music_flow():
    print("--- Testing Music Analysis Flow ---")
    
    # Start analysis
    payload_data = {"url": "https://www.youtube.com/watch?v=TEST_MUSIC"}
    
    # Simple multipart/form-data assembly for the payload field
    boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
    data = []
    data.append(f'--{boundary}')
    data.append('Content-Disposition: form-data; name="payload"')
    data.append('')
    data.append(json.dumps(payload_data))
    data.append(f'--{boundary}--')
    data.append('')
    body = '\r\n'.join(data).encode('utf-8')
    
    req = urllib.request.Request(f"{BASE_URL}/music/analyze_async", data=body)
    req.add_header('Content-Type', f'multipart/form-data; boundary={boundary}')
    
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            job_id = data["job_id"]
            content_id = data["content_id"]
            print(f"Started job {job_id} for content {content_id}")
    except Exception as e:
        print(f"Start failed: {e}")
        return

    print("Waiting for job to complete (simulated polling)...")
    time.sleep(12) 
    
    print("Checking job result via events endpoint...")
    try:
        # We can't easily stream with urllib.request in a simple way while parsing JSON per line 
        # but we can just read the whole thing if the job is done.
        with urllib.request.urlopen(f"{BASE_URL}/jobs/{job_id}/events") as resp:
            content = resp.read().decode()
            for line in content.split('\n'):
                if line.startswith("data: "):
                    event_data = json.loads(line[6:])
                    if event_data.get("type") == "final":
                        print("Job Finished Successfully!")
                        # print(json.dumps(event_data, indent=2))
                        break
    except Exception as e:
        print(f"Event check failed: {e}")

    print("\n--- Testing Music Apply Flow ---")
    apply_payload = {
        "content_id": content_id,
        "options": {"addBeep": True}
    }
    apply_data_bytes = json.dumps(apply_payload).encode('utf-8')
    req = urllib.request.Request(f"{BASE_URL}/music/apply_async", data=apply_data_bytes)
    req.add_header('Content-Type', 'application/json')
    
    try:
        with urllib.request.urlopen(req) as resp:
            apply_res = json.loads(resp.read().decode())
            apply_job_id = apply_res["job_id"]
            print(f"Started apply job {apply_job_id}")
    except Exception as e:
        print(f"Apply failed: {e}")
        return
    
    time.sleep(8)
    try:
        with urllib.request.urlopen(f"{BASE_URL}/jobs/{apply_job_id}/events") as resp:
            content = resp.read().decode()
            for line in content.split('\n'):
                if line.startswith("data: "):
                    event_data = json.loads(line[6:])
                    if event_data.get("type") == "final":
                        print("Apply Finished Successfully!")
                        print(f"Censored URL: {event_data['result'].get('censored_url')}")
                        break
    except Exception as e:
        print(f"Apply event check failed: {e}")

if __name__ == "__main__":
    test_music_flow()
