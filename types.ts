
export interface Message {
  id: string;
  text: string;
  sender: 'me' | 'other' | 'ai';
  timestamp: number;
}

export interface Contact {
  id: string;
  name: string;
  deviceId: string; // This can be the device name or a specific service UUID hint
}

export interface BluetoothDeviceInfo {
  name: string;
  id: string;
  connected: boolean;
}

export enum AppState {
  IDLE = 'IDLE',
  SCANNING = 'SCANNING',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR'
}
