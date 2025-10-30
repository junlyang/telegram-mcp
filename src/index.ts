import "dotenv/config.js";
import { execSync } from "child_process";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  Tool,
  TextContent,
} from "@modelcontextprotocol/sdk/types.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Configuration from environment variables
const BOT_TOKEN: string = process.env.TELEGRAM_BOT_TOKEN || "";
const CHAT_ID: string = process.env.TELEGRAM_CHAT_ID || "";

console.error(`[INIT] BOT_TOKEN loaded: ${BOT_TOKEN ? "yes" : "no"}`);
console.error(`[INIT] CHAT_ID loaded: ${CHAT_ID ? "yes" : "no"}`);

if (!BOT_TOKEN || !CHAT_ID) {
  console.error(
    "Error: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID environment variables are required"
  );
  process.exit(1);
}

// Logging setup
function log(message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} ${message}`;
  console.error(logMessage);
}

// Telegram API base URL
const TELEGRAM_API_BASE = "https://api.telegram.org";

// Input validation schema using Zod
const SendMessageSchema = z.object({
  message: z
    .string()
    .min(1, "Message cannot be empty")
    .max(4096, "Message exceeds Telegram's 4096 character limit"),
  parse_mode: z
    .enum(["HTML", "Markdown", "MarkdownV2"])
    .optional()
    .describe(
      "Optional formatting mode for the message. Defaults to plain text."
    ),
});

type SendMessageInput = z.infer<typeof SendMessageSchema>;

/**
 * Send a message to Telegram via the Telegram Bot API
 * @param message - The message text to send (max 4096 characters)
 * @param parse_mode - Optional formatting: HTML, Markdown, or MarkdownV2
 * @returns Success/error response
 */
async function sendTelegramMessage(
  message: string,
  parse_mode?: "HTML" | "Markdown" | "MarkdownV2"
): Promise<string> {
  try {
    const url = `${TELEGRAM_API_BASE}/bot${BOT_TOKEN}/sendMessage`;
    log(`[DEBUG] Sending to URL: ${url}`);
    log(`[DEBUG] Chat ID: ${CHAT_ID}`);
    log(`[DEBUG] Message length: ${message.length}`);

    // Build curl command with form data
    let curlCmd = `curl -s -X POST "${url}"`;
    curlCmd += ` -d "chat_id=${CHAT_ID}"`;
    curlCmd += ` -d "text=${message.replace(/"/g, '\\"')}"`;

    if (parse_mode) {
      curlCmd += ` -d "parse_mode=${parse_mode}"`;
    }

    log(`[DEBUG] Executing curl command`);

    // Execute curl and capture output
    const responseStr = execSync(curlCmd, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    log(`[DEBUG] Response: ${responseStr}`);

    const responseData = JSON.parse(responseStr) as Record<string, unknown>;
    log(`[DEBUG] Response.ok: ${responseData.ok}`);
    log(`[DEBUG] Response.description: ${responseData.description}`);

    if (!responseData.ok) {
      const errorDesc = (responseData.description as string) || "Unknown error";
      throw new Error(`Telegram API error: ${errorDesc}`);
    }

    const result = responseData.result as Record<string, unknown>;
    log(`[DEBUG] Message ID: ${result.message_id}`);
    return `Message sent successfully to Telegram. Message ID: ${result.message_id}`;
  } catch (error) {
    let errorDetails = "";

    if (error instanceof Error) {
      errorDetails = error.message;
      log(`[ERROR] ${errorDetails}`);
      throw error;
    }

    errorDetails = `Unknown error: ${JSON.stringify(error)}`;
    log(`[ERROR] ${errorDetails}`);
    throw new Error(errorDetails);
  }
}

/**
 * Process tool calls from the MCP client
 */
async function processToolCall(
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<TextContent> {
  if (toolName === "send_message") {
    try {
      // Validate input
      const validInput = SendMessageSchema.parse(toolInput);

      // Send the message
      const result = await sendTelegramMessage(
        validInput.message,
        validInput.parse_mode
      );

      return {
        type: "text",
        text: result,
      };
    } catch (error) {
      let errorMessage = "Unknown error occurred";

      if (error instanceof z.ZodError) {
        errorMessage = `Invalid input: ${error.errors
          .map((e) => e.message)
          .join(", ")}`;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      } else {
        errorMessage = JSON.stringify(error);
      }

      console.error(`[TOOL ERROR] ${errorMessage}`);

      return {
        type: "text",
        text: `Error: ${errorMessage}`,
      };
    }
  }

  return {
    type: "text",
    text: `Unknown tool: ${toolName}`,
  };
}

// Initialize the MCP server with capabilities
const server = new Server(
  {
    name: "telegram-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handler for listing available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools: Tool[] = [
    {
      name: "send_message",
      description:
        "Send a message to a Telegram chat. Configure the bot token and chat ID via environment variables TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.",
      inputSchema: {
        type: "object",
        properties: {
          message: {
            type: "string",
            description:
              "The message to send (max 4096 characters). Can contain newlines and special characters.",
            example: "Hello from Telegram MCP!",
          },
          parse_mode: {
            type: "string",
            enum: ["HTML", "Markdown", "MarkdownV2"],
            description:
              "Optional text formatting mode. Use HTML for <b>bold</b> and <i>italic</i>, Markdown for **bold** and *italic*",
            example: "HTML",
          },
        },
        required: ["message"],
      },
    },
  ];

  return { tools };
});

// Handler for tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const result = await processToolCall(
    request.params.name,
    (request.params.arguments as Record<string, unknown>) || {}
  );
  return {
    content: [result],
  };
});

// Start the server via stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log("Telegram MCP server started successfully");
  log(`Chat ID: ${CHAT_ID}`);
}

main().catch((error) => {
  log(`Fatal error: ${JSON.stringify(error)}`);
  process.exit(1);
});
