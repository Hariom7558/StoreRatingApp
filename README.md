# Storewise — Store Rating Management System

A full-stack store discovery and ratings app built with React, Vite, Express, and MySQL. It implements public customer signup, role-based dashboards, administrator store/user management, customer store ratings, and a store-owner review dashboard.

## Prerequisites

- Node.js 20 or later and npm
- MySQL 8.0.16 or later, running locally or reachable from this machine
- MySQL credentials with permission to create the schema and a restricted application account

MySQL was detected on the development machine, but local root authentication requires a password. No database credentials are included in this project. Configure your own MySQL credentials in `backend/.env` before starting the API.

## Project layout

```text
backend/
  schema.sql
  src/
    db.js
    middleware.js
    routes/
frontend/
  src/
    App.jsx
    api.js
    styles.css
```

## 1. Create the database and application user

From PowerShell, open the project backend folder and apply the schema. MySQL will prompt for your local MySQL administrator password:

```powershell
Set-Location D:\Hariom\StoreRatingApp\backend
cmd /c "mysql -u root -p < schema.sql"
```

Create an application user with a new password of your choice. Run this in the MySQL client, replacing the example password with your own (do not commit or share it):

```sql
CREATE USER 'store_rating_app'@'localhost' IDENTIFIED BY 'choose_a_strong_local_password';
GRANT ALL PRIVILEGES ON store_rating.* TO 'store_rating_app'@'localhost';
```

If that MySQL account already exists, update its password with your administrator account or grant the schema privileges to your existing application account. For a database hosted elsewhere, adjust the MySQL host and account host permissions accordingly. The application account only needs access to `store_rating`; schema creation is performed separately by the administrator.

The schema creates `users`, `stores`, and `ratings`, with foreign keys, timestamps, a unique user email, one owner per store, a unique rating per user/store, and a 1–5 rating constraint.

## 2. Configure the backend

```powershell
Copy-Item .env.example .env
```

Edit `backend/.env` and set `DB_PASSWORD` to the application-user password. Replace `JWT_SECRET` with a private random value of at least 32 characters. Keep `.env` private and out of source control.

Install and start the API:

```powershell
npm install
npm run dev
```

The API listens on `http://localhost:5000` by default. Test the process and database connection at `http://localhost:5000/api/health`; it returns an error if MySQL is not reachable.

## 3. Configure and start the frontend

In a second PowerShell terminal:

```powershell
Set-Location D:\Hariom\StoreRatingApp\frontend
Copy-Item .env.example .env
npm install
npm run dev
```

Open the Vite URL shown in the terminal (normally `http://localhost:5173`). `VITE_API_URL` defaults to `http://localhost:5000/api`; change it in `frontend/.env` only if the API is hosted at a different URL. `CLIENT_ORIGIN` in `backend/.env` must match the frontend origin.

## 4. Add demo data

With MySQL configured and the backend `.env` in place, open a separate terminal:

```powershell
Set-Location D:\Hariom\StoreRatingApp\backend
npm run seed
```

The seed script uses transactions, hashes passwords with bcrypt, and leaves existing demo accounts/stores/ratings unchanged. It creates these demo accounts only when their email addresses are not already present:

| Role | Email | Password for newly created accounts |
| --- | --- | --- |
| System administrator | `admin@storerating.local` | `StoreDemo1!` |
| Store owner | `owner@storerating.local` | `StoreDemo1!` |
| Normal user | `user@storerating.local` | `StoreDemo1!` |

The owner is assigned a sample bookstore and the sample customer has one rating. If a demo account already existed before seeding, its password is not changed; use the password already configured for that account.

## Role functionality

- **System administrator:** view totals; create users (normal, administrator, and store owner) and stores; optionally assign an unassigned store owner; search and sort the user/store directory; inspect user details and store-owner average ratings.
- **Normal user:** register publicly, search all stores by name/address, view overall and personal ratings, and create/update a rating from 1 through 5.
- **Store owner:** view the average and reviewers for their assigned store only.
- Every signed-in role can update their password and sign out. Public registration always creates a normal-user account; roles cannot be chosen in the signup form.

## Validation and security

- Server-side role checks protect administrator, owner, and customer APIs; owner queries are scoped to the authenticated owner's store.
- Passwords are bcrypt hashes; authenticated sessions use JWTs with an environment-configured secret and expiry.
- SQL statements use parameterized values; sort columns are chosen from fixed allowlists.
- User names are 20–60 characters; addresses are at most 400 characters; passwords are 8–16 characters and require an uppercase letter and a special character; ratings are integers from 1 through 5.
- Duplicate user/store ratings update the existing record and are also protected by a database unique constraint.
- The server has no built-in production TLS, email verification/password reset, rate limiting, or deployment-specific hardening; deploy behind HTTPS and configure production security controls before using real customer data.

## Build and smoke checks

```powershell
# API: from backend
npm install
npm test
npm run seed

# Frontend production build: from frontend
npm install
npm run build
```

For the full manual workflow, sign in as the demo administrator, create or inspect a store and its owner, sign in as the customer and submit/change a rating, then sign in as the owner and check that the review and average appear. Verify that a user cannot access administrator/owner pages and that the owner only sees their own store's ratings.

## Submission checklist

- Include the source folders, `README.md`, `backend/schema.sql`, and `.env.example` files.
- Do not submit either `.env` file, database passwords, JWT secrets, or `node_modules`.
- Set up the MySQL schema on the evaluator's machine and provide that machine's own environment values.
- Run `npm run build` in `frontend` before submission.
