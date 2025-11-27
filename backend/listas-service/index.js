const express = require('express');
const cors = require('cors');
const http = require('http');
const mongoose = require('mongoose');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

// --- CORREÇÃO DE CORS ---
// Permite que o Frontend (localhost ou nuvem) faça requisições
app.use(cors({
  origin: '*', 
  allowedHeaders: ['Content-Type', 'Authorization']
}));

const server = http.createServer(app);
const PORT = 3001;
const MONGO_URL = process.env.MONGO_URL;
const JWT_SECRET = process.env.JWT_SECRET || "segredo_padrao_inseguro";
const ITENS_SERVICE_URL = process.env.ITENS_SERVICE_ENDPOINT || 'http://itens-service:3002';
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

mongoose.connect(MONGO_URL)
  .then(() => console.log('Listas-service conectado ao MongoDB.'))
  .catch(err => console.error('Erro ao conectar ao MongoDB:', err));

const ListaSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  nome: { type: String, required: true },
  ownerId: { type: String, required: true }
});
const Lista = mongoose.model('Lista', ListaSchema);

// --- MIDDLEWARE DE SEGURANÇA ---
const verificarToken = (req, res, next) => {
  const tokenHeader = req.headers['authorization'];
  
  // Logs para debug (pode remover depois se quiser)
  console.log(`[AUTH] Verificando rota: ${req.method} ${req.originalUrl}`);

  if (!tokenHeader) {
    console.log("[AUTH] Erro: Sem token.");
    return res.status(401).json({ message: 'Acesso negado. Token não fornecido.' });
  }

  const token = tokenHeader.startsWith('Bearer ') ? tokenHeader.slice(7, tokenHeader.length) : tokenHeader;

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      console.log("[AUTH] Erro: Token inválido.");
      return res.status(403).json({ message: 'Token inválido.' });
    }
    req.userId = decoded.id;
    next();
  });
};

// --- ROTAS (AGORA PADRONIZADAS PARA 'lists' EM INGLÊS) ---

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
    res.status(500).json({ message: 'Erro ao buscar listas.' });
  }
});

// 2. POST /api/lists
app.post('/api/lists', verificarToken, async (req, res) => {
  console.log("[API] Recebido pedido de criação de lista"); // Log para confirmar que chegou
  const { nome } = req.body;
  
  if (!nome) {
    return res.status(400).json({ message: 'O nome da lista é obrigatório.' });
  }

  try {
    const newListId = new Date().getTime().toString();
    const novaLista = new Lista({ _id: newListId, nome, ownerId: req.userId });
    
    // 1. Salva no Banco de Dados (MongoDB)
    await novaLista.save();
    console.log(`[API] Lista criada: ${nome} (ID: ${newListId})`);

    // --- GATILHO DE NOTIFICAÇÃO (NOVO) ---
    // Avisa o itens-service para emitir o Socket.io
    try {
      await axios.post(`${ITENS_SERVICE_URL}/internal/notify/list-created`, {
        id: novaLista._id,
        nome: novaLista.nome
      });
      console.log("[API] Notificação enviada para itens-service com sucesso.");
    } catch (notifyError) {
      // Se falhar a notificação, apenas logamos o erro. 
      // Não queremos travar a criação da lista só porque o socket falhou.
      console.error(`[AVISO] Falha ao notificar itens-service: ${notifyError.message}`);
    }
    // -------------------------------------

    res.status(201).json({ id: novaLista._id, nome: novaLista.nome });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erro ao criar lista.' });
  }
});

// 3. DELETE /api/lists/:id
app.delete('/api/lists/:id', verificarToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 1. Verifica se a lista existe e pertence ao usuário
    const lista = await Lista.findOne({ _id: id, ownerId: req.userId });
    
    if (!lista) {
      return res.status(404).json({ message: 'Lista não encontrada ou sem permissão.' });
    }

    // 2. Tenta deletar os itens associados (COM RETRY - Tolerância a Falhas)
    let tentativas = 3;
    let sucessoItens = false;

    while (tentativas > 0 && !sucessoItens) {
        try {
            await axios.delete(`${ITENS_SERVICE_URL}/api/items/by-list/${id}`);
            sucessoItens = true;
        } catch (err) {
            console.warn(`[Tentativa ${4 - tentativas}/3] Falha ao contatar itens-service para deletar itens...`);
            tentativas--;
            if (tentativas > 0) await sleep(1000); // Espera 1 segundo antes de tentar de novo
        }
    }

    if (!sucessoItens) {
        // Loga o erro crítico, mas prossegue para deletar a lista (Decisão de projeto: priorizar a ação do usuário)
        console.error(`ERRO: Não foi possível limpar os itens da lista ${id} após 3 tentativas.`);
    }

    // 3. Deleta a lista do banco local
    await Lista.findByIdAndDelete(id);

    // 4. --- GATILHO DE NOTIFICAÇÃO (NOVO) ---
    // Avisa o itens-service para remover a lista da tela de quem estiver vendo
    try {
      await axios.post(`${ITENS_SERVICE_URL}/internal/notify/list-deleted`, { id });
      console.log("[API] Notificação de deleção enviada para itens-service.");
    } catch (notifyError) {
      console.error(`[AVISO] Falha ao notificar via socket: ${notifyError.message}`);
    }
    // ----------------------------------------

    res.status(200).json({ message: 'Lista deletada com sucesso.' });

  } catch (error) {
    console.error(`Erro ao deletar lista:`, error);
    res.status(500).json({ message: 'Erro ao deletar a lista.' });
  }
});

server.listen(PORT, () => {
  console.log(`Serviço de Listas rodando na porta ${PORT}`);
});