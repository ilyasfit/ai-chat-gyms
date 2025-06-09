import requests
import json
import os
import time
import glob

API_URL = "http://localhost:3000/api/chat/internal"
COLABORADORES_PASSWORD = "!" # Confirmed

# This function needs to replicate the file reading order and formatting
# of readMarkdownFilesRecursive in app/api/chat/internal/route.ts
# For simplicity, we'll check for the presence of key file contents/names.
# A more robust test would involve a more precise simulation or parsing.
def get_expected_general_context_parts():
    # These are distinctive parts of content or filenames from the general context
    return [
        "MYO CLINIC – EXERCÍCIO COM SAÚDE | MANUAL DE CULTURA E PROCEDIMENTOS INTERNOS", # From Manual Geral Myo Clinic.txt
        "POP - Faltas Frequentes às Sessões.md", # A filename from POP/
        "POP - Cliente Emocionalmente Instável.md", # Another filename
        "Chamada para Lead - Objetivo Agendar Avaliação.txt" # From Fisio - Cliente/Chamadas para Leads/
    ]

def get_latest_payload_file(payload_dir="python"):
    list_of_files = glob.glob(os.path.join(payload_dir, 'gemini_payload_*.json'))
    if not list_of_files:
        return None
    return max(list_of_files, key=os.path.getctime)

def test_general_context_loading():
    payload = {
        "message": "Test general context loading",
        "history": [],
        "password": COLABORADORES_PASSWORD
    }
    headers = {'Content-Type': 'application/json'}

    payload_output_dir = "python"
    if not os.path.exists(payload_output_dir):
        os.makedirs(payload_output_dir)
        print(f"Created directory: {payload_output_dir}")

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

    print("API request successful. Waiting for payload file...")
    time.sleep(2) 
    
    latest_payload_file = get_latest_payload_file(payload_output_dir)
    if not latest_payload_file:
        print(f"MTC Error: No payload file found in {payload_output_dir}.")
        if os.path.exists(payload_output_dir): print(f"Files in {payload_output_dir}: {os.listdir(payload_output_dir)}")
        return False
    
    print(f"Found payload file: {latest_payload_file}")

    try:
        with open(latest_payload_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"MTC Error: Could not read/parse JSON from {latest_payload_file}: {e}")
        return False
    
    # Expected index for "additionalDocuments" is 2 (after system prompt [0] and first model ack [1])
    if len(data) < 3:
        print(f"MTC Failed: Payload has less than 3 messages. Payload: {json.dumps(data, indent=2)}")
        return False
        
    if data[2]['role'] != 'user' or not data[2]['parts'][0]['text'].startswith("Here are some additional documents"):
        print("MTC Failed: 'additionalDocuments' user message not found at expected position (index 2) or does not have the correct prefix.")
        print(f"Message at index 2: {json.dumps(data[2], indent=2)}")
        return False

    actual_additional_docs_content = data[2]['parts'][0]['text']
    
    # Extract the pure context part
    # The role in the prefix should match `determinedRole` which is 'colaboradores' here.
    prefix = "Here are some additional documents and context relevant to your current role (colaboradores). Please use them to inform your responses:\n\n"
    if not actual_additional_docs_content.startswith(prefix):
        print(f"MTC Failed: Prefix for additional documents not found or role mismatch. Expected role 'colaboradores'.")
        print(f"Actual prefix part (first 200 chars): {actual_additional_docs_content[:200]}")
        return False
    
    actual_context_only = actual_additional_docs_content[len(prefix):].strip()
    
    expected_parts = get_expected_general_context_parts()
    missing_parts = []
    for part in expected_parts:
        if part not in actual_context_only:
            missing_parts.append(part)
            
    if not missing_parts:
        print("MTC Success: General context seems to be loaded correctly (all key parts found).")
        return True
    else:
        print("MTC Failed: General context not loaded correctly or key parts missing.")
        for part in missing_parts:
            print(f"- Missing: '{part}'")
        print(f"Actual combined context in payload (first 1000 chars):\n---\n{actual_context_only[:1000]}\n---")
        return False

if __name__ == "__main__":
    if not test_general_context_loading():
        print("test_general_context_loading returned False.")
        exit(1)
    else:
        print("test_general_context_loading returned True.")
