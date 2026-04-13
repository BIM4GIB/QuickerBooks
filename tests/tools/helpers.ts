import { vi } from "vitest";

export interface RegisteredTool {
  name: string;
  description: string;
  schema: Record<string, unknown>;
  handler: (args: any) => Promise<any>;
}

/**
 * Creates a mock McpServer that captures tool registrations.
 * Each call to server.tool() stores the tool in the returned map.
 */
export function createMockServer() {
  const tools = new Map<string, RegisteredTool>();

  const server = {
    tool: vi.fn((name: string, description: string, schema: any, handler: any) => {
      tools.set(name, { name, description, schema, handler });
    }),
  };

  return { server: server as any, tools };
}

/**
 * Creates a mock QuickBooksClient with vi.fn() for every method.
 */
export function createMockClient() {
  return {
    query: vi.fn(),
    read: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    sendInvoice: vi.fn(),
    getCompanyInfo: vi.fn(),
    runReport: vi.fn(),
  } as any;
}
