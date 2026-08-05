terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# ─── HTTP API Gateway ────────────────────────────────────────────────────────
resource "aws_apigatewayv2_api" "main" {
  name          = "${var.project_name}-gateway"
  protocol_type = "HTTP"
  description   = "API Gateway for Identity Provider and Microservices"

  cors_configuration {
    allow_origins = ["*"] # Em produção, defina o domínio exato do frontend
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization"]
  }
}

# ─── JWT Authorizer ──────────────────────────────────────────────────────────
# Usa o JWKS exposto pelo nosso serviço de Autenticação (Node.js)
resource "aws_apigatewayv2_authorizer" "jwt" {
  api_id           = aws_apigatewayv2_api.main.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "${var.project_name}-jwt-authorizer"

  jwt_configuration {
    issuer   = var.jwt_issuer
    audience = [] # Pode ser configurado se a API validar Audience
  }

  authorizer_uri = var.jwks_uri
}

# ─── Integration: Auth Service (Public) ──────────────────────────────────────
resource "aws_apigatewayv2_integration" "auth_service" {
  api_id             = aws_apigatewayv2_api.main.id
  integration_type   = "HTTP_PROXY"
  integration_uri    = "${var.auth_service_url}/{proxy}"
  integration_method = "ANY"
}

# Rota pública para Autenticação (Login, Register, JWKS)
resource "aws_apigatewayv2_route" "auth_route" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "ANY /api/v1/auth/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.auth_service.id}"
  # Note: Sem authorization_type configurado (Pública)
}

# ─── Integration: Other Services (Protected) ─────────────────────────────────
resource "aws_apigatewayv2_integration" "other_service" {
  api_id             = aws_apigatewayv2_api.main.id
  integration_type   = "HTTP_PROXY"
  integration_uri    = "${var.other_service_url}/{proxy}"
  integration_method = "ANY"
}

# Rota protegida (Exemplo: Users API, Payments API)
resource "aws_apigatewayv2_route" "protected_route" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "ANY /api/v1/users/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.other_service.id}"

  # Exige o token JWT válido validado pelo Authorizer
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

# ─── Stage (Default) ─────────────────────────────────────────────────────────
resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "$default"
  auto_deploy = true
}
