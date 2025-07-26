import { GoogleGenAI, Content } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import fs from "fs"; // For sync operations in readMarkdownFilesRecursive
import fsp from "fs/promises"; // For async operations in getContextForRole
import path from "path";
import { rolesConfiguration } from "../../../src/config/roleContextMapping";
import { passwordRoleMap } from "../../../src/config/passwords";

// --- Function to Recursively Read Markdown Files (with exclusion) ---
function readMarkdownFilesRecursive(
  dirPath: string,
  excludeFiles: string[] = []
): string {
  let combinedContent = "";
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        combinedContent += readMarkdownFilesRecursive(fullPath, excludeFiles);
      } else if (
        entry.isFile() &&
        (entry.name.endsWith(".md") || entry.name.endsWith(".txt")) &&
        !excludeFiles.includes(entry.name)
      ) {
        try {
          const fileContent = fs.readFileSync(fullPath, "utf-8");
          combinedContent += `\n\n--- Context from ${entry.name} ---\n\n${fileContent}`;
        } catch (readError) {
          console.error(`Error reading file ${fullPath}:`, readError);
          combinedContent += `\n\n--- Error loading context from ${entry.name} ---`;
        }
      }
    }
  } catch (dirError) {
    console.error(`Error reading directory ${dirPath}:`, dirError);
    combinedContent += `\n\n--- Error accessing context directory ${path.basename(
      dirPath
    )} ---`;
  }
  return combinedContent;
}

// --- Interface for Role Context ---
interface RoleContext {
  instructions: string;
  additionalDocuments: string;
}

// --- Function to Get Context Based on Role ---
async function getContextForRole(role: string): Promise<RoleContext> {
  console.log(`[getContextForRole] Called for role: "${role}"`);
  let instructions = "";
  let additionalDocuments = "";
  const internalContextDir = path.resolve(process.cwd(), "context/internal");
  const publicContextDir = path.resolve(process.cwd(), "context/public");

  const roleSettings = rolesConfiguration[role];

  if (role === "public") {
    console.log(
      `[getContextForRole] Role is "public". Loading context from ${publicContextDir}`
    );
    const publicInstructionsPath = path.join(
      publicContextDir,
      "instructions.md"
    );
    try {
      instructions = await fsp.readFile(publicInstructionsPath, "utf-8");
      console.log(
        `[getContextForRole] Loaded public instructions.md. Length: ${instructions.length}`
      );
      // Load other files from public, excluding instructions.md
      if (fs.existsSync(publicContextDir)) {
        additionalDocuments += readMarkdownFilesRecursive(publicContextDir, [
          "instructions.md",
        ]);
      }
    } catch {
      console.warn(
        `[getContextForRole] Public instructions.md not found at ${publicInstructionsPath}. Using default public prompt.`
      );
      instructions =
        "You are MYA, a helpful AI assistant for Myo Clinic. Please be friendly, professional, and assist users with their public inquiries. 😊";
      // Load all files from public if instructions.md wasn't found
      if (fs.existsSync(publicContextDir)) {
        additionalDocuments += readMarkdownFilesRecursive(publicContextDir);
      }
    }
    if (!fs.existsSync(publicContextDir)) {
      console.warn(
        `[getContextForRole] Public context directory not found: ${publicContextDir}`
      );
      additionalDocuments += "\n\n--- Public context directory not found ---";
    }
  } else if (roleSettings?.isInternal) {
    console.log(`[getContextForRole] Role "${role}" is internal.`);
    const baseInstructionsPath = path.join(
      internalContextDir,
      "instructions.md"
    );
    try {
      instructions = await fsp.readFile(baseInstructionsPath, "utf-8");
      console.log(
        `[getContextForRole] Added base internal instructions.md. Length: ${instructions.length}`
      );
    } catch {
      console.error(
        "[getContextForRole] Error reading internal instructions.md:"
      );
      instructions =
        "Error: Could not load primary instructions. Please contact support. Your role is: " +
        role; // Fallback
      additionalDocuments +=
        "\n\n--- Error loading internal base instructions ---";
    }

    // Add content from context/internal/general/, excluding instructions.md
    const generalContextPath = path.join(internalContextDir, "general");
    console.log(
      `[getContextForRole] Loading general internal context from ${generalContextPath}`
    );
    if (fs.existsSync(generalContextPath)) {
      additionalDocuments += readMarkdownFilesRecursive(generalContextPath, [
        "instructions.md",
      ]);
    } else {
      console.warn(
        `[getContextForRole] General internal context directory not found: ${generalContextPath}`
      );
      additionalDocuments +=
        "\n\n--- General internal context directory not found ---";
    }

    if (role === "admin_full_context") {
      console.log(
        `[getContextForRole] Role is "admin_full_context". Loading all internal role-specific directories.`
      );
      try {
        const internalEntries = await fsp.readdir(internalContextDir, {
          withFileTypes: true,
        });
        for (const entry of internalEntries) {
          // Exclude 'general' (already loaded) and 'instructions.md' (already primary prompt)
          if (entry.isDirectory() && entry.name !== "general") {
            const specificRolePath = path.join(internalContextDir, entry.name);
            console.log(
              `[getContextForRole] admin_full_context: Loading from ${specificRolePath}`
            );
            additionalDocuments += readMarkdownFilesRecursive(
              specificRolePath,
              ["instructions.md"]
            );
          }
        }
      } catch {
        console.error(
          `[getContextForRole] Error reading internal directories for admin_full_context:`
        );
        additionalDocuments +=
          "\n\n--- Error loading all internal contexts for admin ---";
      }
    } else {
      // Load specific role directory, e.g., context/internal/managers/, excluding instructions.md
      const roleSpecificPath = path.join(internalContextDir, role);
      console.log(
        `[getContextForRole] Loading specific context for role "${role}" from ${roleSpecificPath}`
      );
      if (fs.existsSync(roleSpecificPath)) {
        additionalDocuments += readMarkdownFilesRecursive(roleSpecificPath, [
          "instructions.md",
        ]);
      } else {
        console.warn(
          `[getContextForRole] Directory not found for role "${role}": ${roleSpecificPath}`
        );
        // No need to add error to additionalDocuments if dir just doesn't exist for a specific role
      }
    }
  } else {
    console.warn(
      `[getContextForRole] Role "${role}" not found or misconfigured. Defaulting to public context.`
    );
    // Fallback to public context logic (could be a copy of the public block above or a simpler default)
    instructions =
      "You are MYA, a helpful AI assistant. Your current role configuration is unclear. Please be generally helpful. Role attempted: " +
      role;
    if (fs.existsSync(publicContextDir)) {
      additionalDocuments += readMarkdownFilesRecursive(publicContextDir); // Load all public as fallback
    } else {
      additionalDocuments +=
        "\n\n--- Public context directory not found for fallback ---";
    }
  }

  console.log(
    `[getContextForRole] Final instructions for role "${role}". Length: ${instructions.length}`
  );
  console.log(
    `[getContextForRole] Final additional documents for role "${role}". Length: ${additionalDocuments.length}`
  );
  return {
    instructions: instructions.trim(),
    additionalDocuments: additionalDocuments.trim(),
  };
}

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("Missing GEMINI_API_KEY environment variable.");
}
const genAI = new GoogleGenAI({ apiKey: apiKey });

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
    const { message, history, password, selectedAdminRole } = await req.json();

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
    } else if (password && typeof password === "string") {
      const roleFromPassword = passwordRoleMap[password];
      if (roleFromPassword) {
        determinedRole = roleFromPassword;
        userProvidedIdentifier = "password";
      } else {
        console.warn("Invalid password provided. Defaulting to public role.");
        userProvidedIdentifier = "invalid-password";
      }
    } else {
      console.log("No password or admin role provided. Using public role.");
    }

    console.log(
      `Determined role: ${determinedRole} (based on: ${userProvidedIdentifier})`
    );

    const { instructions: systemPromptText, additionalDocuments } =
      await getContextForRole(determinedRole);

    console.log(
      `System prompt length for role ${determinedRole}: ${systemPromptText.length} characters`
    );
    console.log(
      `Additional documents length for role ${determinedRole}: ${additionalDocuments.length} characters`
    );

    const systemInstruction: Content = {
      role: "user", // System prompts are often sent as 'user' role in the first turn
      parts: [{ text: systemPromptText }],
    };
    const modelAcknowledgement: Content = {
      role: "model",
      parts: [{ text: "Verstanden." }], // Understood in German
    };

    const fullHistory: Content[] = [systemInstruction, modelAcknowledgement];

    if (additionalDocuments) {
      const supplementaryDocsMessage: Content = {
        role: "user", // Provide additional context as a user message
        parts: [
          {
            text: `Here are some additional documents and context relevant to your current role (${determinedRole}). Please use them to inform your responses:\n\n${additionalDocuments}`,
          },
        ],
      };
      const modelAcknowledgementForDocs: Content = {
        role: "model",
        parts: [
          {
            text: "Okay, I have the supplementary documents and will use them as needed.",
          },
        ],
      };
      fullHistory.push(supplementaryDocsMessage, modelAcknowledgementForDocs);
    }

    fullHistory.push(...formattedHistory);

    const contents: Content[] = [
      ...fullHistory,
      { role: "user", parts: [{ text: message }] },
    ];

    // --- Save the request payload to a JSON file ---
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
    // --- End of save ---

    const streamResult = await genAI.models.generateContentStream({
      model: "gemini-2.5-flash-lite", // Ensure this model name is correct
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
        for await (const chunk of streamResult) {
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
