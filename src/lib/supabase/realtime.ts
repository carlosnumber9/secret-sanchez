import type { WebSocketLikeConstructor } from "@supabase/realtime-js";
import ws from "ws";

export const serverRealtimeTransport = ws as unknown as WebSocketLikeConstructor;
