import urllib.request
import json
import os

# Create a test text file with PII and confidential content
test_content = """CONFIDENTIAL INTERNAL DOCUMENT

Employee Information:
Name: John Doe
SSN: 123-45-6789
Email: john.doe@company.com
Phone: 555-123-4567
Credit Card: 4532-1234-5678-9012

This is a proprietary document containing trade secrets and internal information.
Password for the system: MySecretPass123
API Key: sk-1234567890abcdef

The company is planning a secret merger with CompetitorCorp.
This information is strictly confidential and should not be shared externally.
"""

# Save to a temporary text file (simulating document content)
test_file_path = "test_confidential.txt"
with open(test_file_path, "w") as f:
    f.write(test_content)

print("=== TEST DOCUMENT CONTENT ===")
print(test_content)
print("\n=== TESTING DOCUMENT ANALYSIS ===\n")

# Note: The actual endpoint expects a file upload
# For this test, we'll verify the analysis logic works with the text
# In a real test, you would upload a DOCX or PDF file

print("Test file created: test_confidential.txt")
print("To test the full endpoint, upload this file via the UI or use a proper file upload test.")
print("\nExpected detections:")
print("- SSN: 123-45-6789")
print("- Email: john.doe@company.com")
print("- Phone: 555-123-4567")
print("- Credit Card: 4532-1234-5678-9012")
print("- Keywords: CONFIDENTIAL, proprietary, trade secrets, internal, Password, API Key, secret")

# Clean up
os.remove(test_file_path)
print("\nTest file cleaned up.")
