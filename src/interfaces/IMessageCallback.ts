export interface IMessageCallback {
    onSuccess: (data: string) => void;
    onError: (error: string) => void;
  }