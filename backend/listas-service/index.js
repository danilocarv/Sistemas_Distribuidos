// backend/listas-service/index.js
const express = require('express');
const cors = require('cors');
const http = require('http');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());
app.use(cors());
const server = http.createServer(app);
const PORT = 3001;
const MONGO_URL = process.env.MONGO_URL;

// --- Configuração do MongoDB ---
mongoose.connect(MONGO_URL)
  .then(() => console.log('Listas-service conectado ao MongoDB.'))
  .catch(err => console.error('Erro ao conectar ao MongoDB:', err));

const ListaSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  nome: { type: String, required: true }
});
const Lista = mongoose.model('Lista', ListaSchema);
// -----------------------------

// Rota para obter todas as listas
app.get('/listas', async (req, res) => {
  try {
    const listasDoBanco = await Lista.find();
    
    // Transforma os dados para o formato que o frontend espera (_id -> id)
    const listasParaFrontend = listasDoBanco.map(lista => ({
      id: lista._id,
      nome: lista.nome
    }));

    res.json(listasParaFrontend);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar listas.' });
  }
});

// Rota para criar uma nova lista
app.post('/listas', async (req, res) => {
  const { nome } = req.body;
  if (!nome) {
    return res.status(400).json({ message: 'O nome da lista é obrigatório.' });
  }
  try {
    const newListId = new Date().getTime().toString();
    const novaLista = new Lista({ _id: newListId, nome });
    await novaLista.save();
    console.log(`Lista criada: ${nome} (ID: ${newListId})`);
    // Retorna o objeto no mesmo formato que o GET, para consistência
    res.status(201).json({ id: novaLista._id, nome: novaLista.nome });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao criar lista.' });
  }
});

server.listen(PORT, () => {
  console.log(`Serviço de Listas rodando na porta ${PORT}`);
});