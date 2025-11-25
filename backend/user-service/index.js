const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors({
  origin: '*', 
  allowedHeaders: ['Content-Type', 'Authorization']
}));

const PORT = 3000; // A porta é fixa em 3000, como definido no Nginx/Docker
const MONGO_URL = process.env.MONGO_URL; // VEM DO DOCKER-COMPOSE.YML
const JWT_SECRET = process.env.JWT_SECRET || "seu_segredo_super_secreto_aqui";

if (!MONGO_URL) {
  console.error("Erro fatal: MONGO_URL não foi definida no ambiente.");
  process.exit(1);
}

// --- Conexão com o MongoDB ---
mongoose.connect(MONGO_URL)
  .then(() => console.log('User-service conectado ao MongoDB (Atlas).'))
  .catch(err => console.error('Erro ao conectar ao MongoDB:', err));

// --- Modelo de Usuário (Schema) ---
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, select: false }, 
}, { timestamps: true });

UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

const User = mongoose.model('User', UserSchema);

// --- Rotas de Autenticação ---
// O Nginx vai traduzir /api/auth/register para /register
app.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    }
    if (await User.findOne({ email })) {
      return res.status(400).json({ error: 'Este e-mail já está em uso.' });
    }
    const user = await User.create({ name, email, password });
    user.password = undefined;
    return res.status(201).json({ user });
  } catch (err) {
    console.error("Erro no registro:", err);
    return res.status(500).json({ error: 'Falha ao registrar usuário.' });
  }
});

// O Nginx vai traduzir /api/auth/login para /login
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    }
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: '1d', // Expira em 1 dia
    });
    user.password = undefined;
    return res.json({ user, token });
  } catch (err) {
    console.error("Erro no login:", err);
    return res.status(500).json({ error: 'Falha ao fazer login.' });
  }
});

// --- Middleware de Verificação de Token ---
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Nenhum token fornecido.' });
  }
  const parts = authHeader.split(' ');
  if (parts.length !== 2) {
    return res.status(401).json({ error: 'Erro no formato do token.' });
  }
  const [ scheme, token ] = parts;
  if (!/^Bearer$/i.test(scheme)) {
    return res.status(401).json({ error: 'Token mal formatado.' });
  }
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Token inválido.' });
    }
    req.userId = decoded.id;
    return next();
  });
};

// O Nginx vai traduzir /api/auth/me para /me
app.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    return res.json({ user });
  } catch (err) {
    console.error("Erro ao buscar usuário:", err);
    return res.status(500).json({ error: 'Falha ao buscar dados do usuário.' });
  }
});

app.listen(PORT, () => {
  console.log(`User-service rodando na porta ${PORT}`);
});