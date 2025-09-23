# backend/Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copia os arquivos de dependências e instala
COPY package*.json ./
RUN npm install

# Copia o resto do código da aplicação
COPY . .

# Expõe a porta que o servidor usa
EXPOSE 5000

# Comando para iniciar a aplicação
CMD ["npm", "start"]