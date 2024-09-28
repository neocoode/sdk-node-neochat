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
  let ChatIdUpdated = null; // Variável para armazenar o ChatID atualizado
  
  // Função de callback para tratar as mensagens recebidas (sucesso e erro)
  const onMessageReceived = {    
    onSuccess: (data: string) => {
      console.log("Resposta do servidor WebSocket:", data);
      if (data.includes("chatId")) {
        // Parseando o chatId da resposta
        const parsedData = JSON.parse(data);
        ChatIdUpdated = parsedData.chatId;
        client.setChatId(ChatIdUpdated); // Atualiza o ChatID no WebClient
      }
    },
    onError: (error: string) => {
      console.error("Erro ao processar a mensagem:", error);
    },
  };

  // Cria uma instância do WebClient com os callbacks personalizados
  let client = new WebClient(onMessageReceived, onEvent);

  // Envia a primeira mensagem imediatamente
  client.sendMessage("Bom dia");
  
  // Aguarda até que o ChatID seja atualizado antes de continuar
  await waitForTimeout(10000); // Aguarda 3 segundos antes de enviar a segunda mensagem

  if (ChatIdUpdated) {
    const client2 = new WebClient(onMessageReceived, onEvent, ChatIdUpdated); // Atualiza o client com o ChatID
    client2.sendMessage("empresa apple"); // Envia a segunda mensagem com o novo ChatID
  } 
})();
