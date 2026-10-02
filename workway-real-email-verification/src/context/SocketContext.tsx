import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  joinBookingRoom: (bookingId: string) => void;
  leaveBookingRoom: (bookingId: string) => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  joinBookingRoom: () => {},
  leaveBookingRoom: () => {},
});

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Connect to Socket.IO on window location host
    const socketInstance = io(window.location.origin, {
      auth: { token: token || undefined },
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketInstance.on('connect', () => {
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [token, user?.id]);

  const joinBookingRoom = (bookingId: string) => {
    if (socket && bookingId) {
      socket.emit('join_booking', bookingId);
    }
  };

  const leaveBookingRoom = (bookingId: string) => {
    if (socket && bookingId) {
      socket.emit('leave_booking', bookingId);
    }
  };

  return (
    <SocketContext.Provider value={{ socket, isConnected, joinBookingRoom, leaveBookingRoom }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
