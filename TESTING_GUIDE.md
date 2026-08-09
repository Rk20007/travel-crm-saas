# Testing Guide - Travel CRM SaaS

Complete guide to testing all features of your Travel CRM application.

## Preparation

Your application is already configured with MongoDB. Just start it!

```bash
cd /vercel/share/v0-project
pnpm dev
```

Then open: http://localhost:3000

---

## Test 1: MongoDB Connection

**Goal**: Verify MongoDB is connected and working

### Steps:
1. Open http://localhost:3000/api/test
2. You should see:
```json
{
  "success": true,
  "message": "MongoDB connection successful",
  "database": "travel-crm",
  "host": "cluster0.hnr8nsa.mongodb.net"
}
```

✅ **PASS** if you see success: true

---

## Test 2: User Registration

**Goal**: Create a new user account

### Using Web Interface:
1. Go to http://localhost:3000
2. Click "Get Started" button
3. Fill in:
   - Email: test1@example.com
   - Password: Test123!@
   - Name: Test User
4. Click "Create Account"
5. Should redirect to dashboard

### Using API (cURL):
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test1@example.com",
    "password": "Test123!@",
    "name": "Test User"
  }'
```

**Expected Response**:
```json
{
  "message": "User created successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

✅ **PASS** if you get a token

---

## Test 3: User Login

**Goal**: Authenticate with existing account

### Using Web Interface:
1. Go to http://localhost:3000/login
2. Enter:
   - Email: test1@example.com
   - Password: Test123!@
3. Click "Sign In"
4. Should show dashboard

### Using API (cURL):
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test1@example.com",
    "password": "Test123!@"
  }'
```

**Expected Response**:
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

✅ **PASS** if you get a token and can access dashboard

---

## Test 4: Create a Lead

**Goal**: Add a new lead to the system

### Using Web Interface:
1. Login to dashboard
2. Go to "Leads" page
3. Click "Add New Lead" button
4. Fill in:
   - Name: John Smith
   - Email: john@example.com
   - Phone: +1234567890
   - Destination: Paris
   - Budget: 5000
   - Status: New
5. Click "Create Lead"
6. Should see the lead in the list

### Using API (cURL):
```bash
# First, get a token from login
TOKEN="your_token_here"

curl -X POST http://localhost:3000/api/leads \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "John Smith",
    "email": "john@example.com",
    "phone": "+1234567890",
    "destination": "Paris",
    "budget": 5000,
    "status": "new",
    "source": "website",
    "travelDate": "2024-06-01"
  }'
```

**Expected Response**:
```json
{
  "message": "Lead created successfully",
  "lead": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "John Smith",
    "email": "john@example.com",
    "status": "new",
    ...
  }
}
```

✅ **PASS** if lead appears in dashboard/database

---

## Test 5: View All Leads

**Goal**: Fetch all leads with pagination

### Using Web Interface:
1. Dashboard → Leads page
2. Should see list of all leads
3. Test pagination (next/previous)

### Using API (cURL):
```bash
TOKEN="your_token_here"

# Get first 10 leads
curl -X GET "http://localhost:3000/api/leads?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN"

# Get leads with filter
curl -X GET "http://localhost:3000/api/leads?status=new&limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response**:
```json
{
  "leads": [
    {
      "_id": "...",
      "name": "John Smith",
      "email": "john@example.com",
      ...
    }
  ],
  "total": 5,
  "page": 1,
  "limit": 10
}
```

✅ **PASS** if you can see leads list with correct pagination

---

## Test 6: Get Lead Details

**Goal**: Fetch a specific lead

### Using Web Interface:
1. Dashboard → Leads
2. Click on any lead name
3. Should show full lead details

### Using API (cURL):
```bash
TOKEN="your_token_here"
LEAD_ID="507f1f77bcf86cd799439011"  # From create test

curl -X GET "http://localhost:3000/api/leads/$LEAD_ID" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response**:
```json
{
  "lead": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "John Smith",
    "email": "john@example.com",
    "phone": "+1234567890",
    "destination": "Paris",
    "budget": 5000,
    "status": "new",
    "source": "website",
    "assignedTo": "...",
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T10:00:00Z"
  }
}
```

✅ **PASS** if you get full lead details

---

## Test 7: Update a Lead

**Goal**: Modify existing lead details

### Using Web Interface:
1. Dashboard → Leads
2. Click edit icon on a lead
3. Change some fields (e.g., status to "qualified")
4. Click "Save"
5. Should see updated values

### Using API (cURL):
```bash
TOKEN="your_token_here"
LEAD_ID="507f1f77bcf86cd799439011"

curl -X PUT "http://localhost:3000/api/leads/$LEAD_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "status": "qualified",
    "budget": 6000,
    "notes": "Client interested in luxury packages"
  }'
```

**Expected Response**:
```json
{
  "message": "Lead updated successfully",
  "lead": {
    "_id": "507f1f77bcf86cd799439011",
    "status": "qualified",
    "budget": 6000,
    ...
  }
}
```

✅ **PASS** if changes are saved and reflected

---

## Test 8: Delete a Lead

**Goal**: Remove a lead from the system

### Using Web Interface:
1. Dashboard → Leads
2. Click delete icon on a lead
3. Confirm deletion
4. Lead should disappear from list

### Using API (cURL):
```bash
TOKEN="your_token_here"
LEAD_ID="507f1f77bcf86cd799439011"

curl -X DELETE "http://localhost:3000/api/leads/$LEAD_ID" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response**:
```json
{
  "message": "Lead deleted successfully"
}
```

✅ **PASS** if lead is removed from database

---

## Test 9: Create an Itinerary

**Goal**: Build a travel itinerary

### Using Web Interface:
1. Dashboard → Itineraries
2. Click "Create Itinerary"
3. Fill in:
   - Title: Paris Trip 2024
   - Destination: Paris, France
   - StartDate: 2024-06-01
   - EndDate: 2024-06-05
   - Budget: 5000
4. Add days:
   - Day 1: Arrive, Hotel check-in
   - Day 2: Eiffel Tower, Museum
   - Day 3: Shopping, Dinner
   - Day 4: Day trip to Versailles
   - Day 5: Depart
5. Click "Save Itinerary"

### Using API (cURL):
```bash
TOKEN="your_token_here"

curl -X POST http://localhost:3000/api/itineraries \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "Paris Trip 2024",
    "destination": "Paris, France",
    "startDate": "2024-06-01",
    "endDate": "2024-06-05",
    "budget": 5000,
    "currency": "EUR",
    "days": [
      {
        "dayNumber": 1,
        "title": "Arrival",
        "activities": ["Hotel check-in"],
        "cost": 150
      },
      {
        "dayNumber": 2,
        "title": "Sightseeing",
        "activities": ["Eiffel Tower", "Louvre Museum"],
        "cost": 200
      }
    ]
  }'
```

✅ **PASS** if itinerary is created and visible in dashboard

---

## Test 10: Create a Booking

**Goal**: Create a booking from a lead

### Using Web Interface:
1. Dashboard → Bookings
2. Click "New Booking"
3. Select Lead: John Smith
4. Select Itinerary: Paris Trip 2024
5. Fill in:
   - Passengers: 2
   - TravelDate: 2024-06-01
   - Status: Confirmed
6. Click "Create Booking"

### Using API (cURL):
```bash
TOKEN="your_token_here"
LEAD_ID="..."
ITINERARY_ID="..."

curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "leadId": "'$LEAD_ID'",
    "itineraryId": "'$ITINERARY_ID'",
    "travelDate": "2024-06-01",
    "passengers": 2,
    "totalCost": 5000,
    "status": "confirmed",
    "specialRequests": "Window seats preferred"
  }'
```

✅ **PASS** if booking appears in system

---

## Test 11: Dashboard Overview

**Goal**: Verify dashboard displays correctly

### Steps:
1. Login to dashboard
2. Check dashboard displays:
   - [ ] Total leads count
   - [ ] Conversion rate
   - [ ] Recent leads list
   - [ ] Quick action buttons
   - [ ] Welcome message
   - [ ] Navigation menu

✅ **PASS** if all elements visible and functional

---

## Test 12: Settings Page

**Goal**: Test user settings

### Steps:
1. Dashboard → Settings
2. Check all tabs load:
   - [ ] Profile tab
   - [ ] Team tab  
   - [ ] Integrations tab
   - [ ] Preferences tab
3. Try updating profile info
4. Changes should save

✅ **PASS** if settings page works properly

---

## Test 13: Analytics Dashboard

**Goal**: View analytics and metrics

### Steps:
1. Dashboard → Analytics
2. Should display:
   - [ ] Lead statistics chart
   - [ ] Conversion metrics
   - [ ] Revenue data
   - [ ] Team performance
3. Charts should load without errors

✅ **PASS** if analytics page displays correctly

---

## Test 14: Authentication Error Handling

**Goal**: Test invalid authentication scenarios

### Test Cases:
```bash
# Test 1: Missing token
curl -X GET http://localhost:3000/api/leads

# Should return: 401 Unauthorized

# Test 2: Invalid token
curl -X GET http://localhost:3000/api/leads \
  -H "Authorization: Bearer invalid_token_here"

# Should return: 401 Invalid token

# Test 3: Expired token
# (Would need to test after token expires or manipulate token)

# Test 4: Wrong password
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "wrongpassword"
  }'

# Should return: 401 Invalid credentials
```

✅ **PASS** if proper error messages returned

---

## Test 15: Input Validation

**Goal**: Test form validation

### Test Cases:
1. **Register with invalid email**
   - Email: notanemail
   - Should show error: "Invalid email format"

2. **Register with weak password**
   - Password: 123
   - Should show error: "Password too weak"

3. **Create lead with missing fields**
   - Submit without name
   - Should show error: "Name is required"

4. **Create lead with invalid budget**
   - Budget: abc
   - Should show error: "Budget must be a number"

✅ **PASS** if validation works on all forms

---

## Performance Tests

### Test Response Times:
```bash
TOKEN="your_token_here"

# Time lead list fetch
time curl -X GET "http://localhost:3000/api/leads" \
  -H "Authorization: Bearer $TOKEN"

# Time single lead fetch
time curl -X GET "http://localhost:3000/api/leads/607f1f77bcf86cd799439011" \
  -H "Authorization: Bearer $TOKEN"

# Time lead creation
time curl -X POST http://localhost:3000/api/leads \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{...}'
```

**Expected Performance**:
- API calls: < 200ms
- Database queries: < 100ms
- Page loads: < 500ms

✅ **PASS** if responses are fast

---

## Responsive Design Test

### Mobile (375px width):
1. Open http://localhost:3000 on mobile or use DevTools
2. Check:
   - [ ] Layout is responsive
   - [ ] Navigation works
   - [ ] Forms are usable
   - [ ] Tables are scrollable

### Tablet (768px width):
1. Check intermediate layout
2. All features visible and usable

### Desktop (1920px width):
1. Check full layout
2. All elements properly aligned

✅ **PASS** if layout responsive on all sizes

---

## Database Tests

### Check Collections Created:
```bash
# Connect to MongoDB and verify
db.users.count()           # Should have at least 1
db.leads.count()           # Should have leads created
db.itineraries.count()     # Should have itineraries
db.bookings.count()        # Should have bookings
```

✅ **PASS** if all collections exist and contain data

---

## Complete Test Checklist

- [ ] MongoDB connection test
- [ ] User registration
- [ ] User login
- [ ] Create lead
- [ ] View all leads
- [ ] Get lead details
- [ ] Update lead
- [ ] Delete lead
- [ ] Create itinerary
- [ ] Create booking
- [ ] Dashboard overview
- [ ] Settings page
- [ ] Analytics page
- [ ] Authentication errors
- [ ] Input validation
- [ ] Performance (< 200ms)
- [ ] Mobile responsive
- [ ] Database collections

---

## Success! 

If all tests pass, your Travel CRM is fully functional and ready for:
- Development
- Further customization
- Production deployment
- User testing

## Support

If any test fails:
1. Check error message carefully
2. Verify environment variables are set
3. Check MongoDB connection
4. Review relevant code file
5. Check documentation

Enjoy your Travel CRM! 🎉
