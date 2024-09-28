import WebSocket from "ws";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid"; // Para gerar um identificador único

import { IWebClient } from "./interfaces/IWebClient";
import { IMessageCallback } from "./interfaces/IMessageCallback";
import { TEventCallback } from "./interfaces/TEventCallback";
import { EEventType } from "./interfaces/EEventType";
import { ICustomOptions } from "./interfaces/ICustomOptions";

// Carrega as variáveis de ambiente do arquivo .env
dotenv.config();
const isDebug = process.env.DEBUG === "true";

export class WebClient implements IWebClient {
  private ws: WebSocket | undefined;
  private reconnectAttempts = 0;
  private maxReconnectAttempts: number;
  private reconnectInterval: number;
  private timeoutDuration: number;
  private timeoutHandle: NodeJS.Timeout | undefined;
  private manualClose = false;
  private sessionId: string;
  private clientSession: string; // Novo hash de identificação
  private chatId: string | undefined; // Armazena o chatId

  constructor(
    private onMessageCallback: IMessageCallback,
    private onEventCallback?: TEventCallback,
    chatId?: string,
    private route: string = "/ws/chat"
  ) {
    this.sessionId = uuidv4();
    this.chatId = chatId;
    this.clientSession = uuidv4(); // Gerar um hash único para a sessão do cliente
    this.logDebug(
      `Sessão iniciada com ID: ${this.sessionId} e Client Session: ${this.clientSession}`
    );

    this.maxReconnectAttempts = parseInt(
      process.env.WS_MAX_RECONNECT_ATTEMPTS || "5",
      10
    );
    this.reconnectInterval = parseInt(
      process.env.WS_RECONNECT_INTERVAL || "3000",
      10
    );
    this.timeoutDuration = parseInt(
      process.env.WS_TIMEOUT_DURATION || "30000",
      10
    );

    this.connect();
  }

  // Adicionando a função setChatId
  setChatId(chatId: string) {
    this.chatId = chatId;
  }

  private logDebug(message: string) {
    if (isDebug) {
      console.log(`[DEBUG] ${message} (Session: ${this.sessionId})`);
    }
  }

  private resetTimeout() {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
    }

    this.timeoutHandle = setTimeout(() => {
      this.logDebug("Tempo limite atingido. Fechando conexão...");
      this.closeConnection();
    }, this.timeoutDuration);
  }

  private connect() {
    if (this.manualClose) {
      this.logDebug("Fechamento manual da conexão. Não será feita reconexão.");
      return;
    }

    const url = process.env.WS_URL || "ws://localhost";
    const port = process.env.WS_PORT || "8080";
    const fullUrl = `${url}:${port}${this.route}`;

    this.logDebug(`Conectando a ${fullUrl}`);

    const headers: Record<string, string> = {
      "Session-ID": this.sessionId,
      "Client-Session": this.clientSession, // Novo cabeçalho com a identificação do cliente
    };

    if (this.chatId) {
      headers["Chat-ID"] = this.chatId;
    }

    this.ws = new WebSocket(fullUrl, { headers });

    this.ws.on("open", () => {
      this.reconnectAttempts = 0;
      this.handleEvent(
        EEventType.CONNECTION,
        `Conexão aberta com sucesso. Session ID: ${this.sessionId}`
      );
      this.logDebug("Conexão WebSocket aberta com sucesso.");
      this.resetTimeout();
    });

    this.ws.on("message", (data) => {
      try {
        const message = data.toString();

        // Verifica se a mensagem inclui um novo chatId
        if (!this.chatId && message.startsWith("chatId:")) {
          this.chatId = message.split(":")[1].trim();
          this.logDebug(`Novo Chat-ID recebido: ${this.chatId}`);
        } else if (message.includes("conversationEnd")) {
          this.logDebug("Conversa finalizada pelo servidor. Fechando conexão...");
          this.closeConnection();
        } else {
          this.onMessageCallback.onSuccess(message);
          this.logDebug(`Mensagem recebida: ${message}`);
          this.resetTimeout();
        }
      } catch (err) {
        const errorMessage = `Erro ao processar a mensagem: ${(err as Error).message}`;
        this.onMessageCallback.onError(errorMessage);
        this.logDebug(errorMessage);
      }
    });

    this.ws.on("error", (err) => {
      const errorMessage = `Erro na conexão: ${(err as Error).message}`;
      this.handleEvent(EEventType.ERROR, errorMessage);
      this.logDebug(errorMessage);
      this.tryReconnect();
    });

    this.ws.on("close", () => {
      this.handleEvent(EEventType.CLOSE, "Conexão fechada.");
      this.logDebug("Conexão WebSocket fechada.");

      if (!this.manualClose) {
        this.tryReconnect();
      }
    });
  }

  private tryReconnect(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const reconnectMessage = `Tentativa de reconexão #${this.reconnectAttempts}`;
        this.handleEvent(EEventType.ERROR, reconnectMessage);
        this.logDebug(reconnectMessage);

        setTimeout(() => {
          this.connect();

          this.ws?.once("open", () => {
            this.reconnectAttempts = 0;
            this.logDebug("Reconectado com sucesso.");
            resolve(true);
          });

          this.ws?.once("error", () => {
            this.logDebug("Falha na reconexão.");
            resolve(false);
          });
        }, this.reconnectInterval);
      } else {
        this.logDebug("Número máximo de tentativas de reconexão atingido.");
        resolve(false);
      }
    });
  }

  private handleEvent(type: EEventType, data: string) {
    if (this.onEventCallback) {
      this.onEventCallback(type, data);
    }
  }

  sendMessage(message: string, options?: ICustomOptions) {
    const maxAttempts = options?.customMaxReconnectAttempts ?? this.maxReconnectAttempts;

    const payload = JSON.stringify({ message }); 

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(payload);
      this.logDebug(`Mensagem enviada: ${payload}`);
      this.resetTimeout();
    } else {
      const errorMessage = "Conexão WebSocket não está aberta.";
      this.onMessageCallback.onError(errorMessage);
      this.logDebug(errorMessage);

      if (this.reconnectAttempts < maxAttempts) {
        this.tryReconnect().then((reconnected: boolean) => {
          if (reconnected) {
            this.ws?.send(payload);
            this.logDebug(`Mensagem enviada após reconexão: ${payload}`);
            this.resetTimeout();
          } else {
            const error = "Não foi possível reconectar após múltiplas tentativas.";
            this.onMessageCallback.onError(error);
            this.logDebug(error);
          }
        });
      } else {
        const error = "Não foi possível enviar a mensagem após múltiplas tentativas de reconexão.";
        this.onMessageCallback.onError(error);
        this.logDebug(error);
      }
    }
  }

  closeConnection() {
    if (this.ws) {
      this.manualClose = true;
      this.ws.close();
      this.logDebug("Conexão WebSocket encerrada.");
    }
  }
}
