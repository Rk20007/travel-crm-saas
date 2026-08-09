# Quick Start Guide - Travel CRM

Get your Travel CRM up and running in 5 minutes!

## Prerequisites
- Node.js 18+ installed
- MongoDB running (local or Atlas)
- Code editor (VS Code recommended)

## 5-Minute Setup

### Step 1: Install (1 minute)
```bash
cd travel-crm
pnpm install
```

### Step 2: Configure (2 minutes)
```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```env
MONGODB_URI=mongodb://localhost:27017/travel-crm
JWT_SECRET=change-this-to-random-key-12345
```

### Step 3: Run (1 minute)
```bash
pnpm dev
```

### Step 4: Access (1 minute)
- Open http://localhost:3000
- Click "Get Started"
- Register your account
- Start using the dashboard!

## Features at a Glance

### 🔐 Authentication
- User registration with password
- Secure login
- JWT token authentication
- 3 user roles (Admin, Manager, Agent)

### 👥 Lead Management
- Create leads (First name, Last name, Email, Phone)
- Assign to team members
- Track status (new → booked → completed)
- Filter and search leads
- Edit and delete leads

### 📋 Dashboard
- Overview with key metrics
- Lead count
- Booking status
- Quick action buttons

### 🏗️ Architecture
- **Frontend**: Next.js + React + Tailwind CSS
- **Backend**: Next.js API routes
- **Database**: MongoDB
- **Auth**: JWT tokens

## API Endpoints

### Auth
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Sign in

### Leads
- `GET /api/leads` - List all leads
- `POST /api/leads` - Create lead
- `GET /api/leads/:id` - Get one lead
- `PUT /api/leads/:id` - Update lead
- `DELETE /api/leads/:id` - Delete lead

### Other
- `GET /api/itineraries` - List itineraries
- `POST /api/itineraries` - Create itinerary
- `GET /api/bookings` - List bookings
- `POST /api/bookings` - Create booking

## Example API Usage

### Register
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "securePass123",
    "confirmPassword": "securePass123"
  }'
```

### Login & Get Token
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "securePass123"
  }'
# Response includes "token" - copy this!
```

### Create Lead (use token from login)
```bash
curl -X POST http://localhost:3000/api/leads \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "firstName": "Jane",
    "lastName": "Smith",
    "email": "jane@example.com",
    "phone": "+1234567890",
    "status": "new",
    "source": "website"
  }'
```

### Get All Leads
```bash
curl -X GET "http://localhost:3000/api/leads?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## File Structure

```
travel-crm/
├── app/
│   ├── api/                # API endpoints
│   ├── dashboard/          # Dashboard pages
│   ├── login/              # Login page
│   ├── register/           # Register page
│   └── page.js             # Home page
├── models/                 # MongoDB schemas
├── lib/                    # Utilities
├── .env.local.example      # Environment template
└── README.md               # Full documentation
```

## Common Tasks

### Add a Lead via UI
1. Go to Dashboard → Leads
2. Click "Add New Lead"
3. Fill in details
4. Click "Create Lead"

### Find a Lead
1. Go to Dashboard → Leads
2. Use search box
3. Or filter by status

### Update a Lead
1. Go to Dashboard → Leads
2. Find the lead
3. Click edit (pencil icon)
4. Update and save

### Delete a Lead
1. Go to Dashboard → Leads
2. Find the lead
3. Click delete (trash icon)
4. Confirm

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `Cannot find module` | Run `pnpm install` |
| `MongoDB connection failed` | Check MongoDB is running |
| `Port 3000 in use` | Run `pnpm dev -- -p 3001` |
| `JWT_SECRET not defined` | Add to `.env.local` |
| `Build fails` | Run `rm -rf .next && pnpm build` |

## Environment Variables

Essential:
```env
MONGODB_URI=mongodb://localhost:27017/travel-crm
JWT_SECRET=your-random-secret-key
```

Optional:
```env
NEXT_PUBLIC_API_URL=http://localhost:3000
NODE_ENV=development
```

## Project Size

- Total files: 50+
- Total lines: 5000+
- Build time: <6 seconds
- Bundle size: Optimized for production

## Next Steps

1. ✅ Get it running - **DONE**
2. 📝 Read the full README.md
3. 🔍 Explore API Reference (docs/API.md)
4. 🎨 Customize colors and branding
5. ⛓️ Connect to MongoDB Atlas
6. 🚀 Deploy to Vercel

## Database Schemas

System comes with 8 pre-configured MongoDB schemas:

1. **User** - User accounts and roles
2. **Lead** - Lead information
3. **Itinerary** - Travel itineraries
4. **Booking** - Travel bookings
5. **Payment** - Payment tracking
6. **Team** - Team management
7. **Activity** - Travel activities
8. **Supplier** - Vendor information

All schemas are production-ready with proper indexing.

## Useful Commands

```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run linter
pnpm lint

# Clean build cache
rm -rf .next

# Check MongoDB
mongosh
```

## Features Implemented

✅ User registration & login
✅ JWT authentication
✅ Lead CRUD operations
✅ Role-based access control
✅ Multi-tenant architecture
✅ Responsive design
✅ API with pagination
✅ Error handling
✅ Dashboard UI
✅ MongoDB integration
✅ Password hashing
✅ Token validation

## Deployment

Deploy to Vercel in 1 click:
1. Push code to GitHub
2. Go to https://vercel.com
3. Click "New Project"
4. Select repository
5. Add environment variables
6. Deploy!

For other platforms, see SETUP.md

## Need Help?

- 📖 Read README.md - Full documentation
- 📚 Check docs/API.md - API reference
- 🛠️ See SETUP.md - Detailed setup
- 📋 Review PROJECT_SUMMARY.md - What's included

## Version Info

- **Next.js**: 16.2.4
- **React**: 19
- **Node**: 18+
- **MongoDB**: 4.4+
- **Status**: Production Ready

---

**That's it!** You now have a production-ready Travel CRM.

Start by creating some leads and exploring the dashboard.

Happy coding! 🚀
