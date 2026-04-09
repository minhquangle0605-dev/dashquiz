import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

import { useAuthStore } from '@/stores/authStore';

const DEFAULT_SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:3000';

export interface UseSocketOptions {
  url?: string;
  path?: string;
}

export function useSocket(options: UseSocketOptions = {}): {
  socket: Socket | null;
  isConnected: boolean;
} {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const url = options.url ?? DEFAULT_SOCKET_URL;
  const path = options.path ?? '/socket.io';

  useEffect(() => {
    if (!accessToken) {
      setSocket(null);
      setIsConnected(false);
      return;
    }

    const s = io(url, {
      path,
      auth: { token: accessToken },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      transports: ['websocket', 'polling'],
    });

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);
    const onConnectError = () => setIsConnected(false);

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('connect_error', onConnectError);

    setSocket(s);

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('connect_error', onConnectError);
      s.removeAllListeners();
      s.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, [accessToken, path, url]);

  return { socket, isConnected };
}
