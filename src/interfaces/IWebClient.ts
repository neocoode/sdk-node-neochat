export interface IWebClient {
    sendMessage(message: string): void;
    closeConnection(): void;
  }