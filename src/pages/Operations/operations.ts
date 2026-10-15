export interface PreNotification {
  id: string;
  vehicleId: string;
  partnerAId: string;
  plateNumber: string;
  plannedArrival: string;
  driverName: string;
  driverPhone?: string;
  status: string;
}

export interface Yard {
  id: string;
  code: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  capacity: number;
  status: string;
}

export interface VehicleSummary {
  id: string;
  plateNumber: string;
  driverName: string;
  status: string;
}

export interface YardInventory {
  yard: Yard;
  occupancy: number;
  occupancyPercent: number;
  alert: boolean;
  vehicles: VehicleSummary[];
}

export interface YardAlert {
  id: string;
  yardId: string;
  occupancy: number;
  capacity: number;
  message: string;
  createdAt: string;
}

export interface YardHistoryEntry {
  id: string;
  preNotificationId: string;
  plateNumber: string;
  driverName: string;
  yardId: string;
  yardCode: string;
  yardName: string;
  checkInAt: string;
  checkOutAt?: string;
  durationSeconds?: number;
}

export interface ServiceOption {
  id: string;
  code: string;
  name: string;
  hourlyRate: number;
  active: boolean;
}

export interface ServiceOrder {
  id: string;
  vehicleId: string;
  serviceId: string;
  status: string;
  startAt?: string;
  endAt?: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
}

export function formatYardDuration(durationSeconds: number): string {
  const totalMinutes = Math.floor(durationSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours} giờ ${minutes} phút`;
}
