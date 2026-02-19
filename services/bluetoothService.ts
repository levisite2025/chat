
// Web Bluetooth Service UUIDs (Custom for typical UART messaging)
const UART_SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
const UART_CHARACTERISTIC_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';

export class BluetoothService {
  // Fix: Use 'any' type for BluetoothDevice as it's not defined in the default TypeScript environment
  private device: any = null;
  // Fix: Use 'any' type for BluetoothRemoteGATTCharacteristic as it's not defined in the default TypeScript environment
  private characteristic: any = null;
  private onMessageReceived: (message: string) => void = () => {};

  async scanAndConnect(): Promise<string> {
    // Fix: Cast navigator to 'any' to access the 'bluetooth' property which is missing from standard Navigator type
    if (!(navigator as any).bluetooth) {
      throw new Error("Bluetooth não suportado neste navegador.");
    }

    // Fix: Cast navigator to 'any' to access 'bluetooth.requestDevice'
    this.device = await (navigator as any).bluetooth.requestDevice({
      filters: [{ services: [UART_SERVICE_UUID] }],
      optionalServices: ['generic_access']
    });

    const server = await this.device.gatt?.connect();
    const service = await server?.getPrimaryService(UART_SERVICE_UUID);
    this.characteristic = (await service?.getCharacteristic(UART_CHARACTERISTIC_UUID)) || null;

    if (this.characteristic) {
      await this.characteristic.startNotifications();
      this.characteristic.addEventListener('characteristicvaluechanged', (event: any) => {
        const value = event.target.value;
        const decoder = new TextDecoder();
        const message = decoder.decode(value);
        this.onMessageReceived(message);
      });
    }

    return this.device.name || "Dispositivo Desconhecido";
  }

  setOnMessage(callback: (msg: string) => void) {
    this.onMessageReceived = callback;
  }

  async sendMessage(message: string) {
    if (!this.characteristic) return;
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    await this.characteristic.writeValue(data);
  }

  disconnect() {
    if (this.device && this.device.gatt?.connected) {
      this.device.gatt.disconnect();
    }
  }

  isConnected(): boolean {
    return !!(this.device && this.device.gatt?.connected);
  }
}

export const bluetoothService = new BluetoothService();
