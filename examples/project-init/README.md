# Task Tracker API

A simple task management REST API with JWT authentication.

## Features

- User registration and login
- CRUD operations for tasks
- Task assignment and status tracking
- JWT-based authentication

## Quick Start

```bash
npm install
npm run dev
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login user |
| GET | /api/tasks | List all tasks |
| POST | /api/tasks | Create task |
| PUT | /api/tasks/:id | Update task |
| DELETE | /api/tasks/:id | Delete task |

## Project Structure

```
src/
├── index.js          # Entry point
├── routes/           # API routes
│   ├── auth.js
│   └── tasks.js
├── middleware/       # Auth middleware
├── models/           # Data models
└── db/               # Database setup
```

## Testing

```bash
npm test
```