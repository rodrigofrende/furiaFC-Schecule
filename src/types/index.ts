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
  location?: string;
  createdBy: string;
  createdAt: Date;
  isRecurring?: boolean;
  recurringType?: 'weekly' | 'monthly';
  originalEventId?: string | null;
}

export type AttendanceStatus = 'attending' | 'not-attending' | 'pending' | 'not-voted';

export interface Attendance {
  id: string;
  eventId: string;
  userId: string;
  userDisplayName: string;
  attending: boolean; // Keep for backward compatibility
  status?: AttendanceStatus; // New field for three-state system
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

// New stats collection type
export interface PlayerStats {
  userId: string;
  displayName: string;
  matchesAttended: number;
  trainingsAttended: number;
  totalAttended: number;
  goals?: number;
  assists?: number;
  lastUpdated: Date;
}

