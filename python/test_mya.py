import requests
import json
from datetime import datetime
import time

API_URL = "http://localhost:3000/api/chat"  # Dein lokaler Endpunkt
MANAGER_PASSWORD = "@"  # Gemäß deiner passwords.ts für die Rolle "managers"

manager_questions_en = [
    "Como é que eu, enquanto gestor, finalizo um contrato de um cliente e arquivo os seus dados de forma definitiva?",
    "Podes explicar resumidamente os passos para gerar o ficheiro para os débitos diretos dos clientes?",
    "Um cliente está suspenso. Quais são os passos no sistema para o reativar?",
    "O que devo fazer se um cliente faltar repetidamente às sessões? Qual é a nossa abordagem?",

    # Vagere Fragen, um die Reaktion/Nachfrage zu testen
    "Preciso de criar um ficheiro para as operações mensais. Podes ajudar-me com o procedimento?", # Vage: "um ficheiro" -> Sollte nachfragen oder sich auf "ficheiro de débito" beziehen, wenn der Kontext passt
    "Como é a gestão de um cliente que tem pagamentos em atraso?", # Zielt auf "Video#7 Gestão Cliente (DívidasMarcações)" im general-Kontext oder allgemeine Schuldenmanagement-Infos
    "Quais são as minhas responsabilidades principais na gestão da clínica no dia-a-dia?", # Allgemein, sollte aus "Descritivo de Funções" im Manual Geral kommen
    "Um cliente pediu para falar com a coordenação sobre um problema. Como devo proceder segundo os nossos POPs?", # Zielt auf POP - Pedido de Falar com Coordenação
    "Preciso de informações sobre o processo de cancelamento. Podes detalhar?", # Vage: "processo de cancelamento" -> Könnte Vertragskündigung meinen, oder eine Sitzung. Sollte nachfragen oder sich auf das wahrscheinlichste (Vertrag) beziehen.
    "Como funciona a avaliação Myo Health? Preciso de preparar algo específico?" # Allgemein aus Manual Geral
]

# Eine einfache Starthistorie, die du bei Bedarf anpassen kannst.
# Die API wird die System-Prompts und Kontextdokumente basierend auf dem Passwort hinzufügen.
initial_history = [
    {"role": "user", "content": "Olá MYA, tenho algumas perguntas sobre os procedimentos para gestores."},
    {"role": "assistant", "content": "Olá! Estou pronta para as suas perguntas específicas para gestores. Como posso ajudar hoje? 😊"}
]

timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
output_filename = f"mya_manager_test_log_{timestamp}.txt"

def ask_mya_api(question, history):
    payload = {
        "message": question,
        "history": history,
        "password": MANAGER_PASSWORD
    }
    headers = {
        'Content-Type': 'application/json'
    }
    max_retries = 3
    retry_delay = 5  # seconds

    for attempt in range(max_retries):
        try:
            # Erhöhe den Timeout, da LLM-Antworten manchmal länger dauern können
            response = requests.post(API_URL, json=payload, headers=headers, timeout=180)
            response.raise_for_status()  # Löst eine Ausnahme für HTTP-Fehler aus (4xx oder 5xx)
            return response.text  # Die API gibt einen Plain-Text-Stream zurück
        except requests.exceptions.Timeout:
            if attempt < max_retries - 1:
                print(f"Attempt {attempt + 1} timed out. Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
            else:
                return "Error: The request to the API timed out after multiple retries."
        except requests.exceptions.HTTPError as http_err:
            # Nur bei Server-Fehlern (5xx) erneut versuchen
            if response.status_code >= 500 and attempt < max_retries - 1:
                print(f"Attempt {attempt + 1} failed with HTTP error {response.status_code}. Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
            else:
                return f"Error: HTTP error occurred: {http_err} - Response: {response.text}"
        except requests.exceptions.RequestException as req_err:
            # Bei anderen Request-Fehlern nicht unbedingt erneut versuchen, es sei denn, es ist sinnvoll
            # Für dieses Beispiel brechen wir bei anderen Request-Fehlern ab
            return f"Error: A request error occurred: {req_err}"
        except Exception as e:
            return f"Error: An unexpected error occurred: {e}"
    return "Error: Max retries reached without success." # Sollte nicht erreicht werden, wenn alle Fehler behandelt werden

with open(output_filename, 'w', encoding='utf-8') as f_log:
    f_log.write(f"MYA Manager Role Test Log - Started at {timestamp}\n")
    f_log.write("===================================================\n\n")

    current_conversation_history = list(initial_history) # Kopiere die Starthistorie

    for i, question_text in enumerate(manager_questions_en):
        print(f"Asking question {i+1}/{len(manager_questions_en)}: {question_text}")
        f_log.write(f"--- Question {i+1} ---\n")
        f_log.write(f"User: {question_text}\n\n")

        # Sende die aktuelle Konversationshistorie
        mya_response = ask_mya_api(question_text, current_conversation_history)

        f_log.write(f"MYA:\n{mya_response}\n") # Füge einen Zeilenumbruch hinzu für bessere Lesbarkeit
        f_log.write("---------------------------------------------------\n\n")
        print(f"Response for question {i+1} received and logged to {output_filename}")

        # Aktualisiere die Konversationshistorie
        current_conversation_history.append({"role": "user", "content": question_text})
        current_conversation_history.append({"role": "assistant", "content": mya_response})

        # Eine kleine Pause, um die API nicht zu überlasten (optional, aber gut für externe APIs)
        if i < len(manager_questions_en) - 1:
            time.sleep(10) # Warte 10 Sekunden

    f_log.write("Test session finished.\n")

print(f"\nAll questions processed. Log saved to {output_filename}")
