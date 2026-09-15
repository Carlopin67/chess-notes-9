// ============================================================
// MOTOR DE AJEDREZ (parser SAN + estado del tablero)
// ============================================================

function createInitialBoard() {
  const empty = () => new Array(8).fill(null);
  const board = [empty(), empty(), empty(), empty(), empty(), empty(), empty(), empty()];
  const backRank = ['R','N','B','Q','K','B','N','R'];
  for (let f = 0; f < 8; f++) {
    board[0][f] = { type: backRank[f], color: 'b' };
    board[1][f] = { type: 'P', color: 'b' };
    board[6][f] = { type: 'P', color: 'w' };
    board[7][f] = { type: backRank[f], color: 'w' };
  }
  return board;
}

function newGameState() {
  return {
    board: createInitialBoard(),
    turn: 'w',
    enPassantTarget: null,
    castling: { wK: true, wQ: true, bK: true, bQ: true },
    moveHistory: [],
    positions: [],
    lastMoveSquares: [null], // {from, to} por posición, para resaltar
    result: null
  };
}

function squareToCoords(square) {
  const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = 8 - parseInt(square[1], 10);
  return { file, rank };
}
function coordsToSquare(file, rank) {
  return String.fromCharCode('a'.charCodeAt(0) + file) + (8 - rank);
}
function inBounds(file, rank) { return file >= 0 && file < 8 && rank >= 0 && rank < 8; }
function pieceAt(board, file, rank) { return inBounds(file, rank) ? board[rank][file] : null; }

function isPathClear(board, fromFile, fromRank, toFile, toRank) {
  const dFile = Math.sign(toFile - fromFile);
  const dRank = Math.sign(toRank - fromRank);
  let f = fromFile + dFile, r = fromRank + dRank;
  while (f !== toFile || r !== toRank) {
    if (pieceAt(board, f, r)) return false;
    f += dFile; r += dRank;
  }
  return true;
}

function canPieceReach(state, piece, fromFile, fromRank, toFile, toRank, isCapture) {
  const board = state.board;
  const dFile = toFile - fromFile;
  const dRank = toRank - fromRank;
  switch (piece.type) {
    case 'N':
      return (Math.abs(dFile) === 1 && Math.abs(dRank) === 2) ||
             (Math.abs(dFile) === 2 && Math.abs(dRank) === 1);
    case 'B':
      if (Math.abs(dFile) !== Math.abs(dRank)) return false;
      return isPathClear(board, fromFile, fromRank, toFile, toRank);
    case 'R':
      if (dFile !== 0 && dRank !== 0) return false;
      return isPathClear(board, fromFile, fromRank, toFile, toRank);
    case 'Q':
      if (dFile !== 0 && dRank !== 0 && Math.abs(dFile) !== Math.abs(dRank)) return false;
      return isPathClear(board, fromFile, fromRank, toFile, toRank);
    case 'K':
      return Math.abs(dFile) <= 1 && Math.abs(dRank) <= 1 && (dFile !== 0 || dRank !== 0);
    case 'P': {
      const direction = piece.color === 'w' ? -1 : 1;
      const startRank = piece.color === 'w' ? 6 : 1;
      if (isCapture) {
        return dRank === direction && Math.abs(dFile) === 1;
      } else {
        if (dFile !== 0) return false;
        if (dRank === direction && !pieceAt(board, toFile, toRank)) return true;
        if (dRank === 2 * direction && fromRank === startRank &&
            !pieceAt(board, toFile, fromRank + direction) &&
            !pieceAt(board, toFile, toRank)) return true;
        return false;
      }
    }
  }
  return false;
}

function findSourceSquares(state, pieceType, color, toFile, toRank, isCapture, hintFile, hintRank) {
  const board = state.board;
  const candidates = [];
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = pieceAt(board, f, r);
      if (!p || p.color !== color || p.type !== pieceType) continue;
      if (hintFile !== null && f !== hintFile) continue;
      if (hintRank !== null && r !== hintRank) continue;
      if (canPieceReach(state, p, f, r, toFile, toRank, isCapture)) {
        candidates.push({ file: f, rank: r });
      }
    }
  }
  return candidates;
}

const SAN_REGEX = /^([NBRQK]?)([a-h]?)([1-8]?)(x?)([a-h][1-8])(=([NBRQ]))?[+#]*$/;

function parseSANToken(token) {
  if (token === 'O-O' || token === '0-0') return { castle: 'K' };
  if (token === 'O-O-O' || token === '0-0-0') return { castle: 'Q' };
  const match = SAN_REGEX.exec(token);
  if (!match) return null;
  const [, pieceLetter, hintFileChar, hintRankChar, captureFlag, destSquare, , promotion] = match;
  return {
    pieceType: pieceLetter || 'P',
    hintFile: hintFileChar ? hintFileChar.charCodeAt(0) - 'a'.charCodeAt(0) : null,
    hintRank: hintRankChar ? 8 - parseInt(hintRankChar, 10) : null,
    isCapture: captureFlag === 'x',
    dest: squareToCoords(destSquare),
    promotion: promotion || null
  };
}

function applyMove(state, token) {
  const board = state.board;
  const color = state.turn;
  const parsed = parseSANToken(token);
  if (!parsed) { console.warn('No se pudo parsear:', token); return false; }

  let movedFrom = null, movedTo = null;

  if (parsed.castle) {
    const rank = color === 'w' ? 7 : 0;
    if (parsed.castle === 'K') {
      board[rank][6] = board[rank][4]; board[rank][4] = null;
      board[rank][5] = board[rank][7]; board[rank][7] = null;
      movedFrom = coordsToSquare(4, rank); movedTo = coordsToSquare(6, rank);
    } else {
      board[rank][2] = board[rank][4]; board[rank][4] = null;
      board[rank][3] = board[rank][0]; board[rank][0] = null;
      movedFrom = coordsToSquare(4, rank); movedTo = coordsToSquare(2, rank);
    }
    state.castling[color + 'K'] = false;
    state.castling[color + 'Q'] = false;
  } else {
    const { file: toFile, rank: toRank } = parsed.dest;
    const candidates = findSourceSquares(
      state, parsed.pieceType, color, toFile, toRank,
      parsed.isCapture, parsed.hintFile, parsed.hintRank
    );
    if (candidates.length === 0) {
      if (!parsingQuiet) console.warn('Sin origen válido para:', token);
      return false;
    }
    const { file: fromFile, rank: fromRank } = candidates[0];
    const movingPiece = board[fromRank][fromFile];

    if (parsed.pieceType === 'P' && parsed.isCapture && !pieceAt(board, toFile, toRank)) {
      const capturedRank = toRank + (color === 'w' ? 1 : -1);
      board[capturedRank][toFile] = null;
    }

    board[toRank][toFile] = movingPiece;
    board[fromRank][fromFile] = null;

    if (parsed.promotion) board[toRank][toFile] = { type: parsed.promotion, color };

    if (movingPiece.type === 'K') {
      state.castling[color + 'K'] = false;
      state.castling[color + 'Q'] = false;
    }
    if (movingPiece.type === 'R') {
      if (fromFile === 0) state.castling[color + 'Q'] = false;
      if (fromFile === 7) state.castling[color + 'K'] = false;
    }

    movedFrom = coordsToSquare(fromFile, fromRank);
    movedTo = coordsToSquare(toFile, toRank);

    if (parsed.pieceType === 'P' && Math.abs(toRank - fromRank) === 2) {
      state.enPassantTarget = { file: toFile, rank: (toRank + fromRank) / 2 };
    } else {
      state.enPassantTarget = null;
    }
  }

  state.turn = color === 'w' ? 'b' : 'w';
  state.moveHistory.push(token);
  state.positions.push(JSON.parse(JSON.stringify(board)));
  state.lastMoveSquares.push({ from: movedFrom, to: movedTo });
  return true;
}

// ============================================================
// LECTURA DE PGN REAL
// Los archivos que se descargan de lichess o chess.com traen
// cabeceras, comentarios, variantes y anotaciones. Se limpian antes
// de leer las jugadas, y de paso las cabeceras rellenan los datos
// de la partida sin tener que escribirlos a mano.
// ============================================================

function parsePgnHeaders(text) {
  const headers = {};
  const re = /\[\s*(\w+)\s*"([^"]*)"\s*\]/g;
  let m;
  while ((m = re.exec(text || ''))) headers[m[1]] = m[2].trim();
  return headers;
}

function stripPgnDecorations(text) {
  let t = text || '';
  t = t.replace(/\[[^\]]*\]/g, ' ');   // cabeceras
  t = t.replace(/\{[^}]*\}/g, ' ');     // comentarios entre llaves
  t = t.replace(/;[^\n]*/g, ' ');       // comentarios de línea
  t = t.replace(/\$\d+/g, ' ');         // anotaciones tipo $1
  let prev;                             // variantes, que pueden anidarse
  do { prev = t; t = t.replace(/\([^()]*\)/g, ' '); } while (t !== prev);
  return t;
}

function yearFromPgnDate(value) {
  const m = /(\d{4})/.exec(value || '');
  return m ? m[1] : '';
}

// Datos que se pueden deducir de un PGN pegado tal cual.
function metadataFromPgn(text) {
  const h = parsePgnHeaders(text);
  return {
    white: h.White && h.White !== '?' ? h.White : '',
    black: h.Black && h.Black !== '?' ? h.Black : '',
    event: h.Event && h.Event !== '?' ? h.Event : '',
    year: yearFromPgnDate(h.Date || h.UTCDate || ''),
    result: h.Result || ''
  };
}

// ============================================================
// NOTACIÓN ESPAÑOLA
// En español las piezas son Rey, Dama, Torre, Alfil y Caballo.
// El problema es que la R española es el Rey y la R inglesa es la
// Torre: traducir a ciegas estropearía las partidas en inglés. Por eso
// se deduce el idioma por las letras que solo existen en uno u otro,
// y si aun así alguna jugada no cuadra, se prueba con el otro y se
// queda la lectura que funciona.
// ============================================================

let parsingQuiet = false;

const PIEZAS_ES_A_EN = { R: 'K', D: 'Q', T: 'R', A: 'B', C: 'N' };
const PIEZAS_EN_A_ES = { K: 'R', Q: 'D', R: 'T', B: 'A', N: 'C' };
const SOLO_ES = 'TACD';   // letras que en inglés no son piezas
const SOLO_EN = 'KNB';    // letras que en español no son piezas

function translateSpanishToken(token) {
  let t = token;
  if (PIEZAS_ES_A_EN[t[0]]) t = PIEZAS_ES_A_EN[t[0]] + t.slice(1);
  return t.replace(/=([RDTAC])/, (_, p) => '=' + PIEZAS_ES_A_EN[p]);
}

function detectNotationLanguage(tokens) {
  let es = 0, en = 0;
  tokens.forEach(t => {
    const first = t[0];
    if (SOLO_ES.includes(first)) es++;
    if (SOLO_EN.includes(first)) en++;
    const promo = /=([A-Z])/.exec(t);
    if (promo) {
      if (SOLO_ES.includes(promo[1])) es++;
      if (SOLO_EN.includes(promo[1])) en++;
    }
  });
  return es > en ? 'es' : 'en';
}

// Reproduce la lista de jugadas y cuenta las que no ha sabido aplicar.
function buildGameFromTokens(tokens, result) {
  parsingQuiet = true;
  const state = newGameState();
  state.positions.push(JSON.parse(JSON.stringify(state.board)));
  let failures = 0;
  for (const token of tokens) {
    if (!applyMove(state, token)) failures++;
  }
  if (result) state.result = result;
  parsingQuiet = false;
  return { state, failures };
}

function loadGame(pgnText, forcedLang) {
  const headerResult = parsePgnHeaders(pgnText).Result || '';
  let text = stripPgnDecorations(pgnText);

  let result = '';
  const resultMatch = text.match(/(1-0|0-1|1\/2-1\/2|\*)\s*$/);
  if (resultMatch) {
    result = resultMatch[1];
    text = text.slice(0, resultMatch.index);
  } else if (headerResult && headerResult !== '*') {
    result = headerResult;
  }

  const rawTokens = text
    .replace(/\d+\s*\.(\.\.)?/g, ' ')
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length > 0);

  const asSpanish = () => rawTokens.map(translateSpanishToken);
  const lang = (forcedLang === 'es' || forcedLang === 'en')
    ? forcedLang
    : detectNotationLanguage(rawTokens);

  let best = buildGameFromTokens(lang === 'es' ? asSpanish() : rawTokens, result);
  // Si se eligió idioma a mano se respeta. Sin elección, y solo si algo
  // no cuadra, se prueba el otro: cubre las partidas ya guardadas.
  if (!forcedLang && best.failures > 0) {
    const alternative = buildGameFromTokens(lang === 'es' ? rawTokens : asSpanish(), result);
    if (alternative.failures < best.failures) best = alternative;
  }
  return best.state;
}

// Reescribe la partida en notación inglesa numerada, que es el estándar
// PGN. Al guardar siempre se normaliza: así dentro de la app solo existe
// un idioma y todo lo demás se simplifica.
function toStandardPgn(state) {
  const out = [];
  state.moveHistory.forEach((san, i) => {
    if (i % 2 === 0) out.push((i / 2 + 1) + '.');
    out.push(san);
  });
  if (state.result) out.push(state.result);
  return out.join(' ');
}

function normalizePgnToStandard(text, lang) {
  const state = loadGame(text, lang);
  if (!state.moveHistory.length) return text;  // ilegible: se guarda tal cual
  return toStandardPgn(state);
}

// ============================================================
// LEGALIDAD DE MOVIMIENTOS — necesario solo para la edición manual
// de ramificaciones (el resto de la app se limita a reproducir SAN
// ya escrito, donde esto no hace falta).
// ============================================================

function findKingSquare(board, color) {
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = board[r][f];
      if (p && p.type === 'K' && p.color === color) return { file: f, rank: r };
    }
  }
  return null;
}

function isSquareAttacked(board, file, rank, byColor) {
  const state = { board };
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = board[r][f];
      if (!p || p.color !== byColor) continue;
      if (canPieceReach(state, p, f, r, file, rank, true)) return true;
    }
  }
  return false;
}

function isKingInCheck(board, color) {
  const king = findKingSquare(board, color);
  if (!king) return false;
  return isSquareAttacked(board, king.file, king.rank, color === 'w' ? 'b' : 'w');
}

function wouldLeaveKingInCheck(board, fromFile, fromRank, toFile, toRank, color, isEnPassant) {
  const copy = board.map(row => row.slice());
  if (isEnPassant) {
    const capturedRank = toRank + (color === 'w' ? 1 : -1);
    copy[capturedRank][toFile] = null;
  }
  copy[toRank][toFile] = copy[fromRank][fromFile];
  copy[fromRank][fromFile] = null;
  return isKingInCheck(copy, color);
}

// Todas las casillas a las que la pieza en (fromFile,fromRank) puede moverse
// legalmente ahora mismo (respetando jaques, enroque y captura al paso).
function getLegalDestinations(state, fromFile, fromRank) {
  const board = state.board;
  const piece = board[fromRank][fromFile];
  if (!piece) return [];
  const color = piece.color;
  const enemyColor = color === 'w' ? 'b' : 'w';
  const results = [];

  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      if (f === fromFile && r === fromRank) continue;
      const target = board[r][f];
      if (target && target.color === color) continue;

      const isCapture = !!target;
      let isEnPassant = false;
      let reachable;

      if (piece.type === 'P' && !target && Math.abs(f - fromFile) === 1 &&
          state.enPassantTarget && state.enPassantTarget.file === f && state.enPassantTarget.rank === r) {
        reachable = canPieceReach(state, piece, fromFile, fromRank, f, r, true);
        isEnPassant = reachable;
      } else {
        reachable = canPieceReach(state, piece, fromFile, fromRank, f, r, isCapture);
      }
      if (!reachable) continue;
      if (wouldLeaveKingInCheck(board, fromFile, fromRank, f, r, color, isEnPassant)) continue;

      results.push({ file: f, rank: r, isCapture: isCapture || isEnPassant, isEnPassant });
    }
  }

  if (piece.type === 'K' && !isKingInCheck(board, color)) {
    const rank = fromRank;
    const rights = state.castling;
    if (rights[color + 'K'] && !pieceAt(board, 5, rank) && !pieceAt(board, 6, rank)) {
      const rook = pieceAt(board, 7, rank);
      if (rook && rook.type === 'R' && rook.color === color &&
          !isSquareAttacked(board, 5, rank, enemyColor) && !isSquareAttacked(board, 6, rank, enemyColor)) {
        results.push({ file: 6, rank, isCastle: 'K' });
      }
    }
    if (rights[color + 'Q'] && !pieceAt(board, 1, rank) && !pieceAt(board, 2, rank) && !pieceAt(board, 3, rank)) {
      const rook = pieceAt(board, 0, rank);
      if (rook && rook.type === 'R' && rook.color === color &&
          !isSquareAttacked(board, 3, rank, enemyColor) && !isSquareAttacked(board, 2, rank, enemyColor)) {
        results.push({ file: 2, rank, isCastle: 'Q' });
      }
    }
  }

  return results;
}

// Construye la notación SAN de un movimiento hecho a mano en el tablero.
function buildSANForUserMove(state, fromFile, fromRank, toFile, toRank, dest, promotionType) {
  const board = state.board;
  const piece = board[fromRank][fromFile];
  const color = piece.color;

  if (dest.isCastle === 'K') return 'O-O';
  if (dest.isCastle === 'Q') return 'O-O-O';

  let disambiguation = '';
  if (piece.type !== 'P' && piece.type !== 'K') {
    const others = [];
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        if (f === fromFile && r === fromRank) continue;
        const p = board[r][f];
        if (p && p.type === piece.type && p.color === color &&
            canPieceReach(state, p, f, r, toFile, toRank, dest.isCapture) &&
            !wouldLeaveKingInCheck(board, f, r, toFile, toRank, color, false)) {
          others.push({ file: f, rank: r });
        }
      }
    }
    if (others.length > 0) {
      const sameFile = others.some(o => o.file === fromFile);
      const sameRank = others.some(o => o.rank === fromRank);
      if (!sameFile) disambiguation = String.fromCharCode('a'.charCodeAt(0) + fromFile);
      else if (!sameRank) disambiguation = String(8 - fromRank);
      else disambiguation = coordsToSquare(fromFile, fromRank);
    }
  }

  const pieceLetter = piece.type === 'P' ? '' : piece.type;
  let san = pieceLetter + disambiguation;
  if (piece.type === 'P' && dest.isCapture) san += String.fromCharCode('a'.charCodeAt(0) + fromFile);
  if (dest.isCapture) san += 'x';
  san += coordsToSquare(toFile, toRank);
  if (promotionType) san += '=' + promotionType;
  return san;
}


// ============================================================
// BIBLIOTECA DE PARTIDAS (localStorage) — la pantalla de inicio
// ============================================================

const LIBRARY_KEY = 'chess-library';

const SAMPLE_GAME_PGN = `1. d4 d5 2. e3 c5 3. c3 e6 4. Bd3 Nc6 5. f4 Nf6 6. Nd2 Qc7 7. Ngf3
cxd4 8. cxd4 Nb4 9. Bb1 Bd7 10. a3 Rc8 11. O-O Bb5 12. Re1 Nc2
13. Bxc2 Qxc2 14. Qxc2 Rxc2 15. h3 Bd6 16. Nb1 Ne4 17. Nfd2
Bd3 18. Nxe4 Bxe4 19. Nd2 Kd7 20. Nxe4 dxe4 21. Rb1 Rhc8 22.
b4 R8c3 23. Kf1 Kc6 24. Bb2 Rb3 25. Re2 Rxe2 26. Kxe2 Kb5 27.
Kd2 Ka4 28. Ke2 a5 29. Kf2 axb4 30. axb4 Kxb4 31. Ke2 Kb5 32.
Kd2 Ba3 33. Kc2 Rxb2+ 34. Rxb2+ Bxb2 35. Kxb2 Kc4 36. g4 Kd3
37. g5 Kxe3 0-1`;

function loadLibrary() {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function saveLibrary(games) {
  try { localStorage.setItem(LIBRARY_KEY, JSON.stringify(games)); } catch (e) { /* ignorar */ }
}

function ensureLibrarySeeded() {
  let games = loadLibrary();
  if (games === null) {
    games = [{
      id: 'sample-game-v1',
      title: 'Partida de ejemplo',
      pgn: SAMPLE_GAME_PGN,
      createdAt: Date.now()
    }];
    saveLibrary(games);
  }
  return games;
}

function normalizeTags(value) {
  if (Array.isArray(value)) return value.map(t => String(t).trim()).filter(Boolean);
  return String(value || '')
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);
}

// Acepta un objeto con todos los datos, o la forma antigua (título, pgn, carpeta).
function addGameToLibrary(dataOrTitle, pgn, folderId) {
  const d = typeof dataOrTitle === 'string'
    ? { title: dataOrTitle, pgn: pgn, folderId: folderId }
    : (dataOrTitle || {});
  const games = loadLibrary() || [];
  const record = {
    id: simpleHash((d.title || '') + '|' + (d.pgn || '') + '|' + Date.now()),
    title: (d.title || '').trim(),
    white: (d.white || '').trim(),
    black: (d.black || '').trim(),
    event: (d.event || '').trim(),
    year: (d.year || '').trim(),
    tags: normalizeTags(d.tags),
    pgn: (d.pgn || '').trim(),
    folderId: d.folderId || null,
    createdAt: Date.now()
  };
  games.unshift(record);
  saveLibrary(games);
  return record;
}

function updateGameInLibrary(id, patch) {
  const games = loadLibrary() || [];
  const target = games.find(g => g.id === id);
  if (!target) return null;
  Object.assign(target, patch, { tags: normalizeTags(patch.tags) });
  saveLibrary(games);
  return target;
}

// El título es opcional: si no lo hay, la partida se llama como se
// llaman las partidas de ajedrez, por sus dos jugadores.
function gameDisplayTitle(record) {
  const t = (record.title || '').trim();
  if (t) return t;
  const w = (record.white || '').trim();
  const b = (record.black || '').trim();
  if (w || b) return `${w || '?'} – ${b || '?'}`;
  return 'Partida sin título';
}

function gameMetaParts(record, folderNameOf, showFolder) {
  const parts = [];
  if (record.year) parts.push(record.year);
  if (record.event) parts.push(record.event);
  // Si el título es propio, los jugadores aún aportan información.
  if ((record.title || '').trim() && (record.white || record.black)) {
    parts.push(`${record.white || '?'} – ${record.black || '?'}`);
  }
  if (showFolder && record.folderId) {
    const n = folderNameOf(record.folderId);
    if (n) parts.push(n);
  }
  if (!parts.length) parts.push(formatDate(record.createdAt));
  return parts;
}

function allTags() {
  const seen = new Map();
  (loadLibrary() || []).forEach(g => normalizeTags(g.tags).forEach(t => {
    const k = t.toLowerCase();
    if (!seen.has(k)) seen.set(k, t);
  }));
  return [...seen.values()].sort((a, b) => a.localeCompare(b, 'es'));
}

// Texto sobre el que busca el buscador de la pantalla de inicio.
// En español buscar "peon" tiene que encontrar "peón", y "Ruiz" a "ruiz".
function foldText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function gameSearchBlob(record) {
  return foldText([record.title, record.white, record.black, record.event,
                   record.year, normalizeTags(record.tags).join(' ')].join(' '));
}

function deleteGameFromLibrary(id) {
  // Con la partida se van sus apuntes, su marcador de última jugada y
  // todas sus ramificaciones. Si no, quedan huérfanos ocupando sitio.
  try {
    loadBranches(id).forEach(b => deleteBranchAndData(id, b.id));
    localStorage.removeItem(branchesKey(id));
    localStorage.removeItem(`chess-lastply:${id}`);
    const prefix = `chess-notes:${id}:`;
    Object.keys(localStorage)
      .filter(k => k.startsWith(prefix))
      .forEach(k => localStorage.removeItem(k));
  } catch (e) { /* almacenamiento no disponible: se ignora */ }

  const games = (loadLibrary() || []).filter(g => g.id !== id);
  saveLibrary(games);
}

function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

function resultBadge(pgn) {
  const m = pgn.match(/(1-0|0-1|1\/2-1\/2|\*)\s*$/);
  if (!m) return null;
  return { '1-0': { label: '1–0', cls: 'result-white' },
           '0-1': { label: '0–1', cls: 'result-black' },
           '1/2-1/2': { label: '½–½', cls: 'result-draw' },
           '*': null }[m[1]] || null;
}

// ---------- Carpetas ----------
const FOLDERS_KEY = 'chess-folders';

function loadFolders() {
  try {
    const raw = localStorage.getItem(FOLDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

function saveFolders(folders) {
  try { localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders)); } catch (e) { /* ignorar */ }
}

function addFolder(name) {
  const folders = loadFolders();
  const folder = { id: simpleHash('folder-' + name + '-' + Date.now()), name: name.trim() };
  folders.push(folder);
  saveFolders(folders);
  return folder;
}

function renameFolder(id, name) {
  const folders = loadFolders();
  const target = folders.find(f => f.id === id);
  if (!target || !name.trim()) return null;
  target.name = name.trim();
  saveFolders(folders);
  return target;
}

function deleteFolder(id) {
  const folders = loadFolders().filter(f => f.id !== id);
  saveFolders(folders);
  // las partidas de esa carpeta pasan a "sin carpeta", no se borran
  const games = (loadLibrary() || []).map(g => g.folderId === id ? { ...g, folderId: null } : g);
  saveLibrary(games);
}

// ============================================================
// RAMIFICACIONES — versiones alternativas de una partida, creadas
// moviendo piezas a mano a partir de una jugada concreta.
// ============================================================

function branchesKey(gameId) {
  return `chess-branches:${gameId}`;
}

function loadBranches(gameId) {
  try {
    const raw = localStorage.getItem(branchesKey(gameId));
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

function saveBranches(gameId, branches) {
  try { localStorage.setItem(branchesKey(gameId), JSON.stringify(branches)); } catch (e) {}
}

// El nombre por defecto se calcula sobre los que ya existen, no sobre
// cuántos hay: si borras una, la siguiente no repite nombre.
function uniqueBranchName(branches, proposed) {
  const taken = new Set(branches.map(b => (b.name || '').trim().toLowerCase()));
  const base = (proposed || '').trim() || 'Variante';
  if (!taken.has(base.toLowerCase())) return base;
  let n = 2;
  while (taken.has(`${base} ${n}`.toLowerCase())) n++;
  return `${base} ${n}`;
}

function defaultBranchName(gameId) {
  const taken = new Set(loadBranches(gameId).map(b => (b.name || '').trim().toLowerCase()));
  let n = 1;
  while (taken.has(`variante ${n}`)) n++;
  return `Variante ${n}`;
}

function createBranch(gameId, fromPly, name) {
  const branches = loadBranches(gameId);
  const record = {
    id: simpleHash('branch-' + Date.now() + '-' + Math.random()),
    name: uniqueBranchName(branches, name || defaultBranchName(gameId)),
    fromPly,
    moves: [],
    createdAt: Date.now()
  };
  branches.push(record);
  saveBranches(gameId, branches);
  return record;
}

function renameBranch(gameId, branchId, name) {
  const branches = loadBranches(gameId);
  const target = branches.find(b => b.id === branchId);
  if (!target) return null;
  const others = branches.filter(b => b.id !== branchId);
  target.name = uniqueBranchName(others, name);
  saveBranches(gameId, branches);
  return target;
}

function persistBranchMoves(gameId, branch) {
  const branches = loadBranches(gameId);
  const target = branches.find(b => b.id === branch.id);
  if (target) { target.moves = branch.moves; saveBranches(gameId, branches); }
}

function deleteBranchAndData(gameId, branchId) {
  saveBranches(gameId, loadBranches(gameId).filter(b => b.id !== branchId));
  try {
    const prefix = `chess-notes:branch:${branchId}:`;
    Object.keys(localStorage)
      .filter(k => k.startsWith(prefix))
      .forEach(k => localStorage.removeItem(k));
    localStorage.removeItem(`chess-lastply:branch:${branchId}`);
  } catch (e) {}
}

// ============================================================
// UI / REPRODUCTOR
// ============================================================

let gameState = null;
let currentPly = 0;
let currentLibraryRecord = null;

const boardEl = document.getElementById('board');

// ---------- Coordenadas del tablero (a-h arriba y abajo, 1-8 a los lados) ----------
// Al girar el tablero las coordenadas también dan la vuelta.
let boardFlipped = false;

function renderBoardCoordinates() {
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
  const f = boardFlipped ? files.slice().reverse() : files;
  const r = boardFlipped ? ranks.slice().reverse() : ranks;

  function fillRow(id, labels) {
    const el = document.getElementById(id);
    el.innerHTML = '';
    labels.forEach(label => {
      const span = document.createElement('span');
      span.textContent = label;
      el.appendChild(span);
    });
  }

  fillRow('coordTop', f);
  fillRow('coordBottom', f);
  fillRow('coordLeft', r);
  fillRow('coordRight', r);
}
renderBoardCoordinates();

// Traduce una casilla real a su hueco en pantalla, que cambia al girar.
function displayIndex(file, rank) {
  return boardFlipped ? (7 - rank) * 8 + (7 - file) : rank * 8 + file;
}
const statusEl = document.getElementById('status');
const moveStripEl = document.getElementById('moveStrip');
const pgnInput = document.getElementById('pgnInput');
const titleInput = document.getElementById('titleInput');
const libraryListEl = document.getElementById('libraryList');
const libraryEmptyEl = document.getElementById('libraryEmpty');
const gameTitleLabelEl = document.getElementById('gameTitleLabel');

// ---------- Edición interactiva de ramificaciones (mover piezas a mano) ----------
let mainGameState = null;
let viewingBranch = null;
let branchEditMode = false;
let selectedSquare = null;
let legalDestinations = [];
let pendingPromotion = null;

function renderBoard(boardArray, highlight) {
  boardEl.innerHTML = '';
  for (let dr = 0; dr < 8; dr++) {
    for (let df = 0; df < 8; df++) {
      // dr/df es el hueco en pantalla; r/f la casilla real del tablero.
      const r = boardFlipped ? 7 - dr : dr;
      const f = boardFlipped ? 7 - df : df;
      const sq = document.createElement('div');
      const isLight = (r + f) % 2 === 0;
      sq.className = 'square ' + (isLight ? 'light' : 'dark');
      sq.dataset.file = f;
      sq.dataset.rank = r;
      const square = coordsToSquare(f, r);
      if (highlight) {
        if (highlight.from === square) sq.classList.add('highlight-from');
        if (highlight.to === square) sq.classList.add('highlight-to');
      }
      if (branchEditMode && selectedSquare && selectedSquare.file === f && selectedSquare.rank === r) {
        sq.classList.add('selected');
      }
      if (branchEditMode) {
        const dest = legalDestinations.find(d => d.file === f && d.rank === r);
        if (dest) {
          sq.classList.add('legal-move');
          if (dest.isCapture) sq.classList.add('capture');
          const marker = document.createElement('span');
          marker.className = 'legalDot';
          sq.appendChild(marker);
        }
      }
      const piece = boardArray[r][f];
      if (piece) {
        const pieceEl = document.createElement('span');
        pieceEl.className = 'piece ' + (piece.color === 'w' ? 'white-piece' : 'black-piece');
        pieceEl.textContent = getPieceGlyph(piece.type);
        sq.appendChild(pieceEl);
      }
      boardEl.appendChild(sq);
    }
  }
}

function refreshBoardOnly() {
  renderBoard(gameState.positions[currentPly], gameState.lastMoveSquares[currentPly]);
}

boardEl.addEventListener('click', (e) => {
  // Sin rama activa no se mueve nada: el tablero de la partida principal
  // es solo de lectura.
  if (!branchEditMode || !viewingBranch || pendingPromotion) return;
  const sq = e.target.closest('.square');
  if (!sq) return;
  handleBoardSquareClick(parseInt(sq.dataset.file, 10), parseInt(sq.dataset.rank, 10));
});

function handleBoardSquareClick(file, rank) {
  const board = gameState.board;
  const piece = board[rank][file];

  if (selectedSquare) {
    const dest = legalDestinations.find(d => d.file === file && d.rank === rank);
    if (dest) {
      const fromFile = selectedSquare.file, fromRank = selectedSquare.rank;
      const movingPiece = board[fromRank][fromFile];
      const lastRank = movingPiece.color === 'w' ? 0 : 7;
      if (movingPiece.type === 'P' && rank === lastRank) {
        pendingPromotion = { fromFile, fromRank, toFile: file, toRank: rank, dest };
        selectedSquare = null;
        legalDestinations = [];
        refreshBoardOnly();
        openPromotionPicker(movingPiece.color);
        return;
      }
      commitUserMove(fromFile, fromRank, file, rank, dest, null);
      return;
    }
    if (piece && piece.color === gameState.turn) {
      selectedSquare = { file, rank };
      legalDestinations = getLegalDestinations(gameState, file, rank);
    } else {
      selectedSquare = null;
      legalDestinations = [];
    }
  } else if (piece && piece.color === gameState.turn) {
    selectedSquare = { file, rank };
    legalDestinations = getLegalDestinations(gameState, file, rank);
  }
  refreshBoardOnly();
}

function commitUserMove(fromFile, fromRank, toFile, toRank, dest, promotionType) {
  if (!viewingBranch) return;
  let san = buildSANForUserMove(gameState, fromFile, fromRank, toFile, toRank, dest, promotionType);
  viewingBranch.moves.push(san);
  gameState = buildBranchGameState(viewingBranch);
  if (isKingInCheck(gameState.board, gameState.turn)) {
    san += '+';
    viewingBranch.moves[viewingBranch.moves.length - 1] = san;
    gameState.moveHistory[gameState.moveHistory.length - 1] = san;
  }
  persistBranchMoves(currentLibraryRecord.id, viewingBranch);
  selectedSquare = null;
  legalDestinations = [];
  buildMoveStrip();
  goToPly(gameState.positions.length - 1);
}

// ---------- Selector de coronación de peón ----------
const promotionOverlayEl = document.getElementById('promotionOverlay');

function openPromotionPicker(color) {
  document.querySelectorAll('.promoBtn').forEach(btn => {
    btn.innerHTML = '';
    const glyph = document.createElement('span');
    glyph.className = 'piece ' + (color === 'w' ? 'white-piece' : 'black-piece');
    glyph.textContent = getPieceGlyph(btn.dataset.piece);
    btn.appendChild(glyph);
  });
  promotionOverlayEl.classList.add('open');
}

function closePromotionPicker() {
  promotionOverlayEl.classList.remove('open');
  pendingPromotion = null;
}

document.querySelectorAll('.promoBtn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!pendingPromotion) return;
    const { fromFile, fromRank, toFile, toRank, dest } = pendingPromotion;
    const pieceType = btn.dataset.piece;
    closePromotionPicker();
    commitUserMove(fromFile, fromRank, toFile, toRank, dest, pieceType);
  });
});

function renderStatus() {
  const total = gameState.positions.length - 1;
  let text = `Jugada ${currentPly} / ${total}`;
  if (viewingBranch) {
    text = `${viewingBranch.name} · ${text}`;
  } else if (currentPly === total && gameState.result) {
    const resultLabel = { '1-0': 'Ganan blancas', '0-1': 'Ganan negras', '1/2-1/2': 'Tablas' }[gameState.result] || gameState.result;
    text += ` · ${resultLabel}`;
  }
  statusEl.textContent = text;
  document.getElementById('prevBtn').disabled = currentPly === 0;
  document.getElementById('nextBtn').disabled = currentPly === total;
}

// ---------- Tira de notación: se puede deslizar libremente para ojear,
// pero la posición del tablero SOLO cambia al tocar una jugada concreta ----------
// Por dentro las jugadas se guardan siempre en notación inglesa, que es
// el estándar de los archivos PGN. Esto solo cambia cómo se ven.
let notationLang = 'es';

function displayMove(san) {
  if (notationLang !== 'es' || !san) return san;
  let t = san;
  if (PIEZAS_EN_A_ES[t[0]]) t = PIEZAS_EN_A_ES[t[0]] + t.slice(1);
  return t.replace(/=([KQRBN])/, (_, p) => '=' + PIEZAS_EN_A_ES[p]);
}

function moveLabel(ply) {
  if (ply === 0) return 'Inicio';
  const moveNumber = Math.ceil(ply / 2);
  const san = displayMove(gameState.moveHistory[ply - 1]);
  const isWhiteMove = ply % 2 === 1;
  return isWhiteMove ? `${moveNumber}.${san}` : `${san}`;
}

let moveChipEls = [];
const moveStripInner = document.getElementById('moveStripInner');
let stripOffset = 0;

// La tira se mueve con transform en vez de con el desplazamiento del
// navegador. Así se comporta igual en Safari que en cualquier otro, y la
// dirección es un único signo: el contenido acompaña al dedo.
function applyStripOffset(px, animate) {
  stripOffset = px;
  moveStripInner.style.transition = animate
    ? 'transform .26s cubic-bezier(.22,.61,.36,1)' : 'none';
  moveStripInner.style.transform = `translateX(${px}px)`;
}

// Dónde queda el centro de cada jugada cuando la tira está sin mover. Se
// mide una sola vez: hacerlo en cada movimiento del dedo iría a tirones.
let chipCenters = null;

function measureChips() {
  const strip = moveStripEl.getBoundingClientRect();
  const mid = strip.left + strip.width / 2;
  chipCenters = moveChipEls.map(ch => {
    const r = ch.getBoundingClientRect();
    return (r.left + r.width / 2) - mid - stripOffset;
  });
}

function ensureChipCenters() {
  if (!chipCenters || chipCenters.length !== moveChipEls.length) measureChips();
}

function offsetCentering(ply) {
  ensureChipCenters();
  return chipCenters[ply] === undefined ? stripOffset : -chipCenters[ply];
}

function stripBounds() {
  const last = moveChipEls.length - 1;
  if (last < 0) return { min: 0, max: 0 };
  ensureChipCenters();
  return { max: -chipCenters[0], min: -chipCenters[last] };
}

// Qué jugada está ahora mismo en el centro de la tira. Búsqueda binaria
// sobre la medición, así que cuesta lo mismo con 10 jugadas que con 200.
function plyAtCenter() {
  ensureChipCenters();
  if (!chipCenters.length) return 0;
  const target = -stripOffset;
  let lo = 0, hi = chipCenters.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (chipCenters[mid] < target) lo = mid + 1; else hi = mid;
  }
  if (lo > 0 && Math.abs(chipCenters[lo - 1] - target) < Math.abs(chipCenters[lo] - target)) lo--;
  return lo;
}

function clampStrip(px) {
  const { min, max } = stripBounds();
  return Math.max(min, Math.min(px, max));
}
let scrubbingNow = false;
let stripFollowsFinger = false;
let notedPlies = new Set();

// Qué jugadas tienen apuntes. Se calcula una vez y se refresca al
// escribir, en vez de preguntarlo por cada chip en cada movimiento.
function refreshNotedPlies() {
  notedPlies = new Set();
  if (!gameState) return;
  for (let i = 0; i < gameState.positions.length; i++) {
    if (hasNote(i)) notedPlies.add(i);
  }
}

// Se reconstruye solo cuando se carga una partida (no en cada jugada).
function buildMoveStrip() {
  refreshNotedPlies();
  moveStripInner.innerHTML = '';
  chipCenters = null;
  applyStripOffset(0, false);
  moveChipEls = [];
  const total = gameState.positions.length - 1;
  const branchStartPlies = new Set(
    (currentLibraryRecord ? loadBranches(currentLibraryRecord.id) : []).map(b => b.fromPly)
  );

  for (let ply = 0; ply <= total; ply++) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'moveChip';
    if (branchStartPlies.has(ply)) chip.classList.add('hasBranch');
    if (viewingBranch && ply > viewingBranch.fromPly) chip.classList.add('branchMove');
    chip.textContent = moveLabel(ply);
    chip.addEventListener('click', () => goToPly(ply));
    moveStripInner.appendChild(chip);
    moveChipEls.push(chip);
  }
}

// Se llama en cada jugada: solo actualiza el resaltado y centra la vista,
// nunca cambia la jugada por sí sola.
function updateMoveStripActive() {
  moveChipEls.forEach((chip, ply) => {
    chip.classList.toggle('current', ply === currentPly);
    chip.classList.toggle('hasNote', notedPlies.has(ply));
  });
  // Si el dedo está llevando la tira, manda él: recolocarla aquí sería
  // justo lo que hacía que fuese a trompicones.
  if (stripFollowsFinger) return;
  if (moveChipEls[currentPly]) {
    applyStripOffset(clampStrip(offsetCentering(currentPly)), !scrubbingNow);
  }
}

// ---------- Mantener pulsada la tira para recorrer la partida ----------
// Deslizar la tira solo la mueve, sin tocar el tablero. Pero si se
// mantiene pulsada un instante, pasa a mandar sobre la partida: al
// arrastrar, las jugadas se van reproduciendo en el tablero.
// ---------- La tira: desplazarla y recorrer la partida con ella ----------
// El navegador desplazaba la tira por su cuenta y peleaba con el
// recorrido de la partida, así que aquí se lleva el desplazamiento a
// mano: así la tira siempre acompaña al dedo.
(function enableStripControl() {
  const HOLD_MS = 230;        // cuánto hay que mantener para engancharla
  const MOVE_CANCEL = 10;     // moverse antes es un desplazamiento normal
  const EDGE_ZONE = 70;       // franja del extremo que sigue avanzando
  const EDGE_MIN = 1.5;       // px por fotograma al asomarse a la franja
  const EDGE_MAX = 20;        // px por fotograma pegado al extremo
  const FRAME = 16.7;         // fotograma de referencia, a 60 Hz

  let holdTimer = null, edgeRaf = null, inertia = null, pointerId = null;
  let scrubbing = false, dragging = false;
  let startX = 0, lastX = 0, lastT = 0, velocity = 0;
  let startOffset = 0, edgeDir = 0, edgeSpeed = 0, edgeLastT = 0;

  function stopEdge() {
    if (edgeRaf) cancelAnimationFrame(edgeRaf);
    edgeRaf = null;
    edgeDir = 0;
    edgeSpeed = 0;
    edgeLastT = 0;
  }

  function endGesture() {
    clearTimeout(holdTimer); holdTimer = null;
    stopEdge();
    if (scrubbing) {
      scrubbing = false;
      scrubbingNow = false;
      stripFollowsFinger = false;
      moveStripEl.classList.remove('scrubbing');
    }
    dragging = false;
  }

  function syncPlyToStrip() {
    const ply = plyAtCenter();
    if (ply !== currentPly) goToPly(ply);
  }

  function beginScrub() {
    scrubbing = true;
    scrubbingNow = true;
    stripFollowsFinger = true;
    // Se reancla aquí para que al enganchar la tira no dé un salto.
    startX = lastX;
    startOffset = stripOffset;
    moveStripEl.classList.add('scrubbing');
  }

  // En el extremo el dedo ya no puede seguir, así que la tira sigue
  // corriendo sola, fotograma a fotograma, mientras se mantenga ahí.
  function edgeStep(now) {
    if (!edgeDir) { edgeRaf = null; return; }
    // Se avanza por tiempo, no por fotograma: si no, en una pantalla de
    // 120 Hz la partida correría al doble de velocidad que en una de 60.
    const t = now || performance.now();
    const dt = edgeLastT ? Math.min(t - edgeLastT, 50) : FRAME;
    edgeLastT = t;
    const next = clampStrip(stripOffset - edgeSpeed * (dt / FRAME) * edgeDir);
    const topeAlcanzado = next === stripOffset;
    applyStripOffset(next, false);
    syncPlyToStrip();
    edgeRaf = topeAlcanzado ? null : requestAnimationFrame(edgeStep);
  }

  // Cuanto más hundido esté el dedo en la franja, más rápido corre: al
  // asomarse apenas se mueve y pegado al extremo va a toda velocidad. La
  // curva es cuadrática para que la parte lenta ocupe casi toda la franja
  // y sea fácil quedarse en la jugada exacta.
  function edgeAt(x) {
    const r = moveStripEl.getBoundingClientRect();
    let dir = 0, hondura = 0;
    // Se avanza arrastrando a la izquierda, así que el dedo acaba tocando
    // el borde IZQUIERDO: ahí hay que seguir avanzando, no retroceder.
    if (x < r.left + EDGE_ZONE) {
      dir = 1;
      hondura = (r.left + EDGE_ZONE - x) / EDGE_ZONE;
    } else if (x > r.right - EDGE_ZONE) {
      dir = -1;
      hondura = (x - (r.right - EDGE_ZONE)) / EDGE_ZONE;
    }
    hondura = Math.max(0, Math.min(hondura, 1));
    // Al cubo: la parte lenta ocupa casi toda la franja y solo se dispara
    // en el último tramo, pegado al extremo.
    const curva = hondura * hondura * hondura;
    return { dir, speed: dir ? EDGE_MIN + (EDGE_MAX - EDGE_MIN) * curva : 0 };
  }

  function updateEdge(x) {
    const { dir, speed } = edgeAt(x);
    if (!dir) { stopEdge(); return; }
    edgeDir = dir;
    edgeSpeed = speed;   // se recalcula en cada movimiento, no solo al entrar
    if (!edgeRaf) edgeRaf = requestAnimationFrame(edgeStep);
  }

  moveStripEl.addEventListener('pointerdown', (e) => {
    if (!gameState) return;
    if (inertia) { cancelAnimationFrame(inertia); inertia = null; }
    // Sin capturar el puntero el gesto muere en cuanto el dedo se sale de
    // la tira, que es más baja que un dedo.
    try { moveStripEl.setPointerCapture(e.pointerId); } catch (err) {}
    pointerId = e.pointerId;
    startX = lastX = e.clientX;
    lastT = performance.now();
    velocity = 0;
    startOffset = stripOffset;
    clearTimeout(holdTimer);
    holdTimer = setTimeout(beginScrub, HOLD_MS);
  });

  moveStripEl.addEventListener('pointermove', (e) => {
    if (pointerId === null) return;
    const dx = e.clientX - startX;
    const now = performance.now();
    if (now > lastT) velocity = (e.clientX - lastX) / (now - lastT);
    lastX = e.clientX;
    lastT = now;

    if (scrubbing) {
      const veniaDelExtremo = edgeDir !== 0;
      updateEdge(e.clientX);
      if (edgeDir) { stripFollowsFinger = false; return; }

      // Mientras la tira corría sola en el extremo, el punto de anclaje se
      // quedó atrás. Si no se vuelve a fijar aquí, al regresar a la zona
      // neutra se calcula la posición desde un punto viejo y la partida
      // pega un salto enorme.
      if (veniaDelExtremo) {
        startOffset = stripOffset;
        startX = e.clientX;
      }

      stripFollowsFinger = true;
      // La tira va pegada al dedo y el tablero cambia cuando una jugada
      // pasa por el centro. Continuo, no a saltos de jugada en jugada.
      applyStripOffset(clampStrip(startOffset + (e.clientX - startX)), false);
      syncPlyToStrip();
      return;
    }

    if (!dragging && Math.abs(dx) > MOVE_CANCEL) {
      clearTimeout(holdTimer);
      holdTimer = null;
      dragging = true;
    }
    if (dragging) applyStripOffset(clampStrip(startOffset + dx), false);
  });

  function glide() {
    velocity *= 0.94;
    const next = clampStrip(stripOffset + velocity * 16);
    const stopped = next === stripOffset;
    applyStripOffset(next, false);
    if (!stopped && Math.abs(velocity) > 0.02) inertia = requestAnimationFrame(glide);
    else inertia = null;
  }

  moveStripEl.addEventListener('pointerup', () => {
    const wasDragging = dragging && !scrubbing;
    const wasScrubbing = scrubbing;
    if (pointerId !== null) {
      try { moveStripEl.releasePointerCapture(pointerId); } catch (err) {}
      pointerId = null;
    }
    endGesture();
    if (wasScrubbing) {
      // Al soltar, la jugada se acomoda en el centro.
      applyStripOffset(clampStrip(offsetCentering(currentPly)), true);
      settleAfterScrub();
    }
    if (wasDragging && Math.abs(velocity) > 0.08) inertia = requestAnimationFrame(glide);
  });

  moveStripEl.addEventListener('pointercancel', () => {
    pointerId = null;
    endGesture();
  });

  // Tras arrastrar, el dedo no debe además saltar a la jugada de debajo.
  moveStripEl.addEventListener('click', (e) => {
    if (dragging || scrubbing) { e.stopPropagation(); e.preventDefault(); }
  }, true);

  // Al girar el iPad cambia el ancho: se vuelve a medir y a centrar.
  window.addEventListener('resize', () => {
    if (!gameState || !moveChipEls.length) return;
    chipCenters = null;
    applyStripOffset(clampStrip(offsetCentering(currentPly)), false);
  });
})();

// ---------- Notas por jugada (persistentes, el alma de la app) ----------
const notesArea = document.getElementById('notesArea');
const notesLabelEl = document.getElementById('notesLabel');
let notesSaveTimer = null;

function simpleHash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) + hash) + str.charCodeAt(i);
  return (hash >>> 0).toString(36);
}

function currentGameId() {
  return simpleHash(gameState.moveHistory.join(' ') || 'partida-vacia');
}

function noteKey(ply) {
  if (viewingBranch && ply >= viewingBranch.fromPly) {
    return `chess-notes:branch:${viewingBranch.id}:${ply}`;
  }
  const baseId = currentLibraryRecord ? currentLibraryRecord.id : currentGameId();
  return `chess-notes:${baseId}:${ply}`;
}

function hasNote(ply) {
  try { return !!localStorage.getItem(noteKey(ply)); } catch (e) { return false; }
}

function loadNote(ply) {
  try { return localStorage.getItem(noteKey(ply)) || ''; } catch (e) { return ''; }
}

function saveNote(ply, text) {
  try {
    if (text.trim()) localStorage.setItem(noteKey(ply), text);
    else localStorage.removeItem(noteKey(ply));
  } catch (e) { /* almacenamiento no disponible: se ignora silenciosamente */ }
}

function renderNotesForCurrentPly() {
  const label = currentPly === 0 ? 'Inicio' : moveLabel(currentPly);
  notesLabelEl.innerHTML = `Notas · <span class="notesLabelMove">${label}</span>`;
  notesArea.value = loadNote(currentPly);
}

notesArea.addEventListener('input', () => {
  clearTimeout(notesSaveTimer);
  const ply = currentPly;
  const text = notesArea.value;
  notesSaveTimer = setTimeout(() => { saveNote(ply, text); refreshNotedPlies(); updateMoveStripActive(); }, 350);
});

// ---------- Retomar la partida justo donde se dejó ----------
function lastPlyKey() {
  if (viewingBranch) return `chess-lastply:branch:${viewingBranch.id}`;
  return `chess-lastply:${currentLibraryRecord ? currentLibraryRecord.id : currentGameId()}`;
}
function saveLastPly(ply) {
  try { localStorage.setItem(lastPlyKey(), String(ply)); } catch (e) {}
}
function loadLastPly() {
  try {
    const raw = localStorage.getItem(lastPlyKey());
    return raw ? parseInt(raw, 10) : 0;
  } catch (e) { return 0; }
}

function goToPly(ply) {
  const total = gameState.positions.length - 1;
  const previousPly = currentPly;
  currentPly = Math.max(0, Math.min(ply, total));
  renderBoard(gameState.positions[currentPly], gameState.lastMoveSquares[currentPly]);
  renderStatus();
  updateMoveStripActive();

  // Mientras se recorre la partida con el dedo solo se dibuja el tablero
  // y la tira. Leer apuntes, mirar ramificaciones y guardar la posición
  // son accesos a disco que ahogarían el gesto; se hacen al soltar.
  if (scrubbingNow) return;

  animatePieceTravel(previousPly, currentPly);
  renderNotesForCurrentPly();
  saveLastPly(currentPly);
  renderBranchAction();
}

function settleAfterScrub() {
  renderNotesForCurrentPly();
  saveLastPly(currentPly);
  renderBranchAction();
}

// ---------- Las piezas viajan por el tablero ----------
// Al avanzar o retroceder una jugada, la pieza se desliza de casilla a
// casilla en vez de aparecer de golpe. Solo para pasos de una jugada:
// en los saltos largos el movimiento no significaría nada.
function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function computeTravelLegs(previousPly, newPly) {
  let move, forward;
  if (newPly === previousPly + 1) { move = gameState.lastMoveSquares[newPly]; forward = true; }
  else if (newPly === previousPly - 1) { move = gameState.lastMoveSquares[previousPly]; forward = false; }
  else return null;
  if (!move || !move.from || !move.to) return null;

  const from = squareToCoords(move.from);
  const to = squareToCoords(move.to);
  const legs = forward
    ? [{ fromFile: from.file, fromRank: from.rank, toFile: to.file, toRank: to.rank }]
    : [{ fromFile: to.file, fromRank: to.rank, toFile: from.file, toRank: from.rank }];

  // En el enroque también se mueve la torre, y debe viajar con el rey.
  const board = gameState.positions[newPly];
  const landed = forward ? board[to.rank][to.file] : board[from.rank][from.file];
  const fileShift = to.file - from.file;
  if (landed && landed.type === 'K' && Math.abs(fileShift) === 2) {
    const rank = from.rank;
    const rookFrom = fileShift > 0 ? 7 : 0;
    const rookTo = fileShift > 0 ? 5 : 3;
    legs.push(forward
      ? { fromFile: rookFrom, fromRank: rank, toFile: rookTo, toRank: rank }
      : { fromFile: rookTo, fromRank: rank, toFile: rookFrom, toRank: rank });
  }
  return legs;
}

function animatePieceTravel(previousPly, newPly) {
  if (previousPly === newPly || prefersReducedMotion()) return;
  const legs = computeTravelLegs(previousPly, newPly);
  if (!legs) return;

  const cell = boardEl.clientWidth / 8;
  if (!cell) return; // el tablero aún no está medido: se dibuja sin animar

  legs.forEach(({ fromFile, fromRank, toFile, toRank }) => {
    const square = boardEl.children[displayIndex(toFile, toRank)];
    if (!square) return;
    const piece = square.querySelector('.piece');
    if (!piece) return;

    const sign = boardFlipped ? -1 : 1;
    const dx = (fromFile - toFile) * cell * sign;
    const dy = (fromRank - toRank) * cell * sign;

    piece.classList.add('traveling');
    piece.style.transition = 'none';
    piece.style.transform = `translate(${dx}px, ${dy}px)`;
    void piece.offsetWidth; // fuerza el reflow para que el punto de partida cuente
    piece.style.transition = 'transform .24s cubic-bezier(.22,.61,.36,1)';
    piece.style.transform = 'translate(0, 0)';

    setTimeout(() => {
      piece.classList.remove('traveling');
      piece.style.transition = '';
      piece.style.transform = '';
    }, 260);
  });
}

function stepForward() { goToPly(currentPly + 1); }
function stepBackward() { goToPly(currentPly - 1); }

// ---------- Mantener pulsado: avance/retroceso acelerado ----------
function bindHold(button, action, atBoundary) {
  let holdTimeout = null;
  let holdInterval = null;
  let steps = 0;
  let interval = 200;

  function tick() {
    action();
    steps++;
    if (atBoundary()) { stop(); return; }
    if (steps % 4 === 0 && interval > 55) {
      interval = Math.max(55, interval - 45);
      clearInterval(holdInterval);
      holdInterval = setInterval(tick, interval);
    }
  }

  function stop() {
    clearTimeout(holdTimeout);
    clearInterval(holdInterval);
    holdTimeout = null;
    holdInterval = null;
    steps = 0;
    interval = 200;
  }

  button.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    action();
    if (atBoundary()) return;
    holdTimeout = setTimeout(() => {
      holdInterval = setInterval(tick, interval);
    }, 320);
  });
  // En iOS el gesto de pulsación larga nace en touchstart: si no se
  // cancela ahí, el sistema empieza a seleccionar aunque el pointerdown
  // ya esté anulado.
  button.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
  button.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  ['pointerup', 'pointerleave', 'pointercancel', 'touchend', 'touchcancel'].forEach(evt =>
    button.addEventListener(evt, stop)
  );
}

bindHold(document.getElementById('prevBtn'), stepBackward, () => currentPly === 0);
bindHold(document.getElementById('nextBtn'), stepForward, () => currentPly === gameState.positions.length - 1);

// ---------- Navegación entre pantallas ----------
const homeView = document.getElementById('homeView');
const analysisView = document.getElementById('analysisView');
const settingsView = document.getElementById('settingsView');
const folderChipsEl = document.getElementById('folderChips');
const folderSelectEl = document.getElementById('folderSelect');

let activeFolderId = 'all'; // 'all' | 'none' | id de carpeta
let activeTag = null;       // etiqueta seleccionada, o null
let searchQuery = '';
let sortMode = 'recent';    // 'recent' | 'year' | 'title'

function showHome() {
  renderFolderChips();
  renderLibraryList();
  homeView.hidden = false;
  analysisView.hidden = true;
  settingsView.hidden = true;
}

function showSettings() {
  homeView.hidden = true;
  analysisView.hidden = true;
  settingsView.hidden = false;
}

document.getElementById('settingsBtn').addEventListener('click', showSettings);
document.getElementById('settingsBackBtn').addEventListener('click', showHome);

function showAnalysis(record) {
  currentLibraryRecord = record;
  mainGameState = loadGame(record.pgn);
  gameState = mainGameState;
  viewingBranch = null;
  branchEditMode = false;
  selectedSquare = null;
  legalDestinations = [];
  gameTitleLabelEl.textContent = gameDisplayTitle(record);
  homeView.hidden = true;
  analysisView.hidden = false;
  settingsView.hidden = true;
  applyBranchModeUI();
  buildMoveStrip();
  const total = gameState.positions.length - 1;
  const resumePly = Math.max(0, Math.min(loadLastPly(), total));
  currentPly = resumePly; // entrar en la partida no es "una jugada": sin deslizamiento
  goToPly(resumePly);
}

document.getElementById('backBtn').addEventListener('click', showHome);

// ---------- Navegación entre la partida principal y sus ramas ----------
function buildBranchGameState(branch) {
  const prefix = mainGameState.moveHistory.slice(0, branch.fromPly);
  const combined = prefix.concat(branch.moves).join(' ');
  return loadGame(combined);
}

function applyBranchModeUI() {
  document.getElementById('boardFrame').classList.toggle('branch-editing', branchEditMode);
}

function loadBranchView(branch, editMode) {
  viewingBranch = branch;
  branchEditMode = !!editMode;
  selectedSquare = null;
  legalDestinations = [];
  gameState = buildBranchGameState(branch);
  applyBranchModeUI();
  buildMoveStrip();
  const total = gameState.positions.length - 1;
  const resumePly = editMode ? total : branch.fromPly;
  currentPly = resumePly;
  goToPly(resumePly);
}

function exitToMainLine() {
  viewingBranch = null;
  branchEditMode = false;
  selectedSquare = null;
  legalDestinations = [];
  gameState = mainGameState;
  applyBranchModeUI();
  buildMoveStrip();
  const total = gameState.positions.length - 1;
  const backPly = Math.max(0, Math.min(loadLastPly(), total));
  currentPly = backPly;
  goToPly(backPly);
}

// ---------- Hoja para nombrar una ramificación ----------
const branchNameOverlay = document.getElementById('branchNameSheetOverlay');
const branchNameInput = document.getElementById('branchNameInput');
const branchNameTitleEl = document.getElementById('branchNameSheetTitle');
const branchNameHintEl = document.getElementById('branchNameHint');
const saveBranchNameBtnEl = document.getElementById('saveBranchNameBtn');
let renamingBranchId = null;

function closeBranchNameSheet() {
  branchNameOverlay.classList.remove('open');
  renamingBranchId = null;
}

function enterBranchCreation() {
  if (viewingBranch) return;
  renamingBranchId = null;
  branchNameTitleEl.textContent = 'Nueva ramificación';
  branchNameHintEl.textContent =
    `Parte de ${currentPly === 0 ? 'la posición inicial' : 'la jugada ' + moveLabel(currentPly)}. ` +
    `A partir de ahí mueves las piezas tú.`;
  branchNameInput.value = defaultBranchName(currentLibraryRecord.id);
  saveBranchNameBtnEl.textContent = 'Crear ramificación';
  branchNameOverlay.classList.add('open');
}

function openRenameBranchSheet() {
  if (!viewingBranch) return;
  renamingBranchId = viewingBranch.id;
  branchNameTitleEl.textContent = 'Renombrar ramificación';
  branchNameHintEl.textContent = '';
  branchNameInput.value = viewingBranch.name || '';
  saveBranchNameBtnEl.textContent = 'Guardar nombre';
  branchNameOverlay.classList.add('open');
}

saveBranchNameBtnEl.addEventListener('click', () => {
  const name = branchNameInput.value.trim();
  const gameId = currentLibraryRecord.id;

  if (renamingBranchId) {
    const updated = renameBranch(gameId, renamingBranchId, name);
    if (updated && viewingBranch && viewingBranch.id === updated.id) {
      viewingBranch.name = updated.name;
    }
    closeBranchNameSheet();
    renderStatus();
    renderBranchAction();
    return;
  }

  const branch = createBranch(gameId, currentPly, name);
  closeBranchNameSheet();
  loadBranchView(branch, true);
});

document.getElementById('closeBranchNameBtn').addEventListener('click', closeBranchNameSheet);
branchNameOverlay.addEventListener('click', (e) => {
  if (e.target === branchNameOverlay) closeBranchNameSheet();
});

function toggleBranchEditMode() {
  if (!viewingBranch) return;
  branchEditMode = !branchEditMode;
  selectedSquare = null;
  legalDestinations = [];
  applyBranchModeUI();
  renderBranchAction();
  refreshBoardOnly();
  renderStatus();
}

// ---------- Zona contextual de ramificaciones ----------
const branchActionEl = document.getElementById('branchAction');
const newBranchBtnEl = document.getElementById('newBranchBtn');

function renderBranchAction() {
  branchActionEl.innerHTML = '';

  // ---- Dentro de una ramificación ----
  if (viewingBranch) {
    newBranchBtnEl.hidden = true;
    branchActionEl.hidden = false;

    // El nombre, con lápiz: se ve que se puede cambiar.
    const info = document.createElement('div');
    info.className = 'branchActionInfo';

    const nameBtn = document.createElement('button');
    nameBtn.type = 'button';
    nameBtn.className = 'branchNameBtn';
    const ico = document.createElement('span');
    ico.className = 'branchNameIcon';
    ico.innerHTML = iconButton('branch');
    nameBtn.appendChild(ico);
    const nameTxt = document.createElement('span');
    nameTxt.textContent = viewingBranch.name;
    nameBtn.appendChild(nameTxt);
    if (!teacherMode) {
      const pencil = document.createElement('span');
      pencil.className = 'branchNamePencil';
      pencil.innerHTML = iconButton('pencil');
      nameBtn.appendChild(pencil);
      nameBtn.setAttribute('aria-label', 'Renombrar la ramificación');
      nameBtn.addEventListener('click', openRenameBranchSheet);
    } else {
      nameBtn.disabled = true;
    }
    info.appendChild(nameBtn);

    if (branchEditMode) {
      const hint = document.createElement('span');
      hint.className = 'branchHint';
      hint.textContent = 'mueve las piezas para añadir jugadas';
      info.appendChild(hint);
    }
    branchActionEl.appendChild(info);

    const btnRow = document.createElement('div');
    btnRow.className = 'branchActionButtons';

    const backToGame = document.createElement('button');
    backToGame.type = 'button';
    backToGame.className = 'branchActionBtn';
    backToGame.textContent = 'Volver a la partida';
    backToGame.addEventListener('click', exitToMainLine);

    // En modo profesor solo queda salir: nada de editar ni borrar,
    // para no tocar la ramificación por error durante una clase.
    if (teacherMode) {
      backToGame.classList.add('primary', 'full');
      btnRow.appendChild(backToGame);
    } else {
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'branchActionBtn' + (branchEditMode ? ' primary' : '');
      editBtn.textContent = branchEditMode ? 'Terminar' : 'Editar';
      editBtn.addEventListener('click', toggleBranchEditMode);
      btnRow.appendChild(editBtn);

      btnRow.appendChild(backToGame);

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'branchActionBtn danger';
      delBtn.innerHTML = iconButton('trash');
      delBtn.setAttribute('aria-label', 'Eliminar rama');
      delBtn.addEventListener('click', () => {
        if (confirm(`¿Eliminar "${viewingBranch.name}"? Esta acción no se puede deshacer.`)) {
          const gameId = currentLibraryRecord.id;
          deleteBranchAndData(gameId, viewingBranch.id);
          exitToMainLine();
        }
      });
      btnRow.appendChild(delBtn);
    }

    branchActionEl.appendChild(btnRow);

    // Si hay más variantes desde la misma jugada, se puede saltar
    // directamente entre ellas para compararlas.
    const siblings = loadBranches(currentLibraryRecord.id)
      .filter(b => b.fromPly === viewingBranch.fromPly && b.id !== viewingBranch.id);
    if (siblings.length) {
      const sibLabel = document.createElement('div');
      sibLabel.className = 'branchSiblingLabel';
      sibLabel.textContent = 'Otras variantes desde esta jugada';
      branchActionEl.appendChild(sibLabel);
      branchActionEl.appendChild(buildBranchPills(siblings));
    }
    return;
  }

  // ---- En la partida principal, sobre una jugada ramificada ----
  // En clase no se crean ramificaciones: el botón desaparece.
  newBranchBtnEl.hidden = teacherMode;
  const branchesHere = loadBranches(currentLibraryRecord.id).filter(b => b.fromPly === currentPly);

  if (branchesHere.length === 0) {
    branchActionEl.hidden = true;
    return;
  }

  branchActionEl.hidden = false;

  const label = document.createElement('div');
  label.className = 'branchActionInfo';
  label.textContent = branchesHere.length === 1
    ? 'Ramificación desde esta jugada'
    : 'Ramificaciones desde esta jugada';
  branchActionEl.appendChild(label);

  branchActionEl.appendChild(buildBranchPills(branchesHere));
}

// Pastillas compactas en vez de un botón alargado: se leen de un
// vistazo y varias caben en la misma línea.
function buildBranchPills(list) {
  const row = document.createElement('div');
  row.className = 'branchPills';
  list.forEach(branch => {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'branchPill';

    const ico = document.createElement('span');
    ico.className = 'branchPillIcon';
    ico.innerHTML = iconButton('branch');
    pill.appendChild(ico);

    const name = document.createElement('span');
    name.className = 'branchPillName';
    name.textContent = branch.name;
    pill.appendChild(name);

    const chev = document.createElement('span');
    chev.className = 'branchPillChevron';
    chev.innerHTML = iconButton('chevron');
    pill.appendChild(chev);

    pill.addEventListener('click', () => loadBranchView(branch, false));
    row.appendChild(pill);
  });
  return row;
}

newBranchBtnEl.addEventListener('click', enterBranchCreation);

// ---------- Chips de carpetas (filtro) ----------
function renderFolderChips() {
  const folders = loadFolders();
  folderChipsEl.innerHTML = '';

  const makeChip = (label, id, folder) => {
    const isActive = activeFolderId === id;
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'folderChip' + (isActive ? ' active' : '');
    const txt = document.createElement('span');
    txt.textContent = label;
    chip.appendChild(txt);

    // La carpeta seleccionada muestra sus opciones: tocarla otra vez las
    // abre. Antes había que adivinar que se mantenía pulsada.
    if (folder && isActive) {
      const dots = document.createElement('span');
      dots.className = 'folderChipDots';
      dots.innerHTML = iconButton('more');
      chip.appendChild(dots);
      chip.setAttribute('aria-label', `Opciones de la carpeta ${label}`);
      chip.addEventListener('click', () => openFolderSheet(folder));
    } else {
      chip.addEventListener('click', () => {
        activeFolderId = id;
        renderFolderChips();
        renderLibraryList();
      });
    }
    return chip;
  };

  folderChipsEl.appendChild(makeChip('Todas', 'all', null));
  if (folders.length > 0) folderChipsEl.appendChild(makeChip('Sin carpeta', 'none', null));
  folders.forEach(f => folderChipsEl.appendChild(makeChip(f.name, f.id, f)));

  const addChip = document.createElement('button');
  addChip.className = 'folderChip folderChipAdd';
  addChip.innerHTML = iconButton('add');
  addChip.setAttribute('aria-label', 'Nueva carpeta');
  addChip.addEventListener('click', openNewFolderSheet);
  folderChipsEl.appendChild(addChip);

  renderTagChips();
}

function populateFolderSelect() {
  const folders = loadFolders();
  folderSelectEl.innerHTML = '<option value="">Sin carpeta</option>' +
    folders.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
}

// ---------- Lista de la biblioteca ----------
// Las etiquetas se pintan en la misma fila que las carpetas, detrás de
// un separador: son otra forma de agrupar, no una carpeta más.
function renderTagChips() {
  const tags = allTags();
  if (!tags.length) return;

  const sep = document.createElement('span');
  sep.className = 'chipSeparator';
  folderChipsEl.appendChild(sep);

  tags.forEach(tag => {
    const chip = document.createElement('button');
    chip.type = 'button';
    const on = activeTag && activeTag.toLowerCase() === tag.toLowerCase();
    chip.className = 'folderChip tagChip' + (on ? ' active' : '');
    chip.textContent = '#' + tag;
    chip.addEventListener('click', () => {
      activeTag = on ? null : tag;
      renderFolderChips();
      renderLibraryList();
    });
    folderChipsEl.appendChild(chip);
  });
}

function filteredSortedGames() {
  const all = loadLibrary() || [];
  const q = foldText(searchQuery).trim();

  // Buscar es buscar: cuando escribes algo se mira en toda la biblioteca,
  // no solo dentro de la carpeta o la etiqueta que tuvieras puesta.
  if (q) {
    const found = all.filter(g => gameSearchBlob(g).includes(q));
    return sortGames(found);
  }

  let games = activeFolderId === 'all' ? all
    : activeFolderId === 'none' ? all.filter(g => !g.folderId)
    : all.filter(g => g.folderId === activeFolderId);

  if (activeTag) {
    const t = activeTag.toLowerCase();
    games = games.filter(g => normalizeTags(g.tags).some(x => x.toLowerCase() === t));
  }

  return sortGames(games);
}

function sortGames(games) {
  const bySort = {
    recent: (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
    // Sin año no se puede ordenar por año: esas partidas van al final.
    year: (a, b) => (parseInt(b.year, 10) || -Infinity) - (parseInt(a.year, 10) || -Infinity),
    title: (a, b) => gameDisplayTitle(a).localeCompare(gameDisplayTitle(b), 'es')
  };
  return games.slice().sort(bySort[sortMode] || bySort.recent);
}

function renderLibraryList() {
  const games = filteredSortedGames();
  refreshSearchUI(games.length);
  const folders = loadFolders();
  const folderName = (id) => (folders.find(f => f.id === id) || {}).name;

  libraryListEl.innerHTML = '';
  const isEmpty = games.length === 0;
  libraryEmptyEl.style.display = isEmpty ? 'flex' : 'none';
  libraryListEl.style.display = isEmpty ? 'none' : 'block';

  games.forEach((record, index) => {
    const row = document.createElement('div');
    row.className = 'libraryRow';
    // Entrada escalonada: la lista se compone, no aparece de golpe.
    row.style.animationDelay = Math.min(index, 9) * 32 + 'ms';

    const info = document.createElement('div');
    info.className = 'libraryInfo';
    const badge = resultBadge(record.pgn);
    const metaParts = gameMetaParts(record, folderName, activeFolderId === 'all');

    const titleEl = document.createElement('div');
    titleEl.className = 'libraryTitle';
    titleEl.textContent = gameDisplayTitle(record);
    const metaEl = document.createElement('div');
    metaEl.className = 'libraryMeta';
    metaEl.textContent = metaParts.join(' · ');
    info.appendChild(titleEl);
    info.appendChild(metaEl);

    const tags = normalizeTags(record.tags);
    if (tags.length) {
      const tagRow = document.createElement('div');
      tagRow.className = 'libraryTags';
      tags.slice(0, 4).forEach(t => {
        const el = document.createElement('span');
        el.className = 'libraryTag';
        el.textContent = '#' + t;
        tagRow.appendChild(el);
      });
      info.appendChild(tagRow);
    }
    info.addEventListener('click', () => showAnalysis(record));

    row.appendChild(info);

    if (badge) {
      const dot = document.createElement('span');
      dot.className = 'resultDot ' + badge.cls;
      dot.textContent = badge.label;
      row.appendChild(dot);
    }

    // Una sola puerta para todo lo que se puede hacer con la partida,
    // en vez de una papelera suelta que es fácil de rozar sin querer.
    const menuBtn = document.createElement('button');
    menuBtn.className = 'libraryDelete';
    menuBtn.innerHTML = iconButton('more');
    menuBtn.setAttribute('aria-label', 'Opciones de la partida');
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openRowSheet(record);
    });

    row.appendChild(menuBtn);
    libraryListEl.appendChild(row);
  });
}

// ---------- Hoja para añadir partida nueva ----------
const addSheetOverlay = document.getElementById('addSheetOverlay');

let editingGameId = null;

const whiteInput = document.getElementById('whiteInput');
const blackInput = document.getElementById('blackInput');
const eventInput = document.getElementById('eventInput');
const yearInput = document.getElementById('yearInput');
const tagsInput = document.getElementById('tagsInput');
const addSheetTitleEl = document.getElementById('addSheetTitle');
const saveGameBtnEl = document.getElementById('saveGameBtn');

function fillSheet(record) {
  titleInput.value = record ? (record.title || '') : '';
  whiteInput.value = record ? (record.white || '') : '';
  blackInput.value = record ? (record.black || '') : '';
  eventInput.value = record ? (record.event || '') : '';
  yearInput.value  = record ? (record.year || '') : '';
  tagsInput.value  = record ? normalizeTags(record.tags).join(', ') : '';
  pgnInput.value   = record ? (record.pgn || '') : '';
  folderSelectEl.value = record ? (record.folderId || '') : '';
  // Lo ya guardado está normalizado a notación inglesa.
  setPgnLang('en');
}

function readSheet() {
  return {
    title: titleInput.value,
    white: whiteInput.value,
    black: blackInput.value,
    event: eventInput.value,
    year: yearInput.value.replace(/\D/g, '').slice(0, 4),
    tags: tagsInput.value,
    pgn: pgnInput.value,
    folderId: folderSelectEl.value || null
  };
}

// Al pegar un PGN con cabeceras se rellenan los huecos que estén vacíos.
// Nunca pisa lo que ya hayas escrito tú.
// ---------- Idioma de la partida que se pega ----------
const pgnLangSegEl = document.getElementById('pgnLangSeg');
let pgnLang = 'en';

function setPgnLang(lang) {
  pgnLang = lang === 'es' ? 'es' : 'en';
  [...pgnLangSegEl.children].forEach(b =>
    b.classList.toggle('active', b.dataset.lang === pgnLang));
}

[...pgnLangSegEl.children].forEach(btn => {
  btn.addEventListener('click', () => setPgnLang(btn.dataset.lang));
});

function autofillFromPgn() {
  // El selector se coloca solo en lo que parece la partida pegada, pero
  // queda a la vista para corregirlo si se equivoca.
  const tokens = stripPgnDecorations(pgnInput.value)
    .replace(/\d+\s*\.(\.\.)?/g, ' ').split(/\s+/).filter(Boolean);
  if (tokens.length) setPgnLang(detectNotationLanguage(tokens));

  const md = metadataFromPgn(pgnInput.value);
  if (!md.white && !md.black && !md.event && !md.year) return;
  if (!whiteInput.value.trim()) whiteInput.value = md.white;
  if (!blackInput.value.trim()) blackInput.value = md.black;
  if (!eventInput.value.trim()) eventInput.value = md.event;
  if (!yearInput.value.trim())  yearInput.value  = md.year;
}
pgnInput.addEventListener('input', autofillFromPgn);
pgnInput.addEventListener('paste', () => setTimeout(autofillFromPgn, 0));

function openEditSheet(record) {
  editingGameId = record.id;
  populateFolderSelect();
  fillSheet(record);
  addSheetTitleEl.textContent = 'Editar partida';
  saveGameBtnEl.textContent = 'Guardar cambios';
  setMoreFields(!!(record.event || record.year || record.folderId || normalizeTags(record.tags).length));
  addSheetOverlay.classList.add('open');
}

// El bloque de datos extra empieza plegado: casi siempre basta con
// pegar la partida y ponerle nombre.
const moreFieldsEl = document.getElementById('moreFields');
const moreFieldsBtnEl = document.getElementById('moreFieldsBtn');

function setMoreFields(open) {
  moreFieldsEl.hidden = !open;
  moreFieldsBtnEl.classList.toggle('open', open);
}
moreFieldsBtnEl.addEventListener('click', () => setMoreFields(moreFieldsEl.hidden));

function openAddSheet() {
  editingGameId = null;
  populateFolderSelect();
  fillSheet(null);
  addSheetTitleEl.textContent = 'Nueva partida';
  saveGameBtnEl.textContent = 'Guardar partida';
  // Si estás viendo una carpeta, la partida nueva nace dentro de ella.
  if (activeFolderId !== 'all' && activeFolderId !== 'none') folderSelectEl.value = activeFolderId;
  if (activeTag) tagsInput.value = activeTag;
  setMoreFields(!!(folderSelectEl.value || tagsInput.value));
  addSheetOverlay.classList.add('open');
}
function closeAddSheet() { addSheetOverlay.classList.remove('open'); }

document.getElementById('newGameBtn').addEventListener('click', openAddSheet);
document.getElementById('closeSheetBtn').addEventListener('click', closeAddSheet);
addSheetOverlay.addEventListener('click', (e) => { if (e.target === addSheetOverlay) closeAddSheet(); });

saveGameBtnEl.addEventListener('click', () => {
  if (!pgnInput.value.trim()) return;
  const data = readSheet();
  data.pgn = normalizePgnToStandard(data.pgn, pgnLang);

  if (editingGameId) {
    const updated = updateGameInLibrary(editingGameId, data);
    editingGameId = null;
    closeAddSheet();
    renderFolderChips();
    renderLibraryList();
    return;
  }

  const record = addGameToLibrary(data);
  closeAddSheet();
  renderFolderChips();
  showAnalysis(record);
});

// ---------- Hoja de opciones, reutilizable ----------
const rowSheetOverlay = document.getElementById('rowSheetOverlay');
const rowSheetTitleEl = document.getElementById('rowSheetTitle');
const rowSheetActionsEl = document.getElementById('rowSheetActions');

function closeRowSheet() { rowSheetOverlay.classList.remove('open'); }

function openOptionsSheet(title, actions) {
  rowSheetTitleEl.textContent = title;
  rowSheetActionsEl.innerHTML = '';
  actions.forEach(a => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sheetAction' + (a.danger ? ' danger' : '');
    btn.textContent = a.label;
    btn.addEventListener('click', () => { closeRowSheet(); a.run(); });
    rowSheetActionsEl.appendChild(btn);
  });
  rowSheetOverlay.classList.add('open');
}

document.getElementById('closeRowSheetBtn').addEventListener('click', closeRowSheet);
rowSheetOverlay.addEventListener('click', (e) => { if (e.target === rowSheetOverlay) closeRowSheet(); });

function openRowSheet(record) {
  openOptionsSheet(gameDisplayTitle(record), [
    { label: 'Editar datos', run: () => openEditSheet(record) },
    { label: 'Eliminar partida', danger: true, run: () => {
        const name = gameDisplayTitle(record);
        if (!confirm(`¿Eliminar "${name}"? Se borran también sus apuntes y ramificaciones.`)) return;
        deleteGameFromLibrary(record.id);
        renderFolderChips();
        renderLibraryList();
      } }
  ]);
}

function openFolderSheet(folder) {
  openOptionsSheet(folder.name, [
    { label: 'Renombrar carpeta', run: () => openRenameFolderSheet(folder) },
    { label: 'Eliminar carpeta', danger: true, run: () => {
        if (!confirm(`¿Eliminar la carpeta "${folder.name}"? Las partidas no se borran, pasan a "Sin carpeta".`)) return;
        deleteFolder(folder.id);
        activeFolderId = 'all';
        renderFolderChips();
        renderLibraryList();
      } }
  ]);
}

// ---------- Buscador y orden ----------
const searchInputEl = document.getElementById('searchInput');
const sortSelectEl = document.getElementById('sortSelect');

const searchClearBtnEl = document.getElementById('searchClearBtn');
const searchStatusEl = document.getElementById('searchStatus');

function refreshSearchUI(resultCount) {
  const active = searchQuery.trim().length > 0;
  searchClearBtnEl.hidden = !active;
  searchStatusEl.hidden = !active;
  if (active) {
    searchStatusEl.textContent = resultCount === 0
      ? 'Sin resultados en toda la biblioteca'
      : `${resultCount} ${resultCount === 1 ? 'partida' : 'partidas'} en toda la biblioteca`;
  }
}

searchInputEl.addEventListener('input', () => {
  searchQuery = searchInputEl.value;
  renderLibraryList();
});

searchClearBtnEl.addEventListener('click', () => {
  searchInputEl.value = '';
  searchQuery = '';
  renderLibraryList();
  searchInputEl.focus();
});
sortSelectEl.addEventListener('change', () => {
  sortMode = sortSelectEl.value;
  renderLibraryList();
});

// ---------- Hoja para crear carpeta nueva ----------
const newFolderSheetOverlay = document.getElementById('newFolderSheetOverlay');
const folderNameInput = document.getElementById('folderNameInput');

let renamingFolderId = null;
const folderSheetTitleEl = document.querySelector('#newFolderSheetCard .sheetHeader h2');
const saveFolderBtnEl = document.getElementById('saveFolderBtn');

function openNewFolderSheet() {
  renamingFolderId = null;
  folderNameInput.value = '';
  if (folderSheetTitleEl) folderSheetTitleEl.textContent = 'Nueva carpeta';
  saveFolderBtnEl.textContent = 'Crear carpeta';
  newFolderSheetOverlay.classList.add('open');
}

function openRenameFolderSheet(folder) {
  renamingFolderId = folder.id;
  folderNameInput.value = folder.name;
  if (folderSheetTitleEl) folderSheetTitleEl.textContent = 'Renombrar carpeta';
  saveFolderBtnEl.textContent = 'Guardar nombre';
  newFolderSheetOverlay.classList.add('open');
}

function closeNewFolderSheet() {
  newFolderSheetOverlay.classList.remove('open');
  renamingFolderId = null;
}

document.getElementById('closeFolderSheetBtn').addEventListener('click', closeNewFolderSheet);
newFolderSheetOverlay.addEventListener('click', (e) => { if (e.target === newFolderSheetOverlay) closeNewFolderSheet(); });

saveFolderBtnEl.addEventListener('click', () => {
  if (!folderNameInput.value.trim()) return;
  if (renamingFolderId) {
    renameFolder(renamingFolderId, folderNameInput.value);
    closeNewFolderSheet();
    renderFolderChips();
    renderLibraryList();
    return;
  }
  const folder = addFolder(folderNameInput.value);
  activeFolderId = folder.id;
  closeNewFolderSheet();
  renderFolderChips();
  renderLibraryList();
});

// ---------- Iconos de los botones (inyectados por JS, nada de emoji) ----------
document.getElementById('prevBtn').innerHTML = iconButton('prev');
document.getElementById('nextBtn').innerHTML = iconButton('next');
document.getElementById('newGameBtn').innerHTML = iconButton('add');
document.getElementById('backBtn').innerHTML = iconButton('back');
document.getElementById('newBranchIcon').innerHTML = iconButton('branch');
// Todas las X de cerrar de una vez: si mañana se añade otra hoja,
// su botón recibe el icono sin tener que acordarse de nada.
document.querySelectorAll('[id^="close"].roundBtn').forEach(btn => {
  btn.innerHTML = iconButton('close');
});
document.getElementById('settingsBtn').innerHTML = iconButton('settings');
document.getElementById('settingsBackBtn').innerHTML = iconButton('back');
document.getElementById('exportIcon').innerHTML = iconButton('exportUp');
document.getElementById('importIcon').innerHTML = iconButton('importDown');
document.getElementById('themeIcon').innerHTML = iconButton('contrast');
document.getElementById('typeIcon').innerHTML = iconButton('textSize');
document.getElementById('teacherIcon').innerHTML = iconButton('teacher');
document.getElementById('searchIcon').innerHTML = iconButton('search');
document.getElementById('moreFieldsChevron').innerHTML = iconButton('chevron');
document.getElementById('orientIcon').innerHTML = iconButton('flip');
document.getElementById('coordsIcon').innerHTML = iconButton('coords');
document.getElementById('notationIcon').innerHTML = iconButton('piece');
document.getElementById('awakeIcon').innerHTML = iconButton('awake');
document.getElementById('flipBtn').innerHTML = iconButton('flip');

// ============================================================
// APARIENCIA — tema y tamaño del texto
// La escala solo afecta al texto: el tablero se mide en píxeles y
// proporción de pantalla, así que no se deforma al agrandar la letra.
// ============================================================

const THEME_KEY = 'chess-theme';
const TYPE_KEY = 'chess-type-scale';

function readPref(key, fallback) {
  try { return localStorage.getItem(key) || fallback; } catch (e) { return fallback; }
}
function writePref(key, value) {
  try { localStorage.setItem(key, value); } catch (e) {}
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'light' ? '#f2eee5' : '#000000');
  document.querySelectorAll('#themeSeg button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });
}

function applyTypeScale(scale) {
  document.documentElement.style.setProperty('--type-scale', scale);
  document.querySelectorAll('#typeSeg button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.scale === scale);
  });
}

document.querySelectorAll('#themeSeg button').forEach(btn => {
  btn.addEventListener('click', () => {
    writePref(THEME_KEY, btn.dataset.theme);
    applyTheme(btn.dataset.theme);
  });
});

document.querySelectorAll('#typeSeg button').forEach(btn => {
  btn.addEventListener('click', () => {
    writePref(TYPE_KEY, btn.dataset.scale);
    applyTypeScale(btn.dataset.scale);
  });
});

// ---------- Tablero: orientación y coordenadas ----------
const FLIP_KEY = 'chess-board-flipped';
const COORDS_KEY = 'chess-board-coords';

const flipBtnEl = document.getElementById('flipBtn');
const orientSegEl = document.getElementById('orientSeg');
const coordsToggleEl = document.getElementById('coordsToggle');

function applyBoardFlip(flipped, redraw) {
  boardFlipped = !!flipped;
  flipBtnEl.classList.toggle('active', boardFlipped);
  [...orientSegEl.children].forEach(b =>
    b.classList.toggle('active', (b.dataset.flip === '1') === boardFlipped));
  renderBoardCoordinates();
  if (redraw && gameState) refreshBoardOnly();
}

flipBtnEl.addEventListener('click', () => {
  writePref(FLIP_KEY, boardFlipped ? '0' : '1');
  applyBoardFlip(!boardFlipped, true);
});

[...orientSegEl.children].forEach(btn => {
  btn.addEventListener('click', () => {
    writePref(FLIP_KEY, btn.dataset.flip);
    applyBoardFlip(btn.dataset.flip === '1', true);
  });
});

function applyCoordsVisible(on) {
  document.getElementById('boardFrame').classList.toggle('no-coords', !on);
  coordsToggleEl.classList.toggle('on', on);
  coordsToggleEl.setAttribute('aria-checked', on ? 'true' : 'false');
}

coordsToggleEl.addEventListener('click', () => {
  const next = !coordsToggleEl.classList.contains('on');
  writePref(COORDS_KEY, next ? '1' : '0');
  applyCoordsVisible(next);
});

applyBoardFlip(readPref(FLIP_KEY, '0') === '1', false);
applyCoordsVisible(readPref(COORDS_KEY, '1') === '1');

// ---------- Idioma de la notación en pantalla ----------
const NOTATION_KEY = 'chess-notation-lang';
const notationSegEl = document.getElementById('notationSeg');

function applyNotationLang(lang, redraw) {
  notationLang = lang === 'en' ? 'en' : 'es';
  [...notationSegEl.children].forEach(b =>
    b.classList.toggle('active', b.dataset.lang === notationLang));
  if (redraw && gameState) {
    buildMoveStrip();
    goToPly(currentPly);
  }
}

[...notationSegEl.children].forEach(btn => {
  btn.addEventListener('click', () => {
    writePref(NOTATION_KEY, btn.dataset.lang);
    applyNotationLang(btn.dataset.lang, true);
  });
});

applyNotationLang(readPref(NOTATION_KEY, 'es'), false);

// ---------- Mantener la pantalla encendida durante la clase ----------
const AWAKE_KEY = 'chess-keep-awake';
const awakeToggleEl = document.getElementById('awakeToggle');
let wakeLock = null;
let keepAwake = false;

async function acquireWakeLock() {
  if (!keepAwake || !('wakeLock' in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch (e) { /* el sistema puede negarlo; no es crítico */ }
}

function releaseWakeLock() {
  if (wakeLock) { try { wakeLock.release(); } catch (e) {} wakeLock = null; }
}

// iOS suelta el bloqueo al cambiar de app: se vuelve a pedir al volver.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') acquireWakeLock();
});

function applyKeepAwake(on) {
  keepAwake = on;
  awakeToggleEl.classList.toggle('on', on);
  awakeToggleEl.setAttribute('aria-checked', on ? 'true' : 'false');
  if (on) acquireWakeLock(); else releaseWakeLock();
}

awakeToggleEl.addEventListener('click', () => {
  const next = !keepAwake;
  writePref(AWAKE_KEY, next ? '1' : '0');
  applyKeepAwake(next);
});

applyKeepAwake(readPref(AWAKE_KEY, '0') === '1');

// ---------- Flechas del teclado, por si hay teclado conectado ----------
document.addEventListener('keydown', (e) => {
  if (analysisView.hidden) return;
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
  if (e.key === 'ArrowRight') { e.preventDefault(); stepForward(); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); stepBackward(); }
});

// ---------- Modo profesor ----------
const TEACHER_KEY = 'chess-teacher-mode';
let teacherMode = readPref(TEACHER_KEY, '0') === '1';

const teacherToggleEl = document.getElementById('teacherToggle');

function applyTeacherMode(on) {
  teacherMode = on;
  teacherToggleEl.classList.toggle('on', on);
  teacherToggleEl.setAttribute('aria-checked', on ? 'true' : 'false');
  // Si se activa estando dentro de una rama en edición, se cierra la
  // edición: en clase el tablero no debe quedar tocable.
  if (on && branchEditMode) {
    branchEditMode = false;
    selectedSquare = null;
    legalDestinations = [];
    applyBranchModeUI();
    refreshBoardOnly();
    renderStatus();
  }
  if (currentLibraryRecord && !analysisView.hidden) renderBranchAction();
}

teacherToggleEl.addEventListener('click', () => {
  const next = !teacherMode;
  writePref(TEACHER_KEY, next ? '1' : '0');
  applyTeacherMode(next);
});

applyTeacherMode(teacherMode);

applyTheme(readPref(THEME_KEY, 'dark'));
applyTypeScale(readPref(TYPE_KEY, '1'));

// ---------- Nada seleccionable fuera de los campos de texto ----------
// Al mantener pulsada una flecha, iOS intentaba iniciar una selección
// de texto o abrir el menú de copiar. Se corta en el propio evento.
function isTextField(node) {
  return node && node.closest && node.closest('textarea, input');
}
document.addEventListener('selectstart', (e) => {
  if (!isTextField(e.target)) e.preventDefault();
});
document.addEventListener('contextmenu', (e) => {
  if (!isTextField(e.target)) e.preventDefault();
});

// ============================================================
// COPIA DE SEGURIDAD — exportar/importar todos los datos de la app
// (partidas, carpetas, ramas y apuntes), para poder pasarlos a otro
// dispositivo o simplemente guardarlos por si acaso.
// ============================================================

const BACKUP_APP_ID = 'ajedrez-pgn-backup';
const BACKUP_PREFIX = 'chess-';

function collectAllAppData() {
  const data = {};
  Object.keys(localStorage)
    .filter(k => k.startsWith(BACKUP_PREFIX))
    .forEach(k => { data[k] = localStorage.getItem(k); });
  return data;
}

async function handleExportClick() {
  const payload = {
    app: BACKUP_APP_ID,
    version: 1,
    exportedAt: new Date().toISOString(),
    data: collectAllAppData()
  };
  const json = JSON.stringify(payload, null, 2);
  const filename = `ajedrez-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([json], filename, { type: 'application/json' });

  if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
    try {
      await navigator.share({ files: [file], title: 'Copia de seguridad de Ajedrez' });
    } catch (e) { /* el usuario canceló el panel de compartir: no pasa nada */ }
    return;
  }

  // Alternativa si el dispositivo no soporta compartir archivos: descarga directa.
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Combina los datos importados con los que ya hay en este dispositivo,
// SIN borrar ni sobrescribir nada existente:
// - listas (partidas, carpetas, ramas): se añaden las que falten, por id.
// - apuntes u otros valores sueltos: solo se rellenan si aquí no había nada.
function mergeImportedData(importedData) {
  const stats = { games: 0, folders: 0, branches: 0, notes: 0 };

  Object.keys(importedData).forEach(key => {
    const importedRaw = importedData[key];
    const existingRaw = localStorage.getItem(key);

    if (existingRaw === null) {
      localStorage.setItem(key, importedRaw);
      if (key === LIBRARY_KEY) stats.games += (JSON.parse(importedRaw) || []).length;
      else if (key === FOLDERS_KEY) stats.folders += (JSON.parse(importedRaw) || []).length;
      else if (key.startsWith('chess-branches:')) stats.branches += (JSON.parse(importedRaw) || []).length;
      else if (key.startsWith('chess-notes:')) stats.notes += 1;
      return;
    }

    try {
      const existingArr = JSON.parse(existingRaw);
      const importedArr = JSON.parse(importedRaw);
      if (Array.isArray(existingArr) && Array.isArray(importedArr)) {
        const existingIds = new Set(existingArr.map(x => x.id));
        const newOnes = importedArr.filter(x => x && !existingIds.has(x.id));
        if (newOnes.length > 0) {
          localStorage.setItem(key, JSON.stringify(existingArr.concat(newOnes)));
          if (key === LIBRARY_KEY) stats.games += newOnes.length;
          else if (key === FOLDERS_KEY) stats.folders += newOnes.length;
          else if (key.startsWith('chess-branches:')) stats.branches += newOnes.length;
        }
        return;
      }
    } catch (e) { /* no era JSON: es un apunte de texto suelto, se trata abajo */ }

    // Clave escalar ya existente aquí (un apunte, la última jugada vista…):
    // se conserva la versión local, no se sobrescribe.
  });

  return stats;
}

document.getElementById('exportBtn').addEventListener('click', handleExportClick);

const importFileInputEl = document.getElementById('importFileInput');
document.getElementById('importBtn').addEventListener('click', () => importFileInputEl.click());

importFileInputEl.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  importFileInputEl.value = '';
  if (!file) return;

  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    if (!payload || payload.app !== BACKUP_APP_ID || !payload.data) {
      alert('Este archivo no es una copia de seguridad válida de esta app.');
      return;
    }
    const stats = mergeImportedData(payload.data);
    alert(
      `Importado correctamente.\n\n` +
      `Partidas nuevas: ${stats.games}\n` +
      `Carpetas nuevas: ${stats.folders}\n` +
      `Ramificaciones nuevas: ${stats.branches}\n` +
      `Apuntes nuevos: ${stats.notes}`
    );
    renderFolderChips();
    renderLibraryList();
  } catch (err) {
    alert('No se pudo leer el archivo. Comprueba que sea una copia de seguridad exportada desde esta app.');
  }
});

// ============================================================
// VOLVER ATRÁS DESLIZANDO DESDE EL BORDE
// Como en cualquier app de iPad: se arrastra desde el borde
// izquierdo y la pantalla acompaña al dedo. Si se pasa de la
// mitad del recorrido, se vuelve; si no, se queda donde estaba.
// ============================================================
(function enableEdgeSwipeBack() {
  const EDGE = 26;       // desde dónde cuenta como gesto de borde
  const TRIGGER = 72;    // cuánto hay que arrastrar para volver
  const MAX = 260;
  let startX = 0, startY = 0, tracking = false, engaged = false, view = null, busy = false;

  function currentBackAction() {
    if (!settingsView.hidden) return { el: settingsView, go: showHome };
    if (!analysisView.hidden) {
      // Dentro de una ramificación, el paso atrás natural es la partida.
      if (viewingBranch) return { el: analysisView, go: exitToMainLine };
      return { el: analysisView, go: showHome };
    }
    return null;
  }

  function clearStyles(el) {
    if (!el) return;
    el.style.transition = '';
    el.style.transform = '';
  }

  function snapBack() {
    const el = view;
    tracking = engaged = false;
    view = null;
    if (!el) return;
    el.style.transition = 'transform .26s cubic-bezier(.22,.61,.36,1)';
    el.style.transform = '';
    setTimeout(() => clearStyles(el), 280);
  }

  document.addEventListener('pointerdown', (e) => {
    if (busy || e.clientX > EDGE) return;
    // Editando una ramificación se tocan casillas pegadas al borde:
    // el gesto no debe robarle el toque al tablero.
    if (branchEditMode) return;
    // La tira de notación se desplaza sola en horizontal.
    if (e.target.closest && e.target.closest('#moveStrip')) return;
    if (document.querySelector(
        '#addSheetOverlay.open, #rowSheetOverlay.open, #newFolderSheetOverlay.open,' +
        '#branchNameSheetOverlay.open, #promotionOverlay.open')) return;
    const action = currentBackAction();
    if (!action) return;
    startX = e.clientX; startY = e.clientY;
    tracking = true; engaged = false; view = action.el;
  }, true);

  document.addEventListener('pointermove', (e) => {
    if (!tracking) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!engaged) {
      // Solo se engancha si el gesto es claramente horizontal.
      if (Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx)) { snapBack(); return; }
      if (dx < 10) return;
      engaged = true;
      view.style.transition = '';
    }
    if (dx <= 0) { view.style.transform = ''; return; }
    // Resistencia al final del recorrido, para que no se sienta un tirón.
    const eased = dx > MAX ? MAX + (dx - MAX) * 0.2 : dx;
    view.style.transform = `translateX(${eased}px)`;
  }, true);

  document.addEventListener('pointerup', (e) => {
    if (!tracking) return;
    const dx = (e.clientX || 0) - startX;
    const action = currentBackAction();

    if (engaged && dx >= TRIGGER && action) {
      // La pantalla termina de salir y solo entonces se navega: así el
      // cambio no da un salto, sigue el movimiento del dedo.
      const el = view;
      tracking = engaged = false; view = null; busy = true;
      el.style.transition = 'transform .2s cubic-bezier(.3,.7,.4,1)';
      el.style.transform = 'translateX(100%)';
      setTimeout(() => {
        clearStyles(el);
        document.body.classList.add('nav-back');
        action.go();
        setTimeout(() => { document.body.classList.remove('nav-back'); busy = false; }, 320);
      }, 200);
      return;
    }
    snapBack();
  }, true);

  document.addEventListener('pointercancel', snapBack, true);
})();

// ---------- Registro del Service Worker ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => console.warn('SW no registrado:', err));
  });
}

// ---------- Arranque ----------
ensureLibrarySeeded();
showHome();
