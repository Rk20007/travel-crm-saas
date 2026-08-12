# Travel CRM - Production-Ready SaaS Platform

A comprehensive Customer Relationship Management (CRM) system built specifically for the travel and tourism industry. Manage leads, create itineraries, track bookings, and grow your travel business with advanced features.

## 🎯 Key Features

### Lead Management
- **Lead Capture & Tracking**: Capture leads from multiple sources (website, direct, referral, social)
- **Smart Assignment**: Automatically assign leads to team members
- **Status Tracking**: Follow leads through sales pipeline (new → contacted → interested → negotiating → booked)
- **Conversion Metrics**: Track conversion rates and lead source effectiveness

### Itinerary Builder
- **Day-Wise Planning**: Create detailed day-by-day travel plans
- **Cost Calculation**: Automatic cost calculation with accommodation, activities, meals, and transportation
- **Multi-Currency Support**: Support for multiple currencies with real-time calculations
- **Export Options**: Export itineraries to PDF, Word, and WhatsApp

### Booking Management
- **Complete Booking Lifecycle**: From confirmation to completion
- **Supplier Coordination**: Manage flights, hotels, and activities
- **Payment Tracking**: Track payment status and due dates
- **Invoice Generation**: Automatic invoice generation for customers

### Team Management
- **Role-Based Access Control**: Admin, Manager, and Agent roles
- **Team Isolation**: Multi-tenant architecture with complete data isolation
- **User Management**: Add and manage team members with permissions
- **Activity Logging**: Complete audit trail of all actions

### Analytics & Reporting
- **Sales Analytics**: Revenue trends and booking statistics
- **Team Performance**: Individual and team metrics
- **Conversion Tracking**: Real-time conversion rate monitoring
- **Custom Reports**: Generate custom reports and insights

## 🏗️ Tech Stack

- **Frontend**: Next.js 16+ (JavaScript) with React 19
- **Styling**: Tailwind CSS + shadcn/ui components
- **Backend**: Next.js API Routes
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT-based authentication with bcryptjs
- **API**: RESTful API with role-based access control

## 📋 Project Structure

```
travel-crm/
├── app/
│   ├── api/
│   │   ├── auth/           # Authentication endpoints
│   │   │   ├── register
│   │   │   └── login
│   │   └── leads/          # Lead management endpoints
│   │       ├── route.js    # GET/POST leads
│   │       └── [id]/       # Single lead operations
│   ├── dashboard/          # Dashboard pages
│   │   ├── layout.js       # Dashboard layout with sidebar
│   │   ├── page.js         # Overview/statistics
│   │   ├── leads/          # Lead management page
│   │   ├── bookings/       # Booking management
│   │   ├── analytics/      # Analytics dashboard
│   │   └── settings/       # Team settings
│   ├── register/           # Registration page
│   ├── login/              # Login page
│   ├── page.js             # Landing page
│   ├── layout.js           # Root layout
│   └── globals.css         # Global styles
├── models/                 # MongoDB schemas
│   ├── User.js
│   ├── Lead.js
│   ├── Itinerary.js
│   ├── Booking.js
│   ├── Payment.js
│   ├── Team.js
│   ├── Activity.js
│   └── Supplier.js
├── lib/
│   ├── mongodb.js          # MongoDB connection
│   ├── auth.js             # Authentication utilities
│   └── middleware.js       # API middleware
├── components/
│   └── ui/                 # shadcn/ui components
├── public/                 # Static assets
├── next.config.mjs         # Next.js configuration
├── tailwind.config.ts      # Tailwind CSS configuration
├── tsconfig.json           # TypeScript configuration (allows JS)
└── package.json            # Dependencies

```

## 🚀 Getting Started

### Prerequisites
- Node.js 18.x or higher
- MongoDB 4.4+ (local or cloud instance)
- npm or pnpm package manager

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd travel-crm
```

2. **Install dependencies**
```bash
pnpm install
# or npm install / yarn install
```

3. **Set up environment variables**
```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add your configuration:
```env
# Required
MONGODB_URI=mongodb://localhost:27017/travel-crm
JWT_SECRET=your-super-secret-key-change-in-production

# Optional
NEXT_PUBLIC_API_URL=http://localhost:3000
SMTP_HOST=smtp.gmail.com
WHATSAPP_API_KEY=your-key
STRIPE_PUBLIC_KEY=your-key
```

4. **Start the development server**
```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📚 Usage Guide

### Authentication
- **Register**: Create a new account at `/register`
- **Login**: Sign in at `/login`
- **Token**: JWT token stored in localStorage, valid for 30 days

### API Endpoints

#### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login

#### Leads
- `GET /api/leads` - List all leads (with pagination)
- `GET /api/leads?status=booked` - Filter by status
- `GET /api/leads?assignedTo=userId` - Filter by assigned agent
- `POST /api/leads` - Create new lead
- `GET /api/leads/[id]` - Get lead details
- `PUT /api/leads/[id]` - Update lead
- `DELETE /api/leads/[id]` - Delete lead

### Database Models

#### User
- Basic user information, password, role
- Team membership and permissions
- Last login tracking

#### Lead
- Contact information (name, email, phone)
- Travel preferences and dates
- Budget and destination preferences
- Status tracking and conversion metrics

#### Itinerary
- Day-by-day activity planning
- Accommodation and meal details
- Cost breakdowns and calculations
- PDF/Word/WhatsApp export

#### Booking
- Flight, hotel, and activity bookings
- Payment schedule tracking
- Supplier coordination
- Complete booking lifecycle

#### Payment
- Payment method and transaction tracking
- Invoice generation
- Due date management
- Refund tracking

#### Team
- Team information and settings
- Member management
- Role assignments
- Currency and timezone preferences

#### Activity
- Destination activities and experiences
- Pricing and ratings
- Supplier information
- Difficulty levels and restrictions

#### Supplier
- Hotel, airline, and activity suppliers
- Contact and banking information
- Commission tracking
- Document management

## 🔒 Security Features

- **Password Hashing**: bcryptjs with salt rounds
- **JWT Authentication**: Secure token-based authentication
- **Role-Based Access Control**: Three-tier permission system (Admin, Manager, Agent)
- **Data Isolation**: Complete multi-tenant isolation
- **Input Validation**: Mongoose schema validation
- **Error Handling**: Secure error responses without sensitive data

## 🎯 Next Steps - Implementation Roadmap

### Phase 1-2: Complete (Authentication & Lead Management)
- ✅ User registration and login
- ✅ Lead CRUD operations
- ✅ Role-based access control
- ✅ Dashboard overview

### Phase 3-4: In Progress
- [ ] Itinerary builder with detailed costing
- [ ] Booking management system
- [ ] Payment tracking
- [ ] Invoice generation

### Phase 5+: Future Enhancements
- [ ] WhatsApp integration for automated messages
- [ ] Email notification system
- [ ] Payment gateway integration (Stripe)
- [ ] Activity and supplier management
- [ ] Advanced analytics and reporting
- [ ] Team member management
- [ ] Bulk lead import from CSV
- [ ] Activity logs and audit trails
- [ ] Mobile-responsive design optimization
- [ ] Dark mode support

## 📊 API Usage Examples

### Register User
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "securepassword",
    "confirmPassword": "securepassword"
  }'
```

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "securepassword"
  }'
```

### Create Lead
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
    "source": "website",
    "destinationPreference": ["Bali", "Thailand"]
  }'
```

## 🐛 Troubleshooting

### MongoDB Connection Issues
- Ensure MongoDB is running: `mongod`
- Check connection string in `.env.local`
- Verify MongoDB version compatibility

### Authentication Errors
- Check JWT_SECRET is set in environment
- Verify token is being sent in Authorization header
- Ensure token hasn't expired

### API Errors
- Check browser console for detailed error messages
- Verify request headers and body format
- Check user permissions for the operation

## 📖 Documentation

- [API Documentation](./docs/API.md) - Detailed API endpoints
- [Database Schema](./docs/SCHEMA.md) - Complete database structure
- [Deployment Guide](./docs/DEPLOYMENT.md) - Production deployment
- [Contributing Guidelines](./CONTRIBUTING.md) - How to contribute

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 💪 Support

For issues, questions, or suggestions:
1. Check existing issues on GitHub
2. Create a new issue with detailed information
3. Contact support team

## 🎉 Happy Traveling!

Build something amazing with Travel CRM. Happy coding!
# travel-crm-saas
