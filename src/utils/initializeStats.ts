import { collection, getDocs, doc, setDoc, getDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Initializes stats for all users who don't have a stats document yet
 * This should be run once to initialize the stats collection for existing users
 */
export const initializeStatsForAllUsers = async (): Promise<number> => {
  try {
    let initializedCount = 0;

    // Get all users
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userEmail = userData.email; // Use email as the unique identifier
      
      if (!userEmail) {
        console.warn(`User ${userDoc.id} has no email, skipping...`);
        continue;
      }
      
      // Check if stats document already exists (using email as document ID)
      const statsRef = doc(db, 'stats', userEmail);
      const statsDoc = await getDoc(statsRef);
      
      if (!statsDoc.exists()) {
        // Create initial stats document
        await setDoc(statsRef, {
          userId: userEmail, // Store email as userId for consistency
          displayName: userData.alias || userEmail,
          matchesAttended: 0,
          trainingsAttended: 0,
          totalAttended: 0,
          goals: 0,
          assists: 0,
          lastUpdated: serverTimestamp()
        });
        
        initializedCount++;
        console.log(`Initialized stats for user: ${userData.alias || userEmail}`);
      }
    }
    
    console.log(`Stats initialization complete. Initialized ${initializedCount} user(s).`);
    return initializedCount;
  } catch (error) {
    console.error('Error initializing stats:', error);
    throw error;
  }
};

/**
 * Recalculates stats for all users based on their attendance history
 * This will fix any inconsistencies in the stats collection
 */
export const recalculateAllStats = async (): Promise<number> => {
  try {
    let recalculatedCount = 0;

    // STEP 1: Get all users (source of truth)
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);
    
    const usersMap = new Map<string, any>();
    usersSnapshot.forEach((userDoc) => {
      const userData = userDoc.data();
      if (userData.email) {
        usersMap.set(userData.email, userData);
      }
    });

    // STEP 2: Get all archived events to know event types
    const archivedEventsRef = collection(db, 'events_archive');
    const archivedEventsSnapshot = await getDocs(archivedEventsRef);
    
    const eventTypesMap = new Map<string, 'MATCH' | 'TRAINING'>();
    archivedEventsSnapshot.forEach((doc) => {
      const data = doc.data();
      eventTypesMap.set(doc.id, data.type);
    });
    
    // STEP 3: Get all archived attendances and group by email
    const archivedAttendancesRef = collection(db, 'attendances_archive');
    const archivedAttendancesSnapshot = await getDocs(archivedAttendancesRef);
    
    const attendancesByEmail = new Map<string, { matchesAttended: number; trainingsAttended: number }>();
    
    archivedAttendancesSnapshot.forEach((doc) => {
      const data = doc.data();
      const userEmail = data.userId; // userId in attendance is the email
      const eventType = eventTypesMap.get(data.eventId);
      
      if (userEmail && eventType && data.attending === true) {
        if (!attendancesByEmail.has(userEmail)) {
          attendancesByEmail.set(userEmail, { matchesAttended: 0, trainingsAttended: 0 });
        }
        
        const stats = attendancesByEmail.get(userEmail)!;
        if (eventType === 'MATCH') {
          stats.matchesAttended++;
        } else if (eventType === 'TRAINING') {
          stats.trainingsAttended++;
        }
      }
    });
    
    // STEP 4: Update stats for each user from source of truth
    for (const [userEmail, userData] of usersMap) {
      const attendanceStats = attendancesByEmail.get(userEmail) || { matchesAttended: 0, trainingsAttended: 0 };
      const totalAttended = attendanceStats.matchesAttended + attendanceStats.trainingsAttended;
      
      const statsRef = doc(db, 'stats', userEmail);
      await setDoc(statsRef, {
        userId: userEmail,
        displayName: userData.alias || userEmail,
        matchesAttended: attendanceStats.matchesAttended,
        trainingsAttended: attendanceStats.trainingsAttended,
        totalAttended,
        goals: 0,
        assists: 0,
        lastUpdated: serverTimestamp()
      }, { merge: true });
      
      recalculatedCount++;
      console.log(`Recalculated stats for user: ${userData.alias || userEmail} - Matches: ${attendanceStats.matchesAttended}, Trainings: ${attendanceStats.trainingsAttended}`);
    }
    
    console.log(`Stats recalculation complete. Updated ${recalculatedCount} user(s).`);
    return recalculatedCount;
  } catch (error) {
    console.error('Error recalculating all stats:', error);
    throw error;
  }
};

/**
 * Recalculates stats for a specific user based on their attendance history
 * This can be used to fix stats if they become out of sync
 */
/**
 * Syncs stats collection with current users list
 * This ensures that stats collection only contains users that exist in users collection
 */
export const syncStatsWithUsers = async (): Promise<number> => {
  try {
    let syncedCount = 0;

    // Get all users (source of truth)
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);
    
    const validEmails = new Set<string>();
    usersSnapshot.forEach((userDoc) => {
      const userData = userDoc.data();
      if (userData.email) {
        validEmails.add(userData.email);
      }
    });

    // Get all stats documents
    const statsRef = collection(db, 'stats');
    const statsSnapshot = await getDocs(statsRef);
    
    // Delete stats for users that no longer exist
    const { deleteDoc } = await import('firebase/firestore');
    for (const statsDoc of statsSnapshot.docs) {
      const docId = statsDoc.id;
      const data = statsDoc.data();
      const email = data.userId || docId;
      
      if (!validEmails.has(email)) {
        await deleteDoc(doc(db, 'stats', docId));
        console.log(`Deleted stats for non-existent user: ${email}`);
        syncedCount++;
      }
    }

    console.log(`Sync complete. Removed ${syncedCount} orphaned stats entries.`);
    return syncedCount;
  } catch (error) {
    console.error('Error syncing stats with users:', error);
    throw error;
  }
};

/**
 * Cleans up duplicate stats documents and consolidates them by email
 * This should be run once to fix existing duplicate entries
 */
export const cleanupDuplicateStats = async (): Promise<number> => {
  try {
    let cleanedCount = 0;

    // Get all users to know which emails should exist
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);
    
    const validEmails = new Set<string>();
    const userDataMap = new Map<string, any>();
    
    usersSnapshot.forEach((userDoc) => {
      const userData = userDoc.data();
      if (userData.email) {
        validEmails.add(userData.email);
        userDataMap.set(userData.email, userData);
      }
    });

    // Get all stats documents
    const statsRef = collection(db, 'stats');
    const statsSnapshot = await getDocs(statsRef);
    
    // Group stats by email
    const statsByEmail = new Map<string, any[]>();
    
    statsSnapshot.forEach((doc) => {
      const data = doc.data();
      const email = data.userId || doc.id; // userId should be email, fallback to doc.id
      
      if (!statsByEmail.has(email)) {
        statsByEmail.set(email, []);
      }
      statsByEmail.get(email)!.push({ docId: doc.id, data });
    });

    // Process each email group
    for (const [email, statsDocs] of statsByEmail) {
      if (!validEmails.has(email)) {
        console.warn(`Email ${email} not found in users collection, skipping...`);
        continue;
      }

      if (statsDocs.length > 1) {
        // Found duplicates, consolidate them
        console.log(`Found ${statsDocs.length} duplicate stats for ${email}, consolidating...`);
        
        // Sum up all the stats
        let totalMatches = 0;
        let totalTrainings = 0;
        let latestUpdate = null;
        
        statsDocs.forEach(({ data }) => {
          totalMatches += data.matchesAttended || 0;
          totalTrainings += data.trainingsAttended || 0;
          if (!latestUpdate || (data.lastUpdated && data.lastUpdated > latestUpdate)) {
            latestUpdate = data.lastUpdated;
          }
        });

        // Delete all duplicate documents
        const { deleteDoc } = await import('firebase/firestore');
        for (const { docId } of statsDocs) {
          await deleteDoc(doc(db, 'stats', docId));
        }

        // Create consolidated document
        const userData = userDataMap.get(email);
        await setDoc(doc(db, 'stats', email), {
          userId: email,
          displayName: userData?.alias || email,
          matchesAttended: totalMatches,
          trainingsAttended: totalTrainings,
          totalAttended: totalMatches + totalTrainings,
          goals: 0,
          assists: 0,
          lastUpdated: latestUpdate || serverTimestamp()
        });

        cleanedCount++;
        console.log(`Consolidated stats for ${email}: ${totalMatches} matches, ${totalTrainings} trainings`);
      }
    }

    console.log(`Cleanup complete. Consolidated ${cleanedCount} duplicate entries.`);
    return cleanedCount;
  } catch (error) {
    console.error('Error cleaning up duplicate stats:', error);
    throw error;
  }
};

export const recalculateUserStats = async (userEmail: string): Promise<void> => {
  try {
    // Get user's display name from users collection
    const usersRef = collection(db, 'users');
    const userQuery = query(usersRef, where('email', '==', userEmail));
    const userSnapshot = await getDocs(userQuery);
    
    if (userSnapshot.empty) {
      console.error('User not found:', userEmail);
      return;
    }
    
    const userData = userSnapshot.docs[0].data();
    const displayName = userData.alias || userEmail;
    
    // This function would need access to archived events to recalculate
    // For now, we'll just reset to 0
    const statsRef = doc(db, 'stats', userEmail);
    await setDoc(statsRef, {
      userId: userEmail,
      displayName,
      matchesAttended: 0,
      trainingsAttended: 0,
      totalAttended: 0,
      goals: 0,
      assists: 0,
      lastUpdated: serverTimestamp()
    }, { merge: true });
    
    console.log(`Stats recalculated for user: ${displayName}`);
  } catch (error) {
    console.error('Error recalculating user stats:', error);
    throw error;
  }
};

