import json

def create_gemini_chat_history(conversation_data):
    """
    Erstellt eine Chat-Historie im Gemini-Format.

    Args:
        conversation_data: Eine Liste von Tupeln, wobei jedes Tupel
                           (Absender, Nachrichtentext) enthält.
                           Absender kann "user" oder "model" sein.

    Returns:
        Eine Liste von Dictionaries im Gemini Chat-History-Format.
    """
    history = []
    for sender, message_text in conversation_data:
        if sender.lower() not in ["user", "model"]:
            raise ValueError(f"Ungültiger Absender: {sender}. Muss 'user' oder 'model' sein.")
        
        history.append({
            "role": sender.lower(),
            "parts": [
                {"text": message_text}
            ]
        })
    return history

def save_chat_history_to_json(chat_history, filename="conversation_gemini_format.json"):
    """
    Speichert die Chat-Historie als JSON-Datei.

    Args:
        chat_history: Die Chat-Historie im Gemini-Format.
        filename: Der Name der zu erstellenden JSON-Datei.
    """
    try:
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(chat_history, f, ensure_ascii=False, indent=2)
        print(f"Chat-Historie erfolgreich in '{filename}' gespeichert.")
    except IOError as e:
        print(f"Fehler beim Speichern der Datei '{filename}': {e}")
    except Exception as e:
        print(f"Ein unerwarteter Fehler ist aufgetreten: {e}")

if __name__ == "__main__":
    # Beispiel-Konversation
    # Jedes Element ist ein Tupel: (Absender, Nachricht)
    # Absender muss "user" oder "model" sein.
    sample_conversation = [
        ("user", "Hallo, wie geht es dir heute?"),
        ("model", "Mir geht es gut, danke! Wie kann ich dir helfen?"),
        ("user", "Kannst du mir das Wetter für Berlin sagen?"),
        ("model", "Sicher. Das Wetter in Berlin ist heute sonnig mit einer Temperatur von 22°C."),
        ("user", "Vielen Dank!"),
        ("model", "Gern geschehen! Gibt es noch etwas, das ich für dich tun kann?")
    ]

    # Erstelle die Chat-Historie im Gemini-Format
    gemini_history = create_gemini_chat_history(sample_conversation)

    # Speichere die Historie in einer JSON-Datei
    # Die Datei wird im selben Verzeichnis wie das Skript gespeichert.
    output_filename = "python/conversation_gemini_format.json" 
    save_chat_history_to_json(gemini_history, output_filename)

    # Beispiel für die Ausgabe der JSON-Struktur (optional)
    # print("\nGenerierte JSON-Struktur:")
    # print(json.dumps(gemini_history, ensure_ascii=False, indent=2))
