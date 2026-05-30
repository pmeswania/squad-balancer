import { Player, PositionKey } from './playersData';

export interface Team {
  id: number;
  name: string;
  players: Player[];
  metrics: TeamMetrics;
}

export interface TeamMetrics {
  avgSkill: number;
  avgStamina: number;
  gkCount: number;
  defCount: number;
  midCount: number;
  attCount: number;
  avgDefending?: number;
  avgMidfield?: number;
  avgAttacking?: number;
  // Optional parsed trait counts for backward compatibility & analytical balancing
  poorPositioningCount?: number;
  lazyCount?: number;
  slowCount?: number;
  poorPassingCount?: number;
  temperamentCount?: number;
  tenaciousCount?: number;
  communicatorCount?: number;
  quickCount?: number;
  solidCount?: number;
}

export type PlayerRole = 'GK' | 'DEF' | 'MID' | 'ATT';

/**
 * Classifies a player's traits from their description parameters.
 */
export interface PlayerTraits {
  poorPositioning: boolean;
  lazy: boolean;
  slow: boolean;
  poorPassing: boolean;
  temperament: boolean;
  
  tenacious: boolean;
  communicator: boolean;
  quick: boolean;
  solid: boolean;
}

export function getPlayerTraits(player: Player): PlayerTraits {
  const posAttr = (player.positiveAttribute || '').toLowerCase();
  const negAttr = (player.negativeAttribute || '').toLowerCase();

  return {
    poorPositioning: negAttr.includes('position') || negAttr.includes('discipline') || negAttr.includes('awareness') || negAttr.includes('vulnerable') || negAttr.includes('in line') || negAttr.includes('leave defence'),
    lazy: negAttr.includes('lazy') || negAttr.includes('unbothered'),
    slow: negAttr.includes('slow') || negAttr.includes('knee'),
    poorPassing: negAttr.includes('pass') || negAttr.includes('lose') || negAttr.includes('loses') || negAttr.includes('greedy'),
    temperament: negAttr.includes('negative') || negAttr.includes('tantrum') || negAttr.includes('wind') || negAttr.includes('anger'),
    
    tenacious: posAttr.includes('tenacious') || posAttr.includes('work') || posAttr.includes('run'),
    communicator: posAttr.includes('communic') || posAttr.includes('talk') || posAttr.includes('leader'),
    quick: posAttr.includes('quick') || posAttr.includes('fast') || posAttr.includes('pace'),
    solid: posAttr.includes('solid'),
  };
}

/**
 * Classifies a player into a primary tactical role based on their ratings.
 */
export function getPlayerRole(player: Player): PlayerRole {
  // If goalkeeper is high or best rating is goalkeeper, they are GK
  if (player.goalkeeper && player.goalkeeper >= 75) {
    return 'GK';
  }
  
  // Categorize positions
  const posRatings = [
    { role: 'GK' as PlayerRole, val: player.goalkeeper || 0 },
    { role: 'DEF' as PlayerRole, val: Math.max(player.rightBack || 0, player.leftBack || 0, player.centreBack || 0) },
    { role: 'MID' as PlayerRole, val: Math.max(player.defensiveMidfielder || 0, player.midfielder || 0, player.attackingMidfielder || 0) },
    { role: 'ATT' as PlayerRole, val: Math.max(player.winger || 0, player.striker || 0) },
  ];

  posRatings.sort((a, b) => b.val - a.val);
  
  // If they have no position values, default based on name/bestRating
  if (posRatings[0].val === 0) {
    if (player.fullName.toLowerCase().includes('gk') || player.fullName.toLowerCase().includes('keeper')) {
      return 'GK';
    }
    return 'MID'; // standard default
  }

  return posRatings[0].role;
}

export function getPlayerDefendingVal(player: Player): number {
  const values = [player.centreBack, player.rightBack, player.leftBack, player.defensiveMidfielder].filter(v => v !== undefined && v > 0) as number[];
  if (values.length > 0) {
    return Math.max(...values);
  }
  const role = getPlayerRole(player);
  if (role === 'DEF') return player.bestRating;
  if (role === 'MID') return Math.max(40, player.bestRating - 10);
  if (role === 'ATT') return Math.max(40, player.bestRating - 18);
  return 40;
}

export function getPlayerMidfieldVal(player: Player): number {
  const values = [player.defensiveMidfielder, player.midfielder, player.attackingMidfielder].filter(v => v !== undefined && v > 0) as number[];
  if (values.length > 0) {
    return Math.max(...values);
  }
  const role = getPlayerRole(player);
  if (role === 'MID') return player.bestRating;
  if (role === 'DEF') return Math.max(40, player.bestRating - 10);
  if (role === 'ATT') return Math.max(40, player.bestRating - 10);
  return 40;
}

export function getPlayerAttackingVal(player: Player): number {
  const values = [player.attackingMidfielder, player.winger, player.striker].filter(v => v !== undefined && v > 0) as number[];
  if (values.length > 0) {
    return Math.max(...values);
  }
  const role = getPlayerRole(player);
  if (role === 'ATT') return player.bestRating;
  if (role === 'MID') return Math.max(40, player.bestRating - 10);
  if (role === 'DEF') return Math.max(40, player.bestRating - 18);
  return 40;
}

/**
 * Calculates metrics for a group of players forming a team.
 */
export function calculateTeamMetrics(players: Player[]): TeamMetrics {
  if (players.length === 0) {
    return {
      avgSkill: 0,
      avgStamina: 0,
      gkCount: 0,
      defCount: 0,
      midCount: 0,
      attCount: 0,
      avgDefending: 0,
      avgMidfield: 0,
      avgAttacking: 0,
      poorPositioningCount: 0,
      lazyCount: 0,
      slowCount: 0,
      poorPassingCount: 0,
      temperamentCount: 0,
      tenaciousCount: 0,
      communicatorCount: 0,
      quickCount: 0,
      solidCount: 0
    };
  }

  let totalSkill = 0;
  let totalStamina = 0;
  let gkCount = 0;
  let defCount = 0;
  let midCount = 0;
  let attCount = 0;
  let totalDefending = 0;
  let totalMidfield = 0;
  let totalAttacking = 0;
  let poorPositioningCount = 0;
  let lazyCount = 0;
  let slowCount = 0;
  let poorPassingCount = 0;
  let temperamentCount = 0;
  let tenaciousCount = 0;
  let communicatorCount = 0;
  let quickCount = 0;
  let solidCount = 0;

  for (const player of players) {
    totalSkill += player.bestRating;
    totalStamina += player.stamina || 70;
    totalDefending += getPlayerDefendingVal(player);
    totalMidfield += getPlayerMidfieldVal(player);
    totalAttacking += getPlayerAttackingVal(player);

    const role = getPlayerRole(player);
    if (role === 'GK') gkCount++;
    else if (role === 'DEF') defCount++;
    else if (role === 'MID') midCount++;
    else if (role === 'ATT') attCount++;

    const traits = getPlayerTraits(player);
    if (traits.poorPositioning) poorPositioningCount++;
    if (traits.lazy) lazyCount++;
    if (traits.slow) slowCount++;
    if (traits.poorPassing) poorPassingCount++;
    if (traits.temperament) temperamentCount++;
    
    if (traits.tenacious) tenaciousCount++;
    if (traits.communicator) communicatorCount++;
    if (traits.quick) quickCount++;
    if (traits.solid) solidCount++;
  }

  return {
    avgSkill: Math.round((totalSkill / players.length) * 10) / 10,
    avgStamina: Math.round((totalStamina / players.length) * 10) / 10,
    avgDefending: Math.round((totalDefending / players.length) * 10) / 10,
    avgMidfield: Math.round((totalMidfield / players.length) * 10) / 10,
    avgAttacking: Math.round((totalAttacking / players.length) * 10) / 10,
    gkCount,
    defCount,
    midCount,
    attCount,
    poorPositioningCount,
    lazyCount,
    slowCount,
    poorPassingCount,
    temperamentCount,
    tenaciousCount,
    communicatorCount,
    quickCount,
    solidCount
  };
}

/**
 * Calculates a penalty score for an entire partition of teams.
 * Lower score = better balanced partition.
 */
function evaluatePartition(teams: Team[], segregatedPairs?: string[]): number {
  if (teams.length <= 1) return 0;

  // Calculate overall means
  let totalSkillMean = 0;
  let totalStaminaMean = 0;
  let totalDefendingMean = 0;
  let totalMidfieldMean = 0;
  let totalAttackingMean = 0;

  for (const team of teams) {
    totalSkillMean += team.metrics.avgSkill;
    totalStaminaMean += team.metrics.avgStamina;
    totalDefendingMean += team.metrics.avgDefending || 0;
    totalMidfieldMean += team.metrics.avgMidfield || 0;
    totalAttackingMean += team.metrics.avgAttacking || 0;
  }
  const meanSkill = totalSkillMean / teams.length;
  const meanStamina = totalStaminaMean / teams.length;
  const meanDefending = totalDefendingMean / teams.length;
  const meanMidfield = totalMidfieldMean / teams.length;
  const meanAttacking = totalAttackingMean / teams.length;

  let skillVariance = 0;
  let staminaVariance = 0;
  let defendingVariance = 0;
  let midfieldVariance = 0;
  let attackingVariance = 0;

  let gkVariance = 0;
  let defVariance = 0;
  let midVariance = 0;
  let attVariance = 0;
  let sizeVariance = 0;

  // Track parsed attributes variance across teams
  let poorPositioningVariance = 0;
  let lazyVariance = 0;
  let slowVariance = 0;
  let poorPassingVariance = 0;
  let temperamentVariance = 0;
  let tenaciousVariance = 0;
  let communicatorVariance = 0;
  let quickVariance = 0;
  let solidVariance = 0;

  // Compute variance for sizes
  const sizes = teams.map(t => t.players.length);
  const meanSize = sizes.reduce((sum, s) => sum + s, 0) / teams.length;

  for (const team of teams) {
    skillVariance += Math.pow(team.metrics.avgSkill - meanSkill, 2);
    staminaVariance += Math.pow(team.metrics.avgStamina - meanStamina, 2);
    defendingVariance += Math.pow((team.metrics.avgDefending || 0) - meanDefending, 2);
    midfieldVariance += Math.pow((team.metrics.avgMidfield || 0) - meanMidfield, 2);
    attackingVariance += Math.pow((team.metrics.avgAttacking || 0) - meanAttacking, 2);

    sizeVariance += Math.pow(team.players.length - meanSize, 2);
    
    // We want to minimize variance of specific positions
    gkVariance += Math.pow(team.metrics.gkCount, 2); // penalties for uneven GK distribution
    defVariance += Math.pow(team.metrics.defCount, 2);
    midVariance += Math.pow(team.metrics.midCount, 2);
    attVariance += Math.pow(team.metrics.attCount, 2);

    // Sum squares of trait counts to penalize clustering
    poorPositioningVariance += Math.pow(team.metrics.poorPositioningCount || 0, 2);
    lazyVariance += Math.pow(team.metrics.lazyCount || 0, 2);
    slowVariance += Math.pow(team.metrics.slowCount || 0, 2);
    poorPassingVariance += Math.pow(team.metrics.poorPassingCount || 0, 2);
    temperamentVariance += Math.pow(team.metrics.temperamentCount || 0, 2);
    
    tenaciousVariance += Math.pow(team.metrics.tenaciousCount || 0, 2);
    communicatorVariance += Math.pow(team.metrics.communicatorCount || 0, 2);
    quickVariance += Math.pow(team.metrics.quickCount || 0, 2);
    solidVariance += Math.pow(team.metrics.solidCount || 0, 2);
  }

  // To penalize uneven GK distribution, we check the global GK count spread.
  // If we have 2 GKs, they should be in separate teams.
  // We can measure the gap between max and min GK counts.
  const gkCounts = teams.map(t => t.metrics.gkCount);
  const gkGap = Math.max(...gkCounts) - Math.min(...gkCounts);

  // Big size mismatch is highly discouraged
  const sizeGap = Math.max(...sizes) - Math.min(...sizes);

  // Segregation clash calculation
  let segregationPenalty = 0;
  if (segregatedPairs && segregatedPairs.length > 0) {
    const pairsSet = new Set(segregatedPairs);
    for (const team of teams) {
      const pIds = team.players.map(p => p.id);
      for (let i = 0; i < pIds.length; i++) {
        for (let j = i + 1; j < pIds.length; j++) {
          const firstId = pIds[i] < pIds[j] ? pIds[i] : pIds[j];
          const secondId = pIds[i] < pIds[j] ? pIds[j] : pIds[i];
          if (pairsSet.has(`${firstId}:${secondId}`)) {
            segregationPenalty += 20000000; // heavy 20,000,000 penalty to enforce splitting first
          }
        }
      }
    }
  }

  // Scoring weights:
  // - Segregation clashes: absolute highest priority
  // - Size imbalance: extremely critical (maximum 1 player difference)
  // - GK gap: extremely critical
  // - Skill average variance: highly critical
  // - Size variance: highly critical
  // - Positional distribution (GK, DEF, MID, ATT): moderate priority
  // - Traits: Positioning deficiencies, lazy behaviour, low pace, bad passing habits, and high temperaments are distributed
  
  return (
    segregationPenalty +
    (sizeGap * 100000) + 
    (gkGap * 50000) +
    (skillVariance * 10000) +
    (defendingVariance * 8000) +
    (midfieldVariance * 8000) +
    (attackingVariance * 8000) +
    (sizeVariance * 20000) +
    (gkVariance * 500) +
    (defVariance * 100) +
    (midVariance * 60) +
    (attVariance * 105) +
    (staminaVariance * 20) +

    // Attribute distribution penalties
    (poorPositioningVariance * 1500) +
    (lazyVariance * 500) +
    (slowVariance * 500) +
    (poorPassingVariance * 500) +
    (temperamentVariance * 400) +
    (tenaciousVariance * 300) +
    (communicatorVariance * 300) +
    (quickVariance * 300) +
    (solidVariance * 300)
  );
}

/**
 * Suggests team size configuration options given a total count of attending players.
 */
export interface SuggestionOption {
  numTeams: number;
  playersPerTeam: number;
  subsCount: number;
  label: string;
}

export function getTeamSuggestions(playerCount: number): SuggestionOption[] {
  if (playerCount < 2) return [];

  const suggestions: SuggestionOption[] = [];

  // Typical team sizes are from 5-a-side to 11-a-side
  // We check for numbers of teams (2, 3, 4, 5, 6) and map configurations
  const candidateNumTeams = [2, 3, 4, 5, 6].filter(n => n <= playerCount / 2);

  for (const n of candidateNumTeams) {
    const perfectSize = playerCount / n;
    const baseSize = Math.floor(perfectSize);
    const remainder = playerCount % n;

    if (remainder === 0) {
      suggestions.push({
        numTeams: n,
        playersPerTeam: baseSize,
        subsCount: 0,
        label: `${n} Teams of ${baseSize} (Perfect balance)`
      });
    } else {
      suggestions.push({
        numTeams: n,
        playersPerTeam: baseSize,
        subsCount: remainder,
        label: `${n} Teams of ${baseSize} (${remainder} ${remainder === 1 ? 'player' : 'players'} extra or rotating sub)`
      });
    }
  }

  return suggestions;
}

/**
 * Core balancing algorithm.
 * Uses a hybrid approach:
 * 1. Initial snake draft partitioning sorted by player skill.
 * 2. Simulated local search/greedy swapping to minimize variance across skill, stamina, roles, and goalkeeper splits.
 */
export function generateBalancedTeams(players: Player[], numTeams: number, segregatedPairs?: string[]): Team[] {
  if (players.length === 0 || numTeams <= 0) return [];

  // Sort players by bestRating descending so our initial snake draft starts strong
  const sortedPlayers = [...players].sort((a, b) => b.bestRating - a.bestRating);

  // Group goalkeepers and non-goalkeepers so they can be distributed first
  const goalkeepers = sortedPlayers.filter(p => getPlayerRole(p) === 'GK');
  const outfield = sortedPlayers.filter(p => getPlayerRole(p) !== 'GK');

  // Let's declare our teams structure
  let bestTeams: Team[] = Array.from({ length: numTeams }, (_, i) => ({
    id: i + 1,
    name: `Team ${String.fromCharCode(65 + i)}`, // Team A, Team B, Team C...
    players: [],
    metrics: { avgSkill: 0, avgStamina: 0, gkCount: 0, defCount: 0, midCount: 0, attCount: 0 }
  }));

  // Initial snake distribution
  // Distribute Goalkeepers first
  let teamIdx = 0;
  let direction = 1; // 1 for forward, -1 for reverse
  
  for (const gk of goalkeepers) {
    bestTeams[teamIdx].players.push(gk);
    teamIdx += direction;
    if (teamIdx >= numTeams) {
      teamIdx = numTeams - 1;
      direction = -1;
    } else if (teamIdx < 0) {
      teamIdx = 0;
      direction = 1;
    }
  }

  // Distribute Outfield players using a continuous snake draft to make it as fair as possible initially
  for (const p of outfield) {
    bestTeams[teamIdx].players.push(p);
    teamIdx += direction;
    if (teamIdx >= numTeams) {
      teamIdx = numTeams - 1;
      direction = -1;
    } else if (teamIdx < 0) {
      teamIdx = 0;
      direction = 1;
    }
  }

  // Calculate metrics for initial partition
  for (const team of bestTeams) {
    team.metrics = calculateTeamMetrics(team.players);
  }

  let bestScore = evaluatePartition(bestTeams, segregatedPairs);

  // LOCAL REFINEMENT SEARCH (Greedy hill-climbing swap)
  // We perform up to 4,000 iterations of random player swaps. If a swap makes the rating variance
  // or layout better (lower penalty), we keep it, otherwise we revert.
  const iterations = 4000;
  
  for (let iter = 0; iter < iterations; iter++) {
    // Pick two random, distinct teams
    const team1Idx = Math.floor(Math.random() * numTeams);
    const team2Idx = (team1Idx + 1 + Math.floor(Math.random() * (numTeams - 1))) % numTeams;

    const t1 = bestTeams[team1Idx];
    const t2 = bestTeams[team2Idx];

    if (t1.players.length === 0 || t2.players.length === 0) continue;

    // Pick a random player from each team
    const p1Idx = Math.floor(Math.random() * t1.players.length);
    const p2Idx = Math.floor(Math.random() * t2.players.length);

    const p1 = t1.players[p1Idx];
    const p2 = t2.players[p2Idx];

    // Swap players temporarily
    t1.players[p1Idx] = p2;
    t2.players[p2Idx] = p1;

    // Recalculate metrics for both teams
    const origMetrics1 = t1.metrics;
    const origMetrics2 = t2.metrics;
    
    t1.metrics = calculateTeamMetrics(t1.players);
    t2.metrics = calculateTeamMetrics(t2.players);

    const newScore = evaluatePartition(bestTeams, segregatedPairs);

    if (newScore < bestScore) {
      // Keep the swap! It's a better balance
      bestScore = newScore;
    } else {
      // Revert the swap
      t1.players[p1Idx] = p1;
      t2.players[p2Idx] = p2;
      t1.metrics = origMetrics1;
      t2.metrics = origMetrics2;
    }
  }

  // Ensure teams are sorted by ID or size, and players inside are sorted by best position / skill descending
  return bestTeams.map(team => {
    team.players.sort((a, b) => b.bestRating - a.bestRating);
    team.metrics = calculateTeamMetrics(team.players);
    return team;
  });
}
