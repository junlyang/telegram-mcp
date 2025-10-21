import "dotenv/config.js";
import axios from "axios";
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

if (!BOT_TOKEN || !CHAT_ID) {
  console.error(
    "Error: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID environment variables are required"
  );
  process.exit(1);
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
    console.error(`[DEBUG] Sending to URL: ${url}`);
    console.error(`[DEBUG] Chat ID: ${CHAT_ID}`);
    console.error(`[DEBUG] Message length: ${message.length}`);

    const params: Record<string, string> = {
      chat_id: CHAT_ID,
      text: message,
    };

    if (parse_mode) {
      params.parse_mode = parse_mode;
    }

    console.error(`[DEBUG] Params:`, params);
    const response = await axios.post(url, params);
    console.error(`[DEBUG] Response status:`, response.status);
    console.error(`[DEBUG] Response data:`, response.data);

    if (!response.data.ok) {
      throw new Error(
        `Telegram API returned error: ${(response.data.description as string) || "Unknown error"}`
      );
    }

    const result = response.data.result as Record<string, unknown>;
    return `Message sent successfully to Telegram. Message ID: ${result.message_id}`;
  } catch (error) {
    console.error(`[ERROR] Catch block error:`, error);
    if (axios.isAxiosError(error)) {
      const errorMessage =
        error.response?.data?.description || error.message || "Unknown error";
      console.error(`[ERROR] Axios error: ${errorMessage}`);
      throw new Error(`Failed to send Telegram message: ${errorMessage}`);
    }
    if (error instanceof Error) {
      console.error(`[ERROR] Error instance: ${error.message}`);
      throw new Error(`Failed to send Telegram message: ${error.message}`);
    }
    console.error(`[ERROR] Unknown error type`);
    throw new Error("Failed to send Telegram message: Unknown error");
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
      if (error instanceof z.ZodError) {
        return {
          type: "text",
          text: `Invalid input: ${error.errors.map((e) => e.message).join(", ")}`,
        };
      }
      if (error instanceof Error) {
        return {
          type: "text",
          text: `Error: ${error.message}`,
        };
      }
      return {
        type: "text",
        text: "Error: Unknown error occurred",
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
  console.error("Telegram MCP server started successfully");
  console.error(`Chat ID: ${CHAT_ID}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
