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
// In production, the Catalyst gateway injects CORS headers via console → Authentication → Whitelisting.
// Express must NOT set CORS headers for production origins — doing so causes duplicate header errors.
// For local dev (catalyst serve), the gateway is absent, so we set headers manually for localhost only.

app.use((req, res, next) => {
  const origin = req.headers.origin || "";
  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-TE-Token");
    if (req.method === "OPTIONS") return res.status(204).end();
  }
  next();
});

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
    const sessionRows = await zcql.executeZCQLQuery(
      `SELECT ROWID, userId FROM TeSessions WHERE sessionToken='${token}'`
    );
    if (!sessionRows || sessionRows.length === 0) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    const session = sessionRows[0].TeSessions;
    req.sessionRowId = session.ROWID;

    const userRows = await zcql.executeZCQLQuery(
      `SELECT ROWID, email, firstName, lastName FROM TeUsers WHERE ROWID='${session.userId}'`
    );
    if (!userRows || userRows.length === 0) {
      return res.status(401).json({ error: "User not found" });
    }
    const user = userRows[0].TeUsers;
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
    });

    // Store session separately so web + mobile can be logged in simultaneously
    const sessionsTable = catalystApp.datastore().table("TeSessions");
    await sessionsTable.insertRow({ userId: row.ROWID, sessionToken });

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

    // Generate a fresh session token and store it (web + mobile can be active simultaneously)
    const sessionToken = generateToken();
    const sessionsTable = catalystApp.datastore().table("TeSessions");
    await sessionsTable.insertRow({ userId: user.ROWID, sessionToken });

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
    const sessionsTable = catalystApp.datastore().table("TeSessions");
    await sessionsTable.deleteRow(req.sessionRowId);
    res.json({ success: true });
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ──────────── PASSWORD RESET ROUTES ────────────

// POST /auth/forgot-password
// Generates a 6-digit code, stores it with 1-hour expiry, and emails it to the user.
// NOTE: TeUsers table must have resetToken (Single Line) and resetTokenExpiry (Single Line) columns.
app.post("/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "email is required" });

    const catalystApp = catalyst.initialize(req);
    const zcql = catalystApp.zcql();

    const rows = await zcql.executeZCQLQuery(
      `SELECT ROWID, firstName FROM TeUsers WHERE email='${email}'`
    );

    // Always respond with success to avoid user enumeration attacks
    if (!rows || rows.length === 0) {
      return res.json({ success: true });
    }

    const user = rows[0].TeUsers;
    const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
    const expiry = (Date.now() + 60 * 60 * 1000).toString(); // 1 hour from now

    await zcql.executeZCQLQuery(
      `UPDATE TeUsers SET resetToken='${code}', resetTokenExpiry='${expiry}' WHERE ROWID='${user.ROWID}'`
    );

    // Send email via Catalyst mail service
    const mail = catalystApp.email();
    await mail.sendMail({
      from_email: "noreply@traceverything.app",
      to_email: [email],
      subject: "Your TracE password reset code",
      content: `Hi ${user.firstName},\n\nYour TracE password reset code is:\n\n  ${code}\n\nThis code expires in 1 hour. If you didn't request this, you can safely ignore this email.\n\n— The TracE team`,
      html_mode: false,
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /auth/reset-password
// Verifies the 6-digit code and updates the user's password.
app.post("/auth/reset-password", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: "email, code, and newPassword are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const catalystApp = catalyst.initialize(req);
    const zcql = catalystApp.zcql();

    const rows = await zcql.executeZCQLQuery(
      `SELECT ROWID, resetToken, resetTokenExpiry FROM TeUsers WHERE email='${email}'`
    );
    if (!rows || rows.length === 0) {
      return res.status(400).json({ error: "Invalid reset code" });
    }

    const user = rows[0].TeUsers;
    if (!user.resetToken || user.resetToken !== code) {
      return res.status(400).json({ error: "Invalid reset code" });
    }
    if (!user.resetTokenExpiry || Date.now() > parseInt(user.resetTokenExpiry, 10)) {
      return res.status(400).json({ error: "Reset code has expired. Please request a new one." });
    }

    const { salt, hash } = hashPassword(newPassword);
    await zcql.executeZCQLQuery(
      `UPDATE TeUsers SET passwordHash='${hash}', passwordSalt='${salt}', resetToken='', resetTokenExpiry='' WHERE ROWID='${user.ROWID}'`
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ──────────── CRUD ROUTES (protected) ────────────

app.post("/add", authMiddleware, async (req, res) => {
  try {
    const { itemType, itemTypeLevel, itemContent, status, createdDate } = req.body;

    const catalystApp = catalyst.initialize(req);
    const table = catalystApp.datastore().table("TeMain");

    const result = await table.insertRow({
      itemType,
      itemTypeLevel,
      itemContent,
      status,
      taskDate: createdDate,
      userId: String(req.userId),
    });

    res.json({ success: true, id: result.ROWID ?? result.rowId });
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

// ──────────────────────────────────────────────────────────────────
//  SCORE ROUTES
//  Rolling 7-day activity score (0–100) for user engagement tracking.
// ──────────────────────────────────────────────────────────────────

/** Format a Date as "YYYY-MM-DD" in local time */
function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * POST /score/calculate
 * Computes and persists the rolling 7-day activity score for the authenticated user.
 * Returns { score, tier, breakdown }.
 */
app.post("/score/calculate", authMiddleware, async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const zcql = catalystApp.zcql();
    const uid = String(req.userId);

    // ── Date window ──
    const now = new Date();
    const todayKey = toDateKey(now);

    const windowStartDate = new Date(now);
    windowStartDate.setDate(windowStartDate.getDate() - 6);
    const windowStartKey = toDateKey(windowStartDate);

    const threeDaysAgoDate = new Date(now);
    threeDaysAgoDate.setDate(threeDaysAgoDate.getDate() - 3);
    const threeDaysAgoKey = toDateKey(threeDaysAgoDate);

    // ── Fetch items in the 7-day window (paginated) ──
    const PAGE_SIZE = 300;
    let windowItems = [];
    let offset = 0;
    while (true) {
      const batch = await zcql.executeZCQLQuery(
        `SELECT ROWID, itemType, itemTypeLevel, status, taskDate FROM TeMain WHERE userId='${uid}' AND taskDate >= '${windowStartKey}' AND taskDate <= '${todayKey}' LIMIT ${offset},${PAGE_SIZE}`
      );
      const rows = batch.map(r => r.TeMain);
      windowItems = windowItems.concat(rows);
      if (rows.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    // ── Fetch stale pending tasks (pending for >3 days) ──
    let staleBatch = [];
    try {
      staleBatch = await zcql.executeZCQLQuery(
        `SELECT ROWID FROM TeMain WHERE userId='${uid}' AND itemType='Task' AND taskDate < '${threeDaysAgoKey}' AND (status='pending' OR status IS NULL)`
      );
    } catch (_) { /* ignore — table may have no matching rows */ }
    const staleTasks = staleBatch.length;

    // ── Score computation ──
    // Group window items by date for empty-day detection
    const taskDateSet = new Set();
    const foodDateSet = new Set();
    // Per-date meal tracking for full-meal-day bonus
    const mealsByDate = {}; // { "YYYY-MM-DD": Set<mealType> }

    let tasksAdded = 0;
    let tasksCompleted = 0;
    let highPriorityCompleted = 0;
    let goalsCompleted = 0;
    let foodLogged = 0;
    let fullMealDays = 0;
    let remindersCompleted = 0;
    let droppedTasks = 0;

    const MEAL_TYPES = new Set(["Breakfast", "Lunch", "Dinner", "Snacks"]);

    for (const item of windowItems) {
      const type = item.itemType;
      const status = item.status;
      const level = item.itemTypeLevel || "";
      const dateKey = (item.taskDate || "").substring(0, 10);

      if (type === "Task") {
        tasksAdded++;
        taskDateSet.add(dateKey);
        if (status === "completed") {
          if (level.toLowerCase() === "high") {
            highPriorityCompleted++;
          } else {
            tasksCompleted++;
          }
        }
        if (status === "dropped") droppedTasks++;
      } else if (type === "Food") {
        foodLogged++;
        foodDateSet.add(dateKey);
        // Track which meals logged per date
        if (MEAL_TYPES.has(level)) {
          if (!mealsByDate[dateKey]) mealsByDate[dateKey] = new Set();
          mealsByDate[dateKey].add(level);
        }
      } else if (type === "Goal") {
        if (status === "completed") goalsCompleted++;
      } else if (type === "Reminder") {
        if (status === "completed") remindersCompleted++;
      }
    }

    // Count full-meal days (all 4 meal types logged in a single day)
    for (const meals of Object.values(mealsByDate)) {
      if (meals.size === 4) fullMealDays++;
    }

    // Only penalise empty days that fall within the user's "active" period.
    // An active period starts from the earliest day the user had ANY item in the window,
    // so we don't punish someone for days before they started using the app consistently.
    const allActivityDates = new Set([...taskDateSet, ...foodDateSet]);
    let firstActiveDay = null;
    for (let i = 0; i < 7; i++) {
      const d = new Date(windowStartDate);
      d.setDate(d.getDate() + i);
      const dk = toDateKey(d);
      if (allActivityDates.has(dk)) { firstActiveDay = dk; break; }
    }

    let emptyTaskDays = 0;
    let emptyFoodDays = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(windowStartDate);
      d.setDate(d.getDate() + i);
      const dk = toDateKey(d);
      // Skip days before the user's first activity — don't penalise pre-adoption gaps
      if (firstActiveDay && dk < firstActiveDay) continue;
      if (!taskDateSet.has(dk)) emptyTaskDays++;
      if (!foodDateSet.has(dk)) emptyFoodDays++;
    }

    // Cap stale task penalty at 5 tasks max so old backlogs don't nuke the score
    const cappedStaleTasks = Math.min(staleTasks, 5);

    // ── Tally ──
    const totalPositive =
      (tasksAdded * 2) +
      (tasksCompleted * 5) +
      (highPriorityCompleted * 7) +
      (goalsCompleted * 10) +
      (foodLogged * 2) +
      (fullMealDays * 5) +
      (remindersCompleted * 3);

    const totalNegative =
      (emptyTaskDays * -5) +
      (emptyFoodDays * -3) +
      (cappedStaleTasks * -2) +
      (droppedTasks * -1);

    const score = Math.max(0, Math.min(100, 50 + totalPositive + totalNegative));

    // ── Tier ──
    let tier;
    if (score >= 80) tier = "On Fire";
    else if (score >= 60) tier = "Good";
    else if (score >= 40) tier = "Needs Work";
    else tier = "Slipping";

    const breakdown = {
      tasksAdded,
      tasksCompleted,
      highPriorityCompleted,
      goalsCompleted,
      foodLogged,
      fullMealDays,
      remindersCompleted,
      emptyTaskDays,
      emptyFoodDays,
      staleTasks: cappedStaleTasks,
      droppedTasks,
      totalPositive,
      totalNegative,
    };

    // ── Upsert into TeScoreLog ──
    try {
      const table = catalystApp.datastore().table("TeScoreLog");
      const existing = await zcql.executeZCQLQuery(
        `SELECT ROWID FROM TeScoreLog WHERE userId='${uid}' AND scoreDate='${todayKey}'`
      );
      if (existing && existing.length > 0) {
        const rowId = existing[0].TeScoreLog.ROWID;
        await table.updateRow({
          ROWID: rowId,
          score: String(score),
          breakdown: JSON.stringify(breakdown),
        });
      } else {
        await table.insertRow({
          userId: uid,
          scoreDate: todayKey,
          score: String(score),
          breakdown: JSON.stringify(breakdown),
        });
      }
    } catch (dbErr) {
      // Don't fail the whole request if persistence fails — still return computed score
      console.error("TeScoreLog upsert error:", dbErr.message);
    }

    res.json({ score, tier, breakdown });
  } catch (err) {
    console.error("score/calculate error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ──────────── TRAVEL ROUTES ────────────

/**
 * GET /travel/list
 * Returns all visited places for the authenticated user.
 * Kept separate from /listAll to avoid bloating the main sync.
 */
app.get("/travel/list", authMiddleware, async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const zcql = catalystApp.zcql();
    const uid = String(req.userId);

    const PAGE_SIZE = 300;
    let allItems = [];
    let offset = 0;
    while (true) {
      const batch = await zcql.executeZCQLQuery(
        `SELECT ROWID, itemContent, itemTypeLevel, taskDate, status FROM TeMain WHERE userId='${uid}' AND itemType='Travel' ORDER BY CREATEDTIME DESC LIMIT ${offset},${PAGE_SIZE}`
      );
      const rows = batch.map(r => r.TeMain);
      allItems = allItems.concat(rows);
      if (rows.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    const places = allItems.map(row => {
      const [lat, lng] = (row.itemTypeLevel || "0,0").split(",").map(Number);
      const [rawTitle, ...notesParts] = (row.itemContent || "").split("|||");
      const notes = notesParts.join("|||").trim();
      return {
        id: String(row.ROWID),
        title: rawTitle.trim() || "",
        address: rawTitle.trim() || "",
        latitude: lat || 0,
        longitude: lng || 0,
        visitDate: (row.taskDate || "").substring(0, 10),
        status: row.status || "visited",
        notes: notes || undefined,
      };
    });

    res.json({ places });
  } catch (err) {
    console.error("travel/list error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /score/history
 * Returns the last 7 daily score records for the authenticated user.
 */
app.get("/score/history", authMiddleware, async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const zcql = catalystApp.zcql();
    const uid = String(req.userId);

    const rows = await zcql.executeZCQLQuery(
      `SELECT ROWID, userId, scoreDate, score, breakdown FROM TeScoreLog WHERE userId='${uid}' ORDER BY scoreDate DESC LIMIT 7`
    );
    const history = (rows || []).map(r => r.TeScoreLog);
    res.json({ history });
  } catch (err) {
    console.error("score/history error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = app;
