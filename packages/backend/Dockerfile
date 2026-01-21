FROM node:18-alpine

WORKDIR /app

# Copiar archivos de dependencias
COPY package.json ./


# Instalar dependencias
RUN npm install --omit=dev

# Copiar código fuente
COPY . .

# Compilar TypeScript
RUN npm run build

# Exponer puerto
EXPOSE 3001

# Comando de inicio
CMD ["npm", "run", "start"]
