import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from "@nestjs/websockets";
import { Server, WebSocket } from "ws";

@WebSocketGateway({ path: "/ws/submissions" })
export class SubmissionGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // 内存存储映射：submissionId -> WebSocket 客户端 Set 集合
  private clientsMap = new Map<number, Set<WebSocket>>();

  handleConnection(client: WebSocket) {
    // 客户端建立连接时，可以暂时不做操作或做日志记录
  }

  handleDisconnect(client: WebSocket) {
    // 当连接断开时，遍历映射表，彻底移除所有属于该客户端的订阅，防止连接泄露和内存泄露
    for (const [subId, clients] of this.clientsMap.entries()) {
      if (clients.has(client)) {
        clients.delete(client);
        if (clients.size === 0) {
          this.clientsMap.delete(subId);
        }
      }
    }
  }

  @SubscribeMessage("subscribe")
  handleSubscribe(client: WebSocket, data: { submissionId: number }) {
    if (!data || !data.submissionId) return;
    const subId = Number(data.submissionId);
    if (isNaN(subId)) return;

    let clients = this.clientsMap.get(subId);
    if (!clients) {
      clients = new Set();
      this.clientsMap.set(subId, clients);
    }
    clients.add(client);
  }

  @SubscribeMessage("unsubscribe")
  handleUnsubscribe(client: WebSocket, data: { submissionId: number }) {
    if (!data || !data.submissionId) return;
    const subId = Number(data.submissionId);
    if (isNaN(subId)) return;

    const clients = this.clientsMap.get(subId);
    if (clients) {
      clients.delete(client);
      if (clients.size === 0) {
        this.clientsMap.delete(subId);
      }
    }
  }

  /**
   * 服务端主动推送：在判题结果写库之后，定向向订阅该 submissionId 的所有前端客户发送通知
   */
  notifySubmissionUpdate(submissionId: number, data: any) {
    const clients = this.clientsMap.get(submissionId);
    if (clients && clients.size > 0) {
      const message = JSON.stringify({
        event: "update",
        data,
      });
      for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      }
    }
  }
}
