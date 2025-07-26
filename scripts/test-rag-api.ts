async function runTest(role: string, query: string) {
  const apiUrl = "http://localhost:3000/api/chat/rag";

  console.log(`\n--- Running test for ROLE: ${role} ---`);
  console.log(`Query: "${query}"`);

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: query,
        history: [],
        userRole: role,
      }),
    });

    if (!response.ok || !response.body) {
      console.error(`API request failed with status: ${response.status}`);
      const errorBody = await response.text();
      console.error("Error body:", errorBody);
      return;
    }

    console.log("\n--- API Response ---");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      const chunk = decoder.decode(value, { stream: true });
      process.stdout.write(chunk);
    }
    console.log("\n--- End of API Response ---");
  } catch (error) {
    console.error(
      `An error occurred while testing the RAG API for role ${role}:`,
      error
    );
  }
}

async function main() {
  const generalQuery = "O que fazer em caso de faltas frequentes?";
  const managerQuery = "Como cancelar um contrato?"; // Query for manager-specific context

  // Test 1: A manager asking a general question. Should get the general context.
  await runTest("managers", generalQuery);

  // Test 2: A manager asking a manager-specific question. Should get manager context.
  await runTest("managers", managerQuery);

  // Test 3: A different role (e.g., physio) asking a manager-specific question. Should NOT get manager context.
  await runTest("physio", managerQuery);
}

main();
