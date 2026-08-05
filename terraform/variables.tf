variable "aws_region" {
  description = "The AWS region to deploy to"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name for tagging and resource naming"
  type        = string
  default     = "authentication-api"
}

variable "auth_service_url" {
  description = "The URL of the Authentication Service (EC2 or ALB endpoint)"
  type        = string
  # Example: "http://ec2-xx-xx-xx-xx.compute-1.amazonaws.com:3000"
}

variable "other_service_url" {
  description = "The URL of a dummy internal service to demonstrate protected routes"
  type        = string
  default     = "http://example.com" # Replace with actual service endpoint
}

variable "jwks_uri" {
  description = "The JWKS endpoint of the Auth Service"
  type        = string
  # Example: "http://ec2-xx-xx-xx-xx.compute-1.amazonaws.com:3000/api/v1/auth/.well-known/jwks.json"
}

variable "jwt_issuer" {
  description = "The issuer expected in the JWT token"
  type        = string
  default     = "authentication-api"
}
