import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface McpSchema {
  name: string;
  description: string;
  tools: Array<{
    name: string;
    description: string;
    path: string;
    method: string;
    parameters: Record<string, { type: string; items?: { type: string }; description: string; required?: boolean }>;
  }>;
}



async function getMcpSchema(): Promise<McpSchema> {
  const response = await fetch(`${BACKEND_URL}/.well-known/mcp.json`);
  if (!response.ok) {
    throw new Error(`Failed to fetch MCP schema: ${response.statusText}`);
  }
  return response.json();
}

interface ToolArgs {
  colors?: string[];
  city?: string;
  min_price?: number;
  max_price?: number;
}

async function callTool(toolName: string, args: ToolArgs) {
  if (toolName === 'list_products') {
    const queryParams = new URLSearchParams();
    if (args.colors) {
      args.colors.forEach(color => queryParams.append('colors', color));
    }
    if (args.city) {
      queryParams.append('city', args.city);
    }
    if (args.min_price) {
      queryParams.append('min_price', args.min_price.toString());
    }
    if (args.max_price) {
      queryParams.append('max_price', args.max_price.toString());
    }
    const response = await fetch(`${BACKEND_URL}/products?${queryParams.toString()}`);
    if (!response.ok) {
      throw new Error(`Failed to call list_products: ${response.statusText}`);
    }
    return response.json();
  }
  throw new Error(`Unknown tool: ${toolName}`);
}

export async function POST(request: Request) {
  try {
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    const mcpSchema: McpSchema = await getMcpSchema();

    const tools: ChatCompletionTool[] = mcpSchema.tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: tool.parameters,
          required: Object.keys(tool.parameters || {}).filter((key: string) => tool.parameters[key].required),
        },
      },
    }));

    const messages: ChatCompletionMessageParam[] = [
      { role: 'user', content: text },
    ];

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      tools,
      tool_choice: 'auto',
    });

    const responseMessage = response.choices[0].message;

    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      const toolCall = responseMessage.tool_calls[0];
      const toolName = toolCall.function.name;
      const toolArgs = JSON.parse(toolCall.function.arguments || '{}');

      const toolResult = await callTool(toolName, toolArgs);

      messages.push(responseMessage);
      messages.push({
        tool_call_id: toolCall.id,
        role: 'tool',
        content: JSON.stringify(toolResult),
      });

      const secondResponse = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
      });

      return NextResponse.json({ response: secondResponse.choices[0].message.content });

    } else {
      return NextResponse.json({ response: responseMessage.content });
    }

  } catch (error) {
    console.error('Error in chat API:', error);
    return NextResponse.json({ error: 'Failed to process chat' }, { status: 500 });
  }
}