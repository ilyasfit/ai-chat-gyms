import { GoogleGenAI, Content } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import fs from "fs"; // Import Node.js file system module
import path from "path"; // Import Node.js path module

// --- Read Markdown Files ---
// Construct absolute paths relative to the current file's directory
const filesDir = path.resolve(process.cwd(), "public/files"); // Use process.cwd() for project root
const gymsPath = path.join(filesDir, "gyms.md");
const instructionsPath = path.join(filesDir, "instructions.md");

let gymsContent: string;
let instructionContent: string;

try {
  gymsContent = fs.readFileSync(gymsPath, "utf-8");
  instructionContent = fs.readFileSync(instructionsPath, "utf-8");
} catch (error) {
  console.error("Error reading markdown files:", error);
  // Set default content or re-throw error depending on desired behavior
  gymsContent = "Gyms information could not be loaded.";
  instructionContent = "Instructions could not be loaded.";
  // Optionally: throw new Error("Failed to load essential markdown content.");
}

// Ensure the API key is available
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("Missing GEMINI_API_KEY environment variable.");
}

// Correct instantiation: Pass API key within an options object per docs
const genAI = new GoogleGenAI({ apiKey: apiKey }); // Reverted to correct instantiation per docs

// --- Helper Function to format frontend history to Gemini history ---
// Frontend uses { role: 'user' | 'assistant', content: string }
// Gemini uses { role: 'user' | 'model', parts: [{ text: string }] }
function formatHistory(
  history: { role: "user" | "assistant"; content: string }[]
): Content[] {
  return history.map((msg) => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }],
  }));
}

// --- API Route Handler ---
export async function POST(req: NextRequest) {
  try {
    const { message, history } = await req.json();

    // --- Input Validation (Basic) ---
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

    const formattedHistory = formatHistory(history); // Original chat history from frontend (Use const)

    // --- Construct the system instruction text using file content read via fs ---
    const systemInstructionText = `You are Safya, the AI assistant, helping franchise partners open their Gym: ${instructionContent}\n\n---\n\nGym Information:\n${gymsContent}`;

    // --- Prepend System Instruction to History (Common Pattern) ---
    // Instead of config, add system instructions as the first turns in the history.
    const systemHistory: Content[] = [
      { role: "user", parts: [{ text: systemInstructionText }] },
      {
        role: "model",
        parts: [{ text: "Understood. I am Safya, ready to assist." }],
      }, // Simple acknowledgement
    ];

    // Combine system history with the actual chat history from the frontend
    const fullHistory = [...systemHistory, ...formattedHistory]; // Use const as it's not reassigned

    // --- Use generateContentStream directly (Stateless Approach) ---
    // Construct the 'contents' array expected by generateContentStream
    // It needs the full history PLUS the current user message as the last element
    const contents: Content[] = [
      ...fullHistory,
      { role: "user", parts: [{ text: message }] }, // Add current user message
    ];

    // Call generateContentStream instead of chat methods
    const streamResult = await genAI.models.generateContentStream({
      model: "gemini-2.0-flash",
      contents: contents, // Pass the full history + current message
      // Optional: Add safety settings if needed
      // safetySettings: [
      //   { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      //   // ... other categories
      // ],
      // Optional: Add generation config if needed
      // generationConfig: { maxOutputTokens: 200, temperature: 0.7 },
    });
    // Note: We are no longer using chat.sendMessageStream

    // --- Convert the async iterator from generateContentStream into a ReadableStream ---
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        // Iterate over the stream from generateContentStream
        // The structure of the stream response might be slightly different
        // Check Gemini SDK docs for generateContentStream response structure if needed
        // Iterate directly over streamResult, as it's the async generator
        for await (const chunk of streamResult) {
          // It's common for generateContentStream chunks to be nested, e.g., chunk.candidates[0].content.parts[0].text
          // Safely access potentially nested text
          const text = chunk?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            controller.enqueue(encoder.encode(text)); // Encode and send the text chunk
          }
        }
        controller.close();
      },
    });

    // --- Return the stream using a standard Response ---
    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8", // Or 'text/event-stream' if using SSE format
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

// --- Optional: Add configuration for edge runtime ---
// export const runtime = 'edge'; // Uncomment if deploying to Vercel Edge Functions
