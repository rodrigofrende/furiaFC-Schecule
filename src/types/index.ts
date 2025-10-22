export type UserRole = 'ADMIN' | 'PLAYER' | 'VIEWER';

export type PlayerPosition = 'Arquera' | 'Defensora' | 'Mediocampista' | 'Delantera';

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  birthday?: string; // Formato: YYYY-MM-DD
  position?: PlayerPosition; // Solo para PLAYER
}

export interface AllowedUser {
  email: string;
  role: UserRole;
}

export type EventType = 'TRAINING' | 'MATCH' | 'BIRTHDAY' | 'CUSTOM';

export interface Rival {
  id: string;
  name: string;
  logoUrl?: string; // Para el futuro
  createdAt: Date;
  createdBy: string;
}

export interface Event {
  id: string;
  type: EventType;
  date: Date;
  title: string;
  description?: string;
  location?: string;
  rivalId?: string; // Para eventos tipo MATCH
  rivalName?: string; // Para eventos tipo MATCH
  createdBy: string;
  createdAt: Date;
  isRecurring?: boolean;
  recurringType?: 'weekly' | 'monthly' | 'yearly';
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
  withCar?: boolean; // Si va con auto
  canGiveRide?: boolean; // Si puede llevar a alguien (solo si withCar es true)
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
  position?: PlayerPosition; // Player position
  matchesAttended: number;
  trainingsAttended: number;
  totalAttended: number;
  goals?: number;
  assists?: number;
  yellowCards?: number; // Number of yellow cards received
  redCards?: number; // Number of red cards received
  figureOfTheMatch?: number; // Times selected as figure of the match
  lastUpdated: Date;
}

// Match History types
export interface Goal {
  id: string;
  playerId: string;
  playerName: string;
  assistPlayerId?: string;
  assistPlayerName?: string;
  createdAt: Date;
}

export type CardType = 'yellow' | 'red';

export interface Card {
  id: string;
  playerId: string;
  playerName: string;
  cardType: CardType; // 'yellow' or 'red'
  createdAt: Date;
}

export interface MatchResult {
  id: string;
  eventId: string; // Reference to the archived event
  rivalName: string;
  furiaGoals: number;
  rivalGoals: number;
  goals: Goal[]; // List of goals scored by Furia players
  cards?: Card[]; // List of cards received by Furia players
  figureOfTheMatchId?: string; // Player ID of the figure of the match
  figureOfTheMatchName?: string; // Player name of the figure of the match
  date: Date;
  location?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MatchHistoryItem {
  id: string;
  eventId: string;
  rivalName: string;
  date: Date;
  location?: string;
  result?: MatchResult; // Optional, only if admin has entered result
  attendance: number; // Number of players who attended
}

