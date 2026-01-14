import { useRef, useCallback, useState } from 'react';
import { usePageVisibility } from './usePageVisibility';

interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
}

interface UseNotificationReturn {
  isPermissionGranted: boolean;
  requestPermission: () => Promise<boolean>;
  showNotification: (options: NotificationOptions) => void;
  playSound: () => void;
}

/**
 * Hook to manage browser notifications and notification sounds.
 * Uses Web Audio API to generate beep sound (no external file needed).
 */
export const useNotification = (): UseNotificationReturn => {
  const isPageVisible = usePageVisibility();
  const audioContextRef = useRef<AudioContext | null>(null);
  const [isPermissionGranted, setIsPermissionGranted] = useState(
    typeof Notification !== 'undefined' && Notification.permission === 'granted'
  );

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (typeof Notification === 'undefined') {
      console.warn('Browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      setIsPermissionGranted(true);
      return true;
    }

    if (Notification.permission === 'denied') {
      console.warn('Notification permission denied');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      const granted = permission === 'granted';
      setIsPermissionGranted(granted);
      return granted;
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return false;
    }
  }, []);

  const showNotification = useCallback((options: NotificationOptions) => {
    // Only show notification if page is not visible and permission is granted
    if (isPageVisible) return;
    
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
      return;
    }

    try {
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || '/favicon.ico',
        tag: 'socket-chat-message', // Prevent duplicate notifications
      });

      // Auto close after 5 seconds
      setTimeout(() => notification.close(), 5000);

      // Focus window when notification is clicked
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch (error) {
      console.error('Failed to show notification:', error);
    }
  }, [isPageVisible]);

  // Play a short beep using Web Audio API
  const playSound = useCallback(() => {
    try {
      // Create or reuse AudioContext
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      
      const ctx = audioContextRef.current;
      
      // Create oscillator for beep
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      // Configure sound (short pleasant beep)
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
      
      // Quick fade in/out for pleasant sound
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.01);
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
      
      // Play and stop
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.15);
    } catch (error) {
      console.warn('Could not play notification sound:', error);
    }
  }, []);

  return {
    isPermissionGranted,
    requestPermission,
    showNotification,
    playSound,
  };
};

export default useNotification;
