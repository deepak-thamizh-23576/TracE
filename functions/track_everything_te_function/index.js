const express = require("express");
const catalyst = require("zcatalyst-sdk-node");
const cors = require("cors");
const crypto = require("crypto");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(express.json());

const upload = multer({ dest: "/tmp/te-uploads/" });

// ──────────── CORS ────────────

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    // Allow any localhost origin (any port) for local dev
    if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true);
    const allowed = [
      "https://trackeverythingte-904503171.development.catalystserverless.com"
    ];
    if (allowed.includes(origin)) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization", "X-TE-Token"]
}));

// ──────────── AUTH HELPERS ────────────

function hashPassword(password, salt) {
  if (!salt) salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
  return { salt, hash };
}

function verifyPassword(password, salt, storedHash) {
  const { hash } = hashPassword(password, salt);
  return hash === storedHash;
}

function generateToken() {
  return crypto.randomBytes(48).toString("hex");
}

/**
 * Auth middleware — checks Authorization header for a valid session token.
 * Sets req.userId and req.userEmail on success, returns 401 on failure.
 */
async function authMiddleware(req, res, next) {
  // Use X-TE-Token to avoid Catalyst platform intercepting the Authorization header
  // Also accept ?token= query param for browser contexts where headers can't be set (e.g. <img> src)
  const token = req.headers["x-te-token"] || req.query.token;
  if (!token) {
    return res.status(401).json({ error: "Missing X-TE-Token header" });
  }
  try {
    const catalystApp = catalyst.initialize(req);
    const zcql = catalystApp.zcql();
    const rows = await zcql.executeZCQLQuery(
      `SELECT ROWID, email, firstName, lastName FROM TeUsers WHERE sessionToken='${token}'`
    );
    if (!rows || rows.length === 0) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    const user = rows[0].TeUsers;
    req.userId = user.ROWID;
    req.userEmail = user.email;
    req.userFirstName = user.firstName;
    req.userLastName = user.lastName;
    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    return res.status(500).json({ error: "Authentication check failed" });
  }
}

// ──────────── AUTH ROUTES ────────────

app.post("/auth/signup", async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    if (!email || !password || !firstName) {
      return res.status(400).json({ error: "email, password, and firstName are required" });
    }

    const catalystApp = catalyst.initialize(req);
    const zcql = catalystApp.zcql();

    // Check if user already exists
    const existing = await zcql.executeZCQLQuery(
      `SELECT ROWID FROM TeUsers WHERE email='${email}'`
    );
    if (existing && existing.length > 0) {
      return res.status(409).json({ error: "A user with this email already exists" });
    }

    // Hash password and generate session token
    const { salt, hash } = hashPassword(password);
    const sessionToken = generateToken();

    // Insert into TeUsers table
    const table = catalystApp.datastore().table("TeUsers");
    const row = await table.insertRow({
      email,
      firstName,
      lastName: lastName || "",
      passwordHash: hash,
      passwordSalt: salt,
      sessionToken,
    });

    res.json({
      success: true,
      token: sessionToken,
      user: {
        id: row.ROWID,
        email,
        firstName,
        lastName: lastName || "",
      },
    });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const catalystApp = catalyst.initialize(req);
    const zcql = catalystApp.zcql();

    const rows = await zcql.executeZCQLQuery(
      `SELECT ROWID, email, firstName, lastName, passwordHash, passwordSalt FROM TeUsers WHERE email='${email}'`
    );
    if (!rows || rows.length === 0) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const user = rows[0].TeUsers;
    if (!verifyPassword(password, user.passwordSalt, user.passwordHash)) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Generate a fresh session token on each login
    const sessionToken = generateToken();
    await zcql.executeZCQLQuery(
      `UPDATE TeUsers SET sessionToken='${sessionToken}' WHERE ROWID='${user.ROWID}'`
    );

    res.json({
      success: true,
      token: sessionToken,
      user: {
        id: user.ROWID,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/auth/me", authMiddleware, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.userId,
      email: req.userEmail,
      firstName: req.userFirstName,
      lastName: req.userLastName,
    },
  });
});

app.post("/auth/logout", authMiddleware, async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const zcql = catalystApp.zcql();
    await zcql.executeZCQLQuery(
      `UPDATE TeUsers SET sessionToken='' WHERE ROWID='${req.userId}'`
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ──────────── CRUD ROUTES (protected) ────────────

app.post("/add", authMiddleware, async (req, res) => {
  try {
    const { itemType, itemTypeLevel, itemContent, status, createdDate } = req.body;

    const catalystApp = catalyst.initialize(req);
    const table = catalystApp.datastore().table("TeMain");

    await table.insertRow({
      itemType,
      itemTypeLevel,
      itemContent,
      status,
      taskDate: createdDate,
      userId: String(req.userId),
    });

    res.json({ success: true });
  } catch (err) {
    console.error("add error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/list", authMiddleware, async (req, res) => {
  const { itemType } = req.query;

  const catalystApp = catalyst.initialize(req);
  const zcql = catalystApp.zcql();

  const query = `
    SELECT * FROM TeMain WHERE itemType='${itemType}'
  `;
  const rows = await zcql.executeZCQLQuery(query);

  res.json(rows.map(r => r.TeMain));
});

// Single endpoint that returns ALL items + ALL delays in one request.
// Reduces mobile from 4+N calls to 1 call.
app.get("/listAll", authMiddleware, async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const zcql = catalystApp.zcql();
    const uid = String(req.userId);

    // ZCQL SELECT * is capped at 300 rows per query — paginate to get all rows.
    const PAGE_SIZE = 300;
    let allItems = [];
    let offset = 0;
    while (true) {
      const batch = await zcql.executeZCQLQuery(
        `SELECT * FROM TeMain WHERE userId='${uid}' OR userId IS NULL OR userId='' ORDER BY CREATEDTIME DESC LIMIT ${offset},${PAGE_SIZE}`
      );
      const rows = batch.map(r => r.TeMain);
      allItems = allItems.concat(rows);
      if (rows.length < PAGE_SIZE) break; // last page
      offset += PAGE_SIZE;
    }
    const items = allItems;

    // Fetch delays only for this user's items
    const itemIds = items.map(i => i.ROWID);
    let delays = [];
    if (itemIds.length > 0) {
      const delayRows = await zcql.executeZCQLQuery("SELECT * FROM TeTaskDelay");
      const allDelays = delayRows.map(r => r.TeTaskDelay);
      const idSet = new Set(itemIds.map(String));
      delays = allDelays.filter(d => idSet.has(String(d.TaskRowID)));
    }

    res.json({ items, delays });
  } catch (err) {
    console.error("listAll error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/update", authMiddleware, async (req, res) => {
  const { id, itemContent } = req.body;

  const catalystApp = catalyst.initialize(req);
  const zcql = catalystApp.zcql();

  await zcql.executeZCQLQuery(`
    UPDATE TeMain
    SET itemContent='${itemContent}'
    WHERE ROWID='${id}'
  `);

  res.json({ success: true });
});

app.post("/updateStatus", authMiddleware, async (req, res) => {
  const { id, status } = req.body;

  const catalystApp = catalyst.initialize(req);
  const zcql = catalystApp.zcql();

  await zcql.executeZCQLQuery(`
    UPDATE TeMain
    SET status='${status}'
    WHERE ROWID='${id}'
  `);

  res.json({ success: true });
});

app.post("/delete", authMiddleware, async (req, res) => {
  const { id } = req.body;

  const catalystApp = catalyst.initialize(req);
  const table = catalystApp.datastore().table("TeMain");

  await table.deleteRow(id);

  res.json({ success: true });
});

// ──────────── DELAY ROUTES (protected) ────────────

app.post("/addDelay", authMiddleware, async (req, res) => {
  const { taskRowId, delayInput, attachmentLink } = req.body;

  const catalystApp = catalyst.initialize(req);
  const table = catalystApp.datastore().table("TeTaskDelay");

  const row = await table.insertRow({
    TaskRowID: taskRowId,
    delayInput: delayInput,
    attachmentLink: attachmentLink || null,
  });

  res.json({ success: true, delay: row });
});

app.get("/listDelays", authMiddleware, async (req, res) => {
  try {
    const { TaskRowId } = req.query;

    if (!TaskRowId) {
      return res.status(400).json({ error: "TaskRowId query parameter is required" });
    }

    const catalystApp = catalyst.initialize(req);
    const zcql = catalystApp.zcql();

    const query = `SELECT * FROM TeTaskDelay WHERE TaskRowID=${TaskRowId}`;
    const rows = await zcql.executeZCQLQuery(query);

    res.json(rows.map(r => r.TeTaskDelay));
  } catch (err) {
    console.error("listDelays error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/updateDelay", authMiddleware, async (req, res) => {
  const { id, delayInput } = req.body;

  const catalystApp = catalyst.initialize(req);
  const zcql = catalystApp.zcql();

  await zcql.executeZCQLQuery(`
    UPDATE TeTaskDelay
    SET delayInput='${delayInput}'
    WHERE ROWID='${id}'
  `);

  res.json({ success: true });
});

app.post("/deleteDelay", authMiddleware, async (req, res) => {
  const { id } = req.body;

  const catalystApp = catalyst.initialize(req);
  const table = catalystApp.datastore().table("TeTaskDelay");

  await table.deleteRow(id);

  res.json({ success: true });
});

// ──────────── FORK DELAY AS TASK ────────────
// Creates a new task from a delay entry and links them bidirectionally.
// Requires columns: TeTaskDelay.forkedTaskId, TeMain.forkedFromTaskId

app.post("/forkDelay", authMiddleware, async (req, res) => {
  try {
    const { delayId, parentTaskId, targetDate, priority } = req.body;
    if (!delayId || !parentTaskId || !targetDate) {
      return res.status(400).json({ error: "delayId, parentTaskId, and targetDate are required" });
    }

    const catalystApp = catalyst.initialize(req);
    const zcql = catalystApp.zcql();
    const uid = String(req.userId);

    // 1. Fetch the delay to get its text
    const delayRows = await zcql.executeZCQLQuery(
      `SELECT ROWID, delayInput, forkedTaskId FROM TeTaskDelay WHERE ROWID='${delayId}'`
    );
    if (!delayRows || delayRows.length === 0) {
      return res.status(404).json({ error: "Delay not found" });
    }
    const delay = delayRows[0].TeTaskDelay;

    // Prevent double-forking
    if (delay.forkedTaskId) {
      return res.status(409).json({ error: "This delay has already been forked" });
    }

    // 2. Create a new task from the delay text
    const taskTable = catalystApp.datastore().table("TeMain");
    const newTask = await taskTable.insertRow({
      itemType: "Task",
      itemTypeLevel: priority || "Medium",
      itemContent: delay.delayInput,
      status: "pending",
      taskDate: targetDate,
      userId: uid,
      forkedFromTaskId: String(parentTaskId),
    });

    // 3. Update the delay to record the forked task ID
    const delayTable = catalystApp.datastore().table("TeTaskDelay");
    await delayTable.updateRow({
      ROWID: delayId,
      forkedTaskId: String(newTask.ROWID),
    });

    res.json({
      success: true,
      forkedTaskId: newTask.ROWID,
      taskTitle: delay.delayInput,
      targetDate,
    });
  } catch (err) {
    console.error("forkDelay error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ──────────── ONE-TIME MIGRATION: claim all unowned rows ────────────
// Call once after logging in to assign all legacy rows (no userId) to yourself.
// Safe to call multiple times — only touches rows where userId is empty/null.

app.post("/migrate/claimUnowned", authMiddleware, async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const zcql = catalystApp.zcql();
    const uid = String(req.userId);

    // Find all rows with no userId
    const rows = await zcql.executeZCQLQuery(
      `SELECT ROWID FROM TeMain WHERE userId IS NULL OR userId=''`
    );

    if (!rows || rows.length === 0) {
      return res.json({ success: true, updated: 0, message: "No unowned rows found" });
    }

    // Update each unowned row to belong to this user
    const table = catalystApp.datastore().table("TeMain");
    let updated = 0;
    for (const row of rows) {
      const rowId = row.TeMain.ROWID;
      await table.updateRow({ ROWID: rowId, userId: uid });
      updated++;
    }

    res.json({ success: true, updated, message: `Claimed ${updated} rows` });
  } catch (err) {
    console.error("Migration error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ──────────── STRATUS FILE UPLOAD ────────────

const BUCKET_NAME = "trackeverything";

app.post("/uploadAttachment", authMiddleware, upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file provided" });
  }

  const tmpPath = req.file.path;
  try {
    const catalystApp = catalyst.initialize(req, { scope: "admin" });
    const stratus = catalystApp.stratus();
    const bucket = stratus.bucket(BUCKET_NAME);

    const fileStream = fs.createReadStream(tmpPath);
    const ext = path.extname(req.file.originalname) || ".jpg";
    const objectName = `attachments/${req.userId}/${Date.now()}${ext}`;
    const result = await bucket.putObject(objectName, fileStream, {
      contentType: req.file.mimetype || "application/octet-stream",
    });

    // Clean up tmp file
    fs.unlink(tmpPath, () => {});

    if (!result) {
      return res.status(500).json({ error: "Upload to Stratus failed" });
    }

    // putObject returns true on success — construct the public URL from bucket details
    const bucketDetails = bucket.bucketDetails || {};
    const bucketUrl = bucketDetails.bucket_url || `https://stratus.zoho.com/b/catalyst/${BUCKET_NAME}`;
    const objectUrl = `${bucketUrl}/${objectName}`;
    res.json({ success: true, url: objectUrl, key: objectName });
  } catch (err) {
    console.error("uploadAttachment error:", err);
    fs.unlink(tmpPath, () => {});
    res.status(500).json({ error: err.message });
  }
});

// ──────────── STRATUS IMAGE PROXY ────────────
// Streams a stored attachment back to the client so the browser
// never needs direct (CORS-blocked) access to the Stratus URL.
app.get("/proxyAttachment", authMiddleware, async (req, res) => {
  let { key } = req.query;
  if (!key || typeof key !== "string") {
    return res.status(400).json({ error: "key required" });
  }

  // If a full URL was passed instead of a key, extract the object path
  if (key.startsWith("http")) {
    // Try to extract "attachments/..." from the URL
    const match = key.match(/\/(attachments\/.+?)(\?.*)?$/);
    if (match) {
      key = match[1];
    } else {
      return res.status(400).json({ error: "Could not extract key from URL" });
    }
  }

  try {
    const catalystApp = catalyst.initialize(req, { scope: "admin" });
    const stratus = catalystApp.stratus();
    const bucket = stratus.bucket(BUCKET_NAME);

    const stream = await bucket.getObject(key);
    console.log("[proxy] getObject key:", key, "bucketUrl:", bucket.bucketDetails?.bucket_url);
    if (!stream) {
      return res.status(404).json({ error: "Object not found" });
    }

    const ext = path.extname(key).toLowerCase();
    const mimeMap = { ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" };
    const contentType = mimeMap[ext] || "image/jpeg";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.setHeader("Access-Control-Allow-Origin", "*");

    if (typeof stream.pipe === "function") {
      stream.pipe(res);
    } else {
      // Some SDK versions return a Buffer directly
      res.end(stream);
    }
  } catch (err) {
    console.error("proxyAttachment error:", err.message, err.stack);
    res.status(500).json({ error: err.message });
  }
});

module.exports = app;
