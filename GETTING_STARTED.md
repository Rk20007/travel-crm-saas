# Getting Started - Travel CRM SaaS

Your MongoDB connection is already configured and ready to use!

## Connection Status

✅ **MongoDB URI**: `mongodb+srv://dhamakaapp99:robin12@cluster0.hnr8nsa.mongodb.net/`

The application is now connected to your MongoDB cluster at Cluster0.

## Quick Start (2 minutes)

### 1. Start the Development Server

```bash
cd /vercel/share/v0-project
pnpm dev
```

The server will start on `http://localhost:3000`

### 2. Test MongoDB Connection

Visit: `http://localhost:3000/api/test`

You should see:
```json
{
  "success": true,
  "message": "MongoDB connection successful",
  "database": "travel-crm",
  "host": "cluster0.hnr8nsa.mongodb.net"
}
```

### 3. Access the Application

- Open `http://localhost:3000`
- Click "Get Started"
- Register a new account
- Start using the dashboard!

## Default Test Account

You can create accounts directly through the registration page.

## API Endpoints

All endpoints require JWT authentication except `/api/auth/register` and `/api/auth/login`.

### Authentication
- **POST** `/api/auth/register` - Create new account
- **POST** `/api/auth/login` - Login & get JWT token

### Leads Management
- **GET** `/api/leads` - List all leads
- **POST** `/api/leads` - Create new lead
- **GET** `/api/leads/[id]` - Get lead details
- **PUT** `/api/leads/[id]` - Update lead
- **DELETE** `/api/leads/[id]` - Delete lead

### Itineraries
- **GET** `/api/itineraries` - List all itineraries
- **POST** `/api/itineraries` - Create itinerary
- **PUT** `/api/itineraries/[id]` - Update itinerary

### Bookings
- **GET** `/api/bookings` - List all bookings
- **POST** `/api/bookings` - Create booking
- **PUT** `/api/bookings/[id]` - Update booking

## How to Use Each Feature

### 1. Register & Login

```bash
# Register a new user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "name": "John Doe"
  }'

# Response:
# {
#   "message": "User created successfully",
#   "token": "eyJhbGc..."
# }
```

### 2. Create a Lead

```bash
# Use the token from registration in the header
curl -X POST http://localhost:3000/api/leads \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "Mr. Smith",
    "email": "smith@example.com",
    "phone": "+1234567890",
    "destination": "Paris",
    "budget": 5000,
    "status": "new"
  }'
```

### 3. View All Leads

```bash
curl -X GET "http://localhost:3000/api/leads?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Frontend Features

### Dashboard Pages

1. **Dashboard** (`/dashboard`)
   - Overview with stats
   - Recent activities
   - Quick actions

2. **Leads** (`/dashboard/leads`)
   - View all leads
   - Create new lead
   - Edit lead details
   - Delete leads
   - Filter by status
   - Search by name/email

3. **Itineraries** (`/dashboard/itineraries`)
   - Create itineraries
   - Plan day-by-day activities
   - Calculate costs
   - Track status

4. **Bookings** (`/dashboard/bookings`)
   - Manage bookings
   - Track booking status
   - View payment info

5. **Analytics** (`/dashboard/analytics`)
   - Conversion metrics
   - Lead statistics
   - Revenue tracking

6. **Settings** (`/dashboard/settings`)
   - Profile management
   - Team settings
   - Integration settings

## Database Collections

Your MongoDB cluster now has these collections (auto-created on first use):

```
travel-crm/
├── users          - User accounts & auth
├── leads          - Client leads
├── itineraries    - Travel plans
├── bookings       - Bookings & reservations
├── payments       - Payment records
├── teams          - Team management
├── activities     - Travel activities
└── suppliers      - Vendor management
```

## User Roles & Permissions

### Admin
- Full access to all features
- User management
- Team management
- Settings & configurations

### Manager
- Access to leads, itineraries, bookings
- Team management
- Can't delete users

### Agent
- Can only manage their own leads
- Read-only access to company data
- Can't manage team members

## Environment Variables

Your `.env.local` file is configured with:

```env
MONGODB_URI=mongodb+srv://dhamakaapp99:robin12@cluster0.hnr8nsa.mongodb.net/
JWT_SECRET=your_jwt_secret_key_change_this_in_production_min_32_chars_long
NODE_ENV=development
NEXT_PUBLIC_API_URL=http://localhost:3000
```

⚠️ **For Production**: Change `JWT_SECRET` to a secure random string!

## Common Tasks

### Logout
Click the logout button in the dashboard header or delete your JWT token from localStorage.

### Reset Password
Contact admin to reset password (implement password reset in settings).

### Export Data
Use the export buttons on each page (functionality to be added).

### Add Team Members
Go to Settings → Team to invite team members.

## Troubleshooting

### MongoDB Connection Failed
```
✗ Error: connect ENOTFOUND cluster0.hnr8nsa.mongodb.net
```
**Solution**: Check your internet connection and MongoDB cluster status on mongodb.com

### JWT Token Invalid
```
✗ Error: Invalid token
```
**Solution**: Register again or login to get a new token

### Port 3000 Already in Use
```bash
# Kill the existing process
kill 1113

# Or use a different port
pnpm dev --port 3001
```

### Components Not Loading
```bash
# Clear cache and reinstall
rm -rf .next node_modules
pnpm install
pnpm dev
```

## Next Steps

1. ✅ Register an account
2. ✅ Create your first lead
3. ✅ Build an itinerary
4. ✅ Create a booking
5. ✅ Track payments
6. ✅ View analytics
7. Integrate with WhatsApp API
8. Add email notifications
9. Setup payment gateway
10. Deploy to production

## Support Resources

- **API Documentation**: See `docs/API.md`
- **Full Documentation**: See `DOCUMENTATION.md`
- **Database Schemas**: See `models/` folder
- **Setup Guide**: See `SETUP.md`

## Deployment

When ready to deploy:

1. Update `JWT_SECRET` to a secure value
2. Update `NEXT_PUBLIC_API_URL` to your production domain
3. Deploy to Vercel with one click
4. Update MongoDB connection string if needed

## Success! 🎉

Your Travel CRM is ready to use! Start creating leads and managing travel packages.

Need help? Check the documentation files or review the API examples above.
