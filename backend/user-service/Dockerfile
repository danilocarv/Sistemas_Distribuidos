# Usar uma imagem base do Node.js
FROM node:18-alpine

# Definir o diretório de trabalho dentro do container
WORKDIR /app

# Copiar o package.json e package-lock.json
COPY package*.json ./

# Instalar as dependências
# Usamos --only=production para não instalar o nodemon na imagem final
# Mas para desenvolvimento (com volumes) o nodemon local será usado.
RUN npm install --only=production

# Copiar o restante dos arquivos da aplicação
COPY . .

# Expor a porta que o serviço vai rodar
EXPOSE 3000

# Comando para iniciar a aplicação
CMD [ "npm", "start" ]