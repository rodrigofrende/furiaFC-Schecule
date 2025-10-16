export type UserRole = 'ADMIN' | 'PLAYER';

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
}

export interface AllowedUser {
  email: string;
  role: UserRole;
}

export type EventType = 'TRAINING' | 'MATCH';

export interface Event {
  id: string;
  type: EventType;
  date: Date;
  title: string;
  description?: string;
  createdBy: string;
  createdAt: Date;
}

export interface Attendance {
  id: string;
  eventId: string;
  userId: string;
  userDisplayName: string;
  attending: boolean;
  comment?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AttendanceStats {
  userId: string;
  displayName: string;
  totalEvents: number;
  attended: number;
  percentage: number;
}

