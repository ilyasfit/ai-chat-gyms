// HINWEIS: Diese Datei dient nur zu Entwicklungszwecken.
// In einer Produktionsumgebung MÜSSEN diese Passwörter über Umgebungsvariablen
// oder einen anderen sicheren Mechanismus verwaltet werden.
// Checken Sie diese Datei NICHT mit echten Passwörtern in ein öffentliches Repository ein.

// Beispiel für Umgebungsvariablen (z.B. in .env.local oder Systemeinstellungen):
// MYO_PASS_COLABORADORES="IhrSicheresColabPasswort"
// MYO_PASS_MANAGERS="IhrSicheresManagerPasswort"
// MYO_PASS_FRANCHISING="IhrSicheresFranchisePasswort"
// MYO_PASS_ADMIN="IhrSicheresAdminPasswort" // Dieses ist für den Admin-Login im Frontend

export const passwordRoleMap: { [password: string]: string } = {
  // Beispiel-Passwörter für die Entwicklung:
  "MyoTeam2025!": "colaboradores",
  "MyoLead2025!": "managers",
  "MyoPartner2025!": "franchising",
  // Das Passwort für die Rolle "administrador" wird nicht hier direkt gemappt,
  // da der Admin-Zugang über einen separaten Admin-Login erfolgt
  // und die Auswahl der Rolle "administrador" im Frontend den Kontext bestimmt.
  // Die Rolle "public" erfordert kein Passwort.
};

// Dieses Passwort wird im Frontend verwendet, um den Admin-Modus freizuschalten.
// Es sollte ebenfalls über eine Umgebungsvariable in der Produktion verwaltet werden.
// z.B. NEXT_PUBLIC_ADMIN_PASSWORD="IhrSicheresAdminPasswort" (wenn im Frontend benötigt)
// oder serverseitig geprüft, wenn der Login-Mechanismus angepasst wird.
export const ADMIN_UI_PASSWORD = "safya-admin-2024!";

// Es wird empfohlen, die Variable CORRECT_PASSWORD in app/page.tsx zu entfernen
// und stattdessen dieses rollenbasierte System zu verwenden.
