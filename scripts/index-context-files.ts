import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import { config } from "dotenv";

config(); // Load environment variables from .env file

const pineconeApiKey = process.env.PINECONE_API_KEY;
if (!pineconeApiKey) {
  throw new Error("Missing PINECONE_API_KEY environment variable.");
}
const geminiApiKey = process.env.GEMINI_API_KEY;
if (!geminiApiKey) {
  throw new Error("Missing GEMINI_API_KEY environment variable.");
}

const pc = new Pinecone({ apiKey: pineconeApiKey });
const genAI = new GoogleGenerativeAI(geminiApiKey);
const embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" });
const indexName = "developer-quickstart-js";
const namespace = "local-context";

// --- Function to Recursively Read Files ---
function getFilesRecursive(dirPath: string): string[] {
  let filePaths: string[] = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      filePaths = filePaths.concat(getFilesRecursive(fullPath));
    } else if (
      entry.isFile() &&
      (entry.name.endsWith(".md") || entry.name.endsWith(".txt"))
    ) {
      filePaths.push(fullPath);
    }
  }
  return filePaths;
}

async function main() {
  console.log("Starting context indexing process...");

  try {
    const contextDir = path.resolve(process.cwd(), "context");
    const filesToIndex = getFilesRecursive(contextDir);

    if (filesToIndex.length === 0) {
      console.log(
        "No .md or .txt files found in the context directory. Exiting."
      );
      return;
    }

    console.log(`Found ${filesToIndex.length} files to index.`);

    // Check if the index exists. If it does, delete it and recreate it
    // to ensure the dimensions are correct for the Gemini embedding model.
    const indexList = await pc.listIndexes();
    if (indexList.indexes?.some((index) => index.name === indexName)) {
      console.log(`Index "${indexName}" already exists. Deleting it...`);
      await pc.deleteIndex(indexName);
      console.log(
        `Index "${indexName}" deleted. Waiting for deletion to complete...`
      );
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds
    }

    console.log(`Creating new index "${indexName}" with dimension 768...`);
    await pc.createIndex({
      name: indexName,
      dimension: 768, // Gemini embedding-001 dimension
      metric: "cosine",
      spec: {
        serverless: {
          cloud: "aws",
          region: "us-east-1",
        },
      },
    });
    console.log(
      `Index "${indexName}" created successfully. Waiting for it to be ready...`
    );
    await new Promise((resolve) => setTimeout(resolve, 15000)); // Wait for index to be ready

    const index = pc.Index(indexName);

    // Chunking and embedding logic
    console.log("Generating embeddings and preparing records...");
    const records = [];
    const chunkSize = 1500; // characters
    const overlap = 200; // characters

    for (const filePath of filesToIndex) {
      const fileContent = fs.readFileSync(filePath, "utf-8").trim();
      if (!fileContent) {
        console.warn(`Skipping empty file: ${filePath}`);
        continue;
      }
      const relativePath = path.relative(process.cwd(), filePath);
      const fileId = relativePath
        .replace(/[\/\\]/g, "-")
        .replace(/[^a-zA-Z0-9_-]/g, "");

      // Determine role from file path
      let role = "general"; // Default role
      if (relativePath.startsWith("context/internal/managers")) {
        role = "managers";
      } else if (relativePath.startsWith("context/internal/franchising")) {
        role = "franchising";
      } else if (relativePath.startsWith("context/public")) {
        role = "public";
      }

      console.log(`Processing and chunking: ${relativePath} (Role: ${role})`);

      for (let i = 0; i < fileContent.length; i += chunkSize - overlap) {
        const chunk = fileContent.substring(i, i + chunkSize);
        if (!chunk) continue;

        const chunkId = `${fileId}-chunk-${Math.floor(
          i / (chunkSize - overlap)
        )}`;

        // Generate embedding using Gemini
        console.log(`  - Embedding chunk: ${chunkId}`);
        const embeddingResult = await embeddingModel.embedContent(chunk);
        const embedding = embeddingResult.embedding.values;

        records.push({
          id: chunkId,
          values: embedding,
          metadata: {
            chunk_text: chunk,
            category: "local-file",
            source: relativePath,
            role: role,
          },
        });
      }
    }

    console.log(
      `Preparing to upsert ${records.length} records into namespace "${namespace}"...`
    );

    const ns = index.namespace(namespace);

    // Upsert records to Pinecone in batches
    const batchSize = 90;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      console.log(`Upserting batch of ${batch.length} records...`);
      await ns.upsert(batch);
    }

    console.log("Successfully upserted all records into Pinecone.");

    // Optional: Check index stats
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait for indexing
    const stats = await index.describeIndexStats();
    console.log("Index stats:", stats);
  } catch (error) {
    console.error("An error occurred during the indexing process:", error);
  }
}

main();
