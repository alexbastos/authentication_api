#!/bin/bash
# Script de conveniência para fazer o deploy passando as informações do Git

echo "🚀 Iniciando processo de deploy..."

# Atualiza o código
echo "📦 Baixando últimas alterações do Git..."
git pull

# Captura as informações do Git
export GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
export GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
export BUILD_DATE="$(date '+%d/%m/%Y %H:%M:%S')"

echo "🏷️  Versão: Branch ($GIT_BRANCH) | Commit ($GIT_COMMIT)"

# Roda o docker-compose
echo "🐳 Reiniciando containers (build)..."
docker-compose down
docker-compose up -d --build

echo "✅ Deploy concluído!"
