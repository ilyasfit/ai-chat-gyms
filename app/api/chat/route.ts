import { GoogleGenAI, Content } from "@google/genai"; // Reverted to correct import name per docs
// Remove StreamingTextResponse import from 'ai'
import { NextRequest, NextResponse } from "next/server";
import fs from "fs"; // Import fs for server-side file reading
import path from "path"; // Import path for constructing file paths

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

/**
 * Reads the content of a file relative to the project root.
 * @param relativePath - The path to the file relative to the project root (e.g., 'files/gyms.md').
 * @returns The content of the file as a string, or null if an error occurs.
 */
function readFileContent(relativePath: string): string | null {
  try {
    // Construct the absolute path from the project root
    const absolutePath = path.join(process.cwd(), relativePath);
    // Read the file synchronously
    return fs.readFileSync(absolutePath, "utf-8");
  } catch (error) {
    console.error(`Error reading file at ${relativePath}:`, error);
    // Return null or throw error, depending on desired handling
    return null;
  }
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

    const formattedHistory = formatHistory(history);

    // --- Read content from markdown files ---
    const gymsContent =
      readFileContent("files/gyms.md") || "Gyms information not found."; // Provide fallback
    const instructionContent =
      readFileContent("files/instructions.md") || "Instructions not found."; // Provide fallback

    // --- Construct the system instruction ---
    // Note: Adjusted the formatting slightly for clarity
    const systemInstruction = `You are Safya, the AI assistant, helping franchise partners open their Gym: ${instructionContent}\n\n---\n\nGym Information:\n${gymsContent}`;

    // --- Create a chat instance with history ---
    const chat = genAI.chats.create({
      model: "gemini-2.0-flash", // Use the specified model
      history: formattedHistory, // Pass the formatted history
      config: {
        systemInstruction: systemInstruction, // Use the combined content
      },
      // Optional: Add safety settings if needed
      // safetySettings: [
      //   { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      //   // ... other categories
      // ],
      // Optional: Add generation config if needed
      // generationConfig: { maxOutputTokens: 200, temperature: 0.7 },
    });

    // --- Send the current message and get the stream ---
    const streamResult = await chat.sendMessageStream({
      message: message, // Send only the current message text
    });

    // --- Convert the async iterator into a ReadableStream ---
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        // Iterate over the stream from chat.sendMessageStream
        for await (const chunk of streamResult) {
          // Access the text from the response chunk using chunk.text per docs
          const text = chunk.text; // Use chunk.text property per docs
          if (text) {
            controller.enqueue(encoder.encode(text));
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
