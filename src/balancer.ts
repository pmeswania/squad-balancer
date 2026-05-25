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
}

export type PlayerRole = 'GK' | 'DEF' | 'MID' | 'ATT';

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

/**
 * Calculates metrics for a group of players forming a team.
 */
export function calculateTeamMetrics(players: Player[]): TeamMetrics {
  if (players.length === 0) {
    return { avgSkill: 0, avgStamina: 0, gkCount: 0, defCount: 0, midCount: 0, attCount: 0 };
  }

  let totalSkill = 0;
  let totalStamina = 0;
  let gkCount = 0;
  let defCount = 0;
  let midCount = 0;
  let attCount = 0;

  for (const player of players) {
    totalSkill += player.bestRating;
    totalStamina += player.stamina || 70;

    const role = getPlayerRole(player);
    if (role === 'GK') gkCount++;
    else if (role === 'DEF') defCount++;
    else if (role === 'MID') midCount++;
    else if (role === 'ATT') attCount++;
  }

  return {
    avgSkill: Math.round((totalSkill / players.length) * 10) / 10,
    avgStamina: Math.round((totalStamina / players.length) * 10) / 10,
    gkCount,
    defCount,
    midCount,
    attCount
  };
}

/**
 * Calculates a penalty score for an entire partition of teams.
 * Lower score = better balanced partition.
 */
function evaluatePartition(teams: Team[]): number {
  if (teams.length <= 1) return 0;

  // Calculate overall means
  let totalSkillMean = 0;
  let totalStaminaMean = 0;
  for (const team of teams) {
    totalSkillMean += team.metrics.avgSkill;
    totalStaminaMean += team.metrics.avgStamina;
  }
  const meanSkill = totalSkillMean / teams.length;
  const meanStamina = totalStaminaMean / teams.length;

  let skillVariance = 0;
  let staminaVariance = 0;
  let gkVariance = 0;
  let defVariance = 0;
  let midVariance = 0;
  let attVariance = 0;
  let sizeVariance = 0;

  // Compute variance for sizes
  const sizes = teams.map(t => t.players.length);
  const meanSize = sizes.reduce((sum, s) => sum + s, 0) / teams.length;

  for (const team of teams) {
    skillVariance += Math.pow(team.metrics.avgSkill - meanSkill, 2);
    staminaVariance += Math.pow(team.metrics.avgStamina - meanStamina, 2);
    sizeVariance += Math.pow(team.players.length - meanSize, 2);
    
    // We want to minimize variance of specific positions
    gkVariance += Math.pow(team.metrics.gkCount, 2); // penalties for uneven GK distribution
    defVariance += Math.pow(team.metrics.defCount, 2);
    midVariance += Math.pow(team.metrics.midCount, 2);
    attVariance += Math.pow(team.metrics.attCount, 2);
  }

  // To penalize uneven GK distribution, we check the global GK count spread.
  // If we have 2 GKs, they should be in separate teams.
  // We can measure the gap between max and min GK counts.
  const gkCounts = teams.map(t => t.metrics.gkCount);
  const gkGap = Math.max(...gkCounts) - Math.min(...gkCounts);

  // Big size mismatch is highly discouraged
  const sizeGap = Math.max(...sizes) - Math.min(...sizes);

  // Scoring weights:
  // - Size imbalance: extremely critical (maximum 1 player difference)
  // - Skill average variance: highly critical
  // - GK gap: extremely critical
  // - Subrole counts variance: moderate priority (so positional mix is good)
  // - Stamina variance: minor priority
  
  return (
    (sizeGap * 10000) + 
    (gkGap * 5000) +
    (skillVariance * 1000) +
    (sizeVariance * 2000) +
    (gkVariance * 100) +
    (defVariance * 20) +
    (midVariance * 12) +
    (attVariance * 20) +
    (staminaVariance * 5)
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
export function generateBalancedTeams(players: Player[], numTeams: number): Team[] {
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

  let bestScore = evaluatePartition(bestTeams);

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

    const newScore = evaluatePartition(bestTeams);

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
