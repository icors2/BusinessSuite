import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getSession } from './auth';

export interface MesLiveEvent {
  topic: string;
  entityId: string;
  payload?: Record<string, unknown>;
  timestamp?: string;
}

export function useMesSocket(onEvent?: (event: MesLiveEvent) => void) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<MesLiveEvent | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const session = getSession();
    if (!session?.accessToken) return;

    const socket = io('/mes', {
      auth: { token: session.accessToken },
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('mes.event', (payload: MesLiveEvent) => {
      setLastEvent(payload);
      onEventRef.current?.(payload);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  return { connected, lastEvent, socket: socketRef.current };
}
