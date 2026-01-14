import React, { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from '../types';

interface AuthContextType {
  currentUser: User | null;
  login: (userId: string) => void;
  logout: () => void;
  availableUsers: User[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const HARDCODED_USERS: User[] = [
  { id: 'u1', name: 'Alice', avatar_color: '#EF4444' },   // red-500
  { id: 'u2', name: 'Bob', avatar_color: '#3B82F6' },     // blue-500
  { id: 'u3', name: 'Charlie', avatar_color: '#22C55E' }, // green-500
  { id: 'u4', name: 'David', avatar_color: '#EAB308' },   // yellow-500
];

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const login = (userId: string) => {
    const user = HARDCODED_USERS.find((u) => u.id === userId);
    if (user) {
      setCurrentUser(user);
    }
  };

  const logout = () => {
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider value={{ currentUser, login, logout, availableUsers: HARDCODED_USERS }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
