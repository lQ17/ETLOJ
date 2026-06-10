import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { WsAdapter } from "@nestjs/platform-ws";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useWebSocketAdapter(new WsAdapter(app) as any);

  app.setGlobalPrefix("api");
  // 限制 CORS 来源，仅允许开发环境和服务器域名
  const allowedOrigins = [
    "http://localhost:5173",
    process.env.CLIENT_ORIGIN, // 服务器域名，如 http://your-server-ip
  ].filter(Boolean);
  app.enableCors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PATCH", "DELETE"],
    credentials: true,
  });
  
  // Increase payload limit for Base64 image uploads and large testcase sets
  const express = require('express');
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    })
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Server running on http://localhost:${port}`);
}
bootstrap();
