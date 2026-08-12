# Travel CRM API Reference

Complete API documentation for Travel CRM endpoints.

## Base URL

```
http://localhost:3000/api
```

## Authentication

All protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

Get a token by registering or logging in.

## Response Format

All endpoints return JSON responses with the following format:

### Success Response
```json
{
  "message": "Operation successful",
  "data": {},
  "status": 200
}
```

### Error Response
```json
{
  "error": "Error message",
  "status": 400
}
```

## Authentication Endpoints

### Register User

Create a new user account.

**POST** `/auth/register`

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securePassword123",
  "confirmPassword": "securePassword123"
}
```

**Response (201):**
```json
{
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "admin",
    "teamId": "507f1f77bcf86cd799439012"
  }
}
```

**Errors:**
- `400`: Missing required fields
- `409`: User already exists

---

### Login

Authenticate user and receive JWT token.

**POST** `/auth/login`

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "securePassword123"
}
```

**Response (200):**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "admin",
    "teamId": "507f1f77bcf86cd799439012"
  }
}
```

**Errors:**
- `400`: Missing email or password
- `401`: Invalid credentials

---

## Leads Endpoints

### List Leads

Get all leads for your team with pagination and filtering.

**GET** `/leads`

**Query Parameters:**
- `status` (optional): Filter by status (new, contacted, interested, negotiating, booked, completed, lost)
- `assignedTo` (optional): Filter by assigned user ID
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 10)

**Example Request:**
```bash
GET /leads?status=new&page=1&limit=10
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "leads": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "firstName": "Jane",
      "lastName": "Smith",
      "email": "jane@example.com",
      "phone": "+1234567890",
      "status": "new",
      "source": "website",
      "destinationPreference": ["Bali", "Thailand"],
      "budget": {
        "min": 5000,
        "max": 10000
      },
      "assignedTo": {
        "_id": "507f1f77bcf86cd799439012",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 42,
    "page": 1,
    "limit": 10,
    "pages": 5
  }
}
```

**Errors:**
- `401`: Unauthorized

---

### Create Lead

Add a new lead to your CRM.

**POST** `/leads`

**Required Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "email": "jane@example.com",
  "phone": "+1234567890",
  "status": "new",
  "source": "website",
  "destinationPreference": ["Bali", "Thailand"],
  "budget": {
    "min": 5000,
    "max": 10000
  },
  "travelDates": {
    "startDate": "2024-06-01T00:00:00Z",
    "endDate": "2024-06-10T00:00:00Z"
  },
  "numberOfTravelers": 2,
  "notes": "Prefers beach destinations"
}
```

**Response (201):**
```json
{
  "message": "Lead created successfully",
  "lead": {
    "_id": "507f1f77bcf86cd799439011",
    "firstName": "Jane",
    "lastName": "Smith",
    "email": "jane@example.com",
    "phone": "+1234567890",
    "status": "new",
    "source": "website",
    "destinationPreference": ["Bali", "Thailand"],
    "budget": {
      "min": 5000,
      "max": 10000
    },
    "travelDates": {
      "startDate": "2024-06-01T00:00:00Z",
      "endDate": "2024-06-10T00:00:00Z"
    },
    "numberOfTravelers": 2,
    "notes": "Prefers beach destinations",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

**Errors:**
- `400`: Invalid request body
- `401`: Unauthorized

---

### Get Single Lead

Retrieve details of a specific lead.

**GET** `/leads/:id`

**Example Request:**
```bash
GET /leads/507f1f77bcf86cd799439011
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "lead": {
    "_id": "507f1f77bcf86cd799439011",
    "firstName": "Jane",
    "lastName": "Smith",
    "email": "jane@example.com",
    "phone": "+1234567890",
    "status": "new",
    "source": "website",
    "destinationPreference": ["Bali", "Thailand"],
    "assignedTo": {
      "_id": "507f1f77bcf86cd799439012",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

**Errors:**
- `401`: Unauthorized
- `404`: Lead not found

---

### Update Lead

Modify an existing lead.

**PUT** `/leads/:id`

**Required Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:** (Send only fields you want to update)
```json
{
  "status": "contacted",
  "notes": "Updated information"
}
```

**Response (200):**
```json
{
  "message": "Lead updated successfully",
  "lead": {
    "_id": "507f1f77bcf86cd799439011",
    "firstName": "Jane",
    "lastName": "Smith",
    "email": "jane@example.com",
    "phone": "+1234567890",
    "status": "contacted",
    "source": "website",
    "notes": "Updated information",
    "updatedAt": "2024-01-15T11:00:00Z"
  }
}
```

**Errors:**
- `401`: Unauthorized
- `404`: Lead not found

---

### Delete Lead

Remove a lead from your CRM.

**DELETE** `/leads/:id`

**Example Request:**
```bash
DELETE /leads/507f1f77bcf86cd799439011
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "message": "Lead deleted successfully"
}
```

**Errors:**
- `401`: Unauthorized
- `404`: Lead not found

---

## Itineraries Endpoints

### List Itineraries

Get all itineraries with optional filtering.

**GET** `/itineraries`

**Query Parameters:**
- `leadId` (optional): Filter by lead ID
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 10)

**Response (200):**
```json
{
  "itineraries": [
    {
      "_id": "507f1f77bcf86cd799439020",
      "title": "Summer Bali Adventure",
      "destination": "Bali, Indonesia",
      "startDate": "2024-06-01T00:00:00Z",
      "endDate": "2024-06-10T00:00:00Z",
      "days": [],
      "totalCost": 3500,
      "currency": "USD",
      "perPersonCost": 1750,
      "numberOfTravelers": 2,
      "status": "draft",
      "createdBy": {
        "_id": "507f1f77bcf86cd799439012",
        "name": "John Doe"
      },
      "leadId": {
        "_id": "507f1f77bcf86cd799439011",
        "firstName": "Jane",
        "lastName": "Smith"
      },
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 15,
    "page": 1,
    "limit": 10,
    "pages": 2
  }
}
```

---

### Create Itinerary

Create a new travel itinerary.

**POST** `/itineraries`

**Request Body:**
```json
{
  "leadId": "507f1f77bcf86cd799439011",
  "title": "Summer Bali Adventure",
  "destination": "Bali, Indonesia",
  "startDate": "2024-06-01T00:00:00Z",
  "endDate": "2024-06-10T00:00:00Z",
  "numberOfTravelers": 2,
  "currency": "USD",
  "days": [
    {
      "dayNumber": 1,
      "date": "2024-06-01T00:00:00Z",
      "activities": [
        {
          "name": "Arrival & Hotel Check-in",
          "time": "14:00",
          "duration": "2 hours",
          "cost": 0
        }
      ],
      "accommodation": {
        "name": "Bali Resort",
        "checkIn": "14:00",
        "checkOut": "11:00",
        "cost": 120,
        "currency": "USD"
      },
      "meals": [
        {
          "type": "Dinner",
          "cost": 50,
          "currency": "USD"
        }
      ],
      "transportation": {
        "type": "Taxi",
        "cost": 20,
        "currency": "USD"
      }
    }
  ]
}
```

**Response (201):** Returns the created itinerary object

---

## Bookings Endpoints

### List Bookings

Get all bookings with filtering options.

**GET** `/bookings`

**Query Parameters:**
- `status` (optional): Filter by status (pending, confirmed, completed, cancelled)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 10)

**Response (200):**
```json
{
  "bookings": [
    {
      "_id": "507f1f77bcf86cd799439030",
      "bookingNumber": "BK-1705316400000-ABC123DEF",
      "leadId": {
        "_id": "507f1f77bcf86cd799439011",
        "firstName": "Jane",
        "lastName": "Smith"
      },
      "startDate": "2024-06-01T00:00:00Z",
      "endDate": "2024-06-10T00:00:00Z",
      "numberOfTravelers": 2,
      "totalAmount": 3500,
      "currency": "USD",
      "status": "confirmed",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 8,
    "page": 1,
    "limit": 10,
    "pages": 1
  }
}
```

---

### Create Booking

Create a new booking from a lead.

**POST** `/bookings`

**Request Body:**
```json
{
  "leadId": "507f1f77bcf86cd799439011",
  "itineraryId": "507f1f77bcf86cd799439020",
  "startDate": "2024-06-01T00:00:00Z",
  "endDate": "2024-06-10T00:00:00Z",
  "numberOfTravelers": 2,
  "totalAmount": 3500,
  "currency": "USD",
  "status": "pending",
  "bookingDetails": {
    "flights": [
      {
        "airline": "Qatar Airways",
        "flightNumber": "QR101",
        "departureDate": "2024-06-01T10:00:00Z",
        "seats": ["1A", "1B"],
        "price": 800
      }
    ],
    "hotels": [
      {
        "name": "Bali Resort",
        "checkInDate": "2024-06-01T14:00:00Z",
        "checkOutDate": "2024-06-10T11:00:00Z",
        "rooms": 1,
        "nights": 9,
        "price": 1200
      }
    ]
  }
}
```

**Response (201):** Returns the created booking object

---

## Data Types & Enums

### Lead Status
- `new` - New lead
- `contacted` - Lead contacted
- `interested` - Lead showed interest
- `negotiating` - In negotiation stage
- `booked` - Lead converted to booking
- `completed` - Trip completed
- `lost` - Lead lost

### Lead Source
- `website` - Website contact form
- `direct` - Direct inquiry
- `referral` - Customer referral
- `social` - Social media
- `other` - Other source

### Booking Status
- `pending` - Awaiting confirmation
- `confirmed` - Booking confirmed
- `completed` - Trip completed
- `cancelled` - Booking cancelled

### User Role
- `admin` - Full access
- `manager` - Team management and reporting
- `agent` - Lead management only

---

## Rate Limiting

API rate limits (per user per hour):
- Authentication endpoints: 10 requests
- Other endpoints: 100 requests

---

## Pagination

Endpoints with multiple results support pagination:

```
GET /leads?page=2&limit=20
```

- `page`: Starting page (default: 1)
- `limit`: Results per page (default: 10, max: 100)

Response includes:
```json
{
  "pagination": {
    "total": 42,
    "page": 2,
    "limit": 20,
    "pages": 3
  }
}
```

---

## Error Codes

| Code | Message | Description |
|------|---------|-------------|
| 400 | Bad Request | Invalid request format |
| 401 | Unauthorized | Missing or invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Duplicate entry |
| 500 | Server Error | Internal server error |

---

## Examples

### cURL

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"John","email":"john@example.com","password":"pass123","confirmPassword":"pass123"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"pass123"}'

# Get Leads
curl -X GET http://localhost:3000/api/leads \
  -H "Authorization: Bearer YOUR_TOKEN"

# Create Lead
curl -X POST http://localhost:3000/api/leads \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"firstName":"Jane","lastName":"Smith","email":"jane@example.com","status":"new","source":"website"}'
```

### JavaScript/Fetch

```javascript
// Login
const loginResponse = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'john@example.com',
    password: 'pass123'
  })
});

const { token } = await loginResponse.json();
localStorage.setItem('token', token);

// Get Leads
const leadsResponse = await fetch('/api/leads', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const { leads } = await leadsResponse.json();
console.log(leads);
```

---

## Support

For API issues or questions:
- Check this documentation
- Review error responses
- Check browser console for details
- Contact support team

Last updated: January 2024
