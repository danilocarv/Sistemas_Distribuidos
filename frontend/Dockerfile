# frontend/Dockerfile

# Estágio 1: Build da aplicação React
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Estágio 2: Servir os arquivos estáticos com Nginx
FROM nginx:stable-alpine
COPY --from=build /app/build /usr/share/nginx/html
# A configuração do Nginx será gerenciada pelo nosso proxy principal
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]