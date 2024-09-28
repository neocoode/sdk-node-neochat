export interface IMessageCallback {
    onSuccess: (data: string, chatId?: string) => void;
    onError: (error: string) => void;
  }