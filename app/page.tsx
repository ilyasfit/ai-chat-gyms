"use client";

import { useState, useCallback, useEffect } from "react"; // Added useCallback, useEffect
// Import the main component and the type
import {
  V0AIChat,
  type Message as V0ChatMessage,
} from "@/components/ui/v0-ai-chat"; // Renamed import type
import { ThemeToggle } from "@/components/theme-toggle"; // Import ThemeToggle
import { Input } from "@/components/ui/input"; // Import Input
import { Button } from "@/components/ui/button"; // Import Button
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"; // Import Card components
import { ADMIN_UI_PASSWORD, passwordRoleMap } from "../src/config/passwords"; // Import ADMIN_UI_PASSWORD and passwordRoleMap

// Define a new Message type that allows AsyncIterable
type Message = Omit<V0ChatMessage, "content"> & {
  content: string | AsyncIterable<string>;
};

interface ChatRequestBody {
  message: string;
  history: Array<{ role: V0ChatMessage["role"]; content: string }>;
  selectedAdminRole?: string;
  password?: string;
}

// Define shimmer messages here as they are used for state in this component
const shimmerMessages = [
  "Safya is pondering your request...",
  "Processing with Safya's brilliance...",
  "Safya is crafting a response...",
  "Thinking deeply, Safya-style...",
  "Safya’s gears are turning...",
  "Hold on, Safya’s got this...",
  "Safya is working her magic...",
  "Analyzing with Safya’s wisdom...",
  "Safya’s thoughts are loading...",
  "Give Safya a moment to shine...",
];

export default function Home() {
  // Removed chatActive state as V0AIChat handles the layout now
  const [messages, setMessages] = useState<Message[]>([]); // Use the new Message type
  const [isLoading, setIsLoading] = useState(false);
  const [currentShimmerText, setCurrentShimmerText] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [selectedAdminRole, setSelectedAdminRole] =
    useState<string>("colaboradores"); // Default role
  const [currentDisplayRole, setCurrentDisplayRole] =
    useState<string>("Public"); // New state for displaying role
  const [loginError, setLoginError] = useState<string>(""); // State for login error messages

  // const CORRECT_PASSWORD = "myo-gym-2025"; // Removed, password check is now backend-driven for roles
  // const ADMIN_PASSWORD = "safya-admin-2024!"; // Replaced by imported ADMIN_UI_PASSWORD

  const adminRoles = [
    "colaboradores",
    "managers",
    "franchising",
    "public",
    "admin_full_context",
  ];

  const handlePasswordSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setLoginError(""); // Clear previous errors

    if (passwordInput === ADMIN_UI_PASSWORD) {
      setIsAdminAuthenticated(true);
      setIsAuthenticated(true);
      setCurrentDisplayRole(selectedAdminRole);
      setPasswordInput(""); // Clear password input on successful login
    } else if (passwordInput.trim() !== "") {
      const roleFromPassword = passwordRoleMap[passwordInput];
      if (roleFromPassword) {
        setIsAuthenticated(true);
        setIsAdminAuthenticated(false);
        setCurrentDisplayRole(roleFromPassword);
        setPasswordInput(""); // Clear password input on successful login
      } else {
        // Invalid password (not admin, not in map)
        setIsAuthenticated(false);
        setIsAdminAuthenticated(false);
        setLoginError("Invalid password.");
        // currentDisplayRole remains as it was (likely "Public" from initial state or logout)
      }
    } else {
      // Empty password
      setIsAuthenticated(false);
      setIsAdminAuthenticated(false);
      setLoginError("Password cannot be empty.");
      // currentDisplayRole remains as it was
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setIsAdminAuthenticated(false);
    setPasswordInput("");
    setMessages([]); // Clear messages on logout
    setCurrentDisplayRole("Public"); // Reset display role
    // Optionally, redirect to login or a public page if desired
    // router.push('/'); // Example redirect
  };

  useEffect(() => {
    if (isAdminAuthenticated) {
      setCurrentDisplayRole(selectedAdminRole);
    } else if (isAuthenticated) {
      // If just authenticated but not admin, keep "User (Password Entered)"
      // or update if more specific info becomes available.
      // For now, this is handled by handlePasswordSubmit.
    } else {
      setCurrentDisplayRole("Public");
    }
  }, [selectedAdminRole, isAdminAuthenticated, isAuthenticated]);

  const handleSendMessage = async (userMessageContent: string) => {
    // Removed setting chatActive

    const newUserMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: userMessageContent,
    };

    // Removed: setMessages((prev) => [...prev, newUserMessage]); // This was causing duplication
    setIsLoading(true);

    // Add an empty assistant message placeholder
    const assistantMessageId = (Date.now() + 1).toString();
    const newAssistantPlaceholder: Message = {
      id: assistantMessageId,
      role: "assistant",
      content: "", // Start with empty content
    };

    // Construct the history *including* the new user message
    const historyForAPI = [...messages, newUserMessage];

    // Update state first to add user message and placeholder
    setMessages((prevMessages) => [
      ...prevMessages,
      newUserMessage,
      newAssistantPlaceholder, // Correctly add only one user message and one placeholder
    ]);

    // Call the API *after* the state update, using the CORRECT history
    fetchAndStreamResponse(
      userMessageContent,
      historyForAPI as V0ChatMessage[], // Use correct history (cast needed)
      assistantMessageId,
      setMessages // Pass setter to update the specific message
    );
  };

  // Function to create the async iterable for the stream
  const createStreamIterable = useCallback(
    async function* (
      stream: ReadableStream<Uint8Array>,
      assistantMessageId: string,
      setMessagesFn: React.Dispatch<React.SetStateAction<Message[]>>
    ): AsyncIterable<string> {
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let firstChunkReceived = false; // Restore firstChunkReceived flag
      let accumulatedText = ""; // Accumulate text here

      try {
        while (true) {
          // isLoading is handled below now
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          if (!firstChunkReceived) {
            // Stop shimmer on first chunk by setting isLoading false globally
            setIsLoading(false);
            firstChunkReceived = true;
          }

          const chunkText = decoder.decode(value, { stream: true });
          accumulatedText += chunkText; // Append to accumulated text
          yield chunkText; // Restore yielding chunks for incremental rendering
        }
      } catch (error) {
        console.error("Error reading stream:", error);
        accumulatedText = "Sorry, something went wrong reading the stream."; // Set error message in accumulated text
        // Note: We'll update the state in the finally block
      } finally {
        // Ensure loading is false globally when stream ends/errors
        setIsLoading(false);
        // Update the message state with the FINAL accumulated string
        setMessagesFn((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: accumulatedText } // Replace iterable with final string
              : msg
          )
        );
      }
    },
    [] // No dependencies needed
  );

  // Separate function to handle fetching and setting up the stream iterable
  const fetchAndStreamResponse = async (
    userMessageContent: string,
    historyForAPI: V0ChatMessage[], // Use V0ChatMessage for API history
    assistantMessageId: string,
    setMessagesFn: React.Dispatch<React.SetStateAction<Message[]>> // Receive setter
  ) => {
    // Select random shimmer message while loading
    const randomShimmer =
      shimmerMessages[Math.floor(Math.random() * shimmerMessages.length)];
    setCurrentShimmerText(randomShimmer);
    setIsLoading(true); // Ensure loading is true before fetch
    try {
      const requestBody: ChatRequestBody = {
        message: userMessageContent,
        history: historyForAPI.map((msg) => ({
          role: msg.role,
          content:
            typeof msg.content === "string"
              ? msg.content
              : "Error: Content was not string", // Should ideally not happen with current logic
        })),
      };

      if (isAdminAuthenticated) {
        requestBody.selectedAdminRole = selectedAdminRole;
      } else {
        requestBody.password = passwordInput; // Send the user's attempted password
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error("Response body is null");
      }

      // Create the async iterable
      const streamIterable = createStreamIterable(
        response.body,
        assistantMessageId,
        setMessagesFn // Pass the setter down
      );

      // Update the specific assistant message content with the iterable
      setMessagesFn((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? { ...msg, content: streamIterable } // Assign the iterable here
            : msg
        )
      );

      // Note: isLoading is set to false inside createStreamIterable now
    } catch (error) {
      console.error("Error initiating stream:", error);
      // Update the specific message with an error state
      setMessagesFn((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: "Sorry, something went wrong initiating the stream.",
              }
            : msg
        )
      );
      setIsLoading(false); // Ensure loading is false on fetch error
    }
    // No finally block needed here for isLoading, handled in iterable or catch
  };

  // Single return statement with conditional rendering
  return (
    <>
      {!isAuthenticated ? (
        // Login Form Section using shadcn/ui components
        <div className="flex items-center justify-center min-h-screen bg-background px-4">
          {" "}
          {/* Use bg-background */}
          <Card className="w-full max-w-sm">
            {" "}
            {/* Use Card component */}
            <CardHeader>
              <CardTitle className="text-2xl text-center">
                {" "}
                {/* Use CardTitle */}
                Enter Password
              </CardTitle>
              {/* Optional: <CardDescription>Enter password to continue</CardDescription> */}
            </CardHeader>
            <form onSubmit={handlePasswordSubmit}>
              {" "}
              {/* Formular umschließt Content und Footer */}
              <CardContent className="space-y-4">
                {" "}
                {/* Use CardContent */}
                {loginError && (
                  <p className="text-sm text-red-500 text-center">
                    {loginError}
                  </p>
                )}
                <div className="space-y-2">
                  {/* Optional: Add a label if needed using "@/components/ui/label" */}
                  {/* <Label htmlFor="password">Password</Label> */}
                  <Input
                    id="password" // Add id for accessibility
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Password"
                    required
                    // Input Komponente verwendet bereits Theme-Variablen (bg-input, border, ring etc.)
                  />
                </div>
              </CardContent>
              <CardFooter>
                {" "}
                {/* Use CardFooter */}
                <Button type="submit" className="w-full mt-4 cursor-pointer">
                  {" "}
                  {/* Use Button component (primary variant by default) */}
                  Access
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      ) : (
        // Authenticated Chat Section
        // Use bg-background for Theme-Konsistenz as suggested
        <main className="relative bg-background">
          {/* Add ThemeToggle button and Role Display */}
          <div className="absolute top-4 right-4 z-10 flex items-center space-x-2">
            {isAuthenticated && (
              <div className="text-sm text-muted-foreground mr-2">
                Role: {currentDisplayRole.replace(/_/g, " ").toUpperCase()}
              </div>
            )}
            {isAuthenticated && ( // Show logout button only when authenticated
              <Button onClick={handleLogout} variant="outline" size="sm">
                Logout
              </Button>
            )}
            <ThemeToggle />
          </div>
          {isAdminAuthenticated && (
            <div
              style={{
                position: "fixed",
                bottom: "20px",
                left: "20px",
                zIndex: 1001,
                backgroundColor: "var(--background)",
                padding: "10px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
              }}
            >
              <label
                htmlFor="adminRoleSelect"
                className="block text-sm font-medium text-foreground mb-1"
              >
                Select Admin Role:
              </label>
              <select
                id="adminRoleSelect"
                value={selectedAdminRole}
                onChange={(e) => setSelectedAdminRole(e.target.value)}
                style={{
                  padding: "8px",
                  borderRadius: "4px",
                  color: "var(--foreground)",
                  backgroundColor: "var(--input)",
                  border: "1px solid var(--border)",
                }}
              >
                {adminRoles.map((role) => (
                  <option key={role} value={role}>
                    {role.replace(/_/g, " ").toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          )}
          <V0AIChat
            messages={messages as V0ChatMessage[]} // Cast messages for V0AIChat props
            isLoading={isLoading}
            currentShimmerText={currentShimmerText}
            onSendMessage={handleSendMessage}
          />
        </main>
      )}
    </>
  );
}
