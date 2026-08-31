#!/usr/bin/env node

/**
 * Test script to verify Groq API works with the new model names
 * Usage: Set GROQ_API_KEY environment variable and run: node test-groq-api.js
 */

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

// Test models
const MODELS = [
  "llama-3.1-8b-versatile",
  "llama-3.1-70b-versatile"
];

async function testGroqAPI(apiKey, model) {
  console.log(`\n📝 Testing model: ${model}`);
  console.log("=".repeat(50));

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant. Respond in JSON format."
          },
          {
            role: "user",
            content: "Say hello in JSON format with a greeting field."
          }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error(`❌ API Error (${response.status}):`, error);
      return false;
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    console.log("✅ API Response successful!");
    console.log("📦 Response:", content);
    return true;

  } catch (error) {
    console.error("❌ Request failed:", error.message);
    return false;
  }
}

async function runTests() {
  const apiKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;
  
  if (!apiKey) {
    console.error("❌ Error: GROQ_API_KEY or VITE_GROQ_API_KEY environment variable not set");
    console.error("Get a free key from https://console.groq.com/keys");
    process.exit(1);
  }

  console.log("🚀 Starting Groq API Model Tests");
  console.log("=".repeat(50));
  console.log(`API Key configured: ${apiKey.substring(0, 8)}...${apiKey.substring(-8)}`);

  let results = [];
  for (const model of MODELS) {
    const success = await testGroqAPI(apiKey, model);
    results.push({ model, success });
    // Add a small delay between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("📊 Test Summary:");
  console.log("=".repeat(50));
  
  results.forEach(({ model, success }) => {
    const status = success ? "✅ PASS" : "❌ FAIL";
    console.log(`${status}: ${model}`);
  });

  const allPassed = results.every(r => r.success);
  console.log("\n" + (allPassed ? "🎉 All tests passed!" : "⚠️  Some tests failed"));
  
  process.exit(allPassed ? 0 : 1);
}

runTests().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});
