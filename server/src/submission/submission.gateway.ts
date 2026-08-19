import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from "@nestjs/websockets";
import { JwtService } from "@nestjs/jwt";
import type { IncomingMessage } from "http";
import { Server, WebSocket } from "ws";
import { PrismaService } from "../prisma/prisma.service";

type SocketUser = { id: number; role: string };
const MAX_SUBSCRIPTIONS_PER_CLIENT = 10;

@WebSocketGateway({ path: "/ws/submissions" })
export class SubmissionGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // 内存存储映射：submissionId -> WebSocket 客户端 Set 集合
  private clientsMap = new Map<number, Set<WebSocket>>();
  private clientSubscriptions = new Map<WebSocket, Set<number>>();
  private clientAuth = new WeakMap<WebSocket, Promise<SocketUser | null>>();

  constructor(
    private jwt: JwtService,
    private prisma: PrismaService,
  ) {}

  createTicket(userId: number) {
    return {
      ticket: this.jwt.sign(
        { sub: userId, purpose: "submission-ws" },
        { expiresIn: "60s", audience: "submission-ws" },
      ),
      expiresIn: 60,
    };
  }

  async handleConnection(client: WebSocket, request: IncomingMessage) {
    const authentication = this.authenticate(request);
    this.clientAuth.set(client, authentication);
    const user = await authentication;
    if (!user) client.close(1008, "Unauthorized");
  }

  private async authenticate(request: IncomingMessage): Promise<SocketUser | null> {
    try {
      const url = new URL(request.url || "", "http://localhost");
      const ticket = url.searchParams.get("ticket");
      if (!ticket) return null;
      const payload = await this.jwt.verifyAsync<{ sub: number; purpose: string }>(ticket, {
        audience: "submission-ws",
      });
      if (payload.purpose !== "submission-ws" || !Number.isInteger(payload.sub)) return null;
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, role: true, status: true, isActive: true },
      });
      if (!user || !user.isActive || user.status !== "APPROVED") return null;
      return { id: user.id, role: user.role };
    } catch {
      return null;
    }
  }

  handleDisconnect(client: WebSocket) {
    const subscriptions = this.clientSubscriptions.get(client);
    for (const subId of subscriptions || []) {
      const clients = this.clientsMap.get(subId);
      clients?.delete(client);
      if (clients?.size === 0) {
        this.clientsMap.delete(subId);
      }
    }
    this.clientSubscriptions.delete(client);
  }

  @SubscribeMessage("subscribe")
  async handleSubscribe(client: WebSocket, data: { submissionId: number }) {
    if (!data || !data.submissionId) return;
    const subId = Number(data.submissionId);
    if (!Number.isInteger(subId) || subId < 1) return;

    const user = await this.clientAuth.get(client);
    if (!user) {
      client.close(1008, "Unauthorized");
      return;
    }
    const submission = await this.prisma.submission.findUnique({
      where: { id: subId },
      select: { userId: true },
    });
    const privileged = user.role === "ADMIN" || user.role === "TEACHER";
    if (!submission || (submission.userId !== user.id && !privileged)) {
      client.send(JSON.stringify({ event: "error", data: { message: "Forbidden" } }));
      return;
    }

    let subscriptions = this.clientSubscriptions.get(client);
    if (!subscriptions) {
      subscriptions = new Set();
      this.clientSubscriptions.set(client, subscriptions);
    }
    if (!subscriptions.has(subId) && subscriptions.size >= MAX_SUBSCRIPTIONS_PER_CLIENT) {
      client.send(JSON.stringify({ event: "error", data: { message: "Too many subscriptions" } }));
      return;
    }

    let clients = this.clientsMap.get(subId);
    if (!clients) {
      clients = new Set();
      this.clientsMap.set(subId, clients);
    }
    clients.add(client);
    subscriptions.add(subId);
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
    this.clientSubscriptions.get(client)?.delete(subId);
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
