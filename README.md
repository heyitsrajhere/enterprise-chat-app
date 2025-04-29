# Enterprise Chat Application

A real-time chat application built with NestJS, TypeScript, and WebSocket for enterprise-level communication.

## Features

- 🔐 **Secure Authentication**

  - JWT-based authentication
  - Role-based access control (Admin, Moderator, User)
  - Organization-based user management

- 💬 **Real-time Messaging**

  - Private and group chats
  - Message encryption
  - Read receipts
  - Message reactions
  - Typing indicators

- 🏢 **Organization Management**

  - Multi-organization support
  - Organization-specific chat rooms
  - User role management

- 🔔 **Notifications**

  - Real-time notifications
  - Notification history
  - Read/unread status

- 🛠️ **Moderation Tools**
  - Message deletion (Moderator/Admin)
  - Room management
  - User management

## Tech Stack

- **Backend**

  - NestJS
  - TypeScript
  - TypeORM
  - PostgreSQL
  - Socket.IO
  - JWT Authentication

- **Security**
  - Message encryption
  - Rate limiting
  - Input validation
  - Role-based access control

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL
- Docker (optional)

## Installation

1. **Clone the repository**

```bash
git clone https://github.com/your-username/enterprise-chat-app.git
cd enterprise-chat-app
```

2. **Install dependencies**

```bash
npm install
```

3. **Environment Setup**

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_NAME=chat-app
JWT_SECRET=your_jwt_secret
ENCRYPTION_SECRET_KEY=your_encryption_key
```

4. **Database Setup**

```bash
# Using Docker
docker-compose up -d

# Or manually
# Create a PostgreSQL database named 'chat-app'
```

5. **Run the application**

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

## Docker Deployment

1. **Build and start containers**

```bash
docker-compose up --build
```

2. **Access the application**

- API: http://localhost:3000
- WebSocket: ws://localhost:3000

## API Documentation

### WebSocket Events

For detailed WebSocket event documentation, see [WEBSOCKET_EVENTS.md](WEBSOCKET_EVENTS.md).

### REST API Endpoints

#### Authentication

- `POST /auth/login` - User login
- `POST /auth/refresh` - Refresh token
- `POST /auth/logout` - User logout

#### Users

- `GET /users` - Get all users
- `GET /users/:id` - Get user by ID
- `PUT /users/:id` - Update user
- `DELETE /users/:id` - Delete user

#### Chat Rooms

- `POST /rooms` - Create room (Admin only)
- `GET /rooms` - Get all rooms
- `GET /rooms/:id` - Get room by ID
- `DELETE /rooms/:id` - Delete room (Admin only)

#### Messages

- `GET /messages` - Get messages
- `GET /messages/:id` - Get message by ID
- `DELETE /messages/:id` - Delete message (Moderator/Admin)

## Development

### Project Structure

```
src/
├── auth/           # Authentication module
├── chat/           # Chat module
├── config/         # Configuration and entities
├── notification/   # Notification module
├── user/           # User module
└── common/         # Common utilities and guards
```

### Code Style

- Follow NestJS best practices
- Use TypeScript strict mode
- Follow SOLID principles
- Write unit tests for new features

### Testing

```bash
# Unit tests
npm run test auth.service

```

## Security

- All messages are encrypted before storage
- JWT tokens are used for authentication
- Rate limiting is implemented
- Input validation is enforced
- Role-based access control is implemented

## Quick Start Guide

1. **Database Setup**

   - The application uses TypeORM with `synchronize: true`
   - Tables will be automatically created on first run
   - No manual database schema setup required

2. **Initial Setup**

   - Create a dummy organization with a name
   - Register a new user with the organization ID
   - Login with the created credentials
   - Update user role to admin in the database if needed

3. **Development Notes**
   - Database schema is automatically synchronized
   - All tables are created on application startup
   - No need for manual migrations in development
