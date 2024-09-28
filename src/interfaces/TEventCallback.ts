import { EEventType } from "./EEventType";

export type TEventCallback = (type: EEventType, data: string) => void;
