const express = require('express');
const cors = require('cors');
const http = require('http');
const mongoose = require('mongoose');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const winston = require('winston');

// --- CONFIGURAÇÃO DE LOGS ---
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()]
});

const app = express();
app.use(helmet());
app.use(express.json());

app.use(cors({
  origin: '*', 
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware de Log
app.use((req, res, next) => {
  logger.info({ message: 'Request received', method: req.method, url: req.url });
  next();
});

const server = http.createServer(app);
const PORT = 3001;
const MONGO_URL = process.env.MONGO_URL;
const JWT_SECRET = process.env.JWT_SECRET || "segredo_padrao_inseguro";
const ITENS_SERVICE_URL = process.env.ITENS_SERVICE_ENDPOINT || 'http://itens-service:3002';
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

mongoose.connect(MONGO_URL)
  .then(() => logger.info('Listas-service conectado ao MongoDB.'))
  .catch(err => logger.error('Erro ao conectar ao MongoDB:', { error: err.message }));

// --- HEALTH CHECK ---
app.get('/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  if (dbState === 1) {
    res.status(200).json({ status: 'UP', service: 'listas-service' });
  } else {
    res.status(500).json({ status: 'DOWN', error: 'Database disconnected' });
  }
});

const ListaSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  nome: { type: String, required: true },
  ownerId: { type: String, required: true }
});
const Lista = mongoose.model('Lista', ListaSchema);

// --- MIDDLEWARE DE SEGURANÇA ---
const verificarToken = (req, res, next) => {
  const tokenHeader = req.headers['authorization'];
  
  if (!tokenHeader) {
    logger.warn("Acesso negado: Sem token.");
    return res.status(401).json({ message: 'Acesso negado. Token não fornecido.' });
  }

  const token = tokenHeader.startsWith('Bearer ') ? tokenHeader.slice(7, tokenHeader.length) : tokenHeader;

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      logger.warn("Acesso negado: Token inválido.");
      return res.status(403).json({ message: 'Token inválido.' });
    }
    req.userId = decoded.id;
    next();
  });
};

// --- ROTAS ---

// 1. GET /api/lists
app.get('/api/lists', verificarToken, async (req, res) => {
  try {
    const listasDoBanco = await Lista.find({ ownerId: req.userId });
    const listasParaFrontend = listasDoBanco.map(lista => ({
      id: lista._id,
      nome: lista.nome
    }));
    res.json(listasParaFrontend);
  } catch (error) {
    logger.error("Erro ao buscar listas", { error: error.message });
    res.status(500).json({ message: 'Erro ao buscar listas.' });
  }
});

// 2. POST /api/lists
app.post('/api/lists', verificarToken, async (req, res) => {
  const { nome } = req.body;
  if (!nome) {
    return res.status(400).json({ message: 'O nome da lista é obrigatório.' });
  }

  try {
    const newListId = new Date().getTime().toString();
    const novaLista = new Lista({ _id: newListId, nome, ownerId: req.userId });
    
    await novaLista.save();
    logger.info(`Lista criada`, { listId: newListId, owner: req.userId });

    // Notificação (Tenta, mas não falha a requisição se der erro)
    try {
      await axios.post(`${ITENS_SERVICE_URL}/internal/notify/list-created`, {
        id: novaLista._id,
        nome: novaLista.nome
      });
    } catch (notifyError) {
      logger.warn(`Falha ao notificar itens-service`, { error: notifyError.message });
    }

    res.status(201).json({ id: novaLista._id, nome: novaLista.nome });

  } catch (error) {
    logger.error("Erro ao criar lista", { error: error.message });
    res.status(500).json({ message: 'Erro ao criar lista.' });
  }
});

// 3. DELETE /api/lists/:id
app.delete('/api/lists/:id', verificarToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const lista = await Lista.findOne({ _id: id, ownerId: req.userId });
    if (!lista) {
      return res.status(404).json({ message: 'Lista não encontrada ou sem permissão.' });
    }

    // --- LÓGICA DE RETRY (TOLERÂNCIA A FALHAS) ---
    // Essencial para o requisito de Recuperação Automática
    let tentativas = 3;
    let sucessoItens = false;

    while (tentativas > 0 && !sucessoItens) {
        try {
            await axios.delete(`${ITENS_SERVICE_URL}/api/items/by-list/${id}`);
            sucessoItens = true;
            logger.info(`Itens da lista ${id} deletados com sucesso.`);
        } catch (err) {
            tentativas--;
            logger.warn(`Falha na comunicação com itens-service. Tentativas restantes: ${tentativas}`, { listId: id });
            if (tentativas > 0) await sleep(1000); 
        }
    }

    if (!sucessoItens) {
        logger.error(`CRÍTICO: Inconsistência. Lista ${id} será deletada, mas itens podem ter ficado órfãos.`, { listId: id });
        // Em um sistema real, aqui você enviaria para uma "Dead Letter Queue"
    }

    await Lista.findByIdAndDelete(id);

    try {
      await axios.post(`${ITENS_SERVICE_URL}/internal/notify/list-deleted`, { id });
    } catch (notifyError) {
      logger.warn(`Falha ao notificar socket de deleção`, { error: notifyError.message });
    }

    res.status(200).json({ message: 'Lista deletada com sucesso.' });

  } catch (error) {
    logger.error(`Erro fatal ao deletar lista`, { error: error.message, listId: req.params.id });
    res.status(500).json({ message: 'Erro ao deletar a lista.' });
  }
});

server.listen(PORT, () => {
  logger.info(`Serviço de Listas rodando na porta ${PORT}`);
});