const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Set up uploads directory
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Helper function to convert file path to URL path
function getFileUrl(filePath) {
  if (!filePath) return null;
  
  // Remove the initial part of the path up to 'uploads'
  const uploadIndex = filePath.indexOf('uploads');
  if (uploadIndex === -1) return filePath;
  
  // Format as a URL path
  return '/' + filePath.substring(uploadIndex);
}

// Set up storage for player photos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const playerDir = path.join(uploadDir, 'players');
    if (!fs.existsSync(playerDir)) {
      fs.mkdirSync(playerDir, { recursive: true });
    }
    cb(null, playerDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'player-' + uniqueSuffix + ext);
  }
});

// Set up storage for Aadhar photos
const aadharStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const aadharDir = path.join(uploadDir, 'aadhar');
    if (!fs.existsSync(aadharDir)) {
      fs.mkdirSync(aadharDir, { recursive: true });
    }
    cb(null, aadharDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'aadhar-' + uniqueSuffix + ext);
  }
});

// Configure multer for uploads
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

const aadharUpload = multer({
  storage: aadharStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Express middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'tournament-app-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }
}));

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Debug middleware for image requests
app.use((req, res, next) => {
  if (req.url.includes('/uploads/')) {
    console.log('Image requested:', req.url);
  }
  next();
});

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB Connected'))
.catch(err => console.log('MongoDB Connection Error:', err));

// Define MongoDB schemas
const TournamentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  venue: { type: String, required: true },
  description: { type: String },
  price: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const TeamRegistrationSchema = new mongoose.Schema({
  tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true },
  institutionName: { type: String, required: true },
  contactEmail: { type: String, required: true },
  contactPhone: { type: String, required: true },
  players: [{
    name: { type: String, required: true },
    dateOfBirth: { type: Date, required: true },
    schoolId: { type: String, required: true },
    parentEmail: { type: String, required: true },
    parentPhone: { type: String, required: true },
    aadharPhoto: { type: String }
  }],
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  registrationDate: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

const LeaderboardSchema = new mongoose.Schema({
  tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true },
  teamName: { type: String, required: true },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  points: { type: Number, default: 0 },
  pointsScored: { type: Number, default: 0 },
  pointsAgainst: { type: Number, default: 0 },
  rank: { type: Number },
  updatedAt: { type: Date, default: Date.now }
});

const MatchSchema = new mongoose.Schema({
  tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true },
  teamA: { type: String, required: true },
  teamB: { type: String, required: true },
  scoreA: { type: Number, default: 0 },
  scoreB: { type: Number, default: 0 },
  date: { type: Date, required: true },
  time: { type: String, required: true },
  venue: { type: String, required: true },
  winner: { type: String },
  status: { type: String, enum: ['upcoming', 'completed'], default: 'upcoming' },
  createdAt: { type: Date, default: Date.now }
});

const RegistrarSchema = new mongoose.Schema({
  schoolName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  authorizingPerson: { type: String, required: true },
  registrationDate: { type: Date, default: Date.now }
});

const PlayerSchema = new mongoose.Schema({
  registrarId: { type: mongoose.Schema.Types.ObjectId, ref: 'Registrar', required: true },
  name: { type: String, required: true },
  dateOfBirth: { type: Date, required: true },
  schoolId: { type: String, required: true },
  parentEmail: { type: String, required: true },
  parentPhone: { type: String, required: true },
  idCardPhoto: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// Create models
const Tournament = mongoose.model('Tournament', TournamentSchema);
const TeamRegistration = mongoose.model('TeamRegistration', TeamRegistrationSchema);
const Leaderboard = mongoose.model('Leaderboard', LeaderboardSchema);
const Match = mongoose.model('Match', MatchSchema);
const Registrar = mongoose.model('Registrar', RegistrarSchema);
const Player = mongoose.model('Player', PlayerSchema);

// Authentication middleware
const isAuthenticated = (req, res, next) => {
  if (req.session.registrarId) {
    return next();
  }
  res.redirect('/login');
};

// Helper functions for leaderboard
async function updateLeaderboardRanks(tournamentId) {
  try {
    const teams = await Leaderboard.find({ tournamentId })
      .sort({ points: -1, pointsScored: -1 });
    
    for (let i = 0; i < teams.length; i++) {
      await Leaderboard.findByIdAndUpdate(teams[i]._id, { rank: i + 1 });
    }
  } catch (err) {
    console.error('Error updating leaderboard ranks:', err);
  }
}

async function updateLeaderboard(match) {
  const winnerTeam = match.scoreA > match.scoreB ? match.teamA : match.teamB;
  const loserTeam = match.scoreA > match.scoreB ? match.teamB : match.teamA;
  
  const winnerPoints = match.scoreA > match.scoreB ? match.scoreA : match.scoreB;
  const loserPoints = match.scoreA > match.scoreB ? match.scoreB : match.scoreA;
  
  // Update winner stats
  let winner = await Leaderboard.findOne({ 
    tournamentId: match.tournamentId,
    teamName: winnerTeam
  });
  
  if (!winner) {
    winner = new Leaderboard({
      tournamentId: match.tournamentId,
      teamName: winnerTeam
    });
  }
  
  winner.wins += 1;
  winner.points += 2; // 2 points for a win in basketball
  winner.pointsScored += winnerPoints;
  winner.pointsAgainst += loserPoints;
  winner.updatedAt = Date.now();
  await winner.save();
  
  // Update loser stats
  let loser = await Leaderboard.findOne({ 
    tournamentId: match.tournamentId,
    teamName: loserTeam
  });
  
  if (!loser) {
    loser = new Leaderboard({
      tournamentId: match.tournamentId,
      teamName: loserTeam
    });
  }
  
  loser.losses += 1;
  loser.points += 1; // 1 point for a loss in basketball
  loser.pointsScored += loserPoints;
  loser.pointsAgainst += winnerPoints;
  loser.updatedAt = Date.now();
  await loser.save();
  
  // Update rankings
  await updateLeaderboardRanks(match.tournamentId);
}

// Basic routes
app.get('/', (req, res) => {
  res.render('index');
});
app.get('/about', (req, res) => {
  res.render('about');
});

app.get('/matches', (req, res) => {
  res.render('statistics');
});

app.get('/error', (req, res) => {
  res.render('error');
});

app.get('/admin', (req, res) => {
  res.render('admin');
});

app.get('/registrations', (req, res) => {
  res.render('registrations');
});

// Auth routes
app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const registrar = await Registrar.findOne({ email });
    if (!registrar) {
      return res.status(400).render('login', { 
        error: 'Invalid email or password',
        email
      });
    }

    const passwordMatch = await bcrypt.compare(password, registrar.password);
    if (!passwordMatch) {
      return res.status(400).render('login', { 
        error: 'Invalid email or password',
        email
      });
    }

    req.session.registrarId = registrar._id;
    req.session.schoolName = registrar.schoolName;
    
    res.redirect('/dashboard');
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).render('login', { 
      error: 'Login failed. Please try again.',
      email: req.body.email
    });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// Registration routes
app.get('/register', async (req, res) => {
  try {
    const upcomingTournaments = await Tournament.find({
      endDate: { $gte: new Date() }
    }).sort({ startDate: 1 });
    
    res.render('register', { tournaments: upcomingTournaments });
  } catch (err) {
    console.error('Error loading tournaments:', err);
    res.status(500).render('error', { message: 'Failed to load tournaments' });
  }
});

const playerUpload = upload.fields([{ name: 'playerIdPhotos', maxCount: 12 }]);

app.post('/register', playerUpload, async (req, res) => {
  try {
    const { schoolName, email, password, authorizingPerson, players } = req.body;

    const existingRegistrar = await Registrar.findOne({ email });
    if (existingRegistrar) {
      return res.status(400).render('register', { 
        error: 'Email already registered',
        formData: req.body
      });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const registrar = new Registrar({
      schoolName,
      email,
      password: hashedPassword,
      authorizingPerson
    });
    
    await registrar.save();

    if (players && Array.isArray(players)) {
      const playerObjects = [];
      
      let parsedPlayers = players;
      if (typeof players === 'string') {
        try {
          parsedPlayers = JSON.parse(players);
        } catch (e) {
          console.error('Error parsing players JSON:', e);
          parsedPlayers = [];
        }
      }
      
      const uploadedFiles = req.files ? req.files.playerIdPhotos || [] : [];
      
      for (let i = 0; i < parsedPlayers.length; i++) {
        const player = parsedPlayers[i];
        const playerObj = {
          registrarId: registrar._id,
          name: player.name,
          dateOfBirth: new Date(player.dateOfBirth),
          schoolId: player.schoolId,
          parentEmail: player.parentEmail,
          parentPhone: player.parentPhone
        };
        
        if (uploadedFiles[i]) {
          playerObj.idCardPhoto = getFileUrl(uploadedFiles[i].path);
        }
        
        playerObjects.push(playerObj);
      }
      
      if (playerObjects.length > 0) {
        await Player.insertMany(playerObjects);
      }
    }

    req.session.registrarId = registrar._id;
    req.session.schoolName = registrar.schoolName;
    
    res.redirect('/dashboard');
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).render('register', { 
      error: 'Registration failed. Please try again.',
      formData: req.body
    });
  }
});

// Team registration API
app.post('/api/team-registration', aadharUpload.array('aadharPhotos', 12), async (req, res) => {
  try {
    const { tournamentId, institutionName, contactEmail, contactPhone, playerData } = req.body;
    
    // Validate required fields
    if (!tournamentId || !institutionName || !contactEmail || !contactPhone) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Parse player data (it will come as a JSON string from the form)
    const players = JSON.parse(playerData);
    
    // Check if we have files
    const files = req.files || [];
    
    // Add file paths to player data - store the URL path not the file system path
    for (let i = 0; i < players.length && i < files.length; i++) {
      players[i].aadharPhoto = getFileUrl(files[i].path);
    }
    
    // Create team registration
    const registration = new TeamRegistration({
      tournamentId,
      institutionName,
      contactEmail,
      contactPhone,
      players,
      status: 'pending',
      registrationDate: new Date()
    });
    
    await registration.save();
    
    res.status(201).json({
      success: true,
      message: 'Registration submitted successfully',
      registrationId: registration._id
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed: ' + err.message });
  }
});

// Registration status update
app.put('/api/team-registration/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }
    
    const registration = await TeamRegistration.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    
    if (!registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }
    
    res.json({
      success: true,
      message: `Registration ${status} successfully`,
      registration
    });
  } catch (err) {
    console.error('Error updating registration status:', err);
    res.status(500).json({ error: 'Failed to update registration status' });
  }
});

// Registration API
app.get('/api/registrations', async (req, res) => {
  try {
    // Build query based on filters
    const query = {};
    
    if (req.query.tournamentId) {
      query.tournamentId = req.query.tournamentId;
    }
    
    if (req.query.status) {
      query.status = req.query.status;
    }
    
    // Find registrations and populate tournament information
    const registrations = await TeamRegistration.find(query)
      .populate('tournamentId', 'name')
      .sort({ createdAt: -1 });
    
    // Format the response to include tournament name
    const formattedRegistrations = registrations.map(reg => {
      const registration = reg.toObject();
      registration.tournamentName = reg.tournamentId ? reg.tournamentId.name : null;
      return registration;
    });
    
    res.json(formattedRegistrations);
  } catch (err) {
    console.error('Error fetching registrations:', err);
    res.status(500).json({ error: 'Failed to fetch registrations' });
  }
});

app.get('/api/registrations/:id', async (req, res) => {
  try {
    const registration = await TeamRegistration.findById(req.params.id)
      .populate('tournamentId', 'name');
    
    if (!registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }
    
    // Format the response
    const formattedRegistration = registration.toObject();
    formattedRegistration.tournamentName = registration.tournamentId ? registration.tournamentId.name : null;
    
    res.json(formattedRegistration);
  } catch (err) {
    console.error('Error fetching registration details:', err);
    res.status(500).json({ error: 'Failed to fetch registration details' });
  }
});

app.get('/api/tournament-registrations/:tournamentId', async (req, res) => {
  try {
    const registrations = await TeamRegistration.find({
      tournamentId: req.params.tournamentId
    }).sort({ createdAt: -1 });
    
    res.json(registrations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/registration/:id', async (req, res) => {
  try {
    const registration = await TeamRegistration.findById(req.params.id)
      .populate('tournamentId', 'name');
      
    if (!registration) {
      return res.status(404).render('error', { message: 'Registration not found' });
    }
    
    res.render('registration-details', { registration });
  } catch (err) {
    console.error('Error fetching registration:', err);
    res.status(500).render('error', { message: 'Failed to load registration details' });
  }
});

// Dashboard route
app.get('/dashboard', isAuthenticated, async (req, res) => {
  try {
    const registrar = await Registrar.findById(req.session.registrarId);
    const players = await Player.find({ registrarId: req.session.registrarId });
    
    res.render('dashboard', { 
      registrar,
      players
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).render('error', { message: 'Failed to load dashboard' });
  }
});

// Tournament API
app.post('/api/tournaments', async (req, res) => {
  try {
    const tournament = new Tournament(req.body);
    await tournament.save();
    res.status(201).json(tournament);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/tournaments', async (req, res) => {
  try {
    const tournaments = await Tournament.find().sort({ startDate: -1 });
    res.json(tournaments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tournaments/:id', async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    res.json(tournament);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/tournaments/:id', async (req, res) => {
  try {
    const tournament = await Tournament.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    res.json(tournament);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/tournaments/:id', async (req, res) => {
  try {
    const tournament = await Tournament.findByIdAndDelete(req.params.id);
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    res.json({ message: 'Tournament deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Match API
app.post('/api/matches', async (req, res) => {
  try {
    const match = new Match(req.body);
    await match.save();
    
    if (match.status === 'completed') {
      await updateLeaderboard(match);
    }
    
    res.status(201).json(match);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/matches/tournament/:tournamentId', async (req, res) => {
  try {
    const matches = await Match.find({ tournamentId: req.params.tournamentId }).sort({ date: -1 });
    res.json(matches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/matches/upcoming', async (req, res) => {
  try {
    const upcomingMatches = await Match.find({ status: 'upcoming' })
      .populate('tournamentId', 'name')
      .sort({ date: 1 });
    res.json(upcomingMatches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/matches/:id', async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }
    res.json(match);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/matches/:id', async (req, res) => {
  try {
    const match = await Match.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }
    
    if (match.status === 'completed') {
      await updateLeaderboard(match);
    }
    
    res.json(match);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/matches/:id', async (req, res) => {
  try {
    const match = await Match.findByIdAndDelete(req.params.id);
    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }
    res.json({ message: 'Match deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Leaderboard API
app.get('/api/leaderboard/:tournamentId', async (req, res) => {
  try {
    const leaderboard = await Leaderboard.find({ tournamentId: req.params.tournamentId })
      .sort({ points: -1, pointsScored: -1 });
    
    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/leaderboard', async (req, res) => {
  try {
    const { tournamentId, teamName, wins, losses, points, pointsScored, pointsAgainst } = req.body;
    
    if (!tournamentId || !teamName) {
      return res.status(400).json({ message: 'Tournament ID and team name are required' });
    }
    
    // Check if the tournament exists
    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }
    
    // Create new leaderboard entry
    const leaderboardEntry = new Leaderboard({
      tournamentId,
      teamName,
      wins: wins || 0,
      losses: losses || 0,
      points: points || 0,
      pointsScored: pointsScored || 0,
      pointsAgainst: pointsAgainst || 0
    });
    
    await leaderboardEntry.save();
    
    // Recalculate ranks for this tournament
    await updateLeaderboardRanks(tournamentId);
    
    res.status(201).json(leaderboardEntry);
  } catch (err) {
    console.error('Error creating leaderboard entry:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

app.post('/api/leaderboard/team', async (req, res) => {
  try {
    const team = new Leaderboard(req.body);
    await team.save();
    
    // Update rankings
    await updateLeaderboardRanks(team.tournamentId);
    
    res.status(201).json(team);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/leaderboard/team/:id', async (req, res) => {
  try {
    const team = await Leaderboard.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    res.json(team);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/leaderboard/team/:id', async (req, res) => {
  try {
    const team = await Leaderboard.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    
    // Update rankings
    await updateLeaderboardRanks(team.tournamentId);
    
    res.json(team);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/leaderboard/team/:id', async (req, res) => {
  try {
    const team = await Leaderboard.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    
    const tournamentId = team.tournamentId;
    await Leaderboard.findByIdAndDelete(req.params.id);
    
    // Update rankings
    await updateLeaderboardRanks(tournamentId);
    
    res.json({ message: 'Team deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Image debug route
app.get('/check-image/:path(*)', (req, res) => {
  const imagePath = path.join(__dirname, 'uploads', req.params.path);
  console.log('Checking image path:', imagePath);
  
  if (fs.existsSync(imagePath)) {
    res.json({ exists: true, path: imagePath });
  } else {
    res.json({ exists: false, path: imagePath });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});