# ⚽ FURIA FC - Team Management Platform

A modern, full-stack web application for managing a women's football team, including event management, attendance tracking, match results, and player statistics.

![React](https://img.shields.io/badge/React-19.1.0-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-3178C6?logo=typescript&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-11.1.0-FFCA28?logo=firebase&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-6.1.7-646CFF?logo=vite&logoColor=white)

---

## 🎮 Live Demo

**Try it yourself!** Explore the full platform with read-only access:

### 🔑 How to Access:

1. Go to the login page
2. Enter username: **`testfuria`**
3. Leave password field **empty** (just press Enter or click "Ingresar")
4. You're in! 🎉

### ✨ What You Can Do:

- ✅ View all upcoming events (training, matches, birthdays)
- ✅ See event participant lists and attendance stats
- ✅ Browse complete match history with scores
- ✅ Explore player statistics (goals, assists, cards)
- ✅ Navigate through fixture calendar
- ✅ See all features and UI/UX

### 🚫 What You Can't Do (Read-Only):

- ❌ Modify your attendance to events
- ❌ Create or edit events
- ❌ Edit match results
- ❌ Change player stats
- ❌ Edit profile information

> **Note:** The demo account is perfect for recruiters and developers to explore the platform's full functionality without affecting real team data. A yellow banner at the top reminds you that you're in read-only mode.

---

## ✨ Features

### 📅 Event Management

- Create and manage training sessions, matches, and custom events
- Recurring events support (weekly, monthly, yearly)
- Automatic birthday reminders for team members
- Location and rival team tracking for matches

### 👥 Attendance System

- Three-state attendance tracking (attending, not attending, pending)
- Car pooling coordination (who has a car, who can give rides)
- Real-time participant counting
- Comment system for each event

### 🏆 Match Results & Statistics

- Comprehensive match history with scores
- Goal tracking with assist attribution
- Yellow and red card management
- "Figure of the Match" recognition
- Automatic player statistics calculation

### 📊 Player Statistics Dashboard

- Goals, assists, and cards tracking
- Match and training attendance metrics
- Position-based organization
- Responsive table with sticky headers
- Mobile-optimized compact view

### 🎯 Advanced Features

- **Role-based access control** (Admin, Player, Viewer)
- **Lazy loading** for optimal performance
- **Real-time data** with Firestore
- **Responsive design** - Mobile-first approach
- **Dark theme navigation** with smooth animations
- **Statistics reprocessing** tool for data integrity

---

## 🛠️ Tech Stack

### Frontend

- **React 19** - UI library with lazy loading and Suspense
- **TypeScript** - Type safety and better DX
- **React Router** - Client-side routing
- **Vite** - Lightning-fast build tool with Rolldown
- **CSS3** - Custom styling with CSS variables and gradients

### Backend & Database

- **Firebase Firestore** - NoSQL cloud database
- **Firebase Timestamp** - Server-side timestamps
- **Real-time listeners** - Live data updates

### Development Tools

- **ESLint** - Code quality and consistency
- **TypeScript ESLint** - TypeScript-specific linting
- **React Tooltip** - Accessible tooltips

---

## 🏗️ Architecture

```
src/
├── components/          # Reusable UI components
│   ├── Header.tsx
│   ├── Navigation.tsx
│   ├── Modal.tsx
│   ├── ReadOnlyBanner.tsx
│   └── AdminPanel.tsx
├── pages/              # Route-based page components
│   ├── Home.tsx        # Events dashboard
│   ├── Statistics.tsx  # Player stats
│   ├── MatchHistory.tsx
│   ├── Fixture.tsx
│   ├── Login.tsx
│   └── Admin.tsx
├── context/            # React Context for state
│   └── AuthContext.tsx # Authentication & user management
├── utils/              # Utility functions
│   ├── reprocessMatchResults.ts
│   └── createTestMatches.ts
├── styles/             # CSS modules
├── types/              # TypeScript type definitions
└── config/             # Firebase configuration
```

---

## 🚀 Key Highlights

### Performance Optimizations

- **Lazy loading** all routes and heavy components
- **Code splitting** with vendor chunks (React, Firebase)
- **Memoization** with `React.memo`, `useMemo`, `useCallback`
- **Rolldown minification** for faster builds
- **Sticky headers** without layout shift
- DNS prefetching for Firebase domains

### User Experience

- **Mobile-first responsive design**
- **Sticky table headers** for better data navigation
- **Smooth animations** without layout shifts
- **Accessible tooltips** with proper ARIA labels
- **Loading states** for async operations
- **Error handling** with user-friendly messages

### Data Integrity

- **Automatic stats calculation** from match results
- **Reprocessing tool** to fix historical data
- **Server timestamps** for consistency
- **Optimistic UI updates** with rollback on error

---

## 🔐 Security & Roles

The platform implements a three-tier role system:

- **👨‍💼 ADMIN**: Full access - create events, manage results, access admin panel
- **⚽ PLAYER**: Limited access - view events, mark attendance, view stats
- **👁️ VIEWER**: Read-only - explore all features without making changes (demo mode)

All Firebase operations are protected with role-based security rules.

---

## 💻 Local Development

### Prerequisites

- Node.js 18+ and npm
- Firebase project (for full functionality)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/furiafc-schedule.git
   cd furiafc-schedule
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up Firebase** (optional - for full functionality)

   - Create a Firebase project
   - Enable Firestore Database
   - Add your Firebase config to `src/config/firebase.ts`

4. **Start development server**

   ```bash
   npm run dev
   ```

5. **Open in browser**
   ```
   http://localhost:5173
   ```

### Build for Production

```bash
npm run build
npm run preview  # Preview production build
```

---

## 📱 Screenshots

<!-- Add screenshots here -->

> _Screenshots coming soon - showing event dashboard, statistics table, match history, and mobile views_

---

## 🎯 Future Enhancements

- [ ] Push notifications for upcoming events
- [ ] Export statistics to PDF/Excel
- [ ] Team chat/messaging system
- [ ] Calendar integration (Google Calendar, iCal)
- [ ] Advanced analytics dashboard
- [ ] Player comparison tools
- [ ] Training session planning tools

---

## 📝 License

This project is private and intended for portfolio demonstration purposes.

---

## 👨‍💻 Developer

**Rodrigo** - [GitHub](https://github.com/yourusername) | [LinkedIn](https://linkedin.com/in/yourprofile)

---

## 🙏 Acknowledgments

Built with ❤️ for FURIA FC women's football team.

Special thanks to:

- React team for the amazing framework
- Firebase for the robust backend infrastructure
- The FURIA FC team for inspiring this project
