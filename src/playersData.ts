/**
 * Default players skills/traits/positional ratings matrix in CSV format.
 * This is saved to localStorage on first load and can be fully edited by the user.
 */

export const DEFAULT_PLAYERS_CSV = `Surname,First name,Goalkeeper,Right back,Left back,Centre back,Defensive Midfielder,Midfielder,Attacking Midfielder,Winger,Striker,Stamina,Positive attribute,Negative attribute
.,Hilli,,,,,,,,80,80,91,quick,
Af,Kaiser,,82,82,95,82,80,,,,90,controls the defence,
Allen,Gary,,81,81,86,85,83,,,,75,very solid,slows the pace down
Andrew,Cox,99,,,,,,,,,70,amazing keeper,Bad knees
Attwell,Steven,,,75,,,,,83,82,75,comes back to support the team,Does not score as often as he should
Batista,Ronald,,70,,70,78,65,,,,70,tenacious,Poor positional awareness
Butler,Sean,,,,85,85,85,,,,80,solid player,has not played in a while
Car Key,Anikesh,,68,68,,,,68,,,80,tenacious,loses the ball instead of passing
Child,Eze_Small,,,,,,,99,99,99,99,,
Child,Arjun,,78,78,82,,,70,,,85,,can get lazy
Cork,Danny,,,,,,96,,,,92,controls the midfield,
Dale,Andy,,,,88,,,,,,75,great communication,
Dave,3_Touch,,,70,,,,,73,,70,,tries to do things that are beyond his limited ability
Deo,Mr_Whiskey,,41,40,43,,,,,,40,good positioning,lacking basic coordination
Do you love me,Keke,,,,,,78,87,,,92,quick,"easy to wind up, gets lazy if he is not winning"
Dobbyn-Scott,Joshua,,,,78,,,,,82,75,,
Drawater,Sean,,,,96,84,75,,,,92,runs the defence,
Elliott,Walker,,,,,,,86,86,,80,,
Ezzy,T&Bread,,,,91,,85,,,,85,,poor positional discipline
GK,Rohit,88,78,78,80,,,,,,85,,
Howard,Jake,,,,,,83,85,85,,80,will step back to support team if needed,
Jake,Putrid,69,69,69,69,,,,69,,60,tenacious,
James,Steamroller,,40,40,,,,,,,40,,
Jayson+1,Kenn,,,,,,77,,,,72,has a lot of quality,will lose ball often
Jonny,Spaghetti_legs,,,,,,,,70,,70,,
Josh++,Chkn_Tika,,78,78,83,82,83,77,78,,78,"solid, everywhere",
Khoshkhoo,Mo,,70,,,,,73,73,,85,,poor positional discipline
Konda Shrestha,Gaurav,,,,,,,72,,,70,,
Ludlow,Ryan,,,,,,,80,80,,80,,
M. M.,Keylor,,,,78,,,,,87,75,skilful,slow
Maroon,Maroon,,,,78,,80,82,,,82,fall out of position leaving defence vulnerable,
Mehra,Jayson,,,99,,,97,,,,85,great communicator,negative when losing
Meswania,Tesh,,82,80,77,,,,,,90,tenacious,
Miries,Cristiano,,,,,,95,99,99,,99,,
Miries,Rafael,,,,,,,82,82,,99,very good ball control,refuses to pass
Mukadam,Raf,,83,83,83,,,,,,85,tenacious,rarely in line with the rest of the defence
Neil K,Jebus,78,,,,,,,,,70,,
Nepal,Kishor,,,84,,,,,,,80,,
P,Chris,,,,,,83,88,88,,88,,
Peterschinigg,Judas,,82,82,87,,,,81,87,80,versatile,gets negative when losing
Peterschinigg,David,81,,,,,,,,,40,fat enough to cover a big portion of the goal,can sometimes be lazy and unbothered
Rangsi,Rich,,,90,,92,88,,,,89,versatile,
Rit,LadyKiler,,,83,77,,,,79,,83,,poor positional discipline
Saleh,Malik,,,78,,,,,,78,78,,
Shahid,Yousuf,,,,,,,82,82,,99,very good ball control,refuses to pass
Shahid,Mikail,,,,,,,82,82,,99,very good ball control,refuses to pass
Siqi,Lee,,,,,94,92,,,,98,extremely tenacious,poor communicator
Stef,Match_Fixer,,,,,93,96,,,,95,,
Steven+1,Sam GK,88,78,78,78,,,,,,75,,
Stray,Stefan,,,,,,86,,,,99,,
Tantrum,Ballack,,82,78,70,75,73,,,,70,,will have a tantrum if losing
Thursday,Sam,,,,98,,93,,,98,86,,
Thursday,Aanish,,,,,,,83,83,,87,,
Tudusciuc,Alex,,,,,,,80,80,,99,,
Weatherspoons,Jenks,,81,,,,,,83,,92,,
Williams,Joel,92,80,80,80,,,,,,80,,
Wilson,Good_Jake,,,,,,84,80,81,,86,,
Yad,Big_Toe,,60,,60,78,73,,,,55,,slow 
~,Seb,,,81,,,,,83,,83,,poor positional discipline`;

export interface Player {
  id: string;
  surname: string;
  firstName: string;
  goalkeeper?: number;
  rightBack?: number;
  leftBack?: number;
  centreBack?: number;
  defensiveMidfielder?: number;
  midfielder?: number;
  attackingMidfielder?: number;
  winger?: number;
  striker?: number;
  stamina?: number;
  positiveAttribute?: string;
  negativeAttribute?: string;
  // Computed values:
  fullName: string;
  bestRating: number;
  bestPosition: string;
  isCustomGuest?: boolean;
}

export type PositionKey = 
  | 'goalkeeper' 
  | 'rightBack' 
  | 'leftBack' 
  | 'centreBack' 
  | 'defensiveMidfielder' 
  | 'midfielder' 
  | 'attackingMidfielder' 
  | 'winger' 
  | 'striker';

export const POSITION_LABELS: Record<PositionKey, string> = {
  goalkeeper: 'Goalkeeper',
  rightBack: 'Right Back',
  leftBack: 'Left Back',
  centreBack: 'Centre Back',
  defensiveMidfielder: 'Defensive Midfielder',
  midfielder: 'Midfielder',
  attackingMidfielder: 'Attacking Midfielder',
  winger: 'Winger',
  striker: 'Striker'
};

export const POSITION_FIELDS: Array<{ key: PositionKey; label: string }> = [
  { key: 'goalkeeper', label: 'Goalkeeper' },
  { key: 'rightBack', label: 'Right Back' },
  { key: 'leftBack', label: 'Left Back' },
  { key: 'centreBack', label: 'Centre Back' },
  { key: 'defensiveMidfielder', label: 'Defensive Midfielder' },
  { key: 'midfielder', label: 'Midfielder' },
  { key: 'attackingMidfielder', label: 'Attacking Midfielder' },
  { key: 'winger', label: 'Winger' },
  { key: 'striker', label: 'Striker' }
];

/**
 * Parses a CSV line safely, accounting for quoted strings that contain commas.
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let inQuotes = false;
  let currentToken = '';

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(currentToken.trim());
      currentToken = '';
    } else {
      currentToken += char;
    }
  }
  result.push(currentToken.trim());
  return result;
}

/**
 * Parses raw CSV string to Player records.
 */
export function parsePlayersCsv(csv: string): Player[] {
  const lines = csv.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length <= 1) return [];

  // Index mapping based on headers
  const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase());
  
  const players: Player[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length < 2) continue;

    const surname = values[0] || '';
    const firstName = values[1] || '';
    if (!surname && !firstName) continue;

    const player: Partial<Player> = {
      id: `${surname.replace(/[^a-zA-Z0-9]/g, '')}_${firstName.replace(/[^a-zA-Z0-9]/g, '')}_${i}`,
      surname,
      firstName,
      fullName: surname && firstName 
        ? (surname === '.' ? firstName : `${firstName} ${surname}`) 
        : (firstName || surname)
    };

    const parseNum = (val: string): number | undefined => {
      if (!val) return undefined;
      const num = parseInt(val, 10);
      return isNaN(num) ? undefined : num;
    };

    player.goalkeeper = parseNum(values[2]);
    player.rightBack = parseNum(values[3]);
    player.leftBack = parseNum(values[4]);
    player.centreBack = parseNum(values[5]);
    player.defensiveMidfielder = parseNum(values[6]);
    player.midfielder = parseNum(values[7]);
    player.attackingMidfielder = parseNum(values[8]);
    player.winger = parseNum(values[9]);
    player.striker = parseNum(values[10]);
    player.stamina = parseNum(values[11]) || 70; // fallback standard stamina
    player.positiveAttribute = values[12] || '';
    player.negativeAttribute = values[13] || '';

    // Calculate best position and best rating
    let bestRating = 60; // minimum template rating
    let bestPos: PositionKey = 'midfielder';
    let hasPositions = false;

    for (const { key } of POSITION_FIELDS) {
      const rating = player[key];
      if (rating !== undefined && rating > 0) {
        hasPositions = true;
        if (rating > bestRating || (rating === bestRating && key === 'midfielder')) {
          bestRating = rating;
          bestPos = key;
        }
      }
    }

    if (!hasPositions) {
      // If no positions, check Stamina or just fallback
      bestRating = 70;
      bestPos = 'midfielder';
    }

    player.bestRating = bestRating;
    player.bestPosition = POSITION_LABELS[bestPos];

    players.push(player as Player);
  }

  return players;
}

/**
 * Searches the list of database players to find fuzzy matches for a given raw name input.
 * E.g., "Cristiano Miries" -> matches "Miries, Cristiano"
 * "Ballack Tantrum" -> matches "Tantrum, Ballack"
 */
export interface MatchDetails {
  player: Player | null;
  confidence: 'high' | 'low' | 'none';
  score: number;
}

/**
 * Detailed matcher that determines the best matches with confidence scores.
 */
export function getMatchDetails(rawName: string, players: Player[]): MatchDetails {
  const cleanStr = rawName.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '');
  if (!cleanStr) return { player: null, confidence: 'none', score: 0 };

  // Split into tokens
  const tokens = cleanStr.split(/\s+/).filter(t => t.length > 0);
  if (tokens.length === 0) return { player: null, confidence: 'none', score: 0 };

  let bestMatch: Player | null = null;
  let highestScore = 0;
  let matchesExact = false;

  const MATCH_IGNORE_WORDS = new Set([
    'of', 'and', 'with', 'guest', 'friend', 'plus', 'child', 'small', 'other', 'temp', 'the', 'new', 'old',
    'sir', 'mr', 'ms', 'mrs', 'dr', 'to', 'for', 'by', 'plus1', 'plusone'
  ]);

  // Extract significant query tokens
  const cleanTokens = tokens
    .map(t => t.replace(/[^a-z0-9]/g, ''))
    .filter(t => t.length >= 3 && !MATCH_IGNORE_WORDS.has(t) && !/^\d+$/.test(t));

  for (const player of players) {
    const rawFName = player.firstName.toLowerCase();
    const rawSName = player.surname.toLowerCase();

    // Support underscore splitting (e.g. Eze_Small -> eze, small)
    const fNameCleaned = rawFName.replace(/_/g, ' ');
    const sNameCleaned = rawSName.replace(/_/g, ' ');

    const fNameParts = fNameCleaned.split(/\s+/).filter(p => p.length > 0);
    const sNameParts = sNameCleaned.split(/\s+/).filter(p => p.length > 0);
    const allPlayerParts = [...fNameParts, ...sNameParts];

    // Concat-based checks for exact match
    const fNameConcat = fNameCleaned.replace(/\s+/g, '');
    const sNameConcat = sNameCleaned.replace(/\s+/g, '');
    const queryNoSpace = cleanStr.replace(/\s+/g, '');

    if (
      queryNoSpace === fNameConcat ||
      queryNoSpace === sNameConcat ||
      queryNoSpace === (fNameConcat + sNameConcat) ||
      queryNoSpace === (sNameConcat + fNameConcat)
    ) {
      return { player, confidence: 'high', score: 100 };
    }

    // Score based on token matches
    let score = 0;
    let matchedSignificantCount = 0;

    for (const token of tokens) {
      const exactMatch = allPlayerParts.some(p => p === token);
      const partialMatch = allPlayerParts.some(p => p.includes(token) || token.includes(p));

      if (exactMatch) {
        // If it's a generic word like "child" or "guest", give it less weight to prevent accidental high mismatch scores
        if (MATCH_IGNORE_WORDS.has(token)) {
          score += 3;
        } else {
          score += 10;
        }
      } else if (partialMatch) {
        if (MATCH_IGNORE_WORDS.has(token)) {
          score += 1;
        } else {
          score += 3;
        }
      }
    }

    // Special exact substring checks
    const fullCombined = `${fNameCleaned} ${sNameCleaned}`;
    const reverseCombined = `${sNameCleaned} ${fNameCleaned}`;
    if (fullCombined.includes(cleanStr) || reverseCombined.includes(cleanStr)) {
      score += 5;
    }

    // Check how many of our significant query tokens matched
    if (cleanTokens.length > 0) {
      for (const t of cleanTokens) {
        const matchesPart = allPlayerParts.some(
          p => p === t || p.includes(t) || t.includes(p)
        );
        if (matchesPart) {
          matchedSignificantCount++;
        }
      }
    }

    // Protect against partial mismatches on composite names (e.g. Jofa Am +1 Of Rohit)
    // If we have multiple significant tokens, and only some match, reject if ratio is low.
    if (cleanTokens.length > 1 && matchedSignificantCount < cleanTokens.length) {
      const matchRatio = matchedSignificantCount / cleanTokens.length;
      if (matchRatio < 0.70) {
        continue;
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = player;
    }
  }

  // If score is too low, we won't even think it's a low-confidence match (complete mismatch)
  if (highestScore < 8 || !bestMatch) {
    return { player: null, confidence: 'none', score: highestScore };
  }

  // Determine if it is high confidence or low confidence
  let confidence: 'high' | 'low' = 'low';

  // If it scores very high (contains at least double perfect non-ignore tokens, or exact match)
  if (highestScore >= 18) {
    confidence = 'high';
  } else if (cleanTokens.length > 0) {
    // If we have significant tokens, let's make sure the best match has matching significant tokens
    const playerCleanName = `${bestMatch.firstName} ${bestMatch.surname}`.toLowerCase().replace(/_/g, ' ');
    const matchedSigCount = cleanTokens.filter(t => playerCleanName.includes(t)).length;

    // If we matched all of the significant tokens, confidence is high!
    if (matchedSigCount === cleanTokens.length && highestScore >= 10) {
      confidence = 'high';
    }
  } else {
    // Zero significant tokens (e.g. "other child" where both are ignores), should ALWAYS be low confidence
    confidence = 'low';
  }

  return { player: bestMatch, confidence, score: highestScore };
}

export function fuzzyMatchPlayer(rawName: string, players: Player[]): Player | null {
  const result = getMatchDetails(rawName, players);
  return result.confidence === 'high' ? result.player : null;
}

/**
 * Parses raw pasted attending text into individual potential player lines.
 */
export function parsePastedAttendees(text: string): string[] {
  return text
    .split(/[\n,;]+/)
    .map(line => line.trim())
    .filter(line => {
      // Filter out utility layout lines, headers, numbers, and garbage
      if (line.length < 2) return false;
      
      const lower = line.toLowerCase();
      // Ignore headings or text indicators
      if (lower.startsWith('surname') || lower.startsWith('first name')) return false;
      if (lower.includes('players attending') || lower.includes('screenshot') || lower.includes('weekly list')) return false;
      
      return true;
    });
}

/**
 * Serializes Player records back to a CSV string.
 */
export function serializePlayersToCsv(players: Player[]): string {
  const headers = "Surname,First name,Goalkeeper,Right back,Left back,Centre back,Defensive Midfielder,Midfielder,Attacking Midfielder,Winger,Striker,Stamina,Positive attribute,Negative attribute";
  const escape = (val: any) => {
    if (val === undefined || val === null) return '';
    const s = String(val);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const rows = players.map(p => {
    return [
      escape(p.surname),
      escape(p.firstName),
      p.goalkeeper !== undefined ? String(p.goalkeeper) : '',
      p.rightBack !== undefined ? String(p.rightBack) : '',
      p.leftBack !== undefined ? String(p.leftBack) : '',
      p.centreBack !== undefined ? String(p.centreBack) : '',
      p.defensiveMidfielder !== undefined ? String(p.defensiveMidfielder) : '',
      p.midfielder !== undefined ? String(p.midfielder) : '',
      p.attackingMidfielder !== undefined ? String(p.attackingMidfielder) : '',
      p.winger !== undefined ? String(p.winger) : '',
      p.striker !== undefined ? String(p.striker) : '',
      p.stamina !== undefined ? String(p.stamina) : '',
      escape(p.positiveAttribute),
      escape(p.negativeAttribute)
    ].join(',');
  });
  return [headers, ...rows].join('\n');
}

