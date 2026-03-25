
---


````md id="acadomi-final-flow-v4"
# Project: Acadomi - AI Learning Platform (Final UI + Flow + System)

---

## 🎯 Objective

Build a complete AI-powered learning system where:

1. User logs in / signs up
2. Uploads study material
3. A session is created
4. AI teaches in real-time
5. User interacts + focus is monitored
6. Session generates notes, bookmarks, and cheat sheets

👉 Experience:
"Feels like sitting with a real teacher"

---

# 🔐 AUTH SYSTEM

---

## 🧾 Signup Page
- Name
- Email
- Password
- Confirm Password

Validation:
- Strong password
- Valid email
-stores hash password

---

## 🔑 Login Page
- Email
- Password
- JWT-based authentication
- HTTP-only cookies

---

# 🧠 CORE USER FLOW (VERY IMPORTANT)

---

## FLOW 1: AI TEACHING SESSION

### Step 1 → Upload Content

## 📂 TAB 1: Upload Page

### Purpose
Start a learning session

### UI
- Drag & Drop upload
- Accept:
  - PDF (slides)
  - Images
  - Audio
- File preview
- Submit button

---

### ⚠️ IMPORTANT BEHAVIOR

👉 User uploads file  
👉 Clicks **Submit**  
👉 System creates a SESSION

API:
`POST /api/session/create`

---

---

## Step 2 → Session Starts

## 🎓 TAB 2: Session Room (CORE PAGE)

### Purpose
Main learning interface

---

## 🧩 Layout

| Section | Function |
|--------|--------|
| Left | Concepts |
| Center | AI Teacher |
| Right | Tools |

---

## 🧑‍🏫 AI Teacher (CENTER)

- Chat interface
- User asks questions
- AI responds from uploaded content

API:
`POST /api/ai/respond`

---

## 📚 Concepts Panel (LEFT)

- Extracted concepts list
- Click → AI explains

---

## 🧠 Focus Mode (INTEGRATED INSIDE SESSION)

### ❗ IMPORTANT DESIGN CHANGE

Focus Mode is NOT a separate tab

👉 It runs automatically during session

---

### UI Placement
- Top-right mini panel OR overlay

---

### Features
- Webcam preview
- Status:
  - Focused
  - Distracted

---

### Behavior
- Runs continuously during session
- Logs attention data

API:
`POST /api/focus/log`

---

---

## 🔖 Bookmarks (INSIDE SESSION)

### Purpose
Save important points during learning

---

### UI
- Bookmark icon next to each AI message
- Click → save

---

### Behavior
- Stores:
  - AI response
  - Timestamp
  - Session ID

---

### After Session Ends

👉 All bookmarks become **Session Notes**

---

---

## 📝 Session Notes (AUTO GENERATED)

### ❗ IMPORTANT FEATURE

After session ends:

👉 System compiles:
- Bookmarks
- Important AI responses

👉 Saves as structured notes

---

## 📄 TAB 3: Notes Page

### Purpose
View notes of past sessions

### UI
- List of sessions
- Click → view notes

---

---

## 📄 Cheat Sheet Generation

### Inside Notes Page

- Button: "Generate Cheat Sheet"

---

### Output
- Bullet summaries
- Flashcards

API:
`POST /api/cheatsheet`

---

---

# 🧠 FLOW 2: ROLE REVERSAL MODE (SEPARATE FLOW)

---

## 🔁 TAB 4: Role Reversal Page

### Purpose
User teaches AI

---

### UI
- Upload audio OR record voice
- Submit button

---

### Flow

1. User uploads explanation
2. AI analyzes
3. Returns feedback

---

### Output UI
- Correct points
- Mistakes
- Suggestions

API:
`POST /api/role-reversal/analyze`

---

---

# 👥 OPTIONAL FLOW: GROUP SESSION

---

## 👥 TAB 5: Group Session Page

- Invite code
- Participants
- Shared AI responses

---

# 🎧 PODCAST MODE (OPTIONAL INSIDE SESSION)

---

## 🎧 Feature (Inside Session or Notes)

- Convert notes → audio
- Play / Pause

API:
`POST /api/podcast`

---

---

# ⚙️ DATABASE DESIGN (MongoDB)

---

## Users
```json
{
  "_id": "ObjectId",
  "name": "string",
  "email": "string",
  "password": "hashed"
}
````

---

## Sessions

```json
{
  "_id": "ObjectId",
  "userId": "ObjectId",
  "materials": ["file URLs"],
  "concepts": [],
  "createdAt": "date"
}
```

---

## Bookmarks

```json
{
  "_id": "ObjectId",
  "sessionId": "ObjectId",
  "content": "AI response",
  "timestamp": "date"
}
```

---

## Notes (IMPORTANT NEW COLLECTION)

```json
{
  "_id": "ObjectId",
  "sessionId": "ObjectId",
  "content": "compiled notes",
  "generatedAt": "date"
}
```

---

## Focus Logs

```json
{
  "_id": "ObjectId",
  "sessionId": "ObjectId",
  "status": "focused/distracted",
  "timestamp": "date"
}
```

---

## Role Reversal

```json
{
  "_id": "ObjectId",
  "userId": "ObjectId",
  "audioUrl": "string",
  "feedback": {
    "correct": [],
    "mistakes": [],
    "suggestions": []
  }
}
```

---

# 🔐 SECURITY (VERY IMPORTANT)

---

## Authentication

* JWT (HTTP-only cookies)
* bcrypt password hashing

---

## Input Security

* Sanitize all inputs
* Prevent:

  * XSS
  * NoSQL injection
  * Prompt injection

---

## File Upload Security

* Restrict file types
* Limit size
* Scan files

---

## API Security

* Rate limiting
* Validation (Joi/Zod)
* Auth middleware

---

## General

* HTTPS
* Helmet.js
* CORS protection

---

# 🎨 DESIGN SYSTEM

---

## Theme

* Dark + Light
* Indigo / Purple gradient

---

## UI Style

* Glassmorphism
* Rounded corners (2xl)
* Soft shadows

---

# ⚙️ TECH STACK

---

Frontend:

* React + Tailwind

Backend:

* Node.js + Express

Database:

* MongoDB

---
keep in midn the exsisting thing u have done of focus montior and session creation dont change the python part and the ui of focus montior and session creation if some thing is to be change the change it in a way that it enhance the user experience and make it more interactive and user friendly and more beautiful followint the theme of the whole project and one thing more the acadomi is the website name and the logo is also in the folder name logo1.png 


# ✨ UX REQUIREMENTS

* AI typing animation
* Smooth transitions
* Real-time feel

---

# 🔥 EXPERIENCE GOAL

👉 "I uploaded notes → AI started teaching me instantly"

---

# 📌 FINAL INSTRUCTION

This is:

❌ NOT a dashboard
✅ A LIVE AI TEACHING SYSTEM

Focus on:

* Flow clarity
* Real-time interaction
* Clean UI
* Strong integration between features

