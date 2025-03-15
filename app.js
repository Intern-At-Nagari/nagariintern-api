const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;
const path = require('path');

const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/config/config.js')[env];


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



// Middleware to parse JSON bodies
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'public/template'));

app.get('/', (req, res) => {
  res.send('Hello, Express!');
});

// API routes
app.use("/", indexRouter);
app.use("/auth", authRouter);
app.use("/api", proxyRouter);
app.use("/admin", adminRouter);
app.use("/superadmin", superadminRouter);

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});