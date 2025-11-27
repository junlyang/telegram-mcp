import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ListToolsRequestSchema, CallToolRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
// Configuration from environment variables
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";
if (!BOT_TOKEN || !CHAT_ID) {
    console.error("Error: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID environment variables are required");
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
        .describe("Optional formatting mode for the message. Defaults to plain text."),
});
/**
 * Send a message to Telegram via the Telegram Bot API
 * @param message - The message text to send (max 4096 characters)
 * @param parse_mode - Optional formatting: HTML, Markdown, or MarkdownV2
 * @returns Success/error response
 */
async function sendTelegramMessage(message, parse_mode) {
    try {
        const url = `${TELEGRAM_API_BASE}/bot${BOT_TOKEN}/sendMessage`;
        const params = {
            chat_id: CHAT_ID,
            text: message,
        };
        if (parse_mode) {
            params.parse_mode = parse_mode;
        }
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(params),
        });
        if (!response.ok) {
            const errorData = (await response.json());
            const errorMessage = errorData.description || `HTTP ${response.status} error`;
            throw new Error(`Telegram API error: ${errorMessage}`);
        }
        const data = (await response.json());
        if (!data.ok) {
            throw new Error(`Telegram API returned error: ${data.description || "Unknown error"}`);
        }
        const result = data.result;
        return `Message sent successfully to Telegram. Message ID: ${result.message_id}`;
    }
    catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to send Telegram message: ${error.message}`);
        }
        throw new Error("Failed to send Telegram message: Unknown error");
    }
}
/**
 * Process tool calls from the MCP client
 */
async function processToolCall(toolName, toolInput) {
    if (toolName === "send_message") {
        try {
            // Validate input
            const validInput = SendMessageSchema.parse(toolInput);
            // Send the message
            const result = await sendTelegramMessage(validInput.message, validInput.parse_mode);
            return {
                type: "text",
                text: result,
            };
        }
        catch (error) {
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
// Initialize the MCP server
const server = new Server({
    name: "telegram-mcp",
    version: "1.0.0",
});
// Handler for listing available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = [
        {
            name: "send_message",
            description: "Send a message to a Telegram chat. Configure the bot token and chat ID via environment variables TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.",
            inputSchema: {
                type: "object",
                properties: {
                    message: {
                        type: "string",
                        description: "The message to send (max 4096 characters). Can contain newlines and special characters.",
                        example: "Hello from Telegram MCP!",
                    },
                    parse_mode: {
                        type: "string",
                        enum: ["HTML", "Markdown", "MarkdownV2"],
                        description: "Optional text formatting mode. Use HTML for <b>bold</b> and <i>italic</i>, Markdown for **bold** and *italic*",
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
    const result = await processToolCall(request.params.name, request.params.arguments || {});
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
//# sourceMappingURL=index.js.map