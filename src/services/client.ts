import type { WebSocket } from "ws";

export class Client {
  public readonly userId: string;
  private socket: WebSocket;

  constructor(socket: WebSocket, userId: string) {
    this.socket = socket;
    this.userId = userId;
  }

  send(payload: unknown) {
    if (this.socket.readyState === this.socket.OPEN) {
      this.socket.send(JSON.stringify(payload));
    }
  }
}
