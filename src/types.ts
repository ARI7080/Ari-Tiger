export type AppType = 'notepad' | 'drawing' | 'game' | 'settings';

export interface WindowState {
  id: string;
  type: AppType;
  title: string;
  isOpen: boolean;
  isMinimized: boolean;
  zIndex: number;
  x: number;
  y: number;
}

export interface Note {
  content: string;
  password?: string;
}
