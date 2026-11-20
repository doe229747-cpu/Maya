import "dotenv/config";

import express, { type NextFunction, type Request, type Response } from "express";
import { GoogleGenAI } from "@google/genai";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const port = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === "production";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const model = process.env.GEMINI_MODEL || "gemini-4-hydrogen";

app.disable("x-powered-by");
app.use(express.json({ limit: "128kb" }));
app.use((_request, response, next) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "same-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

const requestBuckets = new Map<string, { count: number; resetAt: number }>();

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    configured: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
  });
});

app.post("/api/chat", async (request, response) => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    response.status(503).json({
      error:
        "Brakuje GEMINI_API_KEY. W AI Studio dodaj go w Settings → Secrets, a lokalnie skopiuj .env.example do .env.",
    });
    return;
  }

  const now = Date.now();
  const clientId = request.ip || "unknown";
  const bucket = requestBuckets.get(clientId);
  if (!bucket || bucket.resetAt <= now) {
    requestBuckets.set(clientId, { count: 1, resetAt: now + 60_000 });
  } else if (bucket.count >= 20) {
    response
      .status(429)
      .setHeader("Retry-After", Math.ceil((bucket.resetAt - now) / 1000))
      .json({ error: "Zbyt wiele zapytań. Spróbuj ponownie za chwilę." });
    return;
  } else {
    bucket.count += 1;
  }

  const { messages, tone = "ciepły i rzeczowy" } = request.body as {
    messages?: unknown;
    tone?: unknown;
  };

  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 30) {
    response.status(400).json({ error: "Wiadomości muszą być listą zawierającą od 1 do 30 wpisów." });
    return;
  }

  const validMessages = messages.every(
    (message) =>
      typeof message === "object" &&
      message !== null &&
      "role" in message &&
      "content" in message &&
      (message.role === "user" || message.role === "assistant") &&
      typeof message.content === "string" &&
      message.content.trim().length > 0 &&
      message.content.length <= 10_000,
  );

  if (!validMessages || typeof tone !== "string" || tone.length > 100) {
    response.status(400).json({ error: "Nieprawidłowe dane rozmowy." });
    return;
  }

  const transcript = messages
    .slice(-20)
    .map((message: { role: string; content: string }) =>
      `${message.role === "user" ? "Użytkownik" : "Maya"}: ${message.content.trim()}`,
    )
    .join("\n\n");

  try {
    const ai = new GoogleGenAI({ apiKey });
    const interaction = await ai.interactions.create({
      model,
      input: `Kontynuuj rozmowę jako Maya, polskojęzyczny kreatywny partner. Ton: ${tone}.
Odpowiadaj bezpośrednio, konkretnie i z uwagą na kontekst. Nie przedstawiaj fikcyjnych działań jako wykonanych.

${transcript}`,
    });

    const text = interaction.outputs
      ?.filter((output) => output.type === "text")
      .map((output) => output.text)
      .join("\n")
      .trim();
    if (!text) {
      throw new Error("Gemini zwróciło pustą odpowiedź.");
    }
    response.json({ reply: text });
  } catch (error) {
    console.error("Gemini request failed:", error);
    response.status(502).json({
      error:
        "Maya nie mogła połączyć się z Gemini. Sprawdź klucz API, limit zapytań i wybrany model.",
    });
  }
});

if (isProduction) {
  app.use(express.static(path.join(root, "dist"), { index: false }));
  app.get("/{*path}", (_request, response) => {
    response.sendFile(path.join(root, "dist", "index.html"));
  });
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    root,
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  console.error("Server error:", error);
  response.status(500).json({ error: "Wystąpił nieoczekiwany błąd serwera." });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Maya Creative działa na http://localhost:${port}`);
});
