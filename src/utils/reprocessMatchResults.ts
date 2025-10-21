import { collection, getDocs, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Re-processes all match results and updates player stats
 * This fixes any stats that weren't updated due to ID mismatches
 */
export const reprocessAllMatchResults = async () => {
  console.log('🔄 Starting match results reprocessing...\n');
  
  try {
    // Get all users for ID -> email mapping
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);
    
    const usersMap = new Map<string, { email: string; alias: string }>();
    usersSnapshot.forEach((userDoc) => {
      const data = userDoc.data();
      usersMap.set(userDoc.id, {
        email: data.email,
        alias: data.alias || data.email
      });
    });
    
    console.log(`📋 Found ${usersMap.size} users`);
    
    // Get all match results
    const resultsRef = collection(db, 'match_results');
    const resultsSnapshot = await getDocs(resultsRef);
    
    console.log(`⚽ Found ${resultsSnapshot.size} match results to process\n`);
    
    // Initialize stats counters
    const statsCounters = new Map<string, {
      goals: number;
      assists: number;
      yellowCards: number;
      redCards: number;
      figureOfTheMatch: number;
    }>();
    
    // Process each match result
    for (const resultDoc of resultsSnapshot.docs) {
      const data = resultDoc.data();
      console.log(`\n📊 Processing match: ${data.rivalName}`);
      
      // Process goals
      if (data.goals && Array.isArray(data.goals)) {
        for (const goal of data.goals) {
          const playerId = goal.playerId;
          const user = usersMap.get(playerId);
          
          if (user) {
            if (!statsCounters.has(user.email)) {
              statsCounters.set(user.email, {
                goals: 0,
                assists: 0,
                yellowCards: 0,
                redCards: 0,
                figureOfTheMatch: 0
              });
            }
            
            statsCounters.get(user.email)!.goals++;
            console.log(`  ⚽ ${user.alias}: +1 goal`);
            
            // Process assist
            if (goal.assistPlayerId) {
              const assistUser = usersMap.get(goal.assistPlayerId);
              if (assistUser) {
                if (!statsCounters.has(assistUser.email)) {
                  statsCounters.set(assistUser.email, {
                    goals: 0,
                    assists: 0,
                    yellowCards: 0,
                    redCards: 0,
                    figureOfTheMatch: 0
                  });
                }
                
                statsCounters.get(assistUser.email)!.assists++;
                console.log(`  🎯 ${assistUser.alias}: +1 assist`);
              }
            }
          } else {
            console.warn(`  ⚠️ Player ID ${playerId} not found in users`);
          }
        }
      }
      
      // Process cards
      if (data.cards && Array.isArray(data.cards)) {
        for (const card of data.cards) {
          const playerId = card.playerId;
          const user = usersMap.get(playerId);
          
          if (user) {
            if (!statsCounters.has(user.email)) {
              statsCounters.set(user.email, {
                goals: 0,
                assists: 0,
                yellowCards: 0,
                redCards: 0,
                figureOfTheMatch: 0
              });
            }
            
            if (card.cardType === 'yellow') {
              statsCounters.get(user.email)!.yellowCards++;
              console.log(`  🟨 ${user.alias}: +1 yellow card`);
            } else if (card.cardType === 'red') {
              statsCounters.get(user.email)!.redCards++;
              console.log(`  🟥 ${user.alias}: +1 red card`);
            }
          } else {
            console.warn(`  ⚠️ Player ID ${playerId} not found in users`);
          }
        }
      }
      
      // Process figure of the match
      if (data.figureOfTheMatchId) {
        const user = usersMap.get(data.figureOfTheMatchId);
        
        if (user) {
          if (!statsCounters.has(user.email)) {
            statsCounters.set(user.email, {
              goals: 0,
              assists: 0,
              yellowCards: 0,
              redCards: 0,
              figureOfTheMatch: 0
            });
          }
          
          statsCounters.get(user.email)!.figureOfTheMatch++;
          console.log(`  ⭐ ${user.alias}: +1 figure of the match`);
        } else {
          console.warn(`  ⚠️ Figure player ID ${data.figureOfTheMatchId} not found in users`);
        }
      }
    }
    
    // Update stats in Firestore
    console.log('\n\n💾 Updating stats in Firestore...\n');
    
    let updatedCount = 0;
    for (const [email, counters] of statsCounters) {
      const statsRef = doc(db, 'stats', email);
      const statsDoc = await getDoc(statsRef);
      
      if (statsDoc.exists()) {
        await updateDoc(statsRef, {
          goals: counters.goals,
          assists: counters.assists,
          yellowCards: counters.yellowCards,
          redCards: counters.redCards,
          figureOfTheMatch: counters.figureOfTheMatch,
          lastUpdated: serverTimestamp()
        });
        
        const user = Array.from(usersMap.values()).find(u => u.email === email);
        console.log(`✅ Updated stats for ${user?.alias || email}:`, counters);
        updatedCount++;
      } else {
        console.warn(`⚠️ Stats document not found for ${email}`);
      }
    }
    
    console.log(`\n\n🎉 REPROCESSING COMPLETE!`);
    console.log(`📊 Updated ${updatedCount} player stats`);
    console.log(`\n💡 Go to Statistics page to see the updated data!`);
    
    return {
      success: true,
      updatedCount,
      stats: Object.fromEntries(statsCounters)
    };
    
  } catch (error) {
    console.error('❌ Error reprocessing match results:', error);
    return {
      success: false,
      error
    };
  }
};

// Make it available in window for easy access
if (typeof window !== 'undefined') {
  (window as any).reprocessMatchResults = reprocessAllMatchResults;
}

