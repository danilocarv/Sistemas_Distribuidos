// backend/listas-service/index.js
const express = require('express');
const cors = require('cors');
const http = require('http');
const mongoose = require('mongoose');
const axios = require('axios');

const app = express();
app.use(express.json());
app.use(cors());
const server = http.createServer(app);
const PORT = 3001;
const MONGO_URL = process.env.MONGO_URL;

const ITENS_SERVICE_URL = 'http://itens-service:3002';

mongoose.connect(MONGO_URL)
  .then(() => console.log('Listas-service conectado ao MongoDB.'))
  .catch(err => console.error('Erro ao conectar ao MongoDB:', err));

const ListaSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  nome: { type: String, required: true }
});
const Lista = mongoose.model('Lista', ListaSchema);

const ItemSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  nome: { type: String, required: true },
  checked: { type: Boolean, default: false },
  listId: { type: String, required: true, index: true }
});

// --- A CORREÇÃO ESTÁ NESTA LINHA ---
// Verifica se o modelo 'Item' já existe antes de tentar criá-lo.
const Item = mongoose.models.Item || mongoose.model('Item', ItemSchema);
// ------------------------------------

app.get('/listas', async (req, res) => {
  try {
    const listasDoBanco = await Lista.find();
    const listasParaFrontend = listasDoBanco.map(lista => ({
      id: lista._id,
      nome: lista.nome
    }));
    res.json(listasParaFrontend);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar listas.' });
  }
});

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
    res.status(201).json({ id: novaLista._id, nome: novaLista.nome });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao criar lista.' });
  }
});

app.delete('/listas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Recebido pedido para deletar lista ${id}`);

    // Passo 1: Deleta a lista do banco de dados.
    const listaDeletada = await Lista.findByIdAndDelete(id);

    if (!listaDeletada) {
      // Se a lista nem existia, retorna um erro 404.
      return res.status(404).json({ message: 'Lista não encontrada.' });
    }

    console.log(`Lista ${id} deletada com sucesso do DB.`);

    // Passo 2: Tenta deletar os itens associados.
    // Envolvemos isso em um try...catch separado.
    try {
      await axios.delete(`${ITENS_SERVICE_URL}/items/by-list/${id}`);
      console.log(`Pedido de exclusão de itens para a lista ${id} enviado com sucesso.`);
    } catch (itemError) {
      // Se a exclusão dos itens falhar, apenas registramos o erro no log,
      // mas não consideramos a operação inteira um fracasso.
      console.error(`AVISO: A lista ${id} foi deletada, mas a exclusão dos itens falhou:`, itemError.message);
    }

    // Envia uma resposta de sucesso para o frontend, pois a operação principal funcionou.
    res.status(200).json({ message: 'Lista deletada com sucesso.' });

  } catch (error) {
    console.error(`Erro GERAL ao deletar lista:`, error);
    res.status(500).json({ message: 'Erro ao deletar a lista.' });
  }
});

server.listen(PORT, () => {
  console.log(`Serviço de Listas rodando na porta ${PORT}`);
});