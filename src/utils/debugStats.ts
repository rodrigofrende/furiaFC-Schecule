import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Debug utility to check stats data flow
 */
export const debugStatsFlow = async () => {
  console.log('🔍 DEBUGGING STATS FLOW...\n');
  
  try {
    // 1. Check users collection
    console.log('📋 STEP 1: Checking users collection...');
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);
    
    const usersList: any[] = [];
    usersSnapshot.forEach((doc) => {
      const data = doc.data();
      usersList.push({
        docId: doc.id,
        email: data.email,
        alias: data.alias,
        role: data.role
      });
    });
    
    console.log(`Found ${usersList.length} users:`);
    console.table(usersList);
    
    // 2. Check stats collection
    console.log('\n📊 STEP 2: Checking stats collection...');
    const statsRef = collection(db, 'stats');
    const statsSnapshot = await getDocs(statsRef);
    
    const statsList: any[] = [];
    statsSnapshot.forEach((doc) => {
      const data = doc.data();
      statsList.push({
        docId: doc.id,
        userId: data.userId,
        displayName: data.displayName,
        goals: data.goals || 0,
        assists: data.assists || 0,
        yellowCards: data.yellowCards || 0,
        redCards: data.redCards || 0,
        figureOfTheMatch: data.figureOfTheMatch || 0,
        lastUpdated: data.lastUpdated?.toDate?.()?.toISOString() || 'N/A'
      });
    });
    
    console.log(`Found ${statsList.length} stats documents:`);
    console.table(statsList);
    
    // 3. Check match_results collection
    console.log('\n⚽ STEP 3: Checking match_results collection...');
    const resultsRef = collection(db, 'match_results');
    const resultsSnapshot = await getDocs(resultsRef);
    
    const resultsList: any[] = [];
    resultsSnapshot.forEach((doc) => {
      const data = doc.data();
      resultsList.push({
        docId: doc.id,
        rivalName: data.rivalName,
        furiaGoals: data.furiaGoals,
        rivalGoals: data.rivalGoals,
        goalsCount: data.goals?.length || 0,
        cardsCount: data.cards?.length || 0,
        figureId: data.figureOfTheMatchId || 'none'
      });
    });
    
    console.log(`Found ${resultsList.length} match results:`);
    console.table(resultsList);
    
    // 4. Detailed match results
    if (resultsSnapshot.size > 0) {
      console.log('\n🔍 STEP 4: Detailed match results...');
      for (const resultDoc of resultsSnapshot.docs) {
        const data = resultDoc.data();
        console.log(`\n--- Match: ${data.rivalName} ---`);
        console.log('Goals:', data.goals);
        console.log('Cards:', data.cards);
        console.log('Figure:', data.figureOfTheMatchId, '-', data.figureOfTheMatchName);
      }
    }
    
    // 5. Cross-reference check
    console.log('\n🔗 STEP 5: Cross-referencing players in match_results with stats...');
    const playersInMatches = new Set<string>();
    
    resultsSnapshot.forEach((doc) => {
      const data = doc.data();
      data.goals?.forEach((goal: any) => {
        playersInMatches.add(goal.playerId);
        if (goal.assistPlayerId) {
          playersInMatches.add(goal.assistPlayerId);
        }
      });
      data.cards?.forEach((card: any) => {
        playersInMatches.add(card.playerId);
      });
      if (data.figureOfTheMatchId) {
        playersInMatches.add(data.figureOfTheMatchId);
      }
    });
    
    console.log('\nPlayers with activity in matches:', Array.from(playersInMatches));
    
    // Check if these players have stats
    for (const playerId of playersInMatches) {
      console.log(`\nPlayer ID: ${playerId}`);
      
      // Try to find user by doc ID
      const userDocById = await getDoc(doc(db, 'users', playerId));
      if (userDocById.exists()) {
        const userData = userDocById.data();
        console.log(`  ✅ Found user by ID: ${userData.alias || userData.email}`);
        
        // Check stats by email
        const statsDocByEmail = await getDoc(doc(db, 'stats', userData.email));
        if (statsDocByEmail.exists()) {
          console.log(`  ✅ Has stats (by email): ${userData.email}`, statsDocByEmail.data());
        } else {
          console.log(`  ❌ NO stats found for email: ${userData.email}`);
        }
        
        // Check stats by ID
        const statsDocById = await getDoc(doc(db, 'stats', playerId));
        if (statsDocById.exists()) {
          console.log(`  ⚠️ Stats found by ID (should be by email!)`, statsDocById.data());
        }
      } else {
        console.log(`  ❌ User not found by ID`);
      }
    }
    
    console.log('\n✅ DEBUG COMPLETE\n');
    
  } catch (error) {
    console.error('❌ Error during debug:', error);
  }
};

// Make it available in window for easy access
if (typeof window !== 'undefined') {
  (window as any).debugStats = debugStatsFlow;
}

