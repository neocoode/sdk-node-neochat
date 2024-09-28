import { v4 as uuidv4 } from "uuid"; // Para gerar um identificador único
import { IWebClient } from "./interfaces/IWebClient";
import { IMessageCallback } from "./interfaces/IMessageCallback";
import { TEventCallback } from "./interfaces/TEventCallback";
import { EEventType } from "./interfaces/EEventType";
import { ICustomOptions } from "./interfaces/ICustomOptions";

// Verifica o ambiente e usa o WebSocket correto
const isBrowser = typeof window !== "undefined";
const WebSocketImpl = isBrowser ? window.WebSocket : require("ws");

interface IWebClientOptions {
  wsUrl: string;
  wsPort: string;
  maxReconnectAttempts: number;
  reconnectInterval: number;
  timeoutDuration: number;
  debug?: boolean;
}

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
  private isDebug: boolean;

  constructor(
    private onMessageCallback: IMessageCallback,
    private options: IWebClientOptions, // Opções de configuração
    private onEventCallback?: TEventCallback, // Parâmetro opcional
    chatId?: string, // Parâmetro opcional no final
    private route: string = "/ws/chat" // Parâmetro opcional com valor padrão
  ) {
    this.sessionId = uuidv4();
    this.chatId = chatId;
    this.clientSession = uuidv4(); // Gerar um hash único para a sessão do cliente

    this.isDebug = this.options.debug || false; // Debug pode ser opcional

    this.logDebug(
      `Sessão iniciada com ID: ${this.sessionId} e Client Session: ${this.clientSession}`
    );

    this.maxReconnectAttempts = this.options.maxReconnectAttempts;
    this.reconnectInterval = this.options.reconnectInterval;
    this.timeoutDuration = this.options.timeoutDuration;

    this.connect(this.options.wsUrl, this.options.wsPort);
  }

  // Adicionando a função setChatId
  setChatId(chatId: string) {
    this.chatId = chatId;
  }

  private logDebug(message: string) {
    if (this.isDebug) {
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

  private connect(wsUrl: string, wsPort: string) {
    if (this.manualClose) {
      this.logDebug("Fechamento manual da conexão. Não será feita reconexão.");
      return;
    }

    const fullUrl = `${wsUrl}:${wsPort}${this.route}`;
    this.logDebug(`Conectando a ${fullUrl}`);

    if (!isBrowser) {
      // Ambiente Node.js: usar headers no construtor do WebSocket
      const headers: Record<string, string> = {
        "Session-ID": this.sessionId,
        "Client-Session": this.clientSession, // Novo cabeçalho com a identificação do cliente
      };

      if (this.chatId) {
        headers["Chat-ID"] = this.chatId;
      }

      try {
        this.ws = new WebSocketImpl(fullUrl, { headers }); // Passando headers no Node.js
      } catch (error) {
        console.error("Erro ao inicializar o WebSocket no Node.js", error);
      }
    } else {
      // Ambiente do navegador: não suporta headers personalizados
      try {
        this.ws = new WebSocketImpl(fullUrl); // Sem headers no navegador
      } catch (error) {
        console.error("Erro ao inicializar o WebSocket no navegador", error);
      }
    }

    if (this.ws) {
      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.handleEvent(
          EEventType.CONNECTION,
          `Conexão aberta com sucesso. Session ID: ${this.sessionId}`
        );
        this.logDebug("Conexão WebSocket aberta com sucesso.");
        this.resetTimeout();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = event.data.toString(); // Converte os dados recebidos para string
          let parsedData: any;

          // Tenta fazer o parse do JSON se a mensagem for uma string
          if (typeof message === "string") {
            try {
              parsedData = JSON.parse(message); // Tenta fazer o parse do JSON
              this.logDebug(
                `Resposta do servidor WebSocket (JSON): ${JSON.stringify(
                  parsedData,
                  null,
                  4
                )}`
              );
            } catch (error: any) {
              this.logDebug(`Erro ao processar JSON: ${error.message}`);
            }
          } else if (typeof message === "object") {
            parsedData = message; // Trata o dado diretamente como objeto
            this.logDebug(
              `Resposta do servidor WebSocket (Objeto): ${JSON.stringify(
                message,
                null,
                4
              )}`
            );
          } else {
            this.logDebug(
              `Resposta do servidor WebSocket (Raw Data): ${message}`
            );
          }

          if (message.includes("conversationEnd")) {
            console.log(22222);

            this.logDebug(
              "Conversa finalizada pelo servidor. Fechando conexão..."
            );
            this.closeConnection();
          }

          // Verifica se o chatId está presente e atualiza o client
          if (parsedData && parsedData.chatId) {
            console.log(11111, parsedData);
            this.chatId = parsedData.chatId; // Atualiza o chatId a partir da resposta
            this.logDebug(`Novo Chat-ID recebido: ${this.chatId}`);
            if (this.chatId) this.setChatId(this.chatId); // Atualiza o ChatID no WebClient
          }

          // Se não for um chatId, chama o callback de sucesso
          if (message) {
            this.onMessageCallback.onSuccess(message); // Passa a mensagem ou parsedData
            this.logDebug(
              `Mensagem recebida: ${JSON.stringify(message, null, 4)}`
            );
          }
          this.resetTimeout();
        } catch (err) {
          const errorMessage = `Erro ao processar a mensagem: ${
            (err as Error).message
          }`;
          if (errorMessage) {
            this.onMessageCallback.onError(errorMessage);
            this.logDebug(errorMessage);
          }
        }
      };

      this.ws.onerror = (event: Event) => {
        const errorMessage = `Erro na conexão: ${event.type}`;
        this.handleEvent(EEventType.ERROR, errorMessage);
        this.logDebug(errorMessage);
        this.tryReconnect(wsUrl, wsPort);
      };

      this.ws.onclose = () => {
        this.handleEvent(EEventType.CLOSE, "Conexão fechada.");
        this.logDebug("Conexão WebSocket fechada.");

        if (!this.manualClose) {
          this.tryReconnect(wsUrl, wsPort);
        }
      };
    }
  }

  private tryReconnect(wsUrl: string, wsPort: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const reconnectMessage = `Tentativa de reconexão #${this.reconnectAttempts}`;
        this.handleEvent(EEventType.ERROR, reconnectMessage);
        this.logDebug(reconnectMessage);

        setTimeout(() => {
          // Garante que o WebSocket usa a porta original da primeira conexão
          this.connect(wsUrl, wsPort);

          if (this.ws) {
            this.ws.onopen = () => {
              this.reconnectAttempts = 0;
              this.logDebug("Reconectado com sucesso.");
              resolve(true);
            };

            this.ws.onerror = () => {
              this.logDebug("Falha na reconexão.");
              resolve(false);
            };
          }
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
    const maxAttempts =
      options?.customMaxReconnectAttempts ?? this.maxReconnectAttempts;

    const payload = JSON.stringify({ message });

    if (this.ws && this.ws.readyState === WebSocketImpl.OPEN) {
      // Verifica se o WebSocket está realmente aberto
      this.ws.send(payload);
      this.logDebug(`Mensagem enviada: ${payload}`);
      this.resetTimeout();
    } else {
      const errorMessage = "Conexão WebSocket não está aberta.";
      this.onMessageCallback.onError(errorMessage);
      this.logDebug(errorMessage);

      if (this.reconnectAttempts < maxAttempts) {
        this.tryReconnect(
          options?.wsUrl ?? "ws://localhost",
          options?.wsPort ?? "3525"
        ).then(
          // Usa a porta correta na reconexão
          (reconnected: boolean) => {
            if (reconnected && this.ws) {
              this.ws.send(payload);
              this.logDebug(`Mensagem enviada após reconexão: ${payload}`);
              this.resetTimeout();
            } else {
              const error =
                "Não foi possível reconectar após múltiplas tentativas.";
              this.onMessageCallback.onError(error);
              this.logDebug(error);
            }
          }
        );
      } else {
        const error =
          "Não foi possível enviar a mensagem após múltiplas tentativas de reconexão.";
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
