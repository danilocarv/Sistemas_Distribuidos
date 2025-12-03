const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet'); // Segurança extra
const winston = require('winston'); // Monitoramento

// --- CONFIGURAÇÃO DE LOGS (MONITORAMENTO) ---
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

const app = express();
app.use(helmet()); // Proteção de headers HTTP
app.use(express.json());
app.use(cors({
  origin: '*', 
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware para logar todas as requisições (Monitoramento de Tráfego)
app.use((req, res, next) => {
  logger.info({ message: 'Request received', method: req.method, url: req.url, ip: req.ip });
  next();
});

const PORT = 3000; 
const MONGO_URL = process.env.MONGO_URL; 
const JWT_SECRET = process.env.JWT_SECRET || "seu_segredo_super_secreto_aqui";

if (!MONGO_URL) {
  logger.error("Erro fatal: MONGO_URL não foi definida no ambiente.");
  process.exit(1);
}

// --- Conexão com o MongoDB ---
mongoose.connect(MONGO_URL)
  .then(() => logger.info('User-service conectado ao MongoDB (Atlas).'))
  .catch(err => logger.error('Erro ao conectar ao MongoDB:', { error: err.message }));

// --- HEALTH CHECK (TOLERÂNCIA A FALHAS) ---
// O Docker ou AWS usa isso para saber se o serviço está "vivo"
app.get('/health', (req, res) => {
  const dbState = mongoose.connection.readyState; // 1 = conectado
  if (dbState === 1) {
    res.status(200).json({ status: 'UP', database: 'connected' });
  } else {
    res.status(500).json({ status: 'DOWN', database: 'disconnected' });
  }
});

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
app.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    }
    if (await User.findOne({ email })) {
      logger.warn(`Tentativa de registro duplicado: ${email}`);
      return res.status(400).json({ error: 'Este e-mail já está em uso.' });
    }
    const user = await User.create({ name, email, password });
    user.password = undefined;
    logger.info(`Novo usuário registrado: ${user.id}`);
    return res.status(201).json({ user });
  } catch (err) {
    logger.error("Erro no registro:", { error: err.message });
    return res.status(500).json({ error: 'Falha ao registrar usuário.' });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    }
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      logger.warn(`Login falhou (usuário não encontrado): ${email}`);
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      logger.warn(`Login falhou (senha incorreta): ${email}`);
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: '1d', 
    });
    user.password = undefined;
    logger.info(`Usuário logado com sucesso: ${user.id}`);
    return res.json({ user, token });
  } catch (err) {
    logger.error("Erro no login:", { error: err.message });
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

app.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    return res.json({ user });
  } catch (err) {
    logger.error("Erro ao buscar usuário:", { error: err.message });
    return res.status(500).json({ error: 'Falha ao buscar dados do usuário.' });
  }
});

app.listen(PORT, () => {
  logger.info(`User-service rodando na porta ${PORT}`);
});