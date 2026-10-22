# BlogSphere – Blog Platform with Comments

Full-stack blogging platform where users can register, write posts and comment.

**Stack:** Node.js · Express (REST API) · SQLite (better-sqlite3) · JWT auth · bcrypt · vanilla HTML/CSS/JS frontend

## Features
- User registration, login and JWT authentication
- Create, edit, delete blog posts (only the author can edit/delete)
- Comment section on every post (logged-in users comment; comment author or post author can delete)
- Search and pagination on the post list
- RESTful API with SQLite database (auto-created on first run)

## Run
```bash
npm install
npm start          # http://localhost:3000
```
Requires Node.js 18+. Optionally edit `.env` (set a strong `JWT_SECRET`).

## API
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | /api/auth/register | - | Register `{username, email, password}` |
| POST | /api/auth/login | - | Login `{email, password}` |
| GET | /api/auth/me | yes | Current user |
| GET | /api/posts?page=&q= | - | List/search posts |
| GET | /api/posts/:id | - | Single post |
| POST | /api/posts | yes | Create post `{title, content}` |
| PUT | /api/posts/:id | owner | Update post |
| DELETE | /api/posts/:id | owner | Delete post |
| GET | /api/posts/:id/comments | - | List comments |
| POST | /api/posts/:id/comments | yes | Add comment `{content}` |
| DELETE | /api/comments/:id | owner | Delete comment (comment/post owner) |

Send the token as `Authorization: Bearer <token>`.

## Structure
```
server/   index.js, db.js, middleware/auth.js, routes/{auth,posts,comments}.js
public/   index.html, styles.css, app.js   (single-page frontend)
```
