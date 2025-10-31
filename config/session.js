const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const pool = require("./db");

const sessionMiddleware = session({
  store: new pgSession({
    pool,
    tableName: "session",
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET || 'myTempSecret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, 
    httpOnly: true,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24, 
  },
});

module.exports = sessionMiddleware;
