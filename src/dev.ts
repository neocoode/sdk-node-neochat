import { EEventType } from "./interfaces/EEventType";
import { WebClient } from "./WebClient";

// Função de callback para tratar eventos de erro e outros eventos
const onEvent = (type: EEventType, data: string) => {
  switch (type) {
    case EEventType.CONNECTION:
      console.log(`[Conexão]: ${data}`);
      break;
    case EEventType.MESSAGE:
      console.log(`[Mensagem]: ${data}`);
      break;
    case EEventType.ERROR:
      console.error(`[Erro]: ${data}`);
      break;
    case EEventType.CLOSE:
      console.log(`[Fechamento]: ${data}`);
      break;
    default:
      console.log(`[Desconhecido]: ${data}`);
      break;
  }
};

// Função para criar uma Promessa que resolve após um tempo
function waitForTimeout(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Função assíncrona para enviar as mensagens com o delay
(async () => {
  let ChatIdUpdated; // Variável para armazenar o ChatID atualizado

  // Função de callback para tratar as mensagens recebidas (sucesso e erro)
  const onMessageReceived = {
    onSuccess: (data: any, chatId?: string) => {
      console.log(999, data, chatId)      
  
      if (chatId) {
        ChatIdUpdated = chatId;
        if (ChatIdUpdated) {
          client.setChatId(ChatIdUpdated); // Atualiza o ChatID no WebClient
        }
      }
    },
    onError: (error: string) => {
      console.error("Erro ao processar a mensagem:", error);
    },
  };
  

  // Definindo as opções de configuração do WebSocket
  const wsOptions = {
    wsUrl: "ws://localhost", // URL do WebSocket
    wsPort: "3525", // Porta do WebSocket
    maxReconnectAttempts: 5,
    reconnectInterval: 3000,
    timeoutDuration: 30000,
    debug: true, // Define se o modo debug está ativado
  };

  // Cria uma instância do WebClient com os callbacks personalizados e opções de WebSocket
  let client = new WebClient(onMessageReceived, wsOptions, onEvent);

  // Envia a primeira mensagem imediatamente
  client.sendMessage("Bom dia");

  // Aguarda até que o ChatID seja atualizado antes de continuar
  await waitForTimeout(10000); // Aguarda 10 segundos antes de enviar a segunda mensagem

  if (ChatIdUpdated) {
    const client2 = new WebClient(
      onMessageReceived,
      wsOptions,
      onEvent,
      ChatIdUpdated
    ); // Atualiza o client com o ChatID
    client2.sendMessage("empresa apple"); // Envia a segunda mensagem com o novo ChatID
  }
})();
