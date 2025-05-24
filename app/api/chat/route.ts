import { GoogleGenAI, Content } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import fs from "fs"; // For sync operations in readMarkdownFilesRecursive
import fsp from "fs/promises"; // For async operations in getContextForRole
import path from "path";
import { roleContextMapping } from "../../../src/config/roleContextMapping"; // Corrected import path
import { passwordRoleMap } from "../../../src/config/passwords"; // Added import

// --- Function to Recursively Read Markdown Files ---
function readMarkdownFilesRecursive(dirPath: string): string {
  let combinedContent = "";
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        // Recurse into subdirectory, adding its content
        combinedContent += readMarkdownFilesRecursive(fullPath);
      } else if (
        entry.isFile() &&
        (entry.name.endsWith(".md") || entry.name.endsWith(".txt"))
      ) {
        // Include .txt files
        try {
          const fileContent = fs.readFileSync(fullPath, "utf-8");
          // Add filename as a header for clarity in the combined context
          combinedContent += `\n\n--- Context from ${entry.name} ---\n\n${fileContent}`;
        } catch (readError) {
          console.error(`Error reading file ${fullPath}:`, readError);
          combinedContent += `\n\n--- Error loading context from ${entry.name} ---`;
        }
      }
    }
  } catch (dirError) {
    console.error(`Error reading directory ${dirPath}:`, dirError);
    // Add error message to the combined content if directory reading fails
    combinedContent += `\n\n--- Error accessing context directory ${path.basename(
      dirPath
    )} ---`;
  }
  return combinedContent;
}

// --- Load All Context ---
const contextDir = path.resolve(process.cwd(), "context");
// const allContextContent = readMarkdownFilesRecursive(contextDir).trim(); // This will be replaced by role-based context loading

// --- Function to Get Context Based on Role ---
async function getContextForRole(role: string): Promise<string> {
  console.log(`[getContextForRole] Called for role: "${role}"`); // Log: Role passed
  let combinedContext = "";
  const baseInstructionsPath = path.join(contextDir, "instructions.md");

  try {
    const instructionsContent = await fsp.readFile(
      baseInstructionsPath,
      "utf-8"
    );
    combinedContext += instructionsContent;
    console.log(
      `[getContextForRole] Added base instructions from instructions.md. Length: ${instructionsContent.length}. Total context length: ${combinedContext.length}`
    );
  } catch (error) {
    console.error("[getContextForRole] Error reading instructions.md:", error);
    combinedContext += "\n\n--- Error loading base instructions ---";
    // Decide if we should proceed without base instructions or throw
  }

  const roleConfig = roleContextMapping[role];
  console.log(
    `[getContextForRole] Loaded roleConfig for "${role}":`,
    JSON.stringify(roleConfig, null, 2)
  ); // Log: roleConfig

  if (!roleConfig) {
    console.warn(
      `[getContextForRole] Role "${role}" not found in roleContextMapping. Serving minimal context.`
    );
    // Optionally, load a default "public" context or just return base instructions
    // For now, just instructions + warning in logs. The API response might need a user-facing error later.
    combinedContext += `\n\n--- No specific context configured for role: ${role} ---`;
    console.log(
      `[getContextForRole] Final context for role "${role}" (not found). Total length: ${combinedContext.length}`
    );
    return combinedContext.trim();
  }

  // Process individual files
  console.log(
    `[getContextForRole] Processing individual files for role "${role}":`,
    roleConfig.files
  ); // Log: Files to be processed
  for (const filePath of roleConfig.files) {
    const fullPath = path.join(contextDir, filePath);
    console.log(`[getContextForRole] Attempting to read file: ${fullPath}`); // Log: Specific file being read
    try {
      const fileContent = await fsp.readFile(fullPath, "utf-8");
      const contextAddition = `\n\n--- Context from ${path.basename(
        filePath
      )} ---\n\n${fileContent}`;
      combinedContext += contextAddition;
      console.log(
        `[getContextForRole] Added content from file: ${filePath}. Length: ${fileContent.length}. Total context length: ${combinedContext.length}.`
      );
    } catch (error) {
      console.error(
        `[getContextForRole] Error reading mapped file ${fullPath} for role ${role}:`,
        error
      );
      combinedContext += `\n\n--- Error loading context from ${path.basename(
        filePath
      )} for role ${role} ---`;
    }
  }

  // Process directories
  console.log(
    `[getContextForRole] Processing directories for role "${role}":`,
    roleConfig.directories
  ); // Log: Directories to be processed
  for (const dir of roleConfig.directories) {
    const fullDirPath = path.join(contextDir, dir);
    console.log(
      `[getContextForRole] Attempting to read directory: ${fullDirPath}`
    ); // Log: Specific directory being read
    // readMarkdownFilesRecursive is synchronous, but it's called within an async function.
    // It internally handles its errors by appending messages to its return string.
    const directoryContent = readMarkdownFilesRecursive(fullDirPath);
    combinedContext += directoryContent;
    console.log(
      `[getContextForRole] Added content from directory: ${dir} (path: ${fullDirPath}). Length: ${directoryContent.length}. Total context length: ${combinedContext.length}.`
    );
  }

  // Construct a list of sources for the final log
  const contextSources = ["instructions.md"];
  if (roleConfig) {
    roleConfig.files.forEach((file) => contextSources.push(file));
    roleConfig.directories.forEach((directory) =>
      contextSources.push(directory + " (directory)")
    );
  }
  console.log(
    `[getContextForRole] Final combinedContext for role "${role}". Total length: ${
      combinedContext.length
    }. Sources: [${contextSources.join(", ")}]`
  );
  // Removed verbose logging of full context content
  return combinedContext.trim();
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
    // Extract password and selectedAdminRole along with message and history
    const { message, history, password, selectedAdminRole } = await req.json();

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

    const formattedHistory = formatHistory(history); // Original chat history from frontend

    // --- Determine Role and Load Specific Context ---
    let determinedRole = "public"; // Default role
    let userProvidedIdentifier = ""; // For logging/error messages

    if (selectedAdminRole && typeof selectedAdminRole === "string") {
      // Admin is logged in and has selected a role to impersonate
      // We need a way to verify this request is genuinely from an admin.
      // For now, we'll trust 'selectedAdminRole' if present.
      // In a real app, an admin token/session would validate this.
      if (roleContextMapping[selectedAdminRole]) {
        determinedRole = selectedAdminRole;
        userProvidedIdentifier = `admin-selected-role: ${selectedAdminRole}`;
      } else {
        console.warn(
          `Admin selected an invalid role: ${selectedAdminRole}. Defaulting to public.`
        );
        userProvidedIdentifier = `admin-selected-invalid-role: ${selectedAdminRole}`;
        // Potentially return an error to the admin user here
      }
    } else if (password && typeof password === "string") {
      const roleFromPassword = passwordRoleMap[password];
      if (roleFromPassword) {
        determinedRole = roleFromPassword;
        userProvidedIdentifier = "password"; // Don't log the actual password
      } else {
        console.warn("Invalid password provided. Defaulting to public role.");
        userProvidedIdentifier = "invalid-password";
        // Potentially return an error: "Invalid password"
        // For now, we fall back to 'public' context for failed password attempts.
        // This behavior might need adjustment based on security requirements (e.g., explicit error).
      }
    } else {
      // No password and no admin role selected, assume public access
      console.log("No password or admin role provided. Using public role.");
      userProvidedIdentifier = "none";
    }

    console.log(
      `Determined role: ${determinedRole} (based on: ${userProvidedIdentifier})`
    ); // Using userProvidedIdentifier

    const roleSpecificContext = await getContextForRole(determinedRole);
    console.log(
      `Context length for role ${determinedRole}: ${roleSpecificContext.length} characters`
    ); // Added for Task 2.4.2.1

    // --- Construct the system instruction using role-specific context ---
    const systemInstruction: Content = {
      role: "user",
      parts: [
        {
          text: `You are Safya, the Myo Clinic Staff Assistant AI. Your current role is ${determinedRole}. Base your responses on the following information provided for your role:\n${roleSpecificContext}`,
        },
      ],
    };
    const modelAcknowledgement: Content = {
      role: "model",
      parts: [{ text: "Verstanden." }],
    };

    // Combine system instruction, model acknowledgement, and actual chat history
    const fullHistory = [
      systemInstruction,
      modelAcknowledgement,
      ...formattedHistory,
    ];

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
