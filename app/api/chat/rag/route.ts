import {
  GoogleGenerativeAI,
  Content,
  GoogleGenerativeAI as GoogleGenAI_Chat,
} from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";
import { rolesConfiguration } from "../../../../src/config/roleContextMapping";
import { passwordRoleMap } from "../../../../src/config/passwords";

// --- Pinecone Initialization ---
const pineconeApiKey = process.env.PINECONE_API_KEY;
if (!pineconeApiKey) {
  throw new Error("Missing PINECONE_API_KEY environment variable.");
}
const pc = new Pinecone({ apiKey: pineconeApiKey });
const indexName = "developer-quickstart-js";

// --- Gemini Embedding Model Initialization ---
const geminiApiKey_embed = process.env.GEMINI_API_KEY;
if (!geminiApiKey_embed) {
  throw new Error("Missing GEMINI_API_KEY environment variable for embedding.");
}
const genAI_embed = new GoogleGenerativeAI(geminiApiKey_embed);
const embeddingModel = genAI_embed.getGenerativeModel({
  model: "embedding-001",
});

// --- Knowledge Retrieval Function ---
interface PineconeQueryHit {
  id: string;
  score: number;
  metadata: {
    chunk_text: string;
    category: string;
    source: string;
  };
}

async function getKnowledge(query: string, role: string): Promise<string> {
  console.log(
    `[getKnowledge] Embedding query for role "${role}" and querying Pinecone with: "${query}"`
  );
  try {
    // 1. Embed the query
    const embeddingResult = await embeddingModel.embedContent(query);
    const queryVector = embeddingResult.embedding.values;

    // 2. Construct metadata filter based on role
    let filter: object | undefined = undefined;
    if (role === "managers") {
      filter = { $or: [{ role: "general" }, { role: "managers" }] };
    } else if (role === "franchising") {
      filter = { $or: [{ role: "general" }, { role: "franchising" }] };
    } else if (role !== "admin_full_context" && role !== "public") {
      // Default for any other internal role is just "general"
      filter = { role: "general" };
    }
    // For "admin_full_context", filter is undefined (no filter)
    // For "public", filter is { "role": "public" }
    if (role === "public") {
      filter = { role: "public" };
    }

    // 3. Query Pinecone
    const index = pc.Index(indexName);
    const ns = index.namespace("local-context");
    const results = await ns.query({
      topK: 10,
      vector: queryVector,
      includeMetadata: true,
      filter: filter,
    });

    // 4. Format the results
    if (results?.matches && results.matches.length > 0) {
      const hits = results.matches as PineconeQueryHit[];
      const context = hits
        .map(
          (hit: PineconeQueryHit) =>
            `Context from ${hit.metadata.source}: ${
              hit.metadata.chunk_text
            } (Score: ${hit.score.toFixed(2)})`
        )
        .join("\n\n");
      console.log(`[getKnowledge] Retrieved context from Pinecone.`);
      return context;
    } else {
      console.log("[getKnowledge] No relevant documents found in Pinecone.");
      return "No specific knowledge found for this query.";
    }
  } catch (error) {
    console.error("[getKnowledge] Error querying Pinecone:", error);
    return "Error retrieving knowledge from the database.";
  }
}

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("Missing GEMINI_API_KEY environment variable.");
}
const genAI = new GoogleGenAI_Chat(apiKey);
const chatModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

function formatHistory(
  history: { role: "user" | "assistant"; content: string }[]
): Content[] {
  return history.map((msg) => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }],
  }));
}

export async function POST(req: NextRequest) {
  try {
    // Hinzufügen für Debugging
    const rawRequestBody = await req.text(); // Rohen Body als Text lesen
    console.log(
      "[Backend /api/chat/internal] Received raw request body:",
      rawRequestBody
    );
    let parsedBody;
    try {
      parsedBody = JSON.parse(rawRequestBody);
    } catch (e) {
      console.error(
        "[Backend /api/chat/internal] Error parsing raw request body:",
        e
      );
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }
    console.log(
      "[Backend /api/chat/internal] Parsed request body:",
      parsedBody
    );

    const { message, history, password, selectedAdminRole, userRole } =
      parsedBody; // userRole hier hinzufügen

    console.log(
      "[Backend /api/chat/internal] Extracted message:",
      message ? "present" : "missing_or_empty"
    );
    console.log(
      "[Backend /api/chat/internal] Extracted history:",
      history ? "present" : "missing_or_empty"
    );
    console.log("[Backend /api/chat/internal] Extracted password:", password);
    console.log(
      "[Backend /api/chat/internal] Extracted selectedAdminRole:",
      selectedAdminRole
    );
    // --- Ende Debugging Logs ---

    // Originalcode geht hier weiter...
    // const { message, history, password, selectedAdminRole } = await req.json(); // Diese Zeile ersetzen/auskommentieren

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Invalid message format" },
        { status: 400 }
      );
    }
    if (
      !history ||
      !Array.isArray(history) ||
      !history.every(
        (item) =>
          item &&
          (item.role === "user" || item.role === "assistant") &&
          typeof item.content === "string"
      )
    ) {
      return NextResponse.json(
        { error: "Invalid history format" },
        { status: 400 }
      );
    }

    const formattedHistory = formatHistory(history);

    let determinedRole = "public";
    let userProvidedIdentifier = "none";

    if (selectedAdminRole && typeof selectedAdminRole === "string") {
      if (rolesConfiguration[selectedAdminRole]) {
        determinedRole = selectedAdminRole;
        userProvidedIdentifier = `admin-selected-role: ${selectedAdminRole}`;
      } else {
        console.warn(
          `Admin selected an invalid role: ${selectedAdminRole}. Defaulting to public.`
        );
        userProvidedIdentifier = `admin-selected-invalid-role: ${selectedAdminRole}`;
      }
    } else if (userRole && typeof userRole === "string") {
      // NEUER BLOCK für normale authentifizierte Nutzer
      if (
        rolesConfiguration[userRole] &&
        rolesConfiguration[userRole].isInternal
      ) {
        determinedRole = userRole;
        userProvidedIdentifier = `user-role: ${userRole}`;
      } else {
        console.warn(
          `[Backend /api/chat/internal] Received invalid userRole: ${userRole}. Defaulting to public.`
        );
        userProvidedIdentifier = `invalid-user-role: ${userRole}`;
        // determinedRole bleibt "public"
      }
    } else if (password && typeof password === "string") {
      // Fallback oder für initialen Public->Internal Wechsel ohne vollen Login-Flow
      const roleFromPassword = passwordRoleMap[password];
      if (roleFromPassword) {
        determinedRole = roleFromPassword;
        userProvidedIdentifier = "password-fallback"; // Kennzeichnen, dass dies ein Fallback ist
      } else {
        // Kein Fehler loggen, wenn Passwort leer oder ungültig UND kein userRole/selectedAdminRole da war.
        // Der finale Else-Block fängt das ab.
      }
    }

    if (determinedRole === "public" && userProvidedIdentifier === "none") {
      console.log(
        "No admin role, userRole, or valid password provided. Using public role."
      );
    }

    console.log(
      `Determined role: ${determinedRole} (based on: ${userProvidedIdentifier})`
    );

    // --- RAG Implementation ---
    const knowledge = await getKnowledge(message, determinedRole);

    const systemPromptText = `You are MYA, a helpful feminine happy AI assistant for Myo Clinic. Your role is ${determinedRole}.

Deine Rolle ist es, Myo Clinic Mitarbeitern schnell und präzise Fragen zu Betriebsabläufen, Prozeduren, Rollen und Verantwortlichkeiten zu beantworten, basierend auf den bereitgestellten Myo Clinic Dokumenten (inklusive des Handbuchs "Manual Geral Myo Clinic", Gesprächsleitfäden, technischer Diskussionen aus "Fisio Técnico" und Software-Anleitungen aus "Processos_Software"). Du kommunizierst feminin, freundlich und zugänglich und verwendest gelegentlich Emojis für Wärme und Nahbarkeit. 😊
• Fähigkeiten: Beantworte spezifische Fragen klar, fasse Abschnitte prägnant zusammen, erkläre Software-Prozesse Schritt für Schritt basierend auf den Anleitungen und reagiere effektiv auf Vergleichsanfragen bezüglich der bereitgestellten Inhalte.
• Einschränkungen: Stelle explizit klar, wenn Informationen in deinem bereitgestellten Wissen nicht verfügbar sind. Deine Kenntnisse beschränken sich ausschließlich auf die dir zur Verfügung gestellten Dokumente der Myo Clinic. Du gibst keine medizinischen Ratschläge, die über die Inhalte der "Fisio Técnico"-Dateien hinausgehen, sondern fasst diese nur zusammen oder erklärst sie.
• Formatierung: Verwende Standard-Markdown-Formatierung. Nummerierte Listenelemente sollten einzeilige Einträge sein (z. B. 1. Text), ohne zusätzliche Leerzeichen oder Zeilenumbrüche zwischen Zahlen und Text. Verwende "•" für Aufzählungspunkte anstelle von "\*". Verwende keine HTML-Tags. Verwende kein "**Text**" oder Ähnliches zur Hervorhebung.


You have access to a knowledge base to answer user questions.
When answering, use the provided "Knowledge" section.
If the knowledge isn't sufficient, say you don't have enough information.
Be friendly and professional.

WICHTIG: Halte dich immer strikt an gültige Markdown-Formatierung.

Du kannst in mehreren Sprachen kommunizieren – intrinsisch sprichst du **europäisches portugiesisch**.
Wenn dir jemand in einer bestimmten Sprache schreibt, dann antworte auf der entsprechenden Sprache.

Wenn dir eine Information fehlt, stelle ggf. Gegenfragen (falls passend) um das Intent akkurat zu erörtern

Bitte formuliere deine Antworten schön strukturiert, in der Sprache in der gesprochen wird, und übernimm diese nicht einfach 1:1


--- Knowledge ---
${knowledge}
--- End of Knowledge ---
`;

    console.log(
      `System prompt length for role ${determinedRole}: ${systemPromptText.length} characters`
    );

    const systemInstruction: Content = {
      role: "user",
      parts: [{ text: systemPromptText }],
    };
    const modelAcknowledgement: Content = {
      role: "model",
      parts: [
        { text: "Verstanden. I will use the provided knowledge to answer." },
      ],
    };

    const fullHistory: Content[] = [systemInstruction, modelAcknowledgement];

    fullHistory.push(...formattedHistory);

    const contents: Content[] = [
      ...fullHistory,
      { role: "user", parts: [{ text: message }] },
    ];

    // --- Save the request payload to a JSON file --- (Auskommentiert)
    /*
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      // Ensure the 'python' directory exists.
      // For simplicity in this example, we assume it exists or handle error.
      // In a production scenario, you might want to create it if it doesn't.
      const payloadDir = path.join(process.cwd(), "python");
      try {
        await fsp.mkdir(payloadDir, { recursive: true }); // Create directory if it doesn't exist
      } catch (mkdirError) {
        console.warn(
          `[API Chat] Could not create directory ${payloadDir}, it might already exist or there's a permission issue:`,
          mkdirError
        );
      }
      const payloadFilename = path.join(
        payloadDir,
        `gemini_payload_${timestamp}.json`
      );
      await fsp.writeFile(
        payloadFilename,
        JSON.stringify(contents, null, 2),
        "utf-8"
      );
      console.log(
        `[API Chat] Successfully saved Gemini request payload to ${payloadFilename}`
      );
    } catch (saveError) {
      console.error(
        "[API Chat] Error saving Gemini request payload:",
        saveError
      );
    }
    */
    // --- End of save ---

    const streamResult = await chatModel.generateContentStream({
      contents: contents,
      // generationConfig: { // Optional: configure temperature, max output tokens, etc.
      //   temperature: 0.7, // Example: Adjust for more creative or factual responses
      //   maxOutputTokens: 2048,
      // },
      // safetySettings: [ // Optional: configure safety settings
      //   { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      // ],
    });

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        for await (const chunk of streamResult.stream) {
          // Adjusted to handle potential lack of 'candidates' or other parts of the structure
          const text = chunk?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            controller.enqueue(encoder.encode(text));
          }
        }
        controller.close();
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Error in /api/chat:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// export const runtime = 'edge';
