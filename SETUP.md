# Travel CRM - Complete Setup Guide

## Prerequisites

- **Node.js**: v18.x or v20.x (Check with `node --version`)
- **MongoDB**: v4.4+ (Local or Atlas cloud instance)
- **Package Manager**: pnpm (recommended), npm, or yarn
- **Code Editor**: VS Code or any JavaScript IDE

## Step-by-Step Installation

### 1. Clone/Download the Project

```bash
# If using git
git clone <repository-url>
cd travel-crm

# Or navigate to the project folder if already downloaded
cd travel-crm
```

### 2. Install Dependencies

Using pnpm (recommended for speed and efficiency):
```bash
pnpm install
```

Or using npm:
```bash
npm install
```

Or using yarn:
```bash
yarn install
```

### 3. Configure MongoDB

#### Option A: Local MongoDB

1. **Install MongoDB** (if not already installed)
   - macOS: `brew install mongodb-community`
   - Windows: Download from https://www.mongodb.com/try/download/community
   - Linux: `sudo apt-get install -y mongodb`

2. **Start MongoDB Service**
   - macOS/Linux: `mongod`
   - Windows: MongoDB should start automatically

3. **Verify Connection**
   ```bash
   mongosh  # Opens MongoDB shell
   ```

#### Option B: MongoDB Atlas (Cloud)

1. Go to https://www.mongodb.com/cloud/atlas
2. Create a free account
3. Create a new cluster (M0 free tier)
4. Click "Connect" and get your connection string
5. Replace `<password>` in the connection string

### 4. Set Up Environment Variables

```bash
# Copy the example file
cp .env.local.example .env.local
```

Edit `.env.local` with your configuration:

```env
# MongoDB Connection (Required)
MONGODB_URI=mongodb://localhost:27017/travel-crm
# Or for MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/travel-crm?retryWrites=true&w=majority

# JWT Secret (Change in production!)
JWT_SECRET=your-super-secret-jwt-key-change-in-production-12345

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000

# Optional: Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Optional: WhatsApp Integration
WHATSAPP_API_KEY=your-whatsapp-api-key
WHATSAPP_ACCOUNT_ID=your-account-id

# Optional: Payment Gateway
STRIPE_PUBLIC_KEY=pk_test_your_key
STRIPE_SECRET_KEY=sk_test_your_key

# Environment
NODE_ENV=development
```

### 5. Start the Development Server

```bash
pnpm dev
```

The application will be available at `http://localhost:3000`

## First-Time Setup

### 1. Create Your Account

1. Go to http://localhost:3000
2. Click "Get Started" or navigate to `/register`
3. Fill in the registration form:
   - Full Name: Your name
   - Email: Your email address
   - Password: Strong password (min 8 characters)
   - Confirm Password: Same password again
4. Click "Create Account"

### 2. Log In

1. You'll be automatically logged in and redirected to the dashboard
2. Or go to `/login` and enter your credentials

### 3. Explore the Dashboard

Welcome to the Travel CRM dashboard! Here's what you can do:

- **Overview**: See your key metrics and performance
- **Leads**: Add and manage leads
- **Bookings**: Track travel bookings
- **Analytics**: View performance metrics
- **Settings**: Configure team and preferences

## Project Structure Overview

```
travel-crm/
├── app/                        # Next.js app directory
│   ├── api/                   # API endpoints
│   │   ├── auth/              # Auth endpoints (register, login)
│   │   ├── leads/             # Lead management
│   │   ├── bookings/          # Booking management
│   │   └── itineraries/       # Itinerary creation
│   ├── dashboard/             # Dashboard pages
│   │   ├── leads/             # Lead management UI
│   │   ├── bookings/          # Booking management UI
│   │   ├── itineraries/       # Itinerary builder UI
│   │   ├── analytics/         # Analytics dashboard
│   │   └── settings/          # Settings page
│   ├── login/                 # Login page
│   ├── register/              # Registration page
│   └── page.js                # Landing page
│
├── models/                    # MongoDB schemas
│   ├── User.js
│   ├── Lead.js
│   ├── Booking.js
│   ├── Itinerary.js
│   ├── Payment.js
│   ├── Team.js
│   ├── Activity.js
│   └── Supplier.js
│
├── lib/                       # Utility functions
│   ├── mongodb.js             # MongoDB connection
│   ├── auth.js                # Auth utilities
│   └── middleware.js          # API middleware
│
├── components/                # React components
│   └── ui/                    # shadcn/ui components
│
├── public/                    # Static files
├── .env.local.example         # Environment variables template
├── next.config.mjs            # Next.js config
├── tailwind.config.ts         # Tailwind config
└── package.json               # Dependencies
```

## Common Tasks

### Add a New Lead

1. Go to Dashboard → Leads
2. Click "Add New Lead"
3. Fill in lead details:
   - First Name
   - Last Name
   - Email
   - Phone (optional)
   - Status (defaults to "new")
   - Source (where the lead came from)
4. Click "Create Lead"

### Update a Lead

1. Go to Dashboard → Leads
2. Find the lead in the list
3. Click the edit icon (pencil)
4. Update the information
5. Click "Update Lead"

### Delete a Lead

1. Go to Dashboard → Leads
2. Find the lead
3. Click the delete icon (trash)
4. Confirm deletion

### View Statistics

1. Go to Dashboard → Overview
2. See real-time stats:
   - Total Leads
   - Active Bookings
   - Conversion Rate
   - Total Revenue

## API Testing

### Using cURL

#### Register User
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "securePassword123",
    "confirmPassword": "securePassword123"
  }'
```

#### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "securePassword123"
  }'
```

#### Create Lead (requires authentication)
```bash
curl -X POST http://localhost:3000/api/leads \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "firstName": "Jane",
    "lastName": "Smith",
    "email": "jane@example.com",
    "phone": "+1234567890",
    "status": "new",
    "source": "website"
  }'
```

#### Get Leads
```bash
curl -X GET http://localhost:3000/api/leads \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Using Postman

1. Import the collection from `docs/postman-collection.json`
2. Set the token variable in Postman
3. Test endpoints directly from the UI

## Development Tips

### Hot Reload

The development server supports hot module replacement (HMR). Changes to files are automatically reflected in the browser without full page reload.

### Debug Mode

View server logs in the terminal where you ran `pnpm dev`:
```
▲ Next.js 16.2.4
  ▽ ready - started server on 0.0.0.0:3000, url: http://localhost:3000
```

### Database Inspection

View MongoDB data using MongoDB Compass:
1. Download from https://www.mongodb.com/products/compass
2. Connect with: `mongodb://localhost:27017`
3. Browse collections and documents

## Troubleshooting

### "Cannot find module 'mongoose'"

Solution:
```bash
pnpm install
# or
npm install
```

### "MongoDB connection failed"

Check:
1. MongoDB is running: `ps aux | grep mongod`
2. Connection string in `.env.local`
3. MongoDB is accessible: `mongosh`

### "JWT_SECRET is not defined"

Solution: Add `JWT_SECRET` to `.env.local`

### Port 3000 already in use

Use a different port:
```bash
pnpm dev -- -p 3001
```

Then access at `http://localhost:3001`

### Build errors

Clear cache and rebuild:
```bash
rm -rf .next
pnpm build
```

## Production Deployment

### Before Deploying

1. **Change JWT_SECRET** to a strong random value
2. **Use MongoDB Atlas** instead of local MongoDB
3. **Set NODE_ENV=production**
4. **Configure SMTP** for email notifications
5. **Add STRIPE_SECRET_KEY** for payments

### Deploy to Vercel

1. Push code to GitHub
2. Go to https://vercel.com
3. Click "New Project"
4. Select your GitHub repository
5. Add environment variables
6. Click "Deploy"

### Deploy to Other Platforms

See [DEPLOYMENT.md](./docs/DEPLOYMENT.md) for detailed instructions for:
- AWS
- Heroku
- DigitalOcean
- Self-hosted servers

## Next Steps

1. **Customize Branding**: Update colors and logo
2. **Add Email Service**: Configure SMTP for notifications
3. **Integrate Payments**: Set up Stripe
4. **Team Management**: Invite users and assign roles
5. **Advanced Features**: Implement itinerary builder, WhatsApp integration

## Getting Help

- Check [README.md](./README.md) for feature documentation
- Read [API documentation](./docs/API.md)
- Check GitHub Issues for similar problems
- Contact support team

## Security Best Practices

1. **Never commit `.env.local`** to version control
2. **Use strong JWT_SECRET** in production (32+ characters)
3. **Enable 2FA** on production MongoDB
4. **Use HTTPS** only in production
5. **Regularly update dependencies**: `pnpm update`
6. **Monitor API logs** for suspicious activity

## Performance Tips

1. Use **pnpm** instead of npm (faster, more efficient)
2. Enable **Turbopack** (default in Next.js 16)
3. Use **MongoDB indexes** for large datasets
4. Cache API responses with **Redis** (optional)
5. Optimize **images** with Next.js Image component

Happy coding! 🚀
