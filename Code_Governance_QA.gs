const ROOT_FOLDER_ID = '1LOWnIYq3IsINwZAvFMALO1qPO2m74qlZ';

const CACHE_FOLDER_NAME = '_Gorilla_API_Cache';
const INDEX_PROPERTY_NAME = 'GORILLA_CACHE_INDEX';
const INDEX_FILE_PROPERTY_NAME = 'GORILLA_CACHE_INDEX_FILE_V3';
const INDEX_META_PROPERTY_NAME = 'GORILLA_CACHE_INDEX_META_V2';
const INDEX_CHUNK_PREFIX = 'GORILLA_CACHE_INDEX_CHUNK_V2_';
const SYNC_MAX_FILES_PER_RUN = 2;
const SYNC_BUDGET_MS = 210000;
const SYNC_CONTINUATION_HANDLER = 'continueGorillaSync';
const PREP_BUILD_PROPERTY = 'GORILLA_PREP_BUILD_V3';
const PREPARED_PARTS_PROPERTY = 'GORILLA_PREPARED_PARTS_V3';
const ROUTE_PLAN_ONLY_CACHE_PROPERTY_ = 'GORILLA_ROUTE_PLAN_ONLY_CACHE_V1';


// =====================================================
// MAIN SYNC
// =====================================================

function testCacheIndex() {

  const index = loadCacheIndex();

  const ids = Object.keys(index);

  Logger.log(
    'Cached files: ' +
    ids.length
  );

  ids.forEach(id => {

    const item = index[id];

    Logger.log(
      item.sourceDate +
      ' | ' +
      item.sourceFileName +
      ' | Cache ID: ' +
      item.cacheFileId
    );

    Logger.log(
      'Sheets: ' +
      JSON.stringify(
        item.sheets
      )
    );
  });
}


// =====================================================
// INSPECT WORKBOOK
// =====================================================

function inspectCachedWorkbook(spreadsheet) {

  const result = {};

  const sheets =
    spreadsheet.getSheets();

  sheets.forEach(sheet => {

    result[sheet.getName()] = {

      rows:
        Math.max(
          0,
          sheet.getLastRow() - 1
        ),

      columns:
        sheet.getLastColumn()

    };
  });

  return result;
}


// =====================================================
// CACHE FOLDER
// =====================================================

function getOrCreateCacheFolder(rootFolder) {

  const folders =
    rootFolder.getFoldersByName(
      CACHE_FOLDER_NAME
    );

  if (folders.hasNext()) {

    return folders.next();
  }

  const folder =
    rootFolder.createFolder(
      CACHE_FOLDER_NAME
    );

  Logger.log(
    'Cache folder created: ' +
    CACHE_FOLDER_NAME
  );

  return folder;
}


// =====================================================
// COLLECT RAW EXCEL FILES
// =====================================================

function collectExcelFiles(
  folder,
  result,
  cacheFolderId
) {

  // Never enter cache folder

  if (
    folder.getId() ===
    cacheFolderId
  ) {
    return;
  }


  const files =
    folder.getFiles();

  while (files.hasNext()) {

    const file =
      files.next();

    const name =
      file
        .getName()
        .toLowerCase();

    if (
      name.endsWith('.xlsx') ||
      name.endsWith('.xls') || file.getMimeType() === MimeType.GOOGLE_SHEETS
    ) {

      result.push(file);
    }
  }


  const folders =
    folder.getFolders();

  while (folders.hasNext()) {

    const subFolder =
      folders.next();

    if (
      subFolder.getId() ===
      cacheFolderId
    ) {
      continue;
    }

    collectExcelFiles(
      subFolder,
      result,
      cacheFolderId
    );
  }
}


// =====================================================
// CONVERT EXCEL TO PERMANENT CACHE
// =====================================================

function convertExcelToCache(
  file,
  cacheFolder
) {

  const safeName =
    file
      .getName()
      .replace(
        /\.(xlsx|xls)$/i,
        ''
      );


  const resource = {

    name:
      'CACHE - ' +
      safeName,

    mimeType:
      'application/vnd.google-apps.spreadsheet',

    parents: [
      cacheFolder.getId()
    ]
  };


  const converted =
    Drive.Files.create(
      resource,
      file.getBlob(),
      {
        fields:
          'id,name,parents'
      }
    );


  return converted;
}


// =====================================================
// SOURCE DATE
// =====================================================

function detectSourceDate(
  file,
  spreadsheet
) {

  // -----------------------------------------
  // 1) DATE FROM FILENAME
  // -----------------------------------------

  // -----------------------------------------
  // 2) DATE FROM ALL TAB
  // -----------------------------------------

  const allSheet =
    spreadsheet.getSheetByName(
      'All'
    );

  if (
    allSheet &&
    allSheet.getLastRow() >= 2
  ) {

    const headers =
      allSheet
        .getRange(
          1,
          1,
          1,
          allSheet.getLastColumn()
        )
        .getValues()[0];


    const dateIndex =
      headers.indexOf(
        'Date'
      );


    if (dateIndex !== -1) {

      const dates =
        allSheet
          .getRange(
            2,
            dateIndex + 1,
            allSheet.getLastRow() - 1,
            1
          )
          .getValues();


      for (
        let i = 0;
        i < dates.length;
        i++
      ) {

        if (dates[i][0] !== '') {

          const date =
            normalizeDate(
              dates[i][0]
            );

          if (date) {

            return date;
          }
        }
      }
    }
  }


  const filenameDate =
    extractDateFromFilename(
      file.getName()
    );

  if (filenameDate) {

    return filenameDate;
  }


  // -----------------------------------------
  // 3) FALLBACK = DRIVE MODIFIED DATE
  // -----------------------------------------

  return Utilities.formatDate(
    file.getLastUpdated(),
    'Africa/Cairo',
    'yyyy-MM-dd'
  );
}


// =====================================================
// DATE FROM FILENAME
// =====================================================

function extractDateFromFilename(filename) {

  // DD-MM-YYYY
  // DD_MM_YYYY
  // DD.MM.YYYY

  let match =
    filename.match(
      /(\d{1,2})[-_.](\d{1,2})[-_.](\d{4})/
    );


  if (match) {

    const day =
      String(
        match[1]
      ).padStart(
        2,
        '0'
      );

    const month =
      String(
        match[2]
      ).padStart(
        2,
        '0'
      );

    const year =
      match[3];


    return (
      year +
      '-' +
      month +
      '-' +
      day
    );
  }


  // YYYY-MM-DD

  match =
    filename.match(
      /(\d{4})[-_.](\d{1,2})[-_.](\d{1,2})/
    );


  if (match) {

    const year =
      match[1];

    const month =
      String(
        match[2]
      ).padStart(
        2,
        '0'
      );

    const day =
      String(
        match[3]
      ).padStart(
        2,
        '0'
      );


    return (
      year +
      '-' +
      month +
      '-' +
      day
    );
  }


  return '';
}


// =====================================================
// NORMALIZE DATE
// =====================================================

function normalizeDate(value) {

  if (!value) {

    return '';
  }


  if (
    Object.prototype
      .toString
      .call(value) ===
    '[object Date]'
  ) {

    return Utilities.formatDate(
      value,
      'Africa/Cairo',
      'yyyy-MM-dd'
    );
  }


  const text =
    String(value)
      .trim();


  const match =
    text.match(
      /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/
    );


  if (match) {

    return (
      match[3] +
      '-' +
      String(
        match[2]
      ).padStart(
        2,
        '0'
      ) +
      '-' +
      String(
        match[1]
      ).padStart(
        2,
        '0'
      )
    );
  }


  return text;
}


// =====================================================
// INDEX
// =====================================================

function loadCacheIndex() {
  const properties = PropertiesService.getScriptProperties();
  const filePointerRaw = properties.getProperty(INDEX_FILE_PROPERTY_NAME);
  if (filePointerRaw) {
    try {
      const pointer = JSON.parse(filePointerRaw);
      if (pointer && pointer.id) {
        const file = DriveApp.getFileById(pointer.id);
        if (!file.isTrashed()) {
          const index = JSON.parse(file.getBlob().getDataAsString('UTF-8'));
          if (index && typeof index === 'object' && !Array.isArray(index)) return index;
        }
      }
    } catch (err) {
      Logger.log('Drive-backed cache index could not be read: ' + String(err.message || err));
    }
  }

  // Read the interim v2 chunk format if it exists, then fall back to the
  // original single-property index. saveCacheIndex migrates either format.
  const metaRaw = properties.getProperty(INDEX_META_PROPERTY_NAME);
  if (metaRaw) {
    try {
      const meta = JSON.parse(metaRaw);
      if (meta && meta.version === 2 && meta.generation && Number(meta.count) > 0) {
        let serialized = '';
        for (let i = 0; i < Number(meta.count); i++) {
          const chunk = properties.getProperty(INDEX_CHUNK_PREFIX + meta.generation + '_' + i);
          if (chunk === null) throw new Error('Missing cache-index chunk ' + i);
          serialized += chunk;
        }
        const index = JSON.parse(serialized);
        if (index && typeof index === 'object' && !Array.isArray(index)) return index;
        throw new Error('Cache index is not an object');
      }
    } catch (err) {
      Logger.log('Versioned cache index could not be read: ' + String(err.message || err));
    }
  }

  // Backward compatibility with the original single-property index.
  const raw = properties.getProperty(INDEX_PROPERTY_NAME);
  if (!raw) return {};
  try {
    const index = JSON.parse(raw);
    return index && typeof index === 'object' && !Array.isArray(index) ? index : {};
  } catch (err) {
    Logger.log('Invalid legacy cache index. Starting with an empty index.');
    return {};
  }
}


function saveCacheIndex(index, cacheFolder) {
  const properties = PropertiesService.getScriptProperties();
  const serialized = JSON.stringify(index || {});
  let oldPointer = null;
  try { oldPointer = JSON.parse(properties.getProperty(INDEX_FILE_PROPERTY_NAME) || 'null'); } catch (err) {}
  const folder = cacheFolder || getOrCreateCacheFolder(DriveApp.getFolderById(ROOT_FOLDER_ID));
  const file = folder.createFile('gorilla-cache-index-v3-' + Utilities.getUuid() + '.json', serialized, MimeType.PLAIN_TEXT);
  try {
    // Publish the new immutable index by changing a tiny pointer first.
    properties.setProperty(INDEX_FILE_PROPERTY_NAME, JSON.stringify({version: 3, id: file.getId(), updatedAt: new Date().toISOString()}));
  } catch (err) {
    try { file.setTrashed(true); } catch (cleanupErr) {}
    throw err;
  }
  if (oldPointer && oldPointer.id && oldPointer.id !== file.getId()) {
    try { DriveApp.getFileById(oldPointer.id).setTrashed(true); } catch (err) {}
  }

  // Clean up any old Script Properties index formats after the Drive index is published.
  Object.keys(properties.getProperties()).filter(key => key.indexOf(INDEX_CHUNK_PREFIX) === 0).forEach(key => properties.deleteProperty(key));
  properties.deleteProperty(INDEX_META_PROPERTY_NAME);
  properties.deleteProperty(INDEX_PROPERTY_NAME);
}
// =====================================================
// SECURITY CONFIG
// =====================================================

const USERS_PROPERTY = 'GORILLA_USERS';
const API_SECRET_PROPERTY = 'GORILLA_API_SECRET';

const SESSION_HOURS = 12;

const ALLOWED_DATA_SHEETS = [
  'All',
  'Start-End',
  'NewStores',
  'RoutePlan'
];

const NEW_STORES_CURRENT_ROUND_START = '2026-09-11';
const NEW_STORES_HISTORY_FILE = 'new add life time untell last round';
const NEW_STORES_SEED_FILE = "new add from 11 sep'26 to 21 sep'26";


// =====================================================
// ONE-TIME SECURITY SETUP
// شغّلها مرة واحدة فقط
// =====================================================

function setupGorillaSecurity() {
  if (PropertiesService.getScriptProperties().getProperty(USERS_PROPERTY)) throw new Error('Accounts already exist. Setup was not repeated.');

  const props =
    PropertiesService.getScriptProperties();

  // -----------------------------------------
  // API SIGNING SECRET
  // -----------------------------------------

  let secret =
    props.getProperty(
      API_SECRET_PROPERTY
    );

  if (!secret) {

    secret =
      Utilities.getUuid() +
      Utilities.getUuid() +
      Utilities.getUuid();

    props.setProperty(
      API_SECRET_PROPERTY,
      secret
    );
  }


  // -----------------------------------------
  // USERS
  // -----------------------------------------

  const users = {};

  const definitions = [
    {
      username: 'owner',
      role: 'owner',
      rtms: ['*']
    },
    {
      username: 'rtm1',
      role: 'rtm',
      rtms: ['Giza']
    },
    {
      username: 'rtm2',
      role: 'rtm',
      rtms: ['East Cairo']
    },
    {
      username: 'rtm3',
      role: 'rtm',
      rtms: ['West Cairo']
    },
    {
      username: 'rtm4',
      role: 'rtm',
      rtms: ['Alex & North Coast']
    }
  ];


  definitions.forEach(user => {

    const password =
      generateStrongPassword();

    const salt =
      Utilities.getUuid();

    users[user.username] = {

      username:
        user.username,

      role:
        user.role,

      rtms:
        user.rtms,

      salt:
        salt,

      passwordHash:
        hashPassword(
          password,
          salt
        ),

      active:
        true
    };


    Logger.log(
      'LOGIN CREATED | ' +
      user.username +
      ' | PASSWORD: ' +
      password +
      ' | RTM: ' +
      user.rtms.join(', ')
    );
  });


  props.setProperty(
    USERS_PROPERTY,
    JSON.stringify(users)
  );


  Logger.log('===================================');
  Logger.log('SECURITY SETUP COMPLETED');
  Logger.log('SAVE THE PASSWORDS NOW');
  Logger.log('===================================');
}


// =====================================================
// CHANGE USER PASSWORD
// =====================================================

function changeUserPassword(
  username,
  newPassword
) {

  if (
    !username ||
    !newPassword ||
    String(newPassword).length < 10
  ) {
    throw new Error(
      'Password must be at least 10 characters'
    );
  }


  const users =
    loadUsers();

  username =
    String(username)
      .trim()
      .toLowerCase();


  if (!users[username]) {
    throw new Error(
      'User not found'
    );
  }


  const salt =
    Utilities.getUuid();


  users[username].salt =
    salt;

  users[username].passwordHash =
    hashPassword(
      newPassword,
      salt
    );


  users[username].sessionVersion = Number(users[username].sessionVersion || 0) + 1;
  saveUsers(users);


  Logger.log(
    'Password updated for: ' +
    username
  );
}


// =====================================================
// GET - PUBLIC STATUS ONLY
// =====================================================

function doGet(e) {

  return jsonResponse({
    ok: true,
    service: 'Gorilla Data API',
    status: 'online',
    version: '2.1-web'
  });
}


// =====================================================
// POST - LOGIN / DATA
// =====================================================

function doPost(e) {

  try {

    const action =
      getRequestValue(
        e,
        'action'
      ) || '';


    // =========================================
    // LOGIN
    // =========================================

    if (action === 'login') {
      const body = readBody(e);
      const result = apiLogin(body.username, body.password);
      // One web-app round trip authenticates and returns the already prepared
      // data. Login never starts a Drive scan or spreadsheet conversion.
      if (result.ok && body.bootstrap === true) {
        try { result.bootstrap = webBootstrap(result.user, body.format === 'columns'); }
        catch (err) { result.bootstrapError = String(err.message || err); }
      }
      return jsonResponse(result);
    }


    // =========================================
    // EVERYTHING BELOW REQUIRES LOGIN
    // =========================================

    const token =
      getRequestValue(
        e,
        'token'
      );


    const session =
      verifySessionToken(
        token
      );


    if (!session) {

      return jsonResponse({
        ok: false,
        error: 'Unauthorized'
      });
    }
if (action === 'aiInterpret') {
  const body = readBody(e);
  return jsonResponse(handleAiInterpret(body));
}

    const webResult = webAction(action, readBody(e), session);
    if (webResult) return jsonResponse(webResult);

    // =========================================
    // CURRENT USER
    // =========================================

    if (action === 'me') {

      return jsonResponse({
        ok: true,

        user: {
          username:
            session.username,

          role:
            session.role,

          rtms:
            session.rtms
        }
      });
    }


    // =========================================
    // DATA
    // =========================================

    if (action === 'data') {

      const sheetName =
        getRequestValue(
          e,
          'sheet'
        );


      const dateFrom =
        getRequestValue(
          e,
          'from'
        );


      const dateTo =
        getRequestValue(
          e,
          'to'
        );


      return jsonResponse(
        getSecureSheetData(
          sheetName,
          session,
          dateFrom,
          dateTo
        )
      );
    }


    return jsonResponse({
      ok: false,
      error: 'Unknown action'
    });


  } catch (err) {

    return jsonResponse({
      ok: false,

      error:
        String(
          err &&
          err.message
            ? err.message
            : err
        )
    });
  }
}


// =====================================================
// LOGIN
// =====================================================

function apiLogin(
  username,
  password
) {

  username =
    String(
      username || ''
    )
      .trim()
      .toLowerCase();


  password =
    String(
      password || ''
    );


  if (
    !username ||
    !password
  ) {

    return {
      ok: false,
      error: 'Username and password required'
    };
  }


  const users =
    loadUsers();


  const user = Object.prototype.hasOwnProperty.call(users, username) ? users[username] : null;


  if (
    !user ||
    !user.active
  ) {

    return {
      ok: false,
      error: 'Invalid username or password'
    };
  }


  const attemptedHash =
    hashPassword(
      password,
      user.salt
    );


  if (
    attemptedHash !==
    user.passwordHash
  ) {

    return {
      ok: false,
      error: 'Invalid username or password'
    };
  }


  const token =
    createSessionToken(
      user
    );


  return {
    ok: true,

    token:
      token,

    user: publicUser(user),

    expiresInHours:
      SESSION_HOURS
  };
}


// =====================================================
// CREATE SESSION TOKEN
// =====================================================

function createSessionToken(user) {

  const now =
    Date.now();


  const payload = {

    username:
      user.username,

    role:
      user.role,

    rtms:
      user.rtms,

    sessionVersion: Number(user.sessionVersion || 0),

    issuedAt:
      now,

    expiresAt:
      now +
      (
        SESSION_HOURS *
        60 *
        60 *
        1000
      )
  };


  const payloadText =
    JSON.stringify(
      payload
    );


  const payloadEncoded =
    base64UrlEncode(
      payloadText
    );


  const signature =
    signValue(
      payloadEncoded
    );


  return (
    payloadEncoded +
    '.' +
    signature
  );
}


// =====================================================
// VERIFY SESSION TOKEN
// =====================================================

function verifySessionToken(token) {

  if (!token) {
    return null;
  }


  const parts =
    String(token)
      .split('.');


  if (
    parts.length !== 2
  ) {
    return null;
  }


  const payloadEncoded =
    parts[0];

  const suppliedSignature =
    parts[1];


  const expectedSignature =
    signValue(
      payloadEncoded
    );


  if (
    suppliedSignature !==
    expectedSignature
  ) {
    return null;
  }


  try {

    const payload =
      JSON.parse(
        base64UrlDecode(
          payloadEncoded
        )
      );


    if (
      !payload.expiresAt ||
      Date.now() >
      Number(
        payload.expiresAt
      )
    ) {
      return null;
    }


    // -----------------------------------------
    // User still exists & active
    // -----------------------------------------

    const users =
      loadUsers();


    const user =
      users[
        payload.username
      ];


    if (
      !user ||
      !user.active
    ) {
      return null;
    }


    if (Number(payload.sessionVersion || 0) !== Number(user.sessionVersion || 0)) return null;

    return {
      username:
        user.username,

      role:
        user.role,

      rtms:
        user.rtms
    };


  } catch (err) {

    return null;
  }
}


// =====================================================
// SECURE DATA ENGINE
// =====================================================

function getSecureSheetData(
  sheetName,
  session,
  dateFrom,
  dateTo,
  context
) {

  if (
    !ALLOWED_DATA_SHEETS
      .includes(
        sheetName
      )
  ) {

    return {
      ok: false,
      error: 'Invalid sheet'
    };
  }

  if (sheetName === 'NewStores') {
    return getSecureNewStoresData(
      session,
      dateFrom,
      dateTo,
      context
    );
  }

  if (sheetName === 'RoutePlan') {
    return getSecureRoutePlanData(
      session,
      context
    );
  }


  const index =
    context && context.index ? context.index : loadCacheIndex();


  const sourceItems =
    Object
      .keys(index)
      .map(
        id =>
          index[id]
      )
      .sort(
        (a, b) =>
          String(
            a.sourceDate
          )
            .localeCompare(
              String(
                b.sourceDate
              )
            )
      );


  const records = [];
  const allColumns = new Set();
  const warnings = [];

  const seen =
    new Set();


  let rawRows = 0;
  let filteredByRTM = 0;
  let filteredByDate = 0;
  let duplicates = 0;


  sourceItems.forEach(item => {

    let spreadsheet;


    try {

      spreadsheet =
        (context ? (context.books[item.cacheFileId] || (context.books[item.cacheFileId] = SpreadsheetApp.openById(item.cacheFileId))) : SpreadsheetApp.openById(item.cacheFileId));

    } catch (err) {
      throw new Error("Cached workbook unavailable. Run syncGorillaData and retry.");
    }


    const sheet =
      spreadsheet.getSheetByName(
        sheetName
      );


    if (
      !sheet ||
      sheet.getLastRow() < 2
    ) {

      return;
    }


    const values =
      sheet
        .getDataRange()
        .getValues();


    const headers =
      makeUniqueApiHeaders(
        values[0]
      );


    headers.forEach(h=>allColumns.add(h));
    const repMap = context ? (context.maps[item.cacheFileId] || (context.maps[item.cacheFileId] = repRtmMap(spreadsheet))) : repRtmMap(spreadsheet);
    const rows = values.slice(1);


    rows.forEach(row => {

      if (
        isApiEmptyRow(
          row
        )
      ) {

        return;
      }


      rawRows++;


      const record = {};


      headers.forEach(
        (header, index) => {

          record[header] =
            serializeApiValue(
              row[index], header
            );
        }
      );


      record._sourceFile = item.sourceFileName;
      record._sourceDate = item.sourceDate;
      if (!record.RTM) record.RTM = repMap[normalizeApiText(record.Rep || record['New Repzo User'])] || '';

      // =========================================
      // DATE FILTER USING ROW DATE
      // =========================================

      const recordDate =
        getRecordDate(
          sheetName,
          record,
          item.sourceDate
        );


      if (
        dateFrom &&
        recordDate &&
        recordDate <
        dateFrom
      ) {

        filteredByDate++;
        return;
      }


      if (
        dateTo &&
        recordDate &&
        recordDate >
        dateTo
      ) {

        filteredByDate++;
        return;
      }


      // =========================================
      // RTM SECURITY
      // =========================================

      if (
        !isRtmAllowed(
          record['RTM'],
          session.rtms
        )
      ) {

        filteredByRTM++;
        return;
      }


      // =========================================
      // DEDUPE
      // =========================================

      const dedupeKey =
        buildApiDedupeKey(
          sheetName,
          record,
          item.sourceDate
        );


      if (
        seen.has(
          dedupeKey
        )
      ) {

        duplicates++;
        return;
      }


      seen.add(
        dedupeKey
      );


      records.push(
        record
      );
    });
  });


  return {

    ok: true,

    sheet:
      sheetName,

    user:
      session.username,

    role:
      session.role,

    allowedRTMs:
      session.rtms,

    from:
      dateFrom || null,

    to:
      dateTo || null,

    count:
      records.length,

    stats: {
      rawRows:
        rawRows,

      filteredByRTM:
        filteredByRTM,

      filteredByDate:
        filteredByDate,

      duplicatesRemoved:
        duplicates
    },

    columns: Array.from(allColumns),
    warnings: warnings,
    rows:
      records
  };
}


// =====================================================
// NEW STORES - HISTORICAL + CURRENT ROUND + DAILY FEED
// =====================================================

function getSecureNewStoresData(
  session,
  dateFrom,
  dateTo,
  context
) {

  const index =
    context && context.index ? context.index : loadCacheIndex();

  const sourceItems = Object
    .keys(index)
    .map(id => index[id])
    .sort((a, b) =>
      String(a.sourceDate || '')
        .localeCompare(String(b.sourceDate || ''))
    );

  const historical = [];
  const current = [];
  const warnings = [];
  const roundControl = getRoundControl();
  const routeRows = getLatestRoutePlanRows(context).rows;
  const routeByCode = new Map(routeRows.map(row => [normalizeClientCode(row['Client Code']), row]));
  let rawRows = 0;
  let missingCode = 0;
  let missingDate = 0;

  sourceItems.forEach(item => {
    let spreadsheet;

    try {
      spreadsheet = context
        ? (context.books[item.cacheFileId] ||
          (context.books[item.cacheFileId] = SpreadsheetApp.openById(item.cacheFileId)))
        : SpreadsheetApp.openById(item.cacheFileId);
    } catch (err) {
      warnings.push(item.sourceFileName + ': cached workbook unavailable');
      return;
    }

    const fileName = normalizeApiText(item.sourceFileName || '');
    const isHistory = fileName.indexOf(NEW_STORES_HISTORY_FILE) !== -1;
    const isSeed = fileName.indexOf(NEW_STORES_SEED_FILE) !== -1;

    let sheet = null;
    let source = '';

    if (isHistory) {
      sheet = spreadsheet.getSheetByName('Sheet 1');
      source = 'Historical Reference';
    } else if (isSeed) {
      sheet = spreadsheet.getSheetByName('Sheet 1');
      source = 'Current Round Seed';
    } else {
      sheet =
        spreadsheet.getSheetByName('New Add') ||
        spreadsheet.getSheetByName('NewAdd');
      source = 'Daily New Add';
    }

    if (!sheet || sheet.getLastRow() < 2) return;

    const values = sheet.getDataRange().getValues();
    const headers = makeUniqueApiHeaders(values[0]);

    values.slice(1).forEach(row => {
      if (isApiEmptyRow(row)) return;
      rawRows++;

      const original = {};
      headers.forEach((header, i) => {
        original[header] = serializeApiValue(row[i], header);
      });

      const clientCode = firstNewStoreValue(original, [
        'Client Code',
        'ClientCode',
        'Adhoc Serial',
        'AdhocSerial'
      ]);

      if (!clientCode) {
        missingCode++;
        return;
      }

      const rawCreated = firstNewStoreValue(original, [
        'Created At',
        'Created',
        'Date',
        'Added At',
        'Addition Date'
      ]);

      const created =
        normalizeApiDate(rawCreated) ||
        normalizeApiDate(item.sourceDate);
      const createdStamp = normalizeNewStoreStamp(rawCreated, created);
      const assignmentStamp = newStoreRoundAssignmentStamp(
        rawCreated,
        createdStamp,
        item,
        roundControl,
        isHistory || isSeed
      );

      if (!created) {
        missingDate++;
        return;
      }

      // The historical reference is authoritative through 10-Sep-2026.
      // Old daily files can never become current New just because they are re-synced.
      if (!isHistory && created < NEW_STORES_CURRENT_ROUND_START) return;

      const routeRecord = routeByCode.get(normalizeClientCode(clientCode));
      const round = isHistory ? null : roundForStamp(assignmentStamp, roundControl);
      const isCurrentRound = Boolean(round && round.current);
      const routeSource = routeRecord && routeRecord.Source === 'Add From Salim' ? 'Add From Salim' : '';
      const currentStatus =
        (routeRecord && routeRecord['Current Status']) ||
        (isHistory ? 'Historical' : 'Pending New');

      const record = {
        'Created': created,
        'Client': firstNewStoreValue(original, [
          'Client',
          'Name',
          'Client Name',
          'Client Local Name'
        ]),
        'Client Code': String(clientCode).trim(),
        'TDM': normalizeNewStoreTdm(firstNewStoreValue(original, [
          'TDM',
          'Creator',
          'Rep',
          'New Repzo User'
        ])),
        'RTM': firstNewStoreValue(original, ['RTM']),
        'Latitude': firstNewStoreValue(original, ['Latitude', 'Lat']),
        'Longitude': firstNewStoreValue(original, ['Longitude', 'Lng', 'Long']),
        'نوع المحل': firstNewStoreValue(original, ['نوع المحل','Outlet Type']),
        'تصنيف المحل': firstNewStoreValue(original, ['تصنيف المحل','Store Class']),
        'محل قوى': firstNewStoreValue(original, ['محل قوى']),
        'Source': routeSource || (isHistory ? source : 'New TDM'),
        'Ingestion Source': source,
        'Round': isHistory ? 'Historical' : (round ? round.name : 'Unassigned'),
        'Round Start': isHistory ? '' : (round ? round.start : ''),
        'Round End': isHistory ? '' : (round ? round.end || '' : ''),
        'Is Current Round': isCurrentRound ? 'Yes' : 'No',
        'Created Timestamp': createdStamp,
        'Round Assignment Timestamp': assignmentStamp,
        'Current Status': currentStatus,
        '_sourceFile': item.sourceFileName,
        '_sourceDate': item.sourceDate
      };

      if (isHistory) historical.push(record);
      else current.push(record);
    });
  });

  const historyByCode = new Map();
  historical
    .sort(compareNewStoreRecords)
    .forEach(record => {
      const key = normalizeClientCode(record['Client Code']);
      if (!historyByCode.has(key)) historyByCode.set(key, record);
    });

  const currentByCode = new Map();
  let excludedHistoricalMatches = 0;
  let duplicateCurrentRows = 0;

  current
    .sort(compareNewStoreRecords)
    .forEach(record => {
      const key = normalizeClientCode(record['Client Code']);

      if (historyByCode.has(key)) {
        excludedHistoricalMatches++;
        return;
      }

      if (currentByCode.has(key)) {
        duplicateCurrentRows++;
        return;
      }

      currentByCode.set(key, record);
    });

  let records = [
    ...Array.from(historyByCode.values()),
    ...Array.from(currentByCode.values())
  ];

  let filteredByDate = 0;
  let filteredByRTM = 0;

  records = records.filter(record => {
    const created = record['Created'];

    if (dateFrom && created && created < dateFrom) {
      filteredByDate++;
      return false;
    }

    if (dateTo && created && created > dateTo) {
      filteredByDate++;
      return false;
    }

    if (!isRtmAllowed(record['RTM'], session.rtms)) {
      filteredByRTM++;
      return false;
    }

    return true;
  });

  records.sort(compareNewStoreRecords);

  const preferredColumns = [
    'Created',
    'Client',
    'Client Code',
    'TDM',
    'RTM',
    'Latitude',
    'Longitude',
    'نوع المحل',
    'تصنيف المحل',
    'Source',
    'Ingestion Source',
    'Round',
    'Round Start',
    'Round End',
    'Is Current Round',
    'Created Timestamp',
    'Round Assignment Timestamp',
    'Current Status',
    '_sourceFile',
    '_sourceDate'
  ];

  const allColumns = new Set(preferredColumns);
  records.forEach(record => Object.keys(record).forEach(key => allColumns.add(key)));

  if (missingCode) warnings.push('New Stores: ' + missingCode + ' row(s) skipped because Client Code is missing.');
  if (missingDate) warnings.push('New Stores: ' + missingDate + ' row(s) skipped because Created date is missing.');

  return {
    ok: true,
    sheet: 'NewStores',
    user: session.username,
    role: session.role,
    allowedRTMs: session.rtms,
    from: dateFrom || null,
    to: dateTo || null,
    count: records.length,
    stats: {
      rawRows: rawRows,
      historicalUnique: historyByCode.size,
      currentRoundUnique: Array.from(currentByCode.values()).filter(r => r['Is Current Round'] === 'Yes' && r.Source === 'New TDM').length,
      excludedHistoricalMatches: excludedHistoricalMatches,
      duplicateCurrentRows: duplicateCurrentRows,
      missingCode: missingCode,
      missingDate: missingDate,
      filteredByRTM: filteredByRTM,
      filteredByDate: filteredByDate
    },
    columns: Array.from(allColumns),
    warnings: warnings,
    rows: records
  };
}


function firstNewStoreValue(record, names) {
  for (let i = 0; i < names.length; i++) {
    const value = record[names[i]];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }
  return '';
}


function normalizeNewStoreTdm(value) {
  const text = String(value == null ? '' : value).trim();
  if (!text || text === '0') return '';
  const match = text.match(/^tdm0*(\d+)$/i);
  return match ? 'TDM' + String(Number(match[1])) : text;
}


function normalizeClientCode(value) {
  const text = String(value == null ? '' : value).trim().toLowerCase();
  const numeric = text.match(/^_?0*(\d+)$/);
  return numeric ? String(Number(numeric[1])) : text.replace(/^_/, '');
}


function normalizeNewStoreStamp(value, fallbackDate) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, 'Africa/Cairo', 'yyyy-MM-dd HH:mm:ss');
  }
  const text = String(value == null ? '' : value).trim();
  const iso = text.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{1,2}:\d{2}(?::\d{2})?))?/);
  if (iso) return iso[1] + ' ' + (iso[2] ? iso[2].padStart(8, '0') : '00:00:00');
  const dmy = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?/);
  if (dmy) return dmy[3] + '-' + String(dmy[2]).padStart(2,'0') + '-' + String(dmy[1]).padStart(2,'0') + ' ' + (dmy[4] || '00:00:00');
  return String(fallbackDate || '') + ' 00:00:00';
}


function newStoreRoundAssignmentStamp(value, createdStamp, item, control, fixedSeed) {
  if (fixedSeed) return createdStamp;
  const text = String(value == null ? '' : value).trim();
  const timeMatch = text.match(/(?:T|\s)(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  const hasTime = Boolean(timeMatch && (Number(timeMatch[1]) || Number(timeMatch[2]) || Number(timeMatch[3] || 0)));
  if (hasTime) return createdStamp;

  const date = String(createdStamp || '').slice(0, 10);
  const boundaries = (Array.isArray(control.history) ? control.history : [])
    .map(round => String(round.end || ''))
    .filter(Boolean);
  const sameDayBoundary = boundaries.some(end => end.slice(0, 10) === date);
  if (!sameDayBoundary) return createdStamp;

  const observed = item.cachedAt || item.modified || '';
  if (!observed) return createdStamp;
  const observedDate = new Date(observed);
  if (!Number.isFinite(observedDate.getTime())) return createdStamp;
  return Utilities.formatDate(observedDate, 'Africa/Cairo', 'yyyy-MM-dd HH:mm:ss');
}


function roundForStamp(stamp, control) {
  const value = String(stamp || '');
  const history = Array.isArray(control.history) ? control.history : [];
  for (let i = 0; i < history.length; i++) {
    const round = history[i];
    if (value >= String(round.start || '') && value < String(round.end || '')) {
      return Object.assign({}, round, {current:false});
    }
  }
  const current = control.current || {};
  if (current.start && value >= String(current.start)) return Object.assign({}, current, {current:true});
  return null;
}


function compareNewStoreRecords(a, b) {
  const dateCompare = String(a['Created'] || '').localeCompare(String(b['Created'] || ''));
  if (dateCompare) return dateCompare;

  const priority = {
    'Historical Reference': 0,
    'Current Round Seed': 1,
    'Daily New Add': 2
  };

  const sourceCompare =
    Number(priority[a.Source] == null ? 9 : priority[a.Source]) -
    Number(priority[b.Source] == null ? 9 : priority[b.Source]);

  if (sourceCompare) return sourceCompare;

  return String(a['Client Code'] || '').localeCompare(String(b['Client Code'] || ''));
}


function routeStatusFromRecord(record) {
  // Ahmed Salim Comment is the final/current route decision in the Route Plan.
  // Use it first so an older Shaban comment cannot override a later final status.
  const finalCommentKey = Object.keys(record).find(key => normalizeApiText(key) === 'ahmed salim comment');
  const finalComment = finalCommentKey ? String(record[finalCommentKey] || '').trim() : '';
  const comments = finalComment ? [finalComment] : Object.keys(record)
    .filter(key => /comment/i.test(key) || /status/i.test(key))
    .map(key => String(record[key] || '').trim())
    .filter(Boolean);
  const text = normalizeApiText(comments.join(' | '));

  if (/suspend|bucket/.test(text)) return 'Bucket';
  if (/remove|stop user|remove area/.test(text)) return 'Removed';
  if (/final active|active|new add tdm|new adhoc/.test(text)) return 'Active';
  return '';
}


function routeSourceFromRecord(record) {
  const values = Object.values(record).map(v => normalizeApiText(v));
  return values.some(v => v.indexOf('add from salim') !== -1)
    ? 'Add From Salim'
    : '';
}


function isRouteScheduleHeaders(normalizedHeaders) {
  const routeDays = new Set(normalizedHeaders
    .map(h => h.match(/^(saturday|sunday|monday|tuesday|wednesday|thursday|friday) \d+$/))
    .filter(Boolean)
    .map(match => match[1]));
  return normalizedHeaders.includes('adhoc serial') &&
    normalizedHeaders.includes('rtm') &&
    normalizedHeaders.includes('new repzo user') &&
    routeDays.size === 7;
}


function getLatestRoutePlanRows(context) {
  const routeOnlyIndex = context && context.routeOnlyOverride ? null : routePlanCacheOnlyIndex_();
  const index = routeOnlyIndex || (context && context.index ? context.index : loadCacheIndex());
  const sourceItems = Object.keys(index)
    .map(id => Object.assign({_sourceId:id}, index[id]))
    .sort((a, b) => String(b.modified || b.cachedAt || '').localeCompare(String(a.modified || a.cachedAt || '')));

  // Once the Owner has approved route-plan versions, only approved versions
  // are eligible. A selected approved version takes precedence over recency.
  const approvals = getRoutePlanApprovalMap_();
  const approvedIds = Object.keys(approvals).filter(id => approvals[id] && approvals[id].status === 'approved' && approvals[id].active !== false);
  const selectedId = PropertiesService.getScriptProperties().getProperty('GORILLA_ROUTE_PLAN_SELECTED_SOURCE_ID') || '';
  if (approvedIds.length) {
    const eligible = sourceItems.filter(item => approvedIds.includes(item._sourceId));
    eligible.sort((a,b) => (a._sourceId === selectedId ? -1 : b._sourceId === selectedId ? 1 : String(b.modified || b.cachedAt || '').localeCompare(String(a.modified || a.cachedAt || ''))));
    sourceItems.splice(0, sourceItems.length, ...eligible);
  } else if (selectedId) {
    sourceItems.sort((a,b) => (a._sourceId === selectedId ? -1 : b._sourceId === selectedId ? 1 : 0));
  }

  for (let itemIndex = 0; itemIndex < sourceItems.length; itemIndex++) {
    const item = sourceItems[itemIndex];
    let spreadsheet;
    try {
      spreadsheet = context
        ? (context.books[item.cacheFileId] || (context.books[item.cacheFileId] = SpreadsheetApp.openById(item.cacheFileId)))
        : SpreadsheetApp.openById(item.cacheFileId);
    } catch (err) {
      continue;
    }

    const sheets = spreadsheet.getSheets();
    for (let s = 0; s < sheets.length; s++) {
      const sheet = sheets[s];
      if (sheet.getLastRow() < 2 || sheet.getLastColumn() < 2) continue;
      const rawHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const headers = makeUniqueApiHeaders(rawHeaders);
      const normalizedHeaders = headers.map(normalizeApiText);
      const hasAdhocSerial = normalizedHeaders.includes('adhoc serial');
      const hasCode = hasAdhocSerial || normalizedHeaders.includes('client code');
      const hasNamedRouteComment = normalizedHeaders.some(h => h === 'shaban comment gorilla' || h === 'ahmed salim comment');
      const hasRouteSchedule = isRouteScheduleHeaders(normalizedHeaders);
      const hasRouteSignal = hasNamedRouteComment || (hasAdhocSerial && normalizedHeaders.some(h => h.indexOf('comment') !== -1)) || hasRouteSchedule;
      if (!hasCode || !hasRouteSignal) continue;

      const values = sheet.getDataRange().getValues();
      const rows = [];
      values.slice(1).forEach(row => {
        if (isApiEmptyRow(row)) return;
        const original = {};
        headers.forEach((header, i) => {
          original[header] = serializeApiValue(row[i], header);
        });
        const code = firstNewStoreValue(original, ['Adhoc Serial','Client Code','AdhocSerial','ClientCode']);
        if (!code) return;
        const status = routeStatusFromRecord(original);
        const routeComments = Object.keys(original)
          .filter(key => /comment/i.test(key))
          .map(key => String(original[key] || '').trim())
          .filter(Boolean)
          .join(' | ');
        // Preserve every source column (especially the weekday route schedule)
        // and add the canonical fields consumed by the dashboard alongside it.
        rows.push(Object.assign({}, original, {
          'Client Code': String(code).trim(),
          'Client': firstNewStoreValue(original, ['Branch Name','Outlet Name Conc','Client','Name','Client Local Name']),
          'TDM': normalizeNewStoreTdm(firstNewStoreValue(original, ['New Repzo User','TDM','Rep'])),
          'RTM': firstNewStoreValue(original, ['RTM']),
          'Latitude': firstNewStoreValue(original, ['Latitude','Lat']),
          'Longitude': firstNewStoreValue(original, ['Longitude','Lng','Long']),
          'Current Status': status || 'Active',
          'Source': routeSourceFromRecord(original) || 'Route Plan',
          'Route Comment': routeComments,
          '_sourceFile': item.sourceFileName,
          '_sourceDate': item.sourceDate,
          '_sourceModified': item.modified || item.cachedAt || '',
          '_sourceFileId': item._sourceId
        }));
      });

      return {
        rows: rows,
        sourceFile: item.sourceFileName,
        sourceDate: item.sourceDate,
        sourceModified: item.modified || item.cachedAt || '',
        sheetName: sheet.getName(),
        sourceColumns: headers
      };
    }
  }

  return {rows: [], sourceFile: '', sourceDate: '', sourceModified: '', sheetName: '', sourceColumns: []};
}


function getSecureRoutePlanData(session, context) {
  const result = getLatestRoutePlanRows(context);
  const rows = result.rows.filter(row => isRtmAllowed(row.RTM, session.rtms));
  const columns = Array.from(new Set([
    'Client Code','Client','TDM','RTM','Latitude','Longitude','Current Status','Source','_sourceFile','_sourceDate',
    ...rows.flatMap(Object.keys)
  ]));
  return {
    ok: true,
    sheet: 'RoutePlan',
    user: session.username,
    role: session.role,
    allowedRTMs: session.rtms,
    count: rows.length,
    sourceFile: result.sourceFile || null,
    sourceDate: result.sourceDate || null,
    sourceModified: result.sourceModified || null,
    sourceSheet: result.sheetName || null,
    sourceColumns: result.sourceColumns || [],
    columns: columns,
    warnings: result.rows.length ? [] : ['Route Plan: no matching route-plan sheet was found.'],
    rows: rows
  };
}


// =====================================================
// RTM SECURITY
// =====================================================

function isRtmAllowed(
  rowRTM,
  allowedRTMs
) {

  if (
    allowedRTMs.includes('*')
  ) {
    return true;
  }


  const current =
    normalizeApiText(
      rowRTM
    );


  return allowedRTMs.some(
    allowed =>

      normalizeApiText(
        allowed
      ) ===
      current
  );
}


// =====================================================
// RECORD DATE
// =====================================================

function getRecordDate(
  sheetName,
  record,
  sourceDate
) {

  if (
    sheetName ===
    'Missing'
  ) {

    return sourceDate;
  }


  return normalizeApiDate(
    record['Date']
  ) || sourceDate;
}


// =====================================================
// DEDUPE KEYS
// =====================================================

function buildApiDedupeKey(
  sheetName,
  row,
  sourceDate
) {

  if (
    sheetName ===
    'All'
  ) {

    return [
      normalizeApiDate(
        row['Date']
      ),

      normalizeApiText(
        row['Client Code']
      ),

      normalizeApiText(
        row['Started At']
      ),

      normalizeApiText(
        row['Rep']
      )

    ].join('|');
  }


  if (
    sheetName ===
    'NewAdd'
  ) {

    return [
      normalizeApiDate(
        row['Date']
      ),

      normalizeApiText(
        row['Client Code']
      ),

      normalizeApiText(
        row['Started At']
      ),

      normalizeApiText(
        row['Rep']
      )

    ].join('|');
  }


  if (
    sheetName ===
    'Missing'
  ) {

    return [
      sourceDate,

      normalizeApiText(
        row['Adhoc Serial']
      ),

      normalizeApiText(
        row['New Repzo User']
      ),

      normalizeApiText(
        row['RTM']
      )

    ].join('|');
  }


  if (
    sheetName ===
    'Start-End'
  ) {

    return [
      normalizeApiDate(
        row['Date']
      ),

      normalizeApiText(
        row['Rep']
      ),

      normalizeApiText(
        row['Started At']
      ),

      normalizeApiText(
        row['Ended At']
      )

    ].join('|');
  }


  return JSON.stringify(
    row
  );
}


// =====================================================
// UNIQUE HEADERS
// مهم بسبب Facing Count المكرر
// =====================================================

function makeUniqueApiHeaders(
  headers
) {

  const counter = {};


  return headers.map(
    header => {

      let name =
        String(
          header || ''
        )
          .trim();


      if (!name) {
        name = 'Unnamed';
      }


      if (
        !counter[name]
      ) {

        counter[name] = 1;

        return name;
      }


      counter[name]++;


      return (
        name +
        ' [' +
        counter[name] +
        ']'
      );
    }
  );
}


// =====================================================
// API DATE NORMALIZATION
// =====================================================

function normalizeApiDate(
  value
) {

  if (!value) {
    return '';
  }


  const text =
    String(value)
      .trim();


  // already yyyy-mm-dd

  if (
    /^\d{4}-\d{2}-\d{2}(?:[ T]|$)/
      .test(text)
  ) {

    return text.slice(0,10);
  }


  const match =
    text.match(
      /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/
    );


  if (match) {

    return (
      match[3] +
      '-' +
      String(
        match[2]
      ).padStart(
        2,
        '0'
      ) +
      '-' +
      String(
        match[1]
      ).padStart(
        2,
        '0'
      )
    );
  }


  return text;
}


// =====================================================
// SERIALIZE VALUES FOR JSON
// =====================================================

function serializeApiValue(value, header) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, 'Africa/Cairo', header === 'Date' ? 'yyyy-MM-dd' : header === 'Total Duration' ? 'HH:mm:ss' : 'yyyy-MM-dd HH:mm:ss');
  }
  if (header === 'Total Duration' && typeof value === 'number' && value >= 0) {
    const seconds = Math.round(value * 86400);
    return [Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(x=>String(x).padStart(2,'0')).join(':');
  }
  return value == null ? '' : value;
}

function isApiEmptyRow(
  row
) {

  return row.every(
    value =>

      value === '' ||
      value === null
  );
}


// =====================================================
// NORMALIZE TEXT
// =====================================================

function normalizeApiText(
  value
) {

  return String(
    value === null ||
    value === undefined
      ? ''
      : value
  )
    .trim()
    .toLowerCase();
}


// =====================================================
// USERS STORAGE
// =====================================================

function loadUsers() {

  const raw =
    PropertiesService
      .getScriptProperties()
      .getProperty(
        USERS_PROPERTY
      );


  if (!raw) {

    return {};
  }


  return JSON.parse(
    raw
  );
}


function saveUsers(
  users
) {

  PropertiesService
    .getScriptProperties()
    .setProperty(
      USERS_PROPERTY,
      JSON.stringify(
        users
      )
    );
}


// =====================================================
// PASSWORD HASH
// =====================================================

function hashPassword(
  password,
  salt
) {

  const secret =
    getApiSecret();


  const signature =
    Utilities.computeHmacSha256Signature(
      salt +
      '|' +
      password,
      secret
    );


  return Utilities.base64EncodeWebSafe(
    signature
  );
}


// =====================================================
// TOKEN SIGNATURE
// =====================================================

function signValue(
  value
) {

  const signature =
    Utilities.computeHmacSha256Signature(
      value,
      getApiSecret()
    );


  return Utilities
    .base64EncodeWebSafe(
      signature
    )
    .replace(
      /=+$/g,
      ''
    );
}


// =====================================================
// API SECRET
// =====================================================

function getApiSecret() {

  const props =
    PropertiesService
      .getScriptProperties();


  let secret =
    props.getProperty(
      API_SECRET_PROPERTY
    );


  if (!secret) {

    secret =
      Utilities.getUuid() +
      Utilities.getUuid() +
      Utilities.getUuid();


    props.setProperty(
      API_SECRET_PROPERTY,
      secret
    );
  }


  return secret;
}


// =====================================================
// BASE64 URL
// =====================================================

function base64UrlEncode(
  text
) {

  return Utilities
    .base64EncodeWebSafe(
      text,
      Utilities.Charset.UTF_8
    )
    .replace(
      /=+$/g,
      ''
    );
}


function base64UrlDecode(
  encoded
) {

  let value =
    encoded
      .replace(
        /-/g,
        '+'
      )
      .replace(
        /_/g,
        '/'
      );


  while (
    value.length % 4
  ) {

    value += '=';
  }


  const bytes =
    Utilities.base64Decode(
      value
    );


  return Utilities.newBlob(
    bytes
  )
    .getDataAsString(
      'UTF-8'
    );
}


// =====================================================
// RANDOM STRONG PASSWORD
// =====================================================

function generateStrongPassword() {

  const raw =
    Utilities
      .getUuid()
      .replace(
        /-/g,
        ''
      );


  return (
    'G!' +
    raw.substring(
      0,
      6
    ) +
    '@' +
    raw.substring(
      6,
      12
    ) +
    '#' +
    raw.substring(
      12,
      18
    )
  );
}


// =====================================================
// REQUEST PARAMETER
// =====================================================

function getRequestValue(e, key) {

  // أولاً: جرّب قراءة البيانات العادية من URL/Form
  if (
    e &&
    e.parameter &&
    e.parameter[key] !== undefined
  ) {
    return String(e.parameter[key]);
  }

  // ثانياً: جرّب قراءة JSON المرسل في POST
  if (
    e &&
    e.postData &&
    e.postData.contents
  ) {
    try {

      const body =
        JSON.parse(e.postData.contents);

      if (
        body &&
        body[key] !== undefined
      ) {
        return String(body[key]);
      }

    } catch (err) {
      // لو المحتوى مش JSON نكمل عادي
    }
  }

  return '';
}


// =====================================================
// JSON RESPONSE
// =====================================================

function jsonResponse(
  data
) {

  return ContentService
    .createTextOutput(
      JSON.stringify(
        data
      )
    )
    .setMimeType(
      ContentService.MimeType.JSON
    );
}
function getRTMFromRep(
  spreadsheet,
  repName
) {

  if (!repName) {
    return '';
  }

  const summarySheet =
    spreadsheet.getSheetByName(
      'TDM Summary'
    );

  if (
    !summarySheet ||
    summarySheet.getLastRow() < 2
  ) {
    return '';
  }

  const values =
    summarySheet
      .getDataRange()
      .getValues();

  const headers =
    values[0]
      .map(
        x =>
          String(x || '')
            .trim()
      );

  const repIndex =
    headers.indexOf('TDM');

  const rtmIndex =
    headers.indexOf('RTM');

  if (
    repIndex === -1 ||
    rtmIndex === -1
  ) {
    return '';
  }

  const targetRep =
    normalizeApiText(
      repName
    );

  for (
    let i = 1;
    i < values.length;
    i++
  ) {

    const currentRep =
      normalizeApiText(
        values[i][repIndex]
      );

    if (
      currentRep === targetRep
    ) {

      return String(
        values[i][rtmIndex] || ''
      ).trim();
    }
  }

  return '';
}
// Add alongside Code.gs. Existing accounts and secrets stay in Script Properties.
const WEB_PAGES = ['dashboard','presence','execution','market','insights','performance','newstores','geo','stores','photos','all','reports'];
const WEB_SETTINGS = 'GORILLA_WEB_SETTINGS';
const ROUND_CONTROL_PROPERTY = 'GORILLA_ROUND_CONTROL';
const USER_PHOTO_PREFIX = 'GORILLA_USER_PHOTO_';
function userPhotoKey(username){return USER_PHOTO_PREFIX+Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(username||'').trim().toLowerCase()));}
function readUserPhoto(username){try{return String(PropertiesService.getScriptProperties().getProperty(userPhotoKey(username))||'')}catch(err){return ''}}
function publicUser(user) {
  const pages=Array.from(new Set([...(user.pages||WEB_PAGES),...(user.role==='owner'?WEB_PAGES:[])]));
  if(!pages.includes('newstores'))pages.push('newstores');
  if(!pages.includes('insights')&&pages.includes('execution'))pages.push('insights');
  return {username:user.username,displayName:user.displayName||user.username,role:user.role,active:user.active,
    rtms:user.rtms||[],allRtms:(user.rtms||[]).includes('*'),
    pages:pages.filter(p=>WEB_PAGES.includes(p)),actions:user.actions||['view','export','print'],photo:readUserPhoto(user.username)};
}
function getRoundControl(){
  const props=PropertiesService.getScriptProperties();
  let control={};
  try{control=JSON.parse(props.getProperty(ROUND_CONTROL_PROPERTY)||'{}')}catch(err){control={}}
  if(!control.current){let settings={};try{settings=JSON.parse(props.getProperty(WEB_SETTINGS)||'{}')}catch(err){settings={}};control=settings.roundControl||control;}
  const current=control.current||{name:'Round 11 Sep 2026',start:'2026-09-11 00:00:00'};
  const start=String(current.start||'2026-09-11 00:00:00');
  const closedCycles=Array.isArray(current.cycles)?current.cycles.map(c=>({
    number:Number(c.number||1)===2?2:1,
    start:String(c.start||start),
    end:String(c.end||''),
    closed:true
  })).filter(c=>c.end):[];
  let cycle=current.cycle||null;
  if(!cycle){
    const hasTwo=closedCycles.some(c=>c.number===2);
    const hasOne=closedCycles.some(c=>c.number===1);
    cycle=hasTwo
      ? {number:2,start:closedCycles.find(c=>c.number===2).start,end:closedCycles.find(c=>c.number===2).end,closed:true}
      : hasOne
        ? {number:2,start:closedCycles.find(c=>c.number===1).end,closed:false}
        : {number:1,start:start,closed:false};
  }
  cycle={
    number:Number(cycle.number||1)===2?2:1,
    start:String(cycle.start||start),
    end:String(cycle.end||''),
    closed:Boolean(cycle.closed)
  };
  const history=Array.isArray(control.history)?control.history.map(r=>({
    name:String(r.name||'Round'),
    start:String(r.start||''),
    end:String(r.end||''),
    cycles:Array.isArray(r.cycles)?r.cycles:[]
  })):[];
  return {current:{name:String(current.name||'Current Round'),start:start,cycle:cycle,cycles:closedCycles},history:history};
}
function readWebSettings(){
  const props=PropertiesService.getScriptProperties().getProperties();
  let settings={};try{settings=JSON.parse(props[WEB_SETTINGS]||'{}')}catch(err){settings={}}
  settings.periodCatalog=cleanPeriodCatalog_(settings.periodCatalog||{});
  settings.roundControl=getRoundControl();
  if(settings.hero&&Array.isArray(settings.hero.slides))settings.hero.slides=settings.hero.slides.map(slide=>Object.assign({},slide,{page:slide.page==='availability'||slide.page==='presencetrends'?'presence':['health','optional'].includes(slide.page)?'reports':slide.page}));
  settings.tdmPhotos={};
  Object.keys(props).filter(k=>k.indexOf('GORILLA_TDM_PHOTO_')===0).forEach(k=>{try{const photo=JSON.parse(props[k]);settings.tdmPhotos[photo.rep]=photo.image;}catch(err){}});
  return settings;
}
function cleanPeriodCatalog_(input){
  const source=input&&typeof input==='object'?input:{},periods=Array.isArray(source.periods)?source.periods:[];
  if(periods.length>30)throw new Error('Add no more than 30 periods');
  const validDate=value=>{
    const stamp=String(value||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(stamp))return false;
    const parts=stamp.split('-').map(Number),date=new Date(Date.UTC(parts[0],parts[1]-1,parts[2]));
    return date.toISOString().slice(0,10)===stamp;
  };
  const cleanRange=(item,label)=>{
    const name=String(item.name||'').trim().slice(0,80),start=String(item.start||'').trim(),end=String(item.end||'').trim();
    if(!name)throw new Error(label+' name is required');
    if(!validDate(start)||!validDate(end)||end<start)throw new Error(label+' needs valid start and end dates');
    return {name:name,start:start,end:end,enabled:item.enabled!==false};
  };
  let cycleCount=0,weekCount=0;
  return {periods:periods.map(period=>{
    const p=cleanRange(period,'Period'),cycles=Array.isArray(period.cycles)?period.cycles:[];
    cycleCount+=cycles.length;if(cycleCount>180)throw new Error('Add no more than 180 cycles');
    p.cycles=cycles.map(cycle=>{
      const c=cleanRange(cycle,'Cycle'),weeks=Array.isArray(cycle.weeks)?cycle.weeks:[];
      if(c.start<p.start||c.end>p.end)throw new Error('Cycle dates must stay inside their period');
      weekCount+=weeks.length;if(weekCount>500)throw new Error('Add no more than 500 weeks');
      c.weeks=weeks.map(week=>{
        const w=cleanRange(week,'Week');
        if(w.start<c.start||w.end>c.end)throw new Error('Week dates must stay inside their cycle');
        return w;
      });
      return c;
    });
    return p;
  })};
}
function readBody(e){try{return JSON.parse(e.postData.contents)}catch(err){return e.parameter||{};}}
function requireOwner(session){if(session.role!=='owner')throw new Error('Owner only');}
function webAction(action,body,session){
  const user=loadUsers()[session.username];
  const governanceResult=governanceAction_(action,body,session);
  if(governanceResult)return governanceResult;
  if(action==='bootstrap')return webBootstrap(session,body.format==='columns');
  if(action==='sync'){const result=syncGorillaData(true);return {ok:true,sync:syncStatus(),busy:Boolean(result&&result.busy)};}
  if(action==='status')return {ok:true,sync:syncStatus()};
  if(action==='me')return {ok:true,user:publicUser(user)};
  if(action==='settings')return {ok:true,settings:readWebSettings()};
  if(action==='saveRoundControl'){
    requireOwner(session);
    return withWebLock(function(){
      const control=getRoundControl();
      const name=String(body.name||control.current.name||'Current Round').trim().slice(0,80);
      const start=String(body.start||'').trim();
      if(!name)throw new Error('Round name is required');
      if(!/^\d{4}-\d{2}-\d{2}$/.test(start))throw new Error('Use a valid round start date');
      const oldStart=String(control.current.start||'');
      const newStart=start+' 00:00:00';
      const cycles=Array.isArray(control.current.cycles)?control.current.cycles.slice():[];
      const cycle=Object.assign({},control.current.cycle||{number:1,start:newStart,closed:false});
      if(!cycles.length&&Number(cycle.number||1)===1&&!cycle.closed&&String(cycle.start||'')===oldStart)cycle.start=newStart;
      control.current={name:name,start:newStart,cycle:cycle,cycles:cycles};
      PropertiesService.getScriptProperties().setProperty(ROUND_CONTROL_PROPERTY,JSON.stringify(control));
      PropertiesService.getScriptProperties().deleteProperty('GORILLA_PREPARED_V2');
      return {ok:true,settings:readWebSettings()};
    });
  }
  if(action==='saveCycleControl'){
    requireOwner(session);
    return withWebLock(function(){
      const control=getRoundControl();
      const current=control.current;
      const roundStart=String(current.start||'');
      const c1Start=String(body.cycle1Start||roundStart).trim();
      const c1End=String(body.cycle1End||'').trim();
      const c2Start=String(body.cycle2Start||c1End||'').trim();
      const c2End=String(body.cycle2End||'').trim();
      const validStamp=value=>/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value);
      if(!validStamp(c1Start))throw new Error('Cycle 1 start is required');
      if(c1Start<roundStart)throw new Error('Cycle 1 cannot start before the round');
      if(c1End&&!validStamp(c1End))throw new Error('Invalid Cycle 1 end');
      if(c1End&&c1End<=c1Start)throw new Error('Cycle 1 end must be after its start');
      if(c2Start&&!validStamp(c2Start))throw new Error('Invalid Cycle 2 start');
      if(c2Start&&c1End&&c2Start<c1End)throw new Error('Cycle 2 cannot start before Cycle 1 ends');
      if(c2End&&!validStamp(c2End))throw new Error('Invalid Cycle 2 end');
      if(c2End&&!c2Start)throw new Error('Cycle 2 start is required when Cycle 2 end is set');
      if(c2End&&c2End<=c2Start)throw new Error('Cycle 2 end must be after its start');

      const cycles=[];
      if(c1End)cycles.push({number:1,start:c1Start,end:c1End,closed:true});
      let cycle;
      if(c2Start){
        if(c2End){
          cycles.push({number:2,start:c2Start,end:c2End,closed:true});
          cycle={number:2,start:c2Start,end:c2End,closed:true};
        }else{
          cycle={number:2,start:c2Start,end:'',closed:false};
        }
      }else{
        cycle={number:1,start:c1Start,end:'',closed:false};
      }
      current.cycles=cycles;
      current.cycle=cycle;
      PropertiesService.getScriptProperties().setProperty(ROUND_CONTROL_PROPERTY,JSON.stringify(control));
      PropertiesService.getScriptProperties().deleteProperty('GORILLA_PREPARED_V2');
      return {ok:true,settings:readWebSettings()};
    });
  }
  if(action==='closeCycle'){
    requireOwner(session);
    return withWebLock(function(){
      const control=getRoundControl();
      const closeAt=Utilities.formatDate(new Date(),'Africa/Cairo','yyyy-MM-dd HH:mm:ss');
      const current=control.current;
      const cycle=Object.assign({},current.cycle||{number:1,start:current.start,closed:false});
      if(cycle.closed)throw new Error('Current cycle is already closed');
      if(closeAt<=String(cycle.start||current.start||''))throw new Error('Cycle end must be after cycle start');
      const closed={number:Number(cycle.number||1)===2?2:1,start:String(cycle.start||current.start||''),end:closeAt,closed:true};
      const cycles=(Array.isArray(current.cycles)?current.cycles.slice():[]).filter(c=>Number(c.number)!==closed.number);
      cycles.push(closed);
      cycles.sort((a,b)=>Number(a.number)-Number(b.number));
      current.cycles=cycles;
      current.cycle=closed.number===1
        ? {number:2,start:closeAt,end:'',closed:false}
        : {number:2,start:closed.start,end:closeAt,closed:true};
      PropertiesService.getScriptProperties().setProperty(ROUND_CONTROL_PROPERTY,JSON.stringify(control));
      PropertiesService.getScriptProperties().deleteProperty('GORILLA_PREPARED_V2');
      return {ok:true,settings:readWebSettings(),closed:closed};
    });
  }
  if(action==='closeRound'){
    requireOwner(session);
    return withWebLock(function(){
      const control=getRoundControl();
      const closeAt=Utilities.formatDate(new Date(),'Africa/Cairo','yyyy-MM-dd HH:mm:ss');
      const current=control.current||{name:'Current Round',start:'2026-09-11 00:00:00'};
      if(closeAt<=String(current.start||''))throw new Error('Round end must be after round start');
      const cycles=Array.isArray(current.cycles)?current.cycles.slice():[];
      const activeCycle=current.cycle||null;
      if(activeCycle&&!activeCycle.closed&&closeAt>String(activeCycle.start||current.start||'')){
        cycles.push({number:Number(activeCycle.number||1)===2?2:1,start:String(activeCycle.start||current.start||''),end:closeAt,closed:true});
      }
      const history=Array.isArray(control.history)?control.history.slice():[];
      history.push({name:String(current.name||'Current Round'),start:String(current.start||''),end:closeAt,cycles:cycles.sort((a,b)=>Number(a.number)-Number(b.number))});
      const nextName=String(body.nextName||('Round '+Utilities.formatDate(new Date(),'Africa/Cairo','dd MMM yyyy'))).trim().slice(0,80);
      const nextControl={current:{name:nextName||'Current Round',start:closeAt,cycle:{number:1,start:closeAt,end:'',closed:false},cycles:[]},history:history.slice(-50)};
      PropertiesService.getScriptProperties().setProperty(ROUND_CONTROL_PROPERTY,JSON.stringify(nextControl));
      PropertiesService.getScriptProperties().deleteProperty('GORILLA_PREPARED_V2');
      return {ok:true,settings:readWebSettings(),closed:history[history.length-1]};
    });
  }
  if(action==='saveTdmPhoto'){
    requireOwner(session);const rep=String(body.rep||'').trim(),image=String(body.image||'');
    if(!rep||rep.length>160||image.length>7200||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(image))throw new Error('Invalid profile photo');
    const key='GORILLA_TDM_PHOTO_'+Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,rep));
    PropertiesService.getScriptProperties().setProperty(key,JSON.stringify({rep:rep,image:image}));
    return {ok:true,photos:readWebSettings().tdmPhotos};
  }
  if(action==='saveUserPhoto'){
    requireOwner(session);
    const username=String(body.username||'').trim().toLowerCase(),image=String(body.image||''),users=loadUsers();
    if(!Object.prototype.hasOwnProperty.call(users,username))throw new Error('User not found');
    if(image.length>7200||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(image))throw new Error('Invalid profile photo');
    PropertiesService.getScriptProperties().setProperty(userPhotoKey(username),image);
    return {ok:true,user:publicUser(users[username]),users:Object.keys(users).map(k=>publicUser(users[k]))};
  }
  if(action==='logout'){
    return withWebLock(function(){const users=loadUsers();users[session.username].sessionVersion=Number(users[session.username].sessionVersion||0)+1;saveUsers(users);return {ok:true};});
  }
  if(action==='authorize'){
    if(!['view','export','print','download'].includes(body.permission))throw new Error('Invalid permission');
    if(user.role!=='owner'&&!publicUser(user).actions.includes(body.permission))throw new Error('Permission denied');
    return {ok:true};
  }
  if(action==='users'){requireOwner(session);return {ok:true,users:Object.keys(loadUsers()).map(k=>publicUser(loadUsers()[k]))};}
  if(action==='saveUser'){
    requireOwner(session);
    return withWebLock(function(){
      const input=body.user||{},users=loadUsers(),name=String(input.username||'').trim().toLowerCase();
      if(!/^[a-z0-9_.-]{3,60}$/.test(name)||['__proto__','constructor','prototype'].includes(name))throw new Error('Use 3–60 letters, numbers, dots or underscores for the username');
      const existing=Object.prototype.hasOwnProperty.call(users,name)?users[name]:null;
      if(existing&&existing.role==='owner')throw new Error('Owner account cannot be changed here');
      const password=String(input.password||'');
      if((!existing||password)&&password.length<10)throw new Error('Password must be at least 10 characters');
      const rtms=input.allRtms?['*']:(Array.isArray(input.rtms)?input.rtms.filter(x=>typeof x==='string'&&x.trim()&&x!=='*'):[]);
      if(input.active&&rtms.length===0)throw new Error('Select at least one RTM');
      const pages=(Array.isArray(input.pages)?input.pages:[]).filter(x=>WEB_PAGES.includes(x));
      if(!pages.includes('dashboard'))pages.unshift('dashboard');
      const actions=(Array.isArray(input.actions)?input.actions:[]).filter(x=>['view','export','print','download'].includes(x));
      if(!actions.includes('view'))actions.unshift('view');
      const user=Object.assign({},existing||{},{username:name,displayName:String(input.displayName||name).slice(0,100),role:'rtm',active:input.active===true,rtms:rtms,pages:pages,actions:actions,sessionVersion:Number(existing&&existing.sessionVersion||0)+1});
      if(password){user.salt=Utilities.getUuid();user.passwordHash=hashPassword(password,user.salt);}
      users[name]=user;saveUsers(users);return {ok:true,user:publicUser(user)};
    });
  }
  if(action==='saveSettings'){
    requireOwner(session);
    return withWebLock(function(){
      const patch=body.settings||{},current=readWebSettings();delete current.tdmPhotos;delete current.roundControl;
      if(patch.theme){if(!['ultimate','mango','watermelon'].includes(patch.theme))throw new Error('Invalid theme');current.theme=patch.theme;}
      if(patch.hero){
        current.hero={enabled:patch.hero.enabled!==false,title:String(patch.hero.title||'').slice(0,200),subtitle:String(patch.hero.subtitle||'').slice(0,500),autoplaySeconds:Math.max(3,Math.min(20,Number(patch.hero.autoplaySeconds)||6)),fit:patch.hero.fit==='contain'?'contain':'cover'};
        if(Array.isArray(patch.hero.slides)){
          if(!patch.hero.slides.length||patch.hero.slides.length>6)throw new Error('Choose 1 to 6 slides');
          current.hero.slides=patch.hero.slides.map(s=>{
            const image=String(s.image||'').trim();if(image&&!/^https:\/\/[^\s]+$/.test(image)&&!/^\.\/assets\/[a-z0-9_.-]+$/i.test(image)&&image!=='./hero-ultimate.jpg')throw new Error('Use a direct HTTPS image URL');
            if(image.length>1000)throw new Error('Image URL is too long');
            return {image:image,title:String(s.title||'').slice(0,120),subtitle:String(s.subtitle||'').slice(0,240),caption:s.caption!==false,tone:['ultimate','mango','watermelon'].includes(s.tone)?s.tone:'ultimate',page:['presence','execution','market','performance','newstores','geo','stores','photos','all','reports'].includes(s.page)?s.page:'presence'};
          });
        }
      }
      if(patch.filters){current.filters={};WEB_PAGES.forEach(k=>{current.filters[k]=(Array.isArray(patch.filters[k])?patch.filters[k]:[]).filter(x=>['cycle','week','search','date','rtm','tdm','governorate','area','outlet','gorilla','juhayna','status'].includes(x));});}
      if(Object.prototype.hasOwnProperty.call(patch,'periodCatalog'))current.periodCatalog=cleanPeriodCatalog_(patch.periodCatalog);
      if(patch.tabs){current.tabs={};WEB_PAGES.filter(k=>k!=='dashboard').forEach(k=>current.tabs[k]=patch.tabs[k]!==false);}
      if(patch.analysis){current.analysis={};['short','share','availability','perfectAvailability','perfectShare'].forEach(k=>{const n=Number(patch.analysis[k]);if(!isFinite(n)||n<0||n>(k==='short'?480:100))throw new Error('Invalid threshold');current.analysis[k]=n;});}
      if(Utilities.newBlob(JSON.stringify(current)).getBytes().length>8500)throw new Error('Settings are too large. Shorten image URLs or slide text.');
      PropertiesService.getScriptProperties().setProperty(WEB_SETTINGS,JSON.stringify(current));
      return {ok:true,settings:readWebSettings()};
    });
  }
  return null;
}
function withWebLock(fn){const lock=LockService.getScriptLock();lock.waitLock(30000);try{return fn()}finally{lock.releaseLock()}}
function repRtmMap(spreadsheet){
  const map={};['TDM Summary','All'].forEach(name=>{
    const sheet=spreadsheet.getSheetByName(name);if(!sheet||sheet.getLastRow()<2)return;
    const values=sheet.getDataRange().getValues(),headers=values[0].map(x=>String(x).trim()),rep=headers.indexOf(name==='TDM Summary'?'TDM':'Rep'),rtm=headers.indexOf('RTM');
    if(rep<0||rtm<0)return;
    values.slice(1).forEach(r=>{const key=normalizeApiText(r[rep]);if(key&&r[rtm])map[key]=String(r[rtm]).trim();});
  });return map;
}

// Each invocation does a bounded amount of work. Continuation triggers finish
// large batches without hitting Apps Script's single-execution time limit.
function syncGorillaData(force){
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(100))return {busy:true};
  const startedMs=Date.now();
  try{
    const previous=syncStatus();
    if(force!==true&&!previous.inProgress&&previous.checkedAt&&Date.now()-Date.parse(previous.checkedAt)<15000&&!previous.errors?.length)return {skipped:true};

    const root=DriveApp.getFolderById(ROOT_FOLDER_ID),folder=getOrCreateCacheFolder(root),files=[];
    collectExcelFiles(root,files,folder.getId());
    const index=loadCacheIndex(),active={},dirty=[],stale=[];
    files.forEach(file=>{
      const id=file.getId(),old=index[id],updated=file.getLastUpdated(),modified=updated.toISOString(),size=file.getSize();
      active[id]=true;
      let cacheOkay=false;
      if(old&&old.cacheFileId){try{cacheOkay=!DriveApp.getFileById(old.cacheFileId).isTrashed();}catch(err){cacheOkay=false;}}
      if(old&&old.modified===modified&&Number(old.size)===Number(size)&&cacheOkay)return;
      dirty.push({file:file,old:old,modified:modified,size:size,ageMs:Date.now()-updated.getTime()});
    });
    // Small, stable files go first so one very large workbook cannot block
    // the rest of a multi-file upload.
    dirty.sort((a,b)=>Number(a.size||0)-Number(b.size||0)||Number(b.ageMs||0)-Number(a.ageMs||0));
    Object.keys(index).forEach(id=>{if(!active[id])stale.push(id);});

    const publishedRevision=String(previous.revision||'');
    const startedAt=previous.inProgress&&previous.startedAt?previous.startedAt:new Date().toISOString();
    const errors=previous.inProgress&&Array.isArray(previous.errors)
      ? previous.errors.filter(message=>dirty.some(item=>String(message).startsWith(item.file.getName()+': ')))
      : [];
    const baseProcessed=previous.inProgress?Number(previous.processed||0):0;
    const retryingFailedFiles=Boolean(previous.inProgress&&previous.retryingFailedFiles);
    let processedThisRun=0,morePending=false;
    const props=PropertiesService.getScriptProperties();

    if(dirty.length||stale.length||!preparedAvailable(Object.values(index).map(x=>x.cacheFileId).sort().join('|'))){
      props.setProperty('GORILLA_SYNC_STATUS',JSON.stringify({checkedAt:previous.checkedAt||'',revision:publishedRevision,targetRevision:Object.values(index).map(x=>x.cacheFileId).sort().join('|'),inProgress:true,phase:dirty.length?'converting':(stale.length?'reconciling':'preparing'),startedAt:startedAt,processed:baseProcessed,totalFiles:files.length,processedThisRun:0,retryingFailedFiles:retryingFailedFiles,errors:errors}));
    }

    for(let i=0;i<dirty.length;i++){
      const item=dirty[i],file=item.file;
      if(item.ageMs<20000){morePending=true;continue;}
      if(processedThisRun>=SYNC_MAX_FILES_PER_RUN||Date.now()-startedMs>=SYNC_BUDGET_MS){morePending=true;continue;}
      processedThisRun++;
      const id=file.getId(),old=item.old;
      let converted=null;
      try{
        if(file.getMimeType()===MimeType.GOOGLE_SHEETS){const copy=file.makeCopy('CACHE - '+file.getName(),folder);converted={id:copy.getId(),name:copy.getName()};}
        else converted=convertExcelToCache(file,folder);
        const book=SpreadsheetApp.openById(converted.id);
        index[id]={sourceFileName:file.getName(),sourceDate:detectSourceDate(file,book),modified:item.modified,size:item.size,cacheFileId:converted.id,sheets:Object.keys(inspectCachedWorkbook(book)),cachedAt:new Date().toISOString()};
        saveCacheIndex(index,folder);
        if(old&&old.cacheFileId)try{DriveApp.getFileById(old.cacheFileId).setTrashed(true)}catch(err){}
        for(let e=errors.length-1;e>=0;e--)if(String(errors[e]).startsWith(file.getName()+': '))errors.splice(e,1);
      }catch(err){
        if(old)index[id]=old;else delete index[id];
        if(converted)try{DriveApp.getFileById(converted.id).setTrashed(true)}catch(cleanup){}
        const fileError=file.getName()+': '+String(err.message||err);if(!errors.includes(fileError))errors.push(fileError);
        try{saveCacheIndex(index,folder);}catch(indexErr){const indexError='Cache index: '+String(indexErr.message||indexErr);if(!errors.includes(indexError))errors.push(indexError);}
      }
    }

    if(morePending){
      const targetRevision=Object.values(index).map(x=>x.cacheFileId).sort().join('|');
      props.setProperty('GORILLA_SYNC_STATUS',JSON.stringify({checkedAt:previous.checkedAt||'',revision:publishedRevision,targetRevision:targetRevision,inProgress:true,phase:'converting',startedAt:startedAt,processed:baseProcessed+processedThisRun,totalFiles:files.length,processedThisRun:processedThisRun,pendingFiles:Math.max(0,dirty.length-processedThisRun),retryingFailedFiles:retryingFailedFiles,errors:errors}));
      scheduleGorillaSyncContinuation_();
      Logger.log('Sync batch saved; more files remain. Processed this run: '+processedThisRun);
      return {inProgress:true,phase:'converting',processedThisRun:processedThisRun};
    }

    const failedDirtyFiles=errors.filter(message=>dirty.some(item=>String(message).startsWith(item.file.getName()+': ')));
    if(failedDirtyFiles.length){
      const targetRevision=Object.values(index).map(x=>x.cacheFileId).sort().join('|');
      if(!retryingFailedFiles){
        props.setProperty('GORILLA_SYNC_STATUS',JSON.stringify({checkedAt:previous.checkedAt||'',revision:publishedRevision,targetRevision:targetRevision,inProgress:true,phase:'retrying_failed_files',startedAt:startedAt,processed:baseProcessed+processedThisRun,totalFiles:files.length,retryingFailedFiles:true,errors:errors}));
        scheduleGorillaSyncContinuation_();
        Logger.log('A source file failed conversion; retrying once automatically before publishing.');
        return {inProgress:true,phase:'retrying_failed_files',errors:errors};
      }
      props.setProperty('GORILLA_SYNC_STATUS',JSON.stringify({checkedAt:new Date().toISOString(),revision:publishedRevision,targetRevision:targetRevision,inProgress:false,phase:'sync_failed',startedAt:startedAt,processed:baseProcessed+processedThisRun,totalFiles:files.length,retryingFailedFiles:false,errors:errors}));
      clearGorillaSyncContinuation_();
      Logger.log('Sync paused because one or more source files still fail conversion: '+failedDirtyFiles.join(' | '));
      return {inProgress:false,phase:'sync_failed',errors:errors};
    }

    // Reconcile deleted sources only after all changed files have been handled.
    const removed=[];
    stale.forEach(id=>{if(index[id]){removed.push({id:id,item:index[id]});delete index[id];}});
    if(removed.length){
      try{saveCacheIndex(index,folder);}
      catch(err){removed.forEach(entry=>{index[entry.id]=entry.item;});errors.push('Cache index cleanup: '+String(err.message||err));}
      if(!errors.length||removed.every(entry=>!index[entry.id]))removed.forEach(entry=>{try{if(entry.item.cacheFileId)DriveApp.getFileById(entry.item.cacheFileId).setTrashed(true)}catch(err){}});
    }

    const revision=Object.values(index).map(x=>x.cacheFileId).sort().join('|');
    if(!preparedAvailable(revision)){
      const prep=prepareGorillaSheetsBatch_(revision,index);
      if(prep.failed){
        errors.push(prep.error);
        props.setProperty('GORILLA_SYNC_STATUS',JSON.stringify({checkedAt:new Date().toISOString(),revision:publishedRevision,targetRevision:revision,inProgress:false,phase:'preparation_failed',startedAt:startedAt,totalFiles:files.length,processed:baseProcessed+processedThisRun,retryingFailedFiles:false,errors:errors}));
        Logger.log('Sync conversion finished but data preparation needs retry: '+prep.error);
        return {inProgress:false,phase:'preparation_failed',errors:errors};
      }
      if(!prep.done){
        props.setProperty('GORILLA_SYNC_STATUS',JSON.stringify({checkedAt:previous.checkedAt||'',revision:publishedRevision,targetRevision:revision,inProgress:true,phase:'preparing',startedAt:startedAt,totalFiles:files.length,processed:baseProcessed+processedThisRun,processedThisRun:processedThisRun,pendingSheet:prep.nextSheet||ALLOWED_DATA_SHEETS[0],errors:errors}));
        scheduleGorillaSyncContinuation_();
        Logger.log('File conversion finished; prepared data will continue with '+(prep.nextSheet||'the next sheet'));
        return {inProgress:true,phase:'preparing',pendingSheet:prep.nextSheet||''};
      }
    }

    props.setProperty('GORILLA_SYNC_STATUS',JSON.stringify({checkedAt:new Date().toISOString(),revision:revision,targetRevision:revision,inProgress:false,phase:'complete',startedAt:startedAt,totalFiles:files.length,processed:baseProcessed+processedThisRun,retryingFailedFiles:false,errors:errors}));
    clearGorillaSyncContinuation_();
    Logger.log('Sync completed. Cached workbooks: '+Object.keys(index).length+'; errors: '+errors.length);
    return {ok:true,revision:revision,errors:errors};
  }finally{lock.releaseLock();}
}

function continueGorillaSync(){
  const result=syncGorillaData(true);
  if(result&&result.busy)scheduleGorillaSyncContinuation_();
  return result;
}

// Run this no-argument wrapper from the Apps Script editor to start a sync now.
function runGorillaSyncNow(){return syncGorillaData(true);}

function scheduleGorillaSyncContinuation_(){
  clearGorillaSyncContinuation_();
  ScriptApp.newTrigger(SYNC_CONTINUATION_HANDLER).timeBased().after(60*1000).create();
}

function clearGorillaSyncContinuation_(){
  ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()===SYNC_CONTINUATION_HANDLER).forEach(t=>ScriptApp.deleteTrigger(t));
}
// Shared schedule for all users; replace only this project's sync triggers.
function installSyncTrigger(){
  const triggers=ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='syncGorillaData');
  ScriptApp.newTrigger('syncGorillaData').timeBased().everyHours(1).create();
  triggers.forEach(t=>ScriptApp.deleteTrigger(t));
}
function syncStatus(){return JSON.parse(PropertiesService.getScriptProperties().getProperty('GORILLA_SYNC_STATUS')||'{}');}
function webBootstrap(session,compact=true){
  const index=loadCacheIndex(),revision=Object.values(index).map(x=>x.cacheFileId).sort().join('|');
  const status=syncStatus();
  const waitingForPublish=Boolean(status.inProgress||status.phase==='preparation_failed'||status.phase==='sync_failed'||(status.targetRevision&&status.targetRevision!==status.revision));
  let prepared;
  if(waitingForPublish){
    prepared=loadLatestPreparedSheets_();
    if(!prepared)throw new Error('The first Gorilla data sync is still preparing the files. Please try again in a minute.');
  }else prepared=sharedPreparedSheets(revision,index);
  const sheets={};
  for(const name of ALLOWED_DATA_SHEETS){
    const sheet=prepared[name];if(!sheet.ok){sheets[name]=sheet;continue;}
    const rtm=sheet.columns.indexOf('RTM');
    const values=sheet.values.filter(row=>isRtmAllowed(rtm<0?'':row[rtm],session.rtms));
    sheets[name]={ok:true,columns:sheet.columns,sourceColumns:sheet.sourceColumns||[],values:values,count:values.length,warnings:sheet.warnings||[]};
    if(!compact){sheets[name].rows=values.map(row=>Object.fromEntries(sheet.columns.map((c,i)=>[c,row[i]])));delete sheets[name].values;}
  }
  const routeOnlyIndex=routePlanCacheOnlyIndex_();
  if(routeOnlyIndex){
    const route=getSecureRoutePlanData(session,{books:{},maps:{},index:routeOnlyIndex,routeOnlyOverride:true});
    const columns=route.columns||[];
    const values=(route.rows||[]).map(row=>columns.map(c=>row[c]==null?'':row[c]));
    sheets.RoutePlan={ok:true,columns:columns,sourceColumns:route.sourceColumns||[],values:values,count:values.length,warnings:route.warnings||[]};
    if(!compact)sheets.RoutePlan.rows=(route.rows||[]);
    prepared.RoutePlan=sheets.RoutePlan;
  }
  const users=loadUsers(),out={ok:true,user:publicUser(users[session.username]),settings:readWebSettings(),sheets:sheets,sync:Object.assign({},status,{revision:waitingForPublish?(status.revision||''):revision})};
  if(session.role==='owner')out.users=Object.values(users).map(publicUser);
  try {
    // Keep login/bootstrap responsive. Store monitoring reconciliation scans
    // every route and visit and performs spreadsheet writes, so it must not
    // run synchronously for every user session.
    out.governance = getGovernanceForUser_(session);
  } catch (governanceError) {
    Logger.log('Governance snapshot warning: ' + String(governanceError.message || governanceError));
    out.governance = {alerts:[],notifications:[],requests:[],storeStates:[],warning:'Governance data is temporarily unavailable.'};
  }
  return out;
}
// Cache is private to the script. RTM checks are applied after every cache read.
// Columnar transport avoids repeating long survey questions for every visit.
function sharedPreparedSheets(revision,index){
  revision=preparedRevisionKey(revision);
  const partsManifest=getPreparedPartsManifest_(revision);
  if(partsManifest){try{return readPreparedParts_(partsManifest);}catch(err){Logger.log('Prepared parts could not be read; checking fallback cache: '+String(err.message||err));}}
  let cache,key;
  try{
    cache=CacheService.getScriptCache();
    key='gorilla-packed-v2-'+Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,revision));
    const count=Number(cache.get(key));
    if(count>0&&count<=100){
      const keys=Array.from({length:count},(_,i)=>key+':'+i),parts=cache.getAll(keys);
      if(keys.every(k=>parts[k]))return JSON.parse(Utilities.ungzip(Utilities.newBlob(Utilities.base64Decode(keys.map(k=>parts[k]).join('')),'application/x-gzip')).getDataAsString('UTF-8'));
    }
  }catch(err){cache=null;}
  // Persistent private snapshot survives Script Cache eviction and cold logins.
  const props=PropertiesService.getScriptProperties();
  try{const saved=JSON.parse(props.getProperty('GORILLA_PREPARED_V2')||'null');if(saved&&saved.revision===revision){const snapshot=JSON.parse(DriveApp.getFileById(saved.id).getBlob().getDataAsString('UTF-8'));if(snapshot.revision===revision&&ALLOWED_DATA_SHEETS.every(name=>snapshot.sheets&&snapshot.sheets[name]&&snapshot.sheets[name].ok&&Array.isArray(snapshot.sheets[name].values)))return snapshot.sheets;}}catch(err){Logger.log('Rebuilding prepared snapshot.');}
  const sheets={},context={books:{},maps:{},index:index||loadCacheIndex()};
  for(const name of ALLOWED_DATA_SHEETS){
    try{
      const result=getSecureSheetData(name,{username:'internal',role:'owner',rtms:['*']},'','',context);
      if(!result.ok){sheets[name]=result;continue;}
      const columns=Array.from(new Set(result.columns.concat(['_sourceFile','_sourceDate','RTM'])));
      sheets[name]={ok:true,columns:columns,sourceColumns:result.sourceColumns||[],values:result.rows.map(row=>columns.map(c=>row[c]==null?'':row[c])),warnings:result.warnings};
    }catch(err){if(name==='All')throw err;sheets[name]={ok:false,error:String(err.message||err)};}
  }
  if(sheets.All&&sheets.All.ok)try{
    // Publish an immutable file first; readers never see a partially overwritten snapshot.
    const file=getOrCreateCacheFolder(DriveApp.getFolderById(ROOT_FOLDER_ID)).createFile('gorilla-prepared-v2-'+Utilities.getUuid()+'.json',JSON.stringify({revision:revision,sheets:sheets}),MimeType.PLAIN_TEXT);
    props.setProperty('GORILLA_PREPARED_V2',JSON.stringify({id:file.getId(),revision:revision}));
  }catch(err){Logger.log('Persistent snapshot unavailable: '+String(err));}
  if(cache&&key&&Object.values(sheets).every(s=>s.ok))try{
    const packed=Utilities.base64Encode(Utilities.gzip(Utilities.newBlob(JSON.stringify(sheets),'application/json')).getBytes()),parts={};
    const count=Math.ceil(packed.length/80000);
    if(count<=100){for(let i=0;i<count;i++)parts[key+':'+i]=packed.slice(i*80000,(i+1)*80000);cache.putAll(parts,21600);cache.put(key,String(count),21600);}
  }catch(err){Logger.log('Prepared cache unavailable; direct reads remain available.');}
  return sheets;
}
function preparedRevisionKey(revision){
  const round=JSON.stringify(getRoundControl());
  const selectedRoute=PropertiesService.getScriptProperties().getProperty('GORILLA_ROUTE_PLAN_SELECTED_SOURCE_ID')||'';
  const digest=Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,round+'|route:'+selectedRoute)).replace(/=+$/,'');
  return String(revision||'')+'|round:'+digest;
}
function preparedAvailable(revision){
  try{
    revision=preparedRevisionKey(revision);
    if(getPreparedPartsManifest_(revision))return true;
    const saved=JSON.parse(PropertiesService.getScriptProperties().getProperty('GORILLA_PREPARED_V2')||'null');
    return Boolean(saved&&saved.revision===revision&&!DriveApp.getFileById(saved.id).isTrashed());
  }catch(err){return false;}
}

// =====================================================
// GOVERNANCE: durable store state, approvals, alerts and notifications
// =====================================================
const GOVERNANCE_BOOK_PROPERTY_ = 'GORILLA_GOVERNANCE_BOOK_ID';
const ROUTE_APPROVALS_PROPERTY_ = 'GORILLA_ROUTE_PLAN_APPROVALS_V1';
const GOVERNANCE_HEADERS_ = {
  'Store State':['Client Code','RTM','Status','Classification','Comment','Updated At','Updated By','Route Entry At','In Route'],
  'Requests':['Request ID','Client Code','RTM','Type','Reason','Comment','Status','Requested At','Requested By','Decided At','Decided By','Decision Reason'],
  'Alerts':['Event ID','Type','Client Code','RTM','Title','Detail','Status','Opened At','Last Evidence At','Closed At','Close Reason','Route Entry At'],
  'Notifications':['Notification ID','Event ID','Username','Type','Title','Detail','Created At','Read At','Read By'],
  'Audit Log':['Timestamp','Actor','Action','Entity','Entity ID','Before JSON','After JSON'],
  'Preferences':['Username','Key','Value','Updated At']
};
const GOVERNANCE_POSM_FIELDS_ = ['Posters','Transparent Posters','Parasite Rack','Shelf Talker','Counter Top','Shelf Stripe','Sticker 3 Pack','Pallet Wrap','Stopper','Push & Pull Door Sticker','Shelf in Shelf','Carton Display','أخرى (عدد)'];

function getGovernanceBook_(){
  const props=PropertiesService.getScriptProperties();let id=props.getProperty(GOVERNANCE_BOOK_PROPERTY_),book=null;
  if(id){try{book=SpreadsheetApp.openById(id);}catch(err){book=null;}}
  if(!book){
    book=SpreadsheetApp.create('Gorilla Governance & Alerts');
    try{DriveApp.getFileById(book.getId()).moveTo(DriveApp.getFolderById(ROOT_FOLDER_ID));}catch(err){Logger.log('Governance workbook move warning: '+String(err.message||err));}
    props.setProperty(GOVERNANCE_BOOK_PROPERTY_,book.getId());
  }
  Object.keys(GOVERNANCE_HEADERS_).forEach(name=>{
    let sheet=book.getSheetByName(name);
    if(!sheet)sheet=book.insertSheet(name);
    if(sheet.getLastRow()===0)sheet.getRange(1,1,1,GOVERNANCE_HEADERS_[name].length).setValues([GOVERNANCE_HEADERS_[name]]);
  });
  const first=book.getSheets()[0];if(first&&first.getName()==='Sheet1'&&!GOVERNANCE_HEADERS_['Sheet1']){try{book.deleteSheet(first);}catch(err){}}
  return book;
}
function governanceRows_(name){
  const sheet=getGovernanceBook_().getSheetByName(name),values=sheet.getDataRange().getValues();
  if(values.length<2)return [];
  const headers=values[0].map(x=>String(x||''));
  return values.slice(1).map((row,index)=>({__row:index+2,...Object.fromEntries(headers.map((h,i)=>[h,row[i]==null?'':row[i]]))})).filter(r=>Object.values(r).some(v=>v!==''));
}
function governanceAppend_(name,record){
  const sheet=getGovernanceBook_().getSheetByName(name),headers=GOVERNANCE_HEADERS_[name];
  sheet.appendRow(headers.map(h=>record[h]===undefined?'':record[h]));
}
function governanceUpdate_(name,rowNumber,record){
  const sheet=getGovernanceBook_().getSheetByName(name),headers=GOVERNANCE_HEADERS_[name];
  sheet.getRange(rowNumber,1,1,headers.length).setValues([headers.map(h=>record[h]===undefined?'':record[h])]);
}
function governanceUpsertStore_(record){
  const rows=governanceRows_('Store State'),code=normalizeClientCode(record['Client Code']);
  const old=rows.find(r=>normalizeClientCode(r['Client Code'])===code);
  const merged=Object.assign({},old||{},record,{'Client Code':code});
  if(old)governanceUpdate_('Store State',old.__row,merged);else governanceAppend_('Store State',merged);
  return {before:old||null,after:merged};
}
function governanceNow_(){return Utilities.formatDate(new Date(),'Africa/Cairo','yyyy-MM-dd HH:mm:ss');}
function governanceAudit_(actor,action,entity,id,before,after){
  governanceAppend_('Audit Log',{'Timestamp':governanceNow_(),'Actor':actor,'Action':action,'Entity':entity,'Entity ID':String(id||''),'Before JSON':JSON.stringify(before||null),'After JSON':JSON.stringify(after||null)});
}
function getRoutePlanApprovalMap_(){
  try{return JSON.parse(PropertiesService.getScriptProperties().getProperty(ROUTE_APPROVALS_PROPERTY_)||'{}')||{};}catch(err){return {};}
}
function saveRoutePlanApprovalMap_(map){PropertiesService.getScriptProperties().setProperty(ROUTE_APPROVALS_PROPERTY_,JSON.stringify(map));}
function routePlanCacheOnlyIndex_(){
  let meta=null;
  try{meta=JSON.parse(PropertiesService.getScriptProperties().getProperty(ROUTE_PLAN_ONLY_CACHE_PROPERTY_)||'null');}catch(err){}
  if(!meta||!meta.sourceId||!meta.cacheFileId)return null;
  try{if(DriveApp.getFileById(meta.cacheFileId).isTrashed())return null;}catch(err){return null;}
  return {[meta.sourceId]:{
    sourceFileName:meta.sourceFileName||'',sourceDate:meta.sourceDate||'',modified:meta.modified||'',size:Number(meta.size||0),
    cacheFileId:meta.cacheFileId,sheets:meta.sheets||[],cachedAt:meta.cachedAt||''
  }};
}
// Refresh only the newest Drive workbook whose sheet has the full weekday RoutePlan schema.
// The source workbook is read only; only its converted cache copy and this script's pointer change.
function syncRoutePlanCacheOnly(){
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(1000))return {ok:false,busy:true};
  try{
    const root=DriveApp.getFolderById(ROOT_FOLDER_ID),folder=getOrCreateCacheFolder(root),files=[];
    collectExcelFiles(root,files,folder.getId());
    const candidates=files.filter(file=>/rout(e|s)|route[ _-]?plan/i.test(file.getName()))
      .sort((a,b)=>b.getLastUpdated().getTime()-a.getLastUpdated().getTime());
    if(!candidates.length)return {ok:false,error:'No Route/Routs workbook was found in the configured Drive source folder.'};
    const previous=JSON.parse(PropertiesService.getScriptProperties().getProperty(ROUTE_PLAN_ONLY_CACHE_PROPERTY_)||'null');
    for(const file of candidates){
      let converted=null;
      try{
        if(file.getMimeType()===MimeType.GOOGLE_SHEETS){const copy=file.makeCopy('CACHE - '+file.getName(),folder);converted={id:copy.getId(),name:copy.getName()};}
        else converted=convertExcelToCache(file,folder);
        if(!converted||!converted.id)throw new Error('Drive did not return a converted cache file.');
        const book=SpreadsheetApp.openById(converted.id);
        let match=null;
        for(const sheet of book.getSheets()){
          if(sheet.getLastRow()<2||sheet.getLastColumn()<2)continue;
          const headers=makeUniqueApiHeaders(sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0]);
          if(isRouteScheduleHeaders(headers.map(normalizeApiText))){match={sheetName:sheet.getName(),rowCount:sheet.getLastRow()-1};break;}
        }
        if(!match){try{DriveApp.getFileById(converted.id).setTrashed(true)}catch(cleanupErr){};continue;}
        const meta={sourceId:file.getId(),cacheFileId:converted.id,sourceFileName:file.getName(),sourceDate:detectSourceDate(file,book),modified:file.getLastUpdated().toISOString(),size:file.getSize(),sheets:Object.keys(inspectCachedWorkbook(book)),sheetName:match.sheetName,rowCount:match.rowCount,cachedAt:new Date().toISOString()};
        PropertiesService.getScriptProperties().setProperty(ROUTE_PLAN_ONLY_CACHE_PROPERTY_,JSON.stringify(meta));
        if(previous&&previous.cacheFileId&&previous.cacheFileId!==converted.id)try{DriveApp.getFileById(previous.cacheFileId).setTrashed(true)}catch(cleanupErr){}
        return {ok:true,sourceFile:meta.sourceFileName,sourceSheet:meta.sheetName,rowCount:meta.rowCount,sourceModified:meta.modified,cacheOnly:true};
      }catch(err){
        if(converted&&converted.id)try{DriveApp.getFileById(converted.id).setTrashed(true)}catch(cleanupErr){}
        if(candidates.length===1)return {ok:false,error:file.getName()+': '+String(err.message||err)};
      }
    }
    return {ok:false,error:'Route/Routs workbooks were found, but none had the required Adhoc Serial, RTM, New Repzo User, and seven weekday schedule columns.'};
  }finally{lock.releaseLock();}
}
function routePlanVersionList_(){
  const index=Object.assign({},loadCacheIndex(),routePlanCacheOnlyIndex_()||{}),items=Object.keys(index).map(id=>Object.assign({_sourceId:id},index[id])).sort((a,b)=>String(b.modified||b.cachedAt||'').localeCompare(String(a.modified||a.cachedAt||'')));
  const out=[];
  items.forEach(item=>{
    let book;try{book=SpreadsheetApp.openById(item.cacheFileId);}catch(err){return;}
    for(const sheet of book.getSheets()){
      if(sheet.getLastRow()<2||sheet.getLastColumn()<2)continue;
      const headers=makeUniqueApiHeaders(sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0]),normalized=headers.map(normalizeApiText);
      const hasCode=normalized.includes('adhoc serial')||normalized.includes('client code');
      const hasSignal=normalized.some(h=>h==='shaban comment gorilla'||h==='ahmed salim comment')||(hasCode&&normalized.some(h=>h.includes('comment')))||isRouteScheduleHeaders(normalized);
      if(!hasCode||!hasSignal)continue;
      out.push({sourceId:item._sourceId,sourceFile:item.sourceFileName||'',sourceDate:item.sourceDate||'',sourceModified:item.modified||item.cachedAt||'',sheetName:sheet.getName(),rowCount:Math.max(0,sheet.getLastRow()-1)});
      break;
    }
  });
  return out;
}
function routePlanVersionsForOwner_(){
  const versions=routePlanVersionList_(),map=getRoutePlanApprovalMap_();
  if(!Object.keys(map).length&&versions.length){const first=versions[0];map[first.sourceId]={status:'approved',active:true,approvedBy:'system-migration',approvedAt:governanceNow_(),legacy:true};saveRoutePlanApprovalMap_(map);}
  const updated=getRoutePlanApprovalMap_(),selected=PropertiesService.getScriptProperties().getProperty('GORILLA_ROUTE_PLAN_SELECTED_SOURCE_ID')||'',effective=selected||versions.filter(v=>updated[v.sourceId]?.status==='approved'&&updated[v.sourceId]?.active!==false).sort((a,b)=>String(b.sourceModified).localeCompare(String(a.sourceModified)))[0]?.sourceId||'';
  return versions.map(v=>Object.assign({},v,{status:updated[v.sourceId]?.status||'pending',active:updated[v.sourceId]?.active!==false,approvedBy:updated[v.sourceId]?.approvedBy||'',approvedAt:updated[v.sourceId]?.approvedAt||'',selected:v.sourceId===effective}));
}
function governanceCanAccessStore_(session,rtm){return session.role==='owner'||isRtmAllowed(rtm,session.rtms);}
function governanceRequest_(session,body,type){
  const code=normalizeClientCode(body.clientCode||body['Client Code']);if(!code)throw new Error('Client Code is required');
  const route=getLatestRoutePlanRows().rows.find(r=>normalizeClientCode(r['Client Code'])===code);if(!route)throw new Error('Store is not in the current approved Route Plan');
  if(!governanceCanAccessStore_(session,route.RTM))throw new Error('Permission denied for this RTM');
  const reason=String(body.reason||'').trim().slice(0,500),comment=String(body.comment||'').trim().slice(0,1000);
  if(!reason&&!comment)throw new Error('A reason or comment is required');
  const existing=governanceRows_('Requests').find(r=>normalizeClientCode(r['Client Code'])===code&&r.Type===type&&['Pending','Pending Review'].includes(String(r.Status))&&String(r.Comment||'')===comment);
  if(existing)return {ok:true,request:existing,duplicate:true};
  const record={'Request ID':Utilities.getUuid(),'Client Code':code,'RTM':route.RTM||'','Type':type,'Reason':reason,'Comment':comment,'Status':type==='review'?'Pending Review':'Pending','Requested At':governanceNow_(),'Requested By':session.username};
  governanceAppend_('Requests',record);governanceAudit_(session.username,'request_'+type,'Store',code,null,record);
  return {ok:true,request:record};
}
function governanceAction_(action,body,session){
  if(action==='governance')return {ok:true,governance:getGovernanceForUser_(session)};
  if(action==='uploadRoutePlanVersion'){
    requireOwner(session);
    const name=String(body.name||'').trim(),base64=String(body.base64||''),mime=String(body.mimeType||'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    if(!/\.xlsx?$/i.test(name))throw new Error('Upload an Excel Route Plan file (.xlsx or .xls)');
    if(!base64||base64.length>11000000)throw new Error('The file is empty or exceeds the 8 MB upload limit');
    const bytes=Utilities.base64Decode(base64),blob=Utilities.newBlob(bytes,mime,name),file=DriveApp.getFolderById(ROOT_FOLDER_ID).createFile(blob);
    governanceAudit_(session.username,'upload_route_plan','RoutePlan',file.getId(),null,{name:name,size:bytes.length});
    const sync=syncGorillaData(true);
    return {ok:true,fileId:file.getId(),name:file.getName(),sync:syncStatus(),busy:Boolean(sync&&sync.busy)};
  }
  if(action==='routePlanVersions'){requireOwner(session);return {ok:true,versions:routePlanVersionsForOwner_(),selected:PropertiesService.getScriptProperties().getProperty('GORILLA_ROUTE_PLAN_SELECTED_SOURCE_ID')||''};}
  if(action==='approveRoutePlanVersion'||action==='rejectRoutePlanVersion'||action==='deactivateRoutePlanVersion'||action==='activateRoutePlanVersion'||action==='selectRoutePlanVersion'){
    requireOwner(session);
    return withWebLock(function(){
      const sourceId=String(body.sourceId||'').trim(),versions=routePlanVersionList_();if(!versions.some(v=>v.sourceId===sourceId))throw new Error('Route Plan version not found');
      const map=getRoutePlanApprovalMap_(),before=map[sourceId]||null,now=governanceNow_();
      if(action==='approveRoutePlanVersion')map[sourceId]={status:'approved',active:true,approvedBy:session.username,approvedAt:now,decisionReason:String(body.reason||'').slice(0,500)};
      if(action==='rejectRoutePlanVersion')map[sourceId]={status:'rejected',active:false,approvedBy:session.username,approvedAt:now,decisionReason:String(body.reason||'').slice(0,500)};
      if(action==='deactivateRoutePlanVersion')map[sourceId]=Object.assign({},map[sourceId]||{status:'approved'}, {active:false,deactivatedBy:session.username,deactivatedAt:now,decisionReason:String(body.reason||'').slice(0,500)});
      if(action==='activateRoutePlanVersion'){
        if(!map[sourceId]||map[sourceId].status!=='approved')throw new Error('Only an approved Route Plan version can be reactivated');
        map[sourceId]=Object.assign({},map[sourceId],{active:true,reactivatedBy:session.username,reactivatedAt:now,decisionReason:String(body.reason||'').slice(0,500)});
      }
      if(action==='selectRoutePlanVersion'){
        if(!map[sourceId]||map[sourceId].status!=='approved'||map[sourceId].active===false)throw new Error('Only an active approved Route Plan version can be selected');
        PropertiesService.getScriptProperties().setProperty('GORILLA_ROUTE_PLAN_SELECTED_SOURCE_ID',sourceId);
      }
      const selectedNow=PropertiesService.getScriptProperties().getProperty('GORILLA_ROUTE_PLAN_SELECTED_SOURCE_ID')||'';
      if(selectedNow===sourceId&&(!map[sourceId]||map[sourceId].status!=='approved'||map[sourceId].active===false)){
        const fallback=versions.filter(v=>v.sourceId!==sourceId&&map[v.sourceId]?.status==='approved'&&map[v.sourceId]?.active!==false).sort((a,b)=>String(b.sourceModified).localeCompare(String(a.sourceModified)))[0];
        if(fallback)PropertiesService.getScriptProperties().setProperty('GORILLA_ROUTE_PLAN_SELECTED_SOURCE_ID',fallback.sourceId);else PropertiesService.getScriptProperties().deleteProperty('GORILLA_ROUTE_PLAN_SELECTED_SOURCE_ID');
      }
      saveRoutePlanApprovalMap_(map);PropertiesService.getScriptProperties().deleteProperty('GORILLA_PREPARED_V2');
      governanceAudit_(session.username,action,'RoutePlan',sourceId,before,map[sourceId]||{selected:true});
      return {ok:true,versions:routePlanVersionsForOwner_(),selected:PropertiesService.getScriptProperties().getProperty('GORILLA_ROUTE_PLAN_SELECTED_SOURCE_ID')||''};
    });
  }
  if(action==='requestStoreExclusion')return withWebLock(()=>governanceRequest_(session,body,'exclude'));
  if(action==='requestStoreReview')return withWebLock(()=>governanceRequest_(session,body,'review'));
  if(action==='decideStoreRequest'){
    return withWebLock(function(){
      const id=String(body.requestId||''),decision=String(body.decision||'').toLowerCase(),rows=governanceRows_('Requests'),old=rows.find(r=>r['Request ID']===id);
      if(!old)throw new Error('Request not found');if(!['approve','reject'].includes(decision))throw new Error('Choose approve or reject');
      if(!governanceCanAccessStore_(session,old.RTM))throw new Error('Permission denied for this RTM');
      if(old.Type!=='exclude'&&decision==='approve')throw new Error('Review items require a separate store decision; they cannot automatically exclude a store');
      if(!['Pending','Pending Review'].includes(String(old.Status)))throw new Error('Request has already been decided');
      const after=Object.assign({},old,{Status:decision==='approve'?'Approved':'Rejected','Decided At':governanceNow_(),'Decided By':session.username,'Decision Reason':String(body.decisionReason||'').trim().slice(0,500)});
      governanceUpdate_('Requests',old.__row,after);
      if(old.Type==='exclude'&&decision==='approve'){
        const current=governanceRows_('Store State').find(r=>normalizeClientCode(r['Client Code'])===normalizeClientCode(old['Client Code']));
        const result=governanceUpsertStore_({'Client Code':old['Client Code'],'RTM':old.RTM,'Status':'Excluded','Classification':'unsuitable_category','Comment':old.Comment||old.Reason,'Updated At':governanceNow_(),'Updated By':session.username,'Route Entry At':current?.['Route Entry At']||'','In Route':current?.['In Route']||'Yes'});
        governanceAudit_(session.username,'exclude_store','Store',old['Client Code'],result.before,result.after);
      }
      governanceAudit_(session.username,'decide_request','Request',id,old,after);return {ok:true,request:after,governance:getGovernanceForUser_(session)};
    });
  }
  if(action==='reactivateStore'){
    return withWebLock(function(){
      const code=normalizeClientCode(body.clientCode||''),reason=String(body.reason||'').trim().slice(0,500);if(!code||!reason)throw new Error('Client Code and reactivation reason are required');
      const state=governanceRows_('Store State').find(r=>normalizeClientCode(r['Client Code'])===code),route=getLatestRoutePlanRows().rows.find(r=>normalizeClientCode(r['Client Code'])===code),rtm=route?.RTM||state?.RTM||'';
      if(!governanceCanAccessStore_(session,rtm))throw new Error('Permission denied for this RTM');if(!state||state.Status!=='Excluded')throw new Error('Store is not currently excluded');
      const result=governanceUpsertStore_({'Client Code':code,'RTM':rtm,'Status':'Active','Classification':'','Comment':reason,'Updated At':governanceNow_(),'Updated By':session.username,'Route Entry At':route?governanceNow_():'','In Route':route?'Yes':'No'});
      governanceAudit_(session.username,'reactivate_store','Store',code,result.before,result.after);return {ok:true,store:result.after,governance:getGovernanceForUser_(session)};
    });
  }
  if(action==='saveGovernancePreference'){
    const key=String(body.key||''),value=String(body.value||'');if(!['posmMode'].includes(key)||!['any','latest'].includes(value))throw new Error('Invalid preference');
    return withWebLock(function(){const rows=governanceRows_('Preferences'),old=rows.find(r=>r.Username===session.username&&r.Key===key),record={Username:session.username,Key:key,Value:value,'Updated At':governanceNow_()};if(old)governanceUpdate_('Preferences',old.__row,record);else governanceAppend_('Preferences',record);return {ok:true,preference:record};});
  }
  if(action==='markGovernanceNotificationRead'){
    return withWebLock(function(){const id=String(body.notificationId||''),rows=governanceRows_('Notifications'),old=rows.find(r=>r['Notification ID']===id&&r.Username===session.username);if(!old)throw new Error('Notification not found');if(!old['Read At']){const after=Object.assign({},old,{'Read At':governanceNow_(),'Read By':session.username});governanceUpdate_('Notifications',old.__row,after);governanceAudit_(session.username,'read_notification','Notification',id,old,after);}return {ok:true};});
  }
  return null;
}
function getGovernanceForUser_(session){
  const inScope=rtm=>session.role==='owner'||isRtmAllowed(rtm,session.rtms);
  const alerts=governanceRows_('Alerts').filter(r=>inScope(r.RTM)).sort((a,b)=>String(b['Opened At']).localeCompare(String(a['Opened At'])));
  const requests=governanceRows_('Requests').filter(r=>inScope(r.RTM)).sort((a,b)=>String(b['Requested At']).localeCompare(String(a['Requested At'])));
  const storeStates=governanceRows_('Store State').filter(r=>inScope(r.RTM));
  const notifications=governanceRows_('Notifications').filter(r=>r.Username===session.username).sort((a,b)=>String(b['Created At']).localeCompare(String(a['Created At'])));
  const prefs=governanceRows_('Preferences').filter(r=>r.Username===session.username).reduce((o,r)=>(o[r.Key]=r.Value,o),{});
  return {alerts,requests,storeStates,notifications,preferences:prefs};
}
function governanceStamp_(row){return normalizeNewStoreStamp(row['Started At']||row.Date||row['Visit Date']||'',row.Date||'');}
function governanceSuccessful_(row){
  const statusKey=Object.keys(row).find(k=>normalizeApiText(k)==='حالة الزيارة'||normalizeApiText(k)==='visit status'||normalizeApiText(k)==='status');
  const status=normalizeApiText(statusKey?row[statusKey]:'');
  return status==='successful visit'||status==='زيارة ناجحة'||status==='visit successful'||String(row['Successful Visit']||'')==='1'||String(row['Successful Visit']||'').toLowerCase()==='true';
}
function governanceTriState_(value){const s=normalizeApiText(value);if(['yes','y','true','1','نعم','ايوه','أيوه'].includes(s))return true;if(['no','n','false','0','لا','لأ'].includes(s))return false;return null;}
function governanceFindHeader_(row,patterns){return Object.keys(row).find(k=>patterns.some(p=>p.test(normalizeApiText(k))));}
function governanceSkuEvidence_(row){
  const keys=Object.keys(row).filter(k=>/gorilla.*(ultimate|mango|watermelon).*facing count/i.test(k));
  const values=keys.map(k=>row[k]).filter(v=>v!==''&&v!==null&&v!==undefined).map(Number).filter(Number.isFinite);
  const uniqueFlavours=new Set(keys.map(k=>{const s=normalizeApiText(k);return s.includes('ultimate')?'ultimate':s.includes('mango')?'mango':s.includes('watermelon')?'watermelon':'';}).filter(Boolean));
  const complete=uniqueFlavours.size===3&&keys.length>=6&&keys.every(k=>row[k]!==''&&row[k]!==null&&row[k]!==undefined&&Number.isFinite(Number(row[k])));
  return {keys,values,complete,positive:values.some(v=>v>0),allZero:complete&&values.every(v=>v===0)};
}
function governancePosmEvidence_(row){
  const keys=GOVERNANCE_POSM_FIELDS_.filter(k=>Object.prototype.hasOwnProperty.call(row,k));
  const values=keys.map(k=>row[k]!==''&&row[k]!==null&&row[k]!==undefined&&Number.isFinite(Number(row[k]))?Number(row[k]):null);
  return {keys,complete:keys.length===GOVERNANCE_POSM_FIELDS_.length&&values.every(v=>v!==null),known:values.some(v=>v!==null),positive:values.some(v=>v!==null&&v>0),allZero:keys.length>0&&values.every(v=>v!==null&&v===0)};
}
function governanceCreateAlert_(type,store,detail,evidenceStamp,routeEntryAt){
  const open=governanceRows_('Alerts').find(r=>r.Type===type&&normalizeClientCode(r['Client Code'])===normalizeClientCode(store.code)&&r.Status==='Open');
  if(open)return open;
  const titles={gorilla_lost:'Gorilla Lost Presence',posm_lost:'POSM Lost',fridge_lost:'Gorilla Fridge Lost',damaged_products:'Damaged Products'};
  const record={'Event ID':Utilities.getUuid(),'Type':type,'Client Code':store.code,'RTM':store.rtm,'Title':titles[type]||type,'Detail':detail,'Status':'Open','Opened At':governanceNow_(),'Last Evidence At':evidenceStamp||'','Route Entry At':routeEntryAt||''};
  governanceAppend_('Alerts',record);governanceAudit_('system','open_alert','Alert',record['Event ID'],null,record);
  const users=loadUsers();Object.keys(users).forEach(username=>{const u=users[username];if(!u.active)return;const recipient=u.role==='owner'||(u.role==='rtm'&&isRtmAllowed(store.rtm,u.rtms));if(!recipient)return;governanceAppend_('Notifications',{'Notification ID':Utilities.getUuid(),'Event ID':record['Event ID'],'Username':username,'Type':type,'Title':record.Title,'Detail':store.name+' · '+store.code+' · '+detail,'Created At':record['Opened At']});});
  return record;
}
function governanceRequestPresenceReview_(store,detail,evidenceStamp){
  const reason='Gorilla presence evidence needs review';
  const rows=governanceRows_('Requests');
  const pending=rows.find(r=>normalizeClientCode(r['Client Code'])===normalizeClientCode(store.code)&&r.Type==='review'&&['Pending','Pending Review'].includes(String(r.Status))&&String(r.Reason||'')===reason);
  if(pending)return pending;
  const record={'Request ID':Utilities.getUuid(),'Client Code':store.code,'RTM':store.rtm,'Type':'review','Reason':reason,'Comment':String(detail||'Incomplete or conflicting Gorilla survey/SKU evidence')+(evidenceStamp?' · Evidence: '+evidenceStamp:''),'Status':'Pending Review','Requested At':governanceNow_(),'Requested By':'system'};
  governanceAppend_('Requests',record);governanceAudit_('system','review_gorilla_presence','Store',store.code,null,record);
  const users=loadUsers();Object.keys(users).forEach(username=>{const u=users[username];if(!u.active)return;const recipient=u.role==='owner'||(u.role==='rtm'&&isRtmAllowed(store.rtm,u.rtms));if(!recipient)return;governanceAppend_('Notifications',{'Notification ID':Utilities.getUuid(),'Event ID':'','Username':username,'Type':'review','Title':'Gorilla Presence Needs Review','Detail':store.name+' · '+store.code+' · '+record.Comment,'Created At':record['Requested At']});});
  return record;
}
function governanceCloseAlert_(alert,reason,evidenceStamp){
  const after=Object.assign({},alert,{Status:['out_of_scope','excluded_from_scope'].includes(reason)?'Closed · Out of Scope':'Closed · Recovered','Closed At':governanceNow_(),'Close Reason':reason,'Last Evidence At':evidenceStamp||alert['Last Evidence At']});
  governanceUpdate_('Alerts',alert.__row,after);governanceAudit_('system','close_alert','Alert',alert['Event ID'],alert,after);return after;
}
function governanceClassifyComment_(value){
  const s=normalizeApiText(value);if(!s)return 'none';
  if(/المحل ضعيف|weak (commercial|store)|weak potential/.test(s))return 'weak';
  if(/wrong industry|wrong category|industry mismatch|category mismatch|صناعه خطأ|تصنيف خطأ/.test(s))return 'wrong_category';
  if(/not suitable|لا تصلح|غير مناسب/.test(s))return 'not_suitable';
  return 'unknown';
}
function governanceReviewComments_(routeRows,visitRows){
  const commentsByCode=new Map();
  [...routeRows,...visitRows].forEach(row=>{
    const code=normalizeClientCode(row['Client Code']||row['Adhoc Serial']);if(!code)return;
    const values=Object.keys(row).filter(k=>/comment|تعليق/i.test(k)).map(k=>String(row[k]||'').trim()).filter(Boolean);
    if(row['Route Comment'])values.push(String(row['Route Comment']));
    if(values.length){if(!commentsByCode.has(code))commentsByCode.set(code,[]);commentsByCode.get(code).push(...values);}
  });
  const requests=governanceRows_('Requests'),states=governanceRows_('Store State');
  commentsByCode.forEach((values,code)=>{
    const route=routeRows.find(r=>normalizeClientCode(r['Client Code']||r['Adhoc Serial'])===code),rtm=route?.RTM||'';
    const comment=[...new Set(values)].join(' | ').slice(0,1000),classification=governanceClassifyComment_(comment),existing=states.find(r=>normalizeClientCode(r['Client Code'])===code);
    if(classification==='weak'){
      const result=governanceUpsertStore_({'Client Code':code,'RTM':rtm,'Status':existing?.Status||'Active','Classification':'weak_commercial_potential','Comment':comment,'Updated At':governanceNow_(),'Updated By':'system','Route Entry At':existing?.['Route Entry At']||'','In Route':'Yes'});
      if(!existing||existing.Comment!==comment)governanceAudit_('system','classify_weak_store','Store',code,result.before,result.after);
    } else if(classification==='wrong_category'||classification==='not_suitable'||classification==='unknown'){
      const type=classification==='wrong_category'?'exclude':'review',pending=requests.find(r=>normalizeClientCode(r['Client Code'])===code&&r.Type===type&&['Pending','Pending Review'].includes(String(r.Status))&&String(r.Comment||'')===comment);
      if(!pending){const rec={'Request ID':Utilities.getUuid(),'Client Code':code,'RTM':rtm,'Type':type,'Reason':classification==='wrong_category'?'Wrong Industry / Wrong Category':classification==='not_suitable'?'Not Suitable · Manual Review':'Unrecognized store comment · Manual Review','Comment':comment,'Status':type==='review'?'Pending Review':'Pending','Requested At':governanceNow_(),'Requested By':'system'};governanceAppend_('Requests',rec);governanceAudit_('system','auto_request_'+type,'Store',code,null,rec);}
    }
  });
}
function reconcileStoreMonitoring_(prepared){
  if(!prepared||!prepared.All||!prepared.All.ok||!prepared.RoutePlan||!prepared.RoutePlan.ok)return;
  const rowsFrom=sheet=>sheet.values.map(values=>Object.fromEntries(sheet.columns.map((c,i)=>[c,values[i]===undefined?'':values[i]])));
  const allRows=rowsFrom(prepared.All),routeRows=rowsFrom(prepared.RoutePlan),now=governanceNow_(),control=getRoundControl(),cycle=control.current?.cycle||{},cycleStart=String(cycle.start||control.current?.start||''),cycleEnd=String(cycle.end||''),routeMap=new Map();
  routeRows.forEach(r=>{const code=normalizeClientCode(r['Client Code']||r['Adhoc Serial']);if(code)routeMap.set(code,r);});
  const states=governanceRows_('Store State'),stateMap=new Map(states.map(s=>[normalizeClientCode(s['Client Code']),s]));
  routeMap.forEach((route,code)=>{
    const old=stateMap.get(code),entry=old&&old['In Route']==='No'?now:(old?.['Route Entry At']||''),status=old?.Status==='Excluded'?'Excluded':'Active';
    if(!old||old['In Route']!=='Yes'||old.RTM!==route.RTM){const result=governanceUpsertStore_({'Client Code':code,'RTM':route.RTM||old?.RTM||'','Status':status,'Classification':old?.Classification||'','Comment':old?.Comment||'','Updated At':now,'Updated By':'system','Route Entry At':entry,'In Route':'Yes'});if(old&&old['In Route']==='No')governanceAudit_('system','route_reentry','Store',code,result.before,result.after);}
  });
  states.filter(s=>s['In Route']==='Yes'&&!routeMap.has(normalizeClientCode(s['Client Code']))).forEach(old=>{
    governanceUpsertStore_({'Client Code':old['Client Code'],'RTM':old.RTM,'Status':old.Status,'Classification':old.Classification,'Comment':old.Comment,'Updated At':now,'Updated By':'system','Route Entry At':old['Route Entry At'],'In Route':'No'});
    governanceRows_('Alerts').filter(a=>normalizeClientCode(a['Client Code'])===normalizeClientCode(old['Client Code'])&&a.Status==='Open').forEach(a=>governanceCloseAlert_(a,'out_of_scope',''));
  });
  governanceReviewComments_(routeRows,allRows);
  // Keep active and not-eligible stores in scope; remove only explicit
  // route statuses that are no longer active, plus approved governance exclusions.
  const currentStates=governanceRows_('Store State'),activeStores=routeRows.filter(r=>{const code=normalizeClientCode(r['Client Code']||r['Adhoc Serial']),s=currentStates.find(x=>normalizeClientCode(x['Client Code'])===code),routeStatus=normalizeApiText(r['Current Status']||'active');return s?.Status!=='Excluded'&&!['removed','inactive','bucket','excluded'].includes(routeStatus);});
  currentStates.filter(s=>s.Status==='Excluded'&&s['In Route']==='Yes').forEach(s=>governanceRows_('Alerts').filter(a=>normalizeClientCode(a['Client Code'])===normalizeClientCode(s['Client Code'])&&a.Status==='Open').forEach(a=>governanceCloseAlert_(a,'excluded_from_scope','')));
  const posmFields=GOVERNANCE_POSM_FIELDS_.filter(k=>allRows.some(r=>Object.prototype.hasOwnProperty.call(r,k)));
  const cycleVisits=allRows.filter(r=>governanceSuccessful_(r)).map(r=>Object.assign({},r,{__code:normalizeClientCode(r['Client Code']||r['Adhoc Serial']),__stamp:governanceStamp_(r)})).filter(r=>r.__code&&r.__stamp&&(!cycleStart||r.__stamp>=cycleStart)&&(!cycleEnd||r.__stamp<cycleEnd));
  const history=allRows.filter(r=>governanceSuccessful_(r)).map(r=>Object.assign({},r,{__code:normalizeClientCode(r['Client Code']||r['Adhoc Serial']),__stamp:governanceStamp_(r)})).filter(r=>r.__code&&r.__stamp);
  const openAlerts=governanceRows_('Alerts').filter(a=>a.Status==='Open');
  activeStores.forEach(route=>{
    const code=normalizeClientCode(route['Client Code']||route['Adhoc Serial']),storeState=currentStates.find(s=>normalizeClientCode(s['Client Code'])===code);if(storeState?.Status==='Excluded')return;
    const store={code:code,rtm:route.RTM||'',name:route.Client||route['Branch Name']||code},entry=String(storeState?.['Route Entry At']||''),afterEntry=r=>!entry||r.__stamp>=entry;
    const visits=history.filter(r=>r.__code===code&&afterEntry(r)).sort((a,b)=>a.__stamp.localeCompare(b.__stamp)),inCycle=visits.filter(r=>(!cycleStart||r.__stamp>=cycleStart)&&(!cycleEnd||r.__stamp<cycleEnd));
    const gorillaEvidence=r=>{const sku=governanceSkuEvidence_(r),surveyKey=governanceFindHeader_(r,[/gorilla.*(present|available|products?)/i,/products?.*gorilla/i,/منتج.*جوريلا/i]),survey=surveyKey?governanceTriState_(r[surveyKey]):null,conflict=(survey===false&&sku.positive)||(survey===true&&sku.allZero);return {sku,survey,positive:survey===true||sku.positive,confirmedPositive:survey===true&&sku.positive,absent:survey===false&&sku.allZero,conflict,complete:sku.complete&&survey!==null};};
    const priorGorilla=visits.filter(r=>cycleStart&&r.__stamp<cycleStart).some(r=>gorillaEvidence(r).positive),currentGorilla=inCycle.map(r=>({r,e:gorillaEvidence(r)}));
    const gorillaReview=currentGorilla.filter(x=>x.e.conflict||!x.e.complete).at(-1);
    const gorillaRecovered=currentGorilla.some(x=>x.e.confirmedPositive),gorillaSuppressed=currentGorilla.some(x=>x.e.positive),gorillaLost=currentGorilla.filter(x=>x.e.absent&&!x.e.conflict).at(-1);
    const priorPosm=visits.filter(r=>cycleStart&&r.__stamp<cycleStart).some(r=>governancePosmEvidence_(r).positive),currentPosm=inCycle.map(r=>({r,e:governancePosmEvidence_(r)})),posmRecovered=currentPosm.some(x=>x.e.positive),posmLost=currentPosm.filter(x=>x.e.complete&&x.e.allZero).at(-1);
    const coolerKey=allRows.length?governanceFindHeader_(allRows.find(r=>r.__code===code)||allRows[0],[/gorilla.*cooler/i,/gorilla.*fridge/i,/ثلاجه.*جوريلا/i,/ثلاجة.*جوريلا/i]):null;
    const coolerEvidence=r=>coolerKey?governanceTriState_(r[coolerKey]):null,priorCooler=visits.filter(r=>cycleStart&&r.__stamp<cycleStart).some(r=>coolerEvidence(r)===true),currentCoolers=inCycle.map(r=>({r,value:coolerEvidence(r)})),coolerRecovered=currentCoolers.some(x=>x.value===true),coolerLost=currentCoolers.filter(x=>x.value===false).at(-1);
    const damagedKey=allRows.length?governanceFindHeader_(allRows.find(r=>r.__code===code)||allRows[0],[/damaged.*products?/i,/products?.*damaged/i,/منتجات.*تالف/i,/تالف.*منتجات/i]):null;
    const damaged=inCycle.filter(r=>damagedKey&&governanceTriState_(r[damagedKey])===true).at(-1);
    if(gorillaReview)governanceRequestPresenceReview_(store,gorillaReview.e.conflict?'Survey and SKU presence evidence conflict.':'Survey or one or more of the six SKU measurements is missing or invalid.',gorillaReview.r.__stamp);
    const openFor=(type)=>openAlerts.find(a=>a.Type===type&&normalizeClientCode(a['Client Code'])===code);
    if(priorGorilla&&!gorillaSuppressed&&gorillaLost)governanceCreateAlert_('gorilla_lost',store,'A previous Gorilla presence was followed by a confirmed absence in a Successful Visit.',gorillaLost.r.__stamp,entry);
    if(priorPosm&&!posmRecovered&&posmLost)governanceCreateAlert_('posm_lost',store,'Previously recorded POSM is now confirmed at zero in a Successful Visit.',posmLost.r.__stamp,entry);
    if(priorCooler&&!coolerRecovered&&coolerLost)governanceCreateAlert_('fridge_lost',store,'A previously recorded Gorilla fridge is now reported absent in a Successful Visit.',coolerLost.r.__stamp,entry);
    if(damaged)governanceCreateAlert_('damaged_products',store,'Damaged products were reported in a Successful Visit.',damaged.__stamp,entry);
    [['gorilla_lost',gorillaRecovered,currentGorilla.filter(x=>x.e.positive).at(-1)?.r.__stamp],['posm_lost',posmRecovered,currentPosm.filter(x=>x.e.positive).at(-1)?.r.__stamp],['fridge_lost',coolerRecovered,currentCoolers.filter(x=>x.value===true).at(-1)?.r.__stamp]].forEach(([type,recovered,stamp])=>{const alert=openFor(type);if(alert&&recovered)governanceCloseAlert_(alert,'recovered',stamp);});
  });
}

function getPreparedPartsManifest_(expectedRevision){
  try{
    const manifest=JSON.parse(PropertiesService.getScriptProperties().getProperty(PREPARED_PARTS_PROPERTY)||'null');
    if(!manifest||!manifest.revision||!manifest.parts)return null;
    if(expectedRevision&&manifest.revision!==expectedRevision)return null;
    for(const name of ALLOWED_DATA_SHEETS){
      const id=manifest.parts[name];if(!id)return null;
      if(DriveApp.getFileById(id).isTrashed())return null;
    }
    return manifest;
  }catch(err){return null;}
}

function readPreparedParts_(manifest){
  const sheets={};
  for(const name of ALLOWED_DATA_SHEETS){
    const part=JSON.parse(DriveApp.getFileById(manifest.parts[name]).getBlob().getDataAsString('UTF-8'));
    if(part.revision!==manifest.revision||part.sheetName!==name||!part.sheet)throw new Error('Prepared data part is invalid: '+name);
    sheets[name]=part.sheet;
  }
  return sheets;
}

function loadLatestPreparedSheets_(){
  try{
    const manifest=getPreparedPartsManifest_(null);
    if(manifest)return readPreparedParts_(manifest);
  }catch(err){Logger.log('Latest prepared parts unavailable: '+String(err.message||err));}
  try{
    const saved=JSON.parse(PropertiesService.getScriptProperties().getProperty('GORILLA_PREPARED_V2')||'null');
    if(saved&&saved.id){
      const file=DriveApp.getFileById(saved.id);if(file.isTrashed())return null;
      const snapshot=JSON.parse(file.getBlob().getDataAsString('UTF-8'));
      if(snapshot&&snapshot.sheets&&snapshot.sheets.All&&snapshot.sheets.All.ok)return snapshot.sheets;
    }
  }catch(err){Logger.log('Previous prepared snapshot unavailable: '+String(err.message||err));}
  return null;
}

function prepareGorillaSheetsBatch_(revision,index){
  const props=PropertiesService.getScriptProperties(),preparedRevision=preparedRevisionKey(revision);
  let state=null;
  try{state=JSON.parse(props.getProperty(PREP_BUILD_PROPERTY)||'null');}catch(err){}
  if(!state||state.revision!==preparedRevision){
    if(state&&state.parts)Object.keys(state.parts).forEach(name=>{try{DriveApp.getFileById(state.parts[name]).setTrashed(true);}catch(err){}});
    state={revision:preparedRevision,nextIndex:0,parts:{},startedAt:new Date().toISOString()};
    props.setProperty(PREP_BUILD_PROPERTY,JSON.stringify(state));
  }

  if(state.nextIndex>=ALLOWED_DATA_SHEETS.length){
    props.setProperty(PREPARED_PARTS_PROPERTY,JSON.stringify({revision:preparedRevision,parts:state.parts,completedAt:new Date().toISOString()}));
    props.deleteProperty(PREP_BUILD_PROPERTY);
    return {done:true};
  }

  const name=ALLOWED_DATA_SHEETS[state.nextIndex];
  try{
    const context={books:{},maps:{},index:index||loadCacheIndex()};
    let result;
    try{result=getSecureSheetData(name,{username:'internal',role:'owner',rtms:['*']},'','',context);}
    catch(readErr){if(name==='All')throw readErr;result={ok:false,error:String(readErr.message||readErr)};}
    let sheet;
    if(!result.ok){
      if(name==='All')throw new Error(result.error||'All data could not be prepared');
      sheet={ok:false,error:String(result.error||'Sheet unavailable'),warnings:[]};
    }else{
      const columns=Array.from(new Set((result.columns||[]).concat(['_sourceFile','_sourceDate','RTM'])));
      const rows=Array.isArray(result.rows)?result.rows:[];
      sheet={ok:true,columns:columns,sourceColumns:result.sourceColumns||[],values:rows.map(row=>columns.map(c=>row[c]==null?'':row[c])),count:rows.length,warnings:result.warnings||[]};
    }
    const root=DriveApp.getFolderById(ROOT_FOLDER_ID),folder=getOrCreateCacheFolder(root);
    const fileName='gorilla-prepared-v3-'+preparedRevision.replace(/[^a-zA-Z0-9_-]/g,'').slice(0,32)+'-'+name+'.json';
    const partFile=folder.createFile(fileName,JSON.stringify({revision:preparedRevision,sheetName:name,sheet:sheet}),MimeType.PLAIN_TEXT);
    const oldPart=state.parts[name];state.parts[name]=partFile.getId();state.nextIndex++;
    try{props.setProperty(PREP_BUILD_PROPERTY,JSON.stringify(state));}
    catch(stateErr){state.nextIndex--;if(oldPart)state.parts[name]=oldPart;else delete state.parts[name];try{partFile.setTrashed(true)}catch(cleanupErr){}throw stateErr;}
    if(oldPart)try{DriveApp.getFileById(oldPart).setTrashed(true)}catch(err){}
    if(state.nextIndex<ALLOWED_DATA_SHEETS.length)return {done:false,nextSheet:ALLOWED_DATA_SHEETS[state.nextIndex]};

    const oldManifest=getPreparedPartsManifest_(null);
    props.setProperty(PREPARED_PARTS_PROPERTY,JSON.stringify({revision:preparedRevision,parts:state.parts,completedAt:new Date().toISOString()}));
    props.deleteProperty(PREP_BUILD_PROPERTY);
    if(oldManifest)Object.keys(oldManifest.parts).forEach(k=>{if(!Object.values(state.parts).includes(oldManifest.parts[k]))try{DriveApp.getFileById(oldManifest.parts[k]).setTrashed(true)}catch(err){}});
    return {done:true};
  }catch(err){
    Logger.log('Prepared sheet '+name+' failed: '+String(err.message||err));
    return {done:false,failed:true,error:'Preparation ('+name+'): '+String(err.message||err)};
  }
}

