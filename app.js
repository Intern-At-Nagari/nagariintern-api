const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;
const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/config/config.js')[env];

// Middleware
app.use(express.json()); // JSON parsing

const corsOptions = {
  origin: [
      'https://techfuture.my.id',
      'https://adminnagariintern-0e7da3590c83.herokuapp.com',
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5000',
      'http://localhost:5001',
      'http://localhost:4173',
      'http://10.44.10.80:4173/'


  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-access-token'],
  credentials: true,
  optionsSuccessStatus: 200
};

// Use CORS middleware with options
app.use(cors(corsOptions));

const indexRouter = require("./routes/intern");
const authRouter = require("./routes/auth");
const proxyRouter = require("./routes/proxy");
const superadminRouter = require("./routes/superAdmin");
const adminRouter = require("./routes/adminCabang"); 


  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

// Logging for debugging requests
app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  console.log('Origin:', req.headers.origin);
  next();
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'public/template'));

// Routes
const indexRouter = require('./routes/intern');
const authRouter = require('./routes/auth');
const proxyRouter = require('./routes/proxy');
const superadminRouter = require('./routes/superAdmin');
const adminRouter = require('./routes/adminCabang');

app.use('/', indexRouter);
app.use('/auth', authRouter);
app.use('/api', proxyRouter);
app.use('/admin', adminRouter);
app.use('/superadmin', superadminRouter);

// Root endpoint
app.get('/', (req, res) => {
  res.send('Hello, Express!');
});

// Start server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
