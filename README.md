Aqui está um exemplo de arquivo `README.md` para o seu pacote `sdk-node-neochat`. Ele explica o ambiente necessário, o uso de variáveis de ambiente e fornece um exemplo de código para auxiliar no uso do WebClient.

---

# SDK Node NeoChat

Este pacote é uma SDK para comunicação via WebSocket com o servidor NeoChat, permitindo a troca de mensagens entre cliente e servidor. O SDK oferece funcionalidades de reconexão automática, envio de mensagens e callbacks para eventos WebSocket.

## Instalação

Para instalar o pacote, execute:

```bash
npm install sdk-node-neochat
```

## Configuração do Ambiente

O SDK depende de variáveis de ambiente para configurar a conexão WebSocket. Crie um arquivo `.env` na raiz do seu projeto com os seguintes parâmetros:

### Exemplo de arquivo `.env`

```bash
WS_URL=ws://localhost
WS_PORT=3525
WS_MAX_RECONNECT_ATTEMPTS=5
WS_RECONNECT_INTERVAL=3000
DEBUG=false
```

- `WS_URL`: Endereço do WebSocket.
- `WS_PORT`: Porta onde o WebSocket está rodando.
- `WS_MAX_RECONNECT_ATTEMPTS`: Número máximo de tentativas de reconexão.
- `WS_RECONNECT_INTERVAL`: Intervalo de tempo em milissegundos entre tentativas de reconexão.
- `DEBUG`: Modo debug para logar informações de eventos.

## Uso

### Importação e uso do WebClient

Para utilizar o SDK, importe a classe `WebClient` e configure os callbacks para eventos e mensagens.

### Exemplo completo de uso:

```typescript
import { EEventType } from "sdk-node-neochat/interfaces/EEventType";
import { WebClient } from "sdk-node-neochat/WebClient";

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
  await waitForTimeout(10000); // Aguarda 10 segundos antes de enviar a segunda mensagem

  if (ChatIdUpdated) {
    const client2 = new WebClient(onMessageReceived, onEvent, ChatIdUpdated); // Atualiza o client com o ChatID
    client2.sendMessage("empresa apple"); // Envia a segunda mensagem com o novo ChatID
  }
})();
```

### Detalhes do código:

1. **WebClient**: Classe principal que gerencia a conexão WebSocket. Ela permite enviar mensagens, tratar eventos e se reconectar automaticamente caso a conexão falhe.
   
2. **onMessageReceived**: Callback usado para tratar o sucesso e erro no recebimento de mensagens do WebSocket.

3. **onEvent**: Callback para eventos de conexão, fechamento, erro, e mensagens.

4. **ChatId**: O `ChatId` é automaticamente atualizado pelo servidor na primeira interação. O SDK permite enviar mensagens subsequentes com o `ChatId` atualizado.

5. **Reconexão Automática**: A SDK tenta se reconectar automaticamente com base nas variáveis de ambiente configuradas.

---

## Contribuição

Sinta-se à vontade para contribuir com melhorias ou correções para este pacote.

## Licença

Este projeto está licenciado sob a licença ISC.

---

Este `README.md` serve como guia básico para utilização do pacote, explicando como configurar o ambiente e um exemplo prático de uso.