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

mongoose.connect(MONGO_URL)
  .then(() => console.log('Listas-service conectado ao MongoDB.'))
  .catch(err => console.error('Erro ao conectar ao MongoDB:', err));

// --- Schema da Lista ---
const ListaSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  nome: { type: String, required: true }
});
const Lista = mongoose.model('Lista', ListaSchema);

// --- ADICIONADO: Schema do Item (para podermos deletar os itens junto com a lista) ---
const ItemSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  nome: { type: String, required: true },
  checked: { type: Boolean, default: false },
  listId: { type: String, required: true, index: true }
});
const Item = mongoose.model('Item', ItemSchema);
// ------------------------------------------------------------------------------------

// Rota para obter todas as listas
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
    res.status(201).json({ id: novaLista._id, nome: novaLista.nome });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao criar lista.' });
  }
});

// --- ADICIONADO: Nova rota DELETE para apagar a lista e seus itens ---
app.delete('/listas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Recebido pedido para deletar lista ${id}`);

    // Deleta a lista E todos os itens com o mesmo listId em paralelo
    const [listaDeletada, itensDeletados] = await Promise.all([
      Lista.findByIdAndDelete(id),
      Item.deleteMany({ listId: id })
    ]);

    if (!listaDeletada) {
      return res.status(404).json({ message: 'Lista não encontrada.' });
    }

    console.log(`Lista ${id} e ${itensDeletados.deletedCount} itens associados foram deletados.`);
    res.status(200).json({ message: 'Lista e itens deletados com sucesso.' });
  } catch (error) {
    console.error(`Erro ao deletar lista:`, error);
    res.status(500).json({ message: 'Erro ao deletar a lista.' });
  }
});
// ------------------------------------------------------------------

server.listen(PORT, () => {
  console.log(`Serviço de Listas rodando na porta ${PORT}`);
});