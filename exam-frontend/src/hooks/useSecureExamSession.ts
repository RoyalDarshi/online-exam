// src/hooks/useSecureExamSession.ts
import { useEffect, useRef, useState, useCallback } from "react";

export type WSStatus =
    | "connecting"
    | "connected"
    | "disconnected"
    | "error"
    | "closed";

interface UseSecureExamSessionParams {
    attemptId: string;
    examToken: string;
    onTerminated?: (reason?: string) => void;
    onKicked?: (reason?: string) => void;
    onOpen?: () => void;
}

export function useSecureExamSession({
    attemptId,
    examToken,
    onTerminated,
    onKicked,
    onOpen,
}: UseSecureExamSessionParams) {
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
    const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);

    const [status, setStatus] = useState<WSStatus>("connecting");
    const reconnectAttempts = useRef(0);

    // ---- Compute WebSocket URL ----
    function buildWSUrl() {
        const protocol = window.location.protocol === "https:" ? "wss" : "ws";
        return `${protocol}://${window.location.host}/ws/exam?attempt_id=${attemptId}&token=${examToken}`;
    }

    // ---- Heartbeat Ping ----
    const startHeartbeat = useCallback(() => {
        if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);

        heartbeatTimerRef.current = setInterval(() => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: "ping", ts: Date.now() }));
            }
        }, 10000); // every 10s
    }, []);

    // ---- Connect WebSocket ----
    const connect = useCallback(() => {
        if (!attemptId || !examToken) return;

        try {
            const url = buildWSUrl();
            const ws = new WebSocket(url);
            wsRef.current = ws;
            setStatus("connecting");

            ws.onopen = () => {
                setStatus("connected");
                reconnectAttempts.current = 0;

                if (onOpen) onOpen();
                startHeartbeat();
            };

            ws.onmessage = (ev) => {
                try {
                    const msg = JSON.parse(ev.data);
                    // console.log("WS message:", msg);

                    switch (msg.type) {
                        case "pong":
                            return;

                        case "ack":
                            return;

                        case "terminated":
                            if (onTerminated) onTerminated(msg.reason);
                            break;

                        case "kicked":
                            if (onKicked) onKicked(msg.reason);
                            break;

                        default:
                            console.warn("Unknown WS message:", msg);
                    }
                } catch (e) {
                    console.warn("WS parse failed:", e);
                }
            };

            ws.onerror = () => {
                setStatus("error");
            };

            ws.onclose = () => {
                setStatus("disconnected");

                // stop heartbeat
                if (heartbeatTimerRef.current)
                    clearInterval(heartbeatTimerRef.current);

                // automatic reconnect unless session explicitly closed
                if (status !== "closed") {
                    const delay = Math.min(30000, 2000 * Math.pow(1.5, reconnectAttempts.current));
                    reconnectAttempts.current++;

                    reconnectTimerRef.current = setTimeout(() => {
                        connect();
                    }, delay);
                }
            };
        } catch (e) {
            console.error("WS connect error:", e);
            setStatus("error");
        }
    }, [attemptId, examToken, onOpen, onTerminated, onKicked, startHeartbeat, buildWSUrl, status]);

    // ---- Auto-connect ----
    useEffect(() => {
        connect();
        return () => {
            // cleanup on unmount
            if (wsRef.current) wsRef.current.close();
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
            if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
        };
    }, [connect]);

    // ---- Send Event ----
    const sendEvent = useCallback((eventObj: any) => {
        try {
            if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

            wsRef.current.send(JSON.stringify(eventObj));
        } catch (e) {
            console.warn("WS sendEvent failed", e);
        }
    }, []);

    // ---- Manual Close ----
    const closeSession = useCallback((reason?: string) => {
        try {
            setStatus("closed");

            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(
                    JSON.stringify({ type: "close", reason: reason || "user_exit" })
                );
            }

            wsRef.current?.close();

            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
            if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
        } catch (e) {
            console.warn("WS closeSession error", e);
        }
    }, []);

    return {
        status,
        sendEvent,
        closeSession,
    };
}
