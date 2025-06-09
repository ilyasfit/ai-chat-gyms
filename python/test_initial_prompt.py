import requests
import json
import os
import time
import glob

API_URL = "http://localhost:3000/api/chat/internal"
COLABORADORES_PASSWORD = "!" # Confirmed from src/config/passwords.ts

def get_latest_payload_file(payload_dir="python"):
    list_of_files = glob.glob(os.path.join(payload_dir, 'gemini_payload_*.json'))
    if not list_of_files:
        return None
    return max(list_of_files, key=os.path.getctime)

def test_instructions_md_loading():
    payload = {
        "message": "Test instruction loading",
        "history": [],
        "password": COLABORADORES_PASSWORD
    }
    headers = {'Content-Type': 'application/json'}
    
    # Ensure python directory exists
    payload_output_dir = "python"
    if not os.path.exists(payload_output_dir):
        os.makedirs(payload_output_dir)
        print(f"Created directory: {payload_output_dir}")

    # Lösche alte Payloads, um sicherzustellen, dass wir den neuesten bekommen
    for f_old in glob.glob(os.path.join(payload_output_dir, 'gemini_payload_*.json')):
        try:
            os.remove(f_old)
        except OSError as e:
            print(f"Error deleting old payload file {f_old}: {e}")


    print(f"Sending request to {API_URL} with payload: {json.dumps(payload)}")
    response = requests.post(API_URL, json=payload, headers=headers, timeout=30)
    
    if response.status_code != 200:
        print(f"MTC Error: API request failed with status {response.status_code} - {response.text}")
        return False

    print("API request successful. Waiting for payload file to be written...")
    time.sleep(2) # Increased sleep time to ensure file is written
    
    latest_payload_file = get_latest_payload_file(payload_output_dir)
    if not latest_payload_file:
        print(f"MTC Error: No payload file found in {payload_output_dir}. Searched for gemini_payload_*.json")
        # List files in directory for debugging
        if os.path.exists(payload_output_dir):
            print(f"Files in {payload_output_dir}: {os.listdir(payload_output_dir)}")
        else:
            print(f"Directory {payload_output_dir} does not exist.")
        return False
    
    print(f"Found payload file: {latest_payload_file}")
        
    try:
        with open(latest_payload_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"MTC Error: Could not read or parse JSON from {latest_payload_file}: {e}")
        return False
    
    instructions_md_path = "context/internal/instructions.md"
    if not os.path.exists(instructions_md_path):
        print(f"MTC Error: instructions.md file not found at {instructions_md_path}")
        return False

    with open(instructions_md_path, 'r', encoding='utf-8') as f_instr:
        expected_instructions = f_instr.read().strip()
    
    if not data or not isinstance(data, list) or len(data) == 0:
        print(f"MTC Error: Payload data is empty or not in expected list format. Payload: {data}")
        return False
        
    if 'parts' not in data[0] or not isinstance(data[0]['parts'], list) or len(data[0]['parts']) == 0:
        print(f"MTC Error: contents[0].parts is missing or not in expected format. Payload: {data[0]}")
        return False
        
    if 'text' not in data[0]['parts'][0]:
        print(f"MTC Error: contents[0].parts[0].text is missing. Payload: {data[0]['parts'][0]}")
        return False

    actual_instructions = data[0]['parts'][0]['text'].strip()
    
    if actual_instructions == expected_instructions:
        print("MTC Success: instructions.md loaded correctly as initial system prompt.")
        return True
    else:
        print("MTC Failed: instructions.md not loaded correctly.")
        print(f"Expected (from {instructions_md_path}):\n---\n{expected_instructions}\n---")
        print(f"Actual (from {latest_payload_file}):\n---\n{actual_instructions}\n---")
        # For detailed comparison, print lengths
        print(f"Length Expected: {len(expected_instructions)}, Length Actual: {len(actual_instructions)}")
        # For very detailed comparison, show differences if possible (e.g., using difflib)
        # import difflib
        # diff = difflib.unified_diff(expected_instructions.splitlines(keepends=True), 
        #                             actual_instructions.splitlines(keepends=True), 
        #                             fromfile='expected', tofile='actual')
        # print("Diff:\n" + "".join(diff))
        return False

if __name__ == "__main__":
    if not test_instructions_md_loading():
        print("test_instructions_md_loading returned False.")
        exit(1)
    else:
        print("test_instructions_md_loading returned True.")
