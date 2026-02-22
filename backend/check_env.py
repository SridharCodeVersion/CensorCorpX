import os

if os.environ.get("OPENAI_API_KEY"):
    print("OPENAI_API_KEY is set.")
else:
    print("OPENAI_API_KEY is NOT set.")
