import net from "node:net";
import type { VectorCraftResponse } from "../types";

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
};

export class VectorCraftClient {
  private socket: net.Socket | null = null;
  private buffer = "";
  private nextId = 1;
  private pending = new Map<number, PendingRequest>();

  constructor(
    private readonly host: string,
    private readonly port: number,
    private readonly timeoutMs = 30000
  ) {}

  async connect(): Promise<void> {
    if (this.socket && !this.socket.destroyed) return;

    await new Promise<void>((resolve, reject) => {
      const socket = net.createConnection(
        { host: this.host, port: this.port },
        () => {
          this.socket = socket;
          resolve();
        }
      );

      socket.setNoDelay(true);

      socket.on("data", (chunk) => {
        this.buffer += chunk.toString("utf8");
        this.drainBuffer();
      });

      socket.on("error", (error) => {
        if (!this.socket) {
          reject(error);
          return;
        }

        for (const [id, request] of this.pending) {
          clearTimeout(request.timer);
          request.reject(error);
          this.pending.delete(id);
        }
      });

      socket.on("close", () => {
        for (const [id, request] of this.pending) {
          clearTimeout(request.timer);
          request.reject(
            new Error("VectorCraft control connection closed.")
          );
          this.pending.delete(id);
        }
        this.socket = null;
      });
    });
  }

  private drainBuffer() {
    for (;;) {
      const newline = this.buffer.indexOf("\n");
      if (newline < 0) return;

      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);

      if (!line) continue;

      let message: VectorCraftResponse;

      try {
        message = JSON.parse(line) as VectorCraftResponse;
      } catch {
        continue;
      }

      if (typeof message.id !== "number") continue;

      const request = this.pending.get(message.id);
      if (!request) continue;

      clearTimeout(request.timer);
      this.pending.delete(message.id);

      if (message.ok) {
        request.resolve(message.result);
      } else {
        request.reject(
          new Error(
            `VectorCraft request ${message.id} failed: ` +
            JSON.stringify(message.error)
          )
        );
      }
    }
  }

  async request<T = unknown>(
    method: string,
    params?: Record<string, unknown>
  ): Promise<T> {
    if (!this.socket || this.socket.destroyed) {
      throw new Error("VectorCraft client is not connected.");
    }

    const id = this.nextId++;

    const payload: Record<string, unknown> = {
      id,
      method
    };

    if (params !== undefined) {
      payload.params = params;
    }

    return await new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new Error(
            `VectorCraft request timed out after ${this.timeoutMs} ms: ${method}`
          )
        );
      }, this.timeoutMs);

      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
        timer
      });

      this.socket!.write(JSON.stringify(payload) + "\n");
    });
  }

  async execute<T = unknown>(
    command: string,
    params: Record<string, unknown> = {}
  ): Promise<T> {
    return await this.request<T>("engine.execute", {
      command,
      params
    });
  }

  async commands(): Promise<unknown> {
    return await this.request("engine.commands");
  }

  async inspect(
    depth = 2,
    childLimit = 200
  ): Promise<unknown> {
    return await this.request("document.inspect", {
      depth,
      childLimit
    });
  }

  close() {
    this.socket?.end();
    this.socket?.destroy();
    this.socket = null;
  }
}
