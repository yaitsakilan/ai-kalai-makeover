# ✨ Kalai Makeover — AI Business Assistant

An AI-powered, comprehensive business assistant and management platform tailored for the **Kalai Makeover** beauty salon and academy. This platform helps manage day-to-day operations, including customer databases, event bookings, shop expenses, product/jewelry rental inventories, academy student logs, and staff HR management (attendance & payroll).

It features a cutting-edge **AI Voice Assistant** and **Bill Scanner (OCR)** driven by **Groq API** and **Whisper v3** to parse spoken and uploaded logs automatically.

---

## 🚀 Key Features

### 1. Unified Dashboard & Analytics
- **Financial Status**: Real-time overview of cash vs. GPay balances, monthly income, expenses, and net profit.
- **Interactive Charts**: Visualizations built with **Chart.js** detailing monthly income trends, expense categories, and service popularity.
- **Insights**: Business alerts on pending payments, upcoming bridal events, and jewelry rental returns.

### 2. AI Chat & Voice Wizard
- **Tanglish & Tamil Support**: The voice assistant transcribes and understands English, Tamil, and mixed Tamil-English (Tanglish) commands.
- **Smart Form Fill**: Speak naturally (e.g., *"Priya 9876543210 Chennai facial 1500 rating 5"*), and the **Whisper-large-v3** engine extracts variables (Name, Phone, Location, Services, Amount, Rating) to populate database records instantly.
- **AI Business Entry**: Enter raw text inputs to automatically register bookings, expenses, or update customer statuses using Groq completions.

### 3. Management Modules
- **Customers**: Log visits, services rendered, payment methods (Cash/GPay), and customer ratings.
- **Event Bookings**: Schedule bridal makeup sessions, baby showers, and outdoor events. Tracks venue locations, travel allowances, staff wages, advance payments, and pending balances.
- **General & Product Expenses**: Track recurring expenses (rent, utility bills) and salon product purchases.
- **Jewel Rental System**: Manage rental jewelry inventory. Track purchase price, rental fee logs, deposit values, return statuses, and total income generated per ornament.
- **Academy/Students**: Track academy admissions, total course fees, individual installment payments, and active student portfolios.

### 4. HR Portal (Employee Management)
- **Employee Profiles**: Complete profiles containing emergency contacts, Aadhaar card numbers, photo URLs, bank details, and monthly leave balances.
- **Attendance Tracker**: Log employee check-in and check-out times, calculate daily attendance status (Present, Absent, Late, Half-day), and monitor leave balances.
- **Payroll & Payslip Generator**: Calculate base wages, extra allowances, and deductions to generate official monthly payslips.

### 5. OCR Bill Scanner
- **Invoice Parsing**: Upload or scan invoice images. The system extracts store names, individual billing items, and total prices to log product expenses.

---

## 🛠️ Architecture & Tech Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | HTML5, Vanilla JS (ES Modules), Custom CSS | Dynamic, single-page application with responsive layouts. |
| **Styling** | Vanilla CSS | Premium design with dark-mode aesthetic, warm accent colors, glassmorphism, and responsive grids. |
| **Icons** | [Tabler Icons](https://tabler.io/icons) | Modern vector icons for dashboard and actions. |
| **Charts** | Chart.js (v4) | Renders canvas-based revenue and analytics graphs. |
| **Database** | Supabase (Postgres) | Cloud database with Row-Level Security (RLS) policies. |
| **AI Processing** | Groq API | Whisper large v3 for Speech-To-Text; Llama models for completions/parsing. |
| **Functions** | Netlify Serverless Functions | Secure server-side proxy (`groq-proxy.js`) to invoke Groq API without exposing API keys. |

---

## 📂 Project Structure

```
ai-kalai-makeover/
├── billl/                          # Main Frontend Application
│   ├── css/
│   │   └── style.css               # Core CSS & Design System
│   ├── js/
│   │   ├── pages/                  # Page-Specific Render Modules
│   │   │   ├── aichat.js           # AI Entry & Voice Parsing UI
│   │   │   ├── analytics.js        # Sales Charts & Reports
│   │   │   ├── customers.js        # Customer List & Management
│   │   │   ├── dashboard.js        # Financial Overview
│   │   │   ├── employee.js         # Staff Interface & Check-In
│   │   │   ├── employees.js        # HR Employee Settings & Payroll
│   │   │   ├── events.js           # Bridal Booking & Setup
│   │   │   ├── expenses.js         # General/Product Expenses
│   │   │   ├── jewels.js           # Jewelry Rental Inventory
│   │   │   ├── ocr.js              # Invoice OCR Capture/Upload
│   │   │   └── students.js         # Student Academy Enrollments
│   │   ├── api.js                  # Groq API Endpoints & Audio Transcriptions
│   │   ├── app.js                  # Main SPA Router & Controller
│   │   ├── db.js                   # Supabase Database Methods
│   │   ├── state.js                # Local App States
│   │   ├── ui.js                   # Toast and Overlay Components
│   │   └── voiceWizard.js          # Audio Recorder Overlay
│   ├── index.html                  # Core Template HTML
│   ├── config.js                   # Netlify Build Output (Env configuration)
│   ├── supabase_setup.sql          # Primary Database SQL setup
│   ├── employee_setup.sql          # HR System Database SQL setup
│   ├── extended_employees_migration.sql # Extended Profile Migration
│   ├── full_employee_setup_with_profile.sql # Combined setup file
│   └── password_migration.sql      # Employee Password Migration
├── netlify/
│   └── functions/
│       └── groq-proxy.js           # Netlify Serverless Groq API Proxy
├── netlify.toml                    # Netlify Build & Proxy Configuration
└── README.md                       # Documentation
```

---

## 💾 Database Setup (Supabase)

To connect the application to a live database, set up a Supabase project and execute the SQL scripts.

1. Go to your **Supabase Dashboard** and open your project.
2. Navigate to **SQL Editor** on the left menu.
3. Click **New Query** and run the scripts in the following order:
   - Run [supabase_setup.sql](file:///d:/ai-kalai-makeover/billl/supabase_setup.sql): Creates the base tables (`customers`, `events`, `expenses`, `bill_scans`, `class_enrollments`, `class_payments`, `jewels`, `jewel_rentals`, `monthly_balances`) and triggers Row-Level Security (RLS) policies.
   - Run [employee_setup.sql](file:///d:/ai-kalai-makeover/billl/employee_setup.sql): Creates employee tracking tables (`employees`, `attendance`, `payslips`).
   - Run [extended_employees_migration.sql](file:///d:/ai-kalai-makeover/billl/extended_employees_migration.sql) and [password_migration.sql](file:///d:/ai-kalai-makeover/billl/password_migration.sql): Adds custom profile details, password authentication fields, and leave tracker balances to the `employees` table.

> [!IMPORTANT]
> The database utilizes Row Level Security (RLS) policies that permit anon-key actions. Ensure that all RLS settings are configured correctly to match the policies declared in the setup SQL files.

---

## ⚙️ Configuration & Environment Variables

Configure the following environment variables on your hosting environment (Netlify) or add them to your browser local storage during development:

| Variable | Description | Location |
| :--- | :--- | :--- |
| `SUPABASE_URL` | Your Supabase Project API URL | Netlify Env / Local Storage |
| `SUPABASE_ANON_KEY` | Your Supabase Project Anon/Public API Key | Netlify Env / Local Storage |
| `GROQ_API_KEY` | Your Groq Cloud API Key | Netlify Env / Local Storage |

During build time, Netlify outputs these variables into a dynamic `config.js` script so that the frontend can read the keys as `window.SUPABASE_URL` and `window.SUPABASE_ANON_KEY`:
```bash
echo "window.GROQ_API_KEY = '$GROQ_API_KEY'; window.SUPABASE_URL = '$SUPABASE_URL'; window.SUPABASE_ANON_KEY = '$SUPABASE_ANON_KEY';" > billl/config.js
```

---

## 💻 Local Development Setup

To run the application locally:

### Prerequisites
- Install **Node.js** (v18 or higher recommended).
- Install **Netlify CLI** globally for local serverless function proxying:
  ```bash
  npm install -g netlify-cli
  ```

### Steps
1. Clone the repository and navigate to the project directory:
   ```bash
   cd ai-kalai-makeover
   ```
2. Initialize a local `.env` configuration file in the project root:
   ```env
   GROQ_API_KEY=your_groq_api_key_here
   SUPABASE_URL=your_supabase_url_here
   SUPABASE_ANON_KEY=your_supabase_anon_key_here
   ```
3. Run the development server using Netlify CLI to launch the proxy endpoints locally:
   ```bash
   netlify dev
   ```
4. Open the browser pointing to `http://localhost:8888` (or the local server address shown in the terminal output).

---

## 🚢 Netlify Deployment

1. Connect your GitHub/GitLab repository to **Netlify**.
2. Configure the **Build settings** as follows:
   - **Build command**: `echo "window.GROQ_API_KEY = '$GROQ_API_KEY'; window.SUPABASE_URL = '$SUPABASE_URL'; window.SUPABASE_ANON_KEY = '$SUPABASE_ANON_KEY';" > billl/config.js`
   - **Publish directory**: `billl`
   - **Functions directory**: `netlify/functions`
3. Navigate to **Site configuration → Environment variables** and add `GROQ_API_KEY`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY` with their corresponding production values.
4. Deploy the site. The Netlify serverless function will automatically route API requests to Groq securely.

---

## 🔒 Security Practices

- **API Key Masking**: The client application never accesses the Groq API directly. Instead, requests are forwarded through the serverless function `groq-proxy.js`.
- **Database Access**: In production, restrict table modifications using authenticated credentials or specify strict filters inside RLS templates if public/anonymous CRUD access is disabled.
- **Local Fallback Mode**: If database connections fail or are misconfigured, the frontend automatically falls back to saving updates to the user's `localStorage` and alerts the user via status toasts.
